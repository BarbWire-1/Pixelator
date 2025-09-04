/*
MIT License
Copyright(c) 2025 Barbara Kälin aka BarbWire - 1
*/
// TODO SEPARATE DRAWING FROM LOGIC FROM LAYERING!!!!

//TODO recolors BACK if using color to brush.... very strange
// TODO way too much colors, NOT SORTED AT ALL

import { snapshot } from "../../main.js";
import { DrawingTool } from "../DrawingTool.js";




import { Layer } from "../Layer.js";
import { upscaleClusteredData } from "./ClusteredDataUtils.js";





//=========================
// CANVAS MANAGER
//=========================
export class CanvasManager {
	constructor (canvas) {

		this.tool = undefined
		this.canvas = canvas;
		this.canvas.width = 400;
		this.canvas.height = 400;
		this.ctx = canvas.getContext("2d", { willReadFrequently: true });
		this.ctx.imageSmoothingEnabled = false;



		this.tempCanvas = document.createElement("canvas");
		this.tempCtx = this.tempCanvas.getContext("2d", { willReadFrequently: true });

		this.layers = [];
		this.activeLayer = null;

		this.toggleGrid = false;
		this.tileSize = 1;

		this.startTime = performance.now();
		this.logEntries = [];
		this.showLogs = true;

		this.allOpaque = false;
		this.kMeansIterations = 1;
		this.worker = null;
		this.colorCount = 16;
		this.renderMetrics = {};
	}

	// --------------------
	// Logging
	// --------------------
	log(message) {
		if (!this.showLogs) return;
		const elapsed = ((performance.now() - this.startTime) / 1000).toFixed(3);
		this.logEntries.push({ time: new Date().toLocaleTimeString(), elapsed: parseFloat(elapsed), message });
	}
	clearLogs() { this.logEntries = []; }
	getLogs() { return this.logEntries; }

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
			const imageData = tempCanvas.getContext("2d").getImageData(0, 0, tempCanvas.width, tempCanvas.height);
			const handler = (e) => {
				const { success, palette, clusters, clusteredData, uniqueCount, error } = e.data;
				if (success) resolve({ palette, clusters, clusteredData, uniqueCount });
				else reject(new Error(error));
				this.worker.removeEventListener("message", handler);
			};
			this.worker.addEventListener("message", handler);
			this.worker.postMessage({ imageData, colorCount, iterations: this.kMeansIterations, allOpaque: this.allOpaque });
		});
	}

	// --------------------
	// Canvas helpers
	// --------------------
	_drawToCtx(ctx, img, width, height, smoothing = false) {
		if (ctx.canvas.width !== width || ctx.canvas.height !== height) {
			ctx.canvas.width = width;
			ctx.canvas.height = height;
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
		this.layers = [];

		this._drawToCtx(this.ctx, img, targetW, targetH, false);
		const imageData = this.ctx.getImageData(0, 0, targetW, targetH);

		this.canvas.width = targetW;
		this.canvas.height = targetH;

		const original = new Layer(targetW, targetH, "BG Image", img);
		original.imageData = new ImageData(new Uint8ClampedArray(imageData.data), targetW, targetH);
		original.ctx.putImageData(original.imageData, 0, 0);
		original.opacity = 0.5;

		const base = new Layer(targetW, targetH, "PX Layer", img);
		base.imageData = new ImageData(new Uint8ClampedArray(imageData.data), targetW, targetH);
		base.ctx.putImageData(base.imageData, 0, 0);
		base.rawImage = img;

		this.layers.push(original, base);
		this.activeLayer = base;

		this.redraw();
		this.log(`Image loaded: ${img.width}x${img.height}`);
		return base;
	}

	// --------------------
	// Render Metrics (computed on demand)
	// --------------------
	updateRenderMetrics() {
    if (!this.activeLayer) return;

    const rect = this.canvas.getBoundingClientRect();
    const canvasW = this.canvas.width;
    const canvasH = this.canvas.height;

    // Always derived from tileSize
    const tempW = Math.ceil(canvasW / this.tileSize);
    const tempH = Math.ceil(canvasH / this.tileSize);

    const scaleX = canvasW / rect.width;
    const scaleY = canvasH / rect.height;

    this.renderMetrics = { canvasW, canvasH, rectW: rect.width, rectH: rect.height, scaleX, scaleY, tempW, tempH };
}



	// --------------------
	// Canvas drawing
	// --------------------
	setContainerDimensions(img) {
		const maxSize = 800;
		const ratio = img.width / img.height;
		let targetW, targetH;

		if (ratio > 1) { targetW = maxSize; targetH = Math.round(maxSize / ratio); }
		else { targetH = maxSize; targetW = Math.round(maxSize * ratio); }

		this.dimensions = { width: targetW, height: targetH, ratio };
		this.resizeCanvas(targetW, targetH);
		return { targetW, targetH };
	}

	resizeCanvas(width, height) { this.canvas.width = width; this.canvas.height = height; }

	redraw() {
		if (!this.layers.length) return;
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		for (const layer of this.layers) layer.drawTo(this.ctx);
		if (this.toggleGrid) this.drawGrid();
	}

	drawGrid() {
		if (!this.activeLayer || !this.renderMetrics) return;

const ctx = this.ctx;
const { canvasW, canvasH, scaleX, scaleY, tempW, tempH } = this.renderMetrics;

ctx.strokeStyle = "#0c0c0cff";
ctx.lineWidth = 1 * scaleX;

// Vertical lines
for (let i = 0; i <= tempW; i++) {
	const x = Math.round((i * canvasW) / tempW - 0.5);
	ctx.beginPath();
	ctx.moveTo(x, 0);
	ctx.lineTo(x, canvasH);
	ctx.stroke();
}

// Horizontal lines
for (let i = 0; i <= tempH; i++) {
	const y = Math.round((i * canvasH) / tempH - 0.5);
	ctx.beginPath();
	ctx.moveTo(0, y);
	ctx.lineTo(canvasW, y);
	ctx.stroke();
}

	}

	// --------------------
	// Quantization
	// --------------------
	// quantizeImage() also uses renderMetrics
async quantizeImage() {
    if (!this.activeLayer) return;
    this.updateRenderMetrics();
    const { tempW, tempH, canvasW, canvasH } = this.renderMetrics;

    const tempCanvas = await this.timedLog("Quantize Temp Canvas", async () =>
        this.createTempCanvas(this.activeLayer.rawImage, tempW, tempH, false)
    );

    const { palette, clusteredData, uniqueCount, clusters } = await this.timedLog("kMeans Quantization", async () =>
        this.runQuantizationInWorker(tempCanvas, this.colorCount)
    );

    Object.assign(this.activeLayer, { clusteredData, tempWidth: tempW, tempHeight: tempH, colors: palette, clusters });
    this.activeLayer.applyClusteredData(clusteredData, tempW, tempH, this.tileSize);

    this.log(`quantizeImage done, totalPixels=${canvasW * canvasH}, uniqueColors=${uniqueCount}, palette=${palette.length}`);
}


	applyTileSize() {
		const layer = this.activeLayer;
		if (!layer || !layer.clusteredData) return;
		layer.applyClusteredData(layer.clusteredData, layer.tempWidth, layer.tempHeight, this.tileSize);
		this.redraw();
		this.log(`applyTileSize: done, tileSize=${this.tileSize}`);
	}

	async applyQuantizeAndTile() {
		const t0 = performance.now();
		await this.quantizeImage();
		this.applyTileSize();
		this.log(`applyQuantizeAndTile: done in ${(performance.now() - t0).toFixed(2)} ms`);
	}

	// --------------------
	// Download / Export
	// --------------------
	downloadImage(targetW, targetH) {
		if (!this.activeLayer) return;
		const layer = this.activeLayer;
		const tempCanvas = document.createElement("canvas");
		tempCanvas.width = targetW;
		tempCanvas.height = targetH;
		const tctx = tempCanvas.getContext("2d");

		if (layer.clusteredData && layer.tempWidth && layer.tempHeight) {
			const imgData = upscaleClusteredData(layer.clusteredData, layer.tempWidth, layer.tempHeight, targetW, targetH);
			tctx.putImageData(imgData, 0, 0);
		} else {
			if (targetW === layer.width && targetH === layer.height) tctx.putImageData(layer.imageData, 0, 0);
			else tctx.drawImage(layer.canvas, 0, 0, targetW, targetH);
		}

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

	async timedLog(label, fn) { const t0 = performance.now(); const result = await fn(); this.log(`${label}: done in ${(performance.now() - t0).toFixed(2)} ms`); return result; }
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