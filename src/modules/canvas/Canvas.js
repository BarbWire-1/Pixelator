/*
MIT License
Copyright(c) 2025 Barbara Kälin aka BarbWire - 1
*/
// TODO SEPARATE DRAWING FROM LOGIC FROM LAYERING!!!!

//TODO recolors BACK if using color to brush.... very strange
// TODO way too much colors, NOT SORTED AT ALL

import { snapshot } from "../../main.js";




import { Layer } from "../Layer.js";
import { upscaleClusteredData } from "./ClusteredDataUtils.js";





//=========================
// CANVAS MANAGER
//=========================
export class CanvasManager {
	constructor (canvas) {
		this.canvas = canvas;
		this.canvas.width = 400;
		this.canvas.height = 400;
		this.ctx = canvas.getContext("2d", { willReadFrequently: true });
		this.ctx.imageSmoothingEnabled= false;
		// Reusable tempCanvas
		this.tempCanvas = document.createElement("canvas");
		this.tempCtx = this.tempCanvas.getContext("2d", { willReadFrequently: true });


		//this.drawingLayer = new Layer(this.canvas.width, this.canvas.height, "Drawing", null)
		//this.layers = [ this.drawingLayer ];

		//this.activeLayer = this.drawingLayer;

		this.layers = [];
		this.activeLayer = null;

		this.toggleGrid = false;
		this.tileSize = 1;
		this.rawImage = null;

		this.startTime = performance.now();
		this.logEntries = [];


		this.showLogs = true;
		this.allOpaque = false;

		this.liveUpdate = false;

		this.kMeansIterations = 1;
		this.worker = null;
		this.colorCount = 16;
	}

	// --------------------
	// Logging
	// --------------------
	log(message) {
		if (!this.showLogs) return;
		const elapsed = ((performance.now() - this.startTime) / 1000).toFixed(3);
		this.logEntries.push({
			time: new Date().toLocaleTimeString(),
			elapsed: parseFloat(elapsed),
			message
		});
	}
	getLogs() { return this.logEntries; }
	clearLogs() { this.logEntries = []; }

	// --------------------
	// Worker
	// --------------------
	initWorker() {
		if (!this.worker) {
			this.worker = new Worker(new URL("./quantizeWorker.js", import.meta.url), { type: "module" });
		}
	}

	runQuantizationInWorker(tempCanvas, colorCount) {
		return new Promise((resolve, reject) => {
			this.initWorker();
			const ctx = tempCanvas.getContext("2d");
			const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);

			const handler = (e) => {
				const { success, palette, clusters,clusteredData, uniqueCount, error } = e.data;
				if (success) resolve({ palette, clusters,clusteredData, uniqueCount });
				else reject(new Error(error));
				this.worker.removeEventListener("message", handler);
			};

			this.worker.addEventListener("message", handler);
			// pass allOpaque flag to the worker
			this.worker.postMessage({
				imageData,
				colorCount,

				iterations: this.kMeansIterations,
				allOpaque: this.allOpaque
			});
		});
	}


	// --------------------
	// Canvas helpers
	// --------------------
	_drawToCtx(ctx, img, width, height, smoothing = false) {
		const c = ctx.canvas;
		if (c.width !== width || c.height !== height) {
			c.width = width;
			c.height = height;
		}
		ctx.imageSmoothingEnabled = smoothing;
		ctx.clearRect(0, 0, width, height);
		ctx.drawImage(img, 0, 0, width, height);
		return ctx;
	}

	createTempCanvas(img, width, height, smoothing = false, stepName = "Temp Canvas") {
		const start = performance.now();

		this._drawToCtx(this.tempCtx, img, width, height, smoothing);

		this.log(`${stepName} done in ${(performance.now() - start).toFixed(2)} ms`);
		return this.tempCanvas;
	}




	// --------------------
	// Image Loading
	// --------------------
	async loadImage(img) {
		const { targetW, targetH } = this.setContainerDimensions(img);
// 		// ✅ stretch the Drawing layer to match the new dimensions
// 		if (this.drawingLayer) {
// 			// capture existing sketch
// 			const oldCanvas = this.drawingLayer.canvas;
// 			const oldImg = new Image();
// 			oldImg.src = oldCanvas.toDataURL();
//
// 			// resize drawingLayer canvas
// 			this.drawingLayer.canvas.width = targetW;
// 			this.drawingLayer.canvas.height = targetH;
// 			this.drawingLayer.width = targetW;
// 			this.drawingLayer.height = targetH;
//
// 			// redraw old sketch stretched into new size
// 			oldImg.onload = () => {
// 				this.drawingLayer.ctx.drawImage(oldImg, 0, 0, targetW, targetH);
// 				this.redraw();
// 			};
// 		}

		this.layers = []
		// Draw scaled image
		this._drawToCtx(this.ctx, img, targetW, targetH, false);
		const imageData = this.ctx.getImageData(0, 0, targetW, targetH);


		this.canvas.width = targetW;
		this.canvas.height = targetH
		// Original Image (display only, semi-transparent)
		const original = new Layer(targetW, targetH, "BG Image", img);
		original.imageData = new ImageData(
			new Uint8ClampedArray(imageData.data),
			imageData.width,
			imageData.height
		);
		original.ctx.putImageData(original.imageData, 0, 0);
		original.opacity = 0.5;

		// Base Layer (working copy)
		const base = new Layer(targetW, targetH, "PX Layer", img);
		base.imageData = new ImageData(
			new Uint8ClampedArray(imageData.data),
			imageData.width,
			imageData.height
		);
		base.ctx.putImageData(base.imageData, 0, 0);

		// Keep raw image reference for quantization
		base.rawImage = img;

		// Assign layers
		[ original, base ].forEach(l => this.layers.push(l));
		this.activeLayer = base;

		this.redraw();


		this.log(`Image loaded: ${img.width}x${img.height}`);
		return base;
	}



	setContainerDimensions(img) {
		//const container = document.getElementById("canvas-container");
		const margin = 0;
		const maxSize = 800;

		// aspect ratio
		const ratio = img.width / img.height;

		let targetW, targetH;

		if (ratio > 1) {
			// wider than tall → width = max, scale height
			targetW = maxSize;
			targetH = Math.round(maxSize / ratio);
		} else {
			// taller than wide → height = max, scale width
			targetH = maxSize;
			targetW = Math.round(maxSize * ratio);
		}

		this.dimensions = { width: targetW, height: targetH, ratio };
		this.resizeCanvas(targetW, targetH);

		return { targetW, targetH };
	}



	// --------------------
	// Canvas drawing
	// --------------------
	resizeCanvas(width, height) {
		this.canvas.width = width;
		this.canvas.height = height;
	}

	redraw() {
		if (!this.layers.length) return;

		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		for (const layer of this.layers) {
			layer.drawTo(this.ctx); // <- uses layer.canvas, opacity, visibility
		}

		if (this.toggleGrid) this.drawGrid();

	}


	drawGrid() {
	if (!this.activeLayer) return;

	const ctx = this.ctx;
	const rect = this.canvas.getBoundingClientRect(); // CSS size
	const scaleX = this.canvas.width / rect.width;
	const scaleY = this.canvas.height / rect.height;

	const w = this.canvas.width;
	const h = this.canvas.height;

	const tempW = this.activeLayer.tempWidth || Math.floor(rect.width / this.tileSize) || 1;
	const tempH = this.activeLayer.tempHeight || Math.floor(rect.height / this.tileSize) || 1;


	ctx.strokeStyle = "#0c0c0cff";
	ctx.lineWidth = 1 * scaleX; // scale lineWidth

	// Vertical lines
	for (let i = 0; i <= tempW; i++) {
		const x = Math.round((i * rect.width) / tempW) * scaleX + 0.5;
		ctx.beginPath();
		ctx.moveTo(x, 0);
		ctx.lineTo(x, h);
		ctx.stroke();
	}

	// Horizontal lines
	for (let i = 0; i <= tempH; i++) {
		const y = Math.round((i * rect.height) / tempH) * scaleY + 0.5;
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(w, y);
		ctx.stroke();
	}
}




	// Utility wrapper
	async timedLog(label, fn) {
		const t0 = performance.now();
		const result = await fn();
		const elapsed = (performance.now() - t0).toFixed(2);
		this.log(`${label}: done in ${elapsed} ms`);
		return result;
	}

	// --------------------
	// Quantize only
	// --------------------
	async quantizeImage() {
		if (!this.activeLayer || !this.dimensions) return;

		//this.activeLayer.opacity = 1;
		const { width: canvasW, height: canvasH } = this.dimensions;
		const layer = this.activeLayer;

		// Always start from the raw image
		const source = layer.rawImage;
		if (!source) {
			this.log("No rawImage available for quantization.");
			return;
		}

		// Downscale
		const downscaledWidth = this.tileSize === 1 ? canvasW : Math.ceil(canvasW / this.tileSize);
		const downscaledHeight = this.tileSize === 1 ? canvasH : Math.ceil(canvasH / this.tileSize);

		// Step 1: Create temporary canvas
		const tempCanvas = await this.timedLog("Quantize Temp Canvas", async () => {
			return this.createTempCanvas(source, downscaledWidth, downscaledHeight, false);
		});

		// Step 2: Run quantization
		const { palette, clusteredData, uniqueCount , clusters} = await this.timedLog("kMeans Quantization", async () => {
			return this.runQuantizationInWorker(tempCanvas, this.colorCount);
		});

		// Step 3: Store result on layer
		Object.assign(layer, {
			clusteredData,
			tempWidth: downscaledWidth,
			tempHeight: downscaledHeight,
			colors: palette,
			clusters

		});
		//console.log(clusters)

		// Step 4: Apply clustered data
		layer.applyClusteredData(clusteredData, downscaledWidth, downscaledHeight, this.tileSize);

		// Step 5: Log
		const totalPixels = canvasW * canvasH;
		this.log(`quantizeImage: done, totalPixels=${totalPixels}, uniqueColors=${uniqueCount}, palette=${palette.length}`);
	}

	// --------------------
	// Apply tiling only (uses previously clustered data)
	// --------------------
	applyTileSize() {
		const layer = this.activeLayer;
		if (!layer || !layer.clusteredData) return;

		// No need to re-quantize here, just update tiling
		layer.applyClusteredData(layer.clusteredData, layer.tempWidth, layer.tempHeight, this.tileSize);

		this.redraw();
		this.log(`applyTileSize: done, tileSize=${this.tileSize}`);
	}

	// --------------------
	// Quantize + Tile (convenience)
	// --------------------
	async applyQuantizeAndTile() {
		const t0 = performance.now();
		await this.quantizeImage(); // generates clustered data
		this.applyTileSize();       // applies tiling
		this.log(`applyQuantizeAndTile: done in ${(performance.now() - t0).toFixed(2)} ms`);


	}


	// --------------------
	// Download / Export
	// --------------------
	downloadImage(targetWidth, targetHeight) {
		if (!this.activeLayer) return;

		const tempCanvas = document.createElement("canvas");
		tempCanvas.width = targetWidth;
		tempCanvas.height = targetHeight;
		const tctx = tempCanvas.getContext("2d");

		const layer = this.activeLayer;

		if (layer.clusteredData && layer.tempWidth && layer.tempHeight) {
			// ---- Export crisp pixelated result ----

			const imgData = upscaleClusteredData(
				layer.clusteredData,
				layer.tempWidth,
				layer.tempHeight,
				targetWidth,
				targetHeight
			);
			tctx.putImageData(imgData, 0, 0);

		} else {
			// ---- Fallback: export the canvas content ----
			if (targetWidth === layer.width && targetHeight === layer.height) {
				tctx.putImageData(layer.imageData, 0, 0);
			} else {
				tctx.drawImage(layer.canvas, 0, 0, targetWidth, targetHeight);
			}
		}

		// save as PNG
		tempCanvas.toBlob(blob => {
			if (!blob) return;
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = "pixelatorrr.png";
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
			this.log("IMAGE DOWNLOADED");
		}, "image/png");
	}

}

function upscaleImageData(srcData, srcW, srcH, targetW, targetH) {
	const tmp = new ImageData(targetW, targetH);
	for (let y = 0; y < targetH; y++) {
		const srcY = Math.floor(y * srcH / targetH);
		for (let x = 0; x < targetW; x++) {
			const srcX = Math.floor(x * srcW / targetW);
			const srcIdx = (srcY * srcW + srcX) * 4;
			const dstIdx = (y * targetW + x) * 4;
			tmp.data[ dstIdx ] = srcData[ srcIdx ];
			tmp.data[ dstIdx + 1 ] = srcData[ srcIdx + 1 ];
			tmp.data[ dstIdx + 2 ] = srcData[ srcIdx + 2 ];
			tmp.data[ dstIdx + 3 ] = srcData[ srcIdx + 3 ];
		}
	}
	return tmp;
}


// =====================
// HISTORY SUPPORT
// =====================
// CanvasManager.prototype.getState = function () {
// 	return {
// 		activeLayer: this.activeLayer
// 			? {
// 				width: this.activeLayer.width,
// 				height: this.activeLayer.height,
// 				data: new Uint8ClampedArray(this.activeLayer.imageData.data)
// 			}
// 			: null,
// 		tileSize: this.tileSize,
// 		colorCount: this.colorCount,
// 		toggleGrid: this.toggleGrid
// 	};
// };
//
// CanvasManager.prototype.setState = function (state) {
// 	if (state.activeLayer) {
// 		this.activeLayer = {
// 			width: state.activeLayer.width,
// 			height: state.activeLayer.height,
// 			imageData: new ImageData(
// 				new Uint8ClampedArray(state.activeLayer.data),
// 				state.activeLayer.width,
// 				state.activeLayer.height
// 			)
// 		};
// 		this.resizeCanvas(state.activeLayer.width, state.activeLayer.height);
// 	}
// 	this.tileSize = state.tileSize;
// 	this.colorCount = state.colorCount;
// 	this.toggleGrid = state.toggleGrid;
// 	this.redraw();
// };
CanvasManager.prototype.getState = function () {
	return {
		tileSize: this.tileSize,
		colorCount: this.colorCount,
		toggleGrid: this.toggleGrid,
		activeIndex: this.layers.indexOf(this.activeLayer),
		layers: this.layers.map(layer => ({
			name: layer.name,
			width: layer.width,
			height: layer.height,
			imageData: new ImageData(new Uint8ClampedArray(layer.imageData.data), layer.width, layer.height),
			clusteredData: layer.clusteredData ? [ ...layer.clusteredData ] : null,
			opacity: layer.opacity ?? 1,
			hidden: layer.hidden ?? false,
			// **keep rawImage reference, but never mutate it**
			rawImage: layer.rawImage || null
		}))
	};
};

CanvasManager.prototype.setState = function (state) {
	if (!state || !state.layers) return;

	// Restore layer properties in-place
	state.layers.forEach((savedLayer, idx) => {
		const layer = this.layers[ idx ];
		if (!layer) return;

		layer.width = savedLayer.width;
		layer.height = savedLayer.height;
		layer.opacity = savedLayer.opacity ?? 1;
		layer.hidden = savedLayer.hidden ?? false;

		// Keep rawImage intact
		layer.imageData.data.set(savedLayer.imageData.data);
		layer.ctx.putImageData(layer.imageData, 0, 0);

		layer.clusteredData = savedLayer.clusteredData ? [ ...savedLayer.clusteredData ] : null;
	});

	// Restore active layer by index
	this.activeLayer = this.layers[ state.activeIndex ] || this.layers[ 0 ];

	this.tileSize = state.tileSize;
	this.colorCount = state.colorCount;
	this.toggleGrid = state.toggleGrid;

	this.redraw();
};
/*
// Create an offscreen canvas for the grid
this.gridCanvas = document.createElement('canvas');
this.gridCanvas.width = this.canvas.width;
this.gridCanvas.height = this.canvas.height;
const gridCtx = this.gridCanvas.getContext('2d');

// Draw the grid once
function drawGridOffscreen() {
	const rect = this.canvas.getBoundingClientRect();
	const w = rect.width;
	const h = rect.height;

	const tempW = this.activeLayer.tempWidth || Math.floor(w / this.tileSize) || 1;
	const tempH = this.activeLayer.tempHeight || Math.floor(h / this.tileSize) || 1;

	const scaleX = this.gridCanvas.width / w;
	const scaleY = this.gridCanvas.height / h;

	gridCtx.clearRect(0, 0, this.gridCanvas.width, this.gridCanvas.height);
	gridCtx.strokeStyle = "#0c0c0cff";
	gridCtx.lineWidth = 0.2 * ((scaleX + scaleY) / 2);

	// Vertical lines
	for (let i = 0; i <= tempW; i++) {
		const x = Math.round((i * w) / tempW) + 0.5;
		gridCtx.beginPath();
		gridCtx.moveTo(x * scaleX, 0);
		gridCtx.lineTo(x * scaleX, this.gridCanvas.height);
		gridCtx.stroke();
	}

	// Horizontal lines
	for (let i = 0; i <= tempH; i++) {
		const y = Math.round((i * h) / tempH) + 0.5;
		gridCtx.beginPath();
		gridCtx.moveTo(0, y * scaleY);
		gridCtx.lineTo(this.gridCanvas.width, y * scaleY);
		gridCtx.stroke();
	}
}

// Later, blit the grid onto your overlay canvas
function renderOverlay() {
	this.ctx.drawImage(this.gridCanvas, 0, 0);
}
*/