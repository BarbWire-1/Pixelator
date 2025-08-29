/*
MIT License
Copyright(c) 2025 Barbara Kälin aka BarbWire - 1
*/
// TODO SEPARATE DRAWING FROM LOGIC FROM LAYERING!!!!
// TODO HOW to handle colorChanges to quantize new????

import { snapshot } from "../../main.js";




import { Layer } from "../Layer.js";
//=========================
// CANVAS MANAGER
//=========================
export class CanvasManager {
	constructor (canvas) {
		this.canvas = canvas;
		this.ctx = canvas.getContext("2d", { willReadFrequently: true });
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
		const tempCanvas = document.createElement("canvas");
		this._drawToCtx(tempCanvas.getContext("2d"), img, width, height, smoothing);
		this.log(`${stepName} done in ${(performance.now() - start).toFixed(2)} ms`);
		return tempCanvas;
	}

	createDimensionCanvas(width, height) {
		const tempCanvas = document.createElement("canvas");
		tempCanvas.width = width;
		tempCanvas.height = height;
		return { tempCanvas, tctx: tempCanvas.getContext("2d") };
	}

	// --------------------
	// Image Loading
	// --------------------
	async loadImage(img) {
		const start = performance.now();
// TODO later draw on layer ctx - now only virtual
		const { targetW, targetH } = this.setContainerDimensions(img);
		this._drawToCtx(this.ctx, img, targetW, targetH, false);
		const imageData = this.ctx.getImageData(0, 0, targetW, targetH);

		// Create a new base layer that owns the raw image
		const layer = new Layer(targetW, targetH, "Base Layer", img);
		layer.imageData = imageData;

		this.layers = [ layer ];
		this.activeLayer = layer;
		this.redraw();

		this.log(`Image loaded: ${img.width}x${img.height}, scaled to ${targetW}x${targetH} in ${(performance.now() - start).toFixed(2)} ms`);
		return layer;
	}


	setContainerDimensions(img) {
		const container = document.getElementById("canvas-container");
		const margin = 100;
		const ratio = Math.min(container.clientWidth / img.width, container.clientHeight / img.height);

		const targetW = Math.round(img.width * ratio) - margin;
		const targetH = Math.round(img.height * ratio) - margin;

		this.dimensions = { width: targetW, height: targetH, ratio };
		this.resizeCanvas(targetW, targetH);

		return { targetW, targetH };
	}

	// prepareCanvasForImage(img) {
	// 	const start = performance.now();
	// 	const { targetW, targetH } = this.setContainerDimensions(img);
	// 	this.ctx.imageSmoothingEnabled = false;
	// 	this.ctx.clearRect(0, 0, targetW, targetH);
	// 	this.log(`Step 1 (prepare canvas) done in ${(performance.now() - start).toFixed(2)} ms`);
	// 	return { targetW, targetH };
	// }

	// drawImageOnCanvas(img, width, height) {
	// 	const start = performance.now();
	// 	this._drawToCtx(this.ctx, img, width, height, false);
	// 	const imageData = this.ctx.getImageData(0, 0, width, height);
	// 	this.log(`Step 2 (draw image) done in ${(performance.now() - start).toFixed(2)} ms`);
	// 	return imageData;
	// }

	// createBaseLayer(width, height, imageData) {
	// 	const start = performance.now();
	// 	const layer = new Layer(width, height, "Base Layer");
	// 	layer.imageData = imageData;
	// 	this.layers = [ layer ];
	// 	this.activeLayer = layer;
	// 	this.log(`Step 3 (create base layer) done in ${(performance.now() - start).toFixed(2)} ms`);
	// 	return layer;
	// }

	// --------------------
	// Canvas drawing
	// --------------------
	resizeCanvas(width, height) {
		this.canvas.width = width;
		this.canvas.height = height;
	}

	redraw() {
		if (!this.activeLayer) return;
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.ctx.putImageData(this.activeLayer.imageData, 0, 0);
		if (this.toggleGrid) this.drawGrid();
	}

	drawGrid() {
		const ctx = this.ctx;
		const w = this.canvas.width;
		const h = this.canvas.height;
		const ts = this.tileSize;

		ctx.strokeStyle = "#4b4b4b";
		ctx.lineWidth = 1;

		// vertical lines
		for (let x = 0; x <= w; x += ts) {
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, h);
			ctx.stroke();
		}

		// horizontal lines
		for (let y = 0; y <= h; y += ts) {
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(w, y);
			ctx.stroke();
		}
	}


	// --------------------
	// Quantize only
	// --------------------
	// Utility wrapper
	async timedLog(label, fn) {
		const t0 = performance.now();
		const result = await fn();
		const elapsed = (performance.now() - t0).toFixed(2);
		this.log(`${label}: done in ${elapsed} ms`);
		return result;
	}

	// --------------------
	// Quantize only with step logging
	// --------------------
	async quantizeImage() {
		if (!this.activeLayer || !this.dimensions) return;

		const { width: canvasW, height: canvasH } = this.dimensions;
		const { rawImage } = this.activeLayer;
		const layer = this.activeLayer;

		// Determine downscaled size for kMeans
		const downscaledWidth = this.tileSize === 1 ? canvasW : Math.ceil(canvasW / this.tileSize);
		const downscaledHeight = this.tileSize === 1 ? canvasH : Math.ceil(canvasH / this.tileSize);

		// Step 1: Create temporary downscaled canvas
		const tempCanvas = await this.timedLog("Quantize Temp Canvas", async () => {
			return this.createTempCanvas(rawImage, downscaledWidth, downscaledHeight, false);
		});

		// Step 2: Run kMeans quantization
		const { palette, clusteredData, uniqueCount } = await this.timedLog("kMeans Quantization", async () => {
			return this.runQuantizationInWorker(tempCanvas, this.colorCount);
		});

		// Step 3: Store palette & clustered data
		await this.timedLog("Store clustered data", async () => {
			layer.colorClusters = palette.map(color => ({ color }));
			Object.assign(layer, {
				clusteredData,
				tempWidth: downscaledWidth,
				tempHeight: downscaledHeight,
				colors: palette
			});
		});

		// Step 4: Apply clustered data (upscale if needed)
		await this.timedLog("Apply clustered data", async () => {
			layer.applyClusteredData(clusteredData, downscaledWidth, downscaledHeight, this.tileSize);
		});

		// Step 5: Final log
		const totalPixels = canvasW * canvasH;
		this.log(`quantizeImage: done, totalPixels: ${totalPixels}, uniqueColors: ${uniqueCount}, new palette length: ${palette.length}`);
	}




	// --------------------
	// Apply tiling only (uses previously clustered data)
	// --------------------
	applyTileSize() {
		const layer = this.activeLayer;
		if (!layer || !layer.clusteredData) return;

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

		const { tempCanvas, tctx } = this.createDimensionCanvas(targetWidth, targetHeight);

		if (targetWidth === this.activeLayer.width && targetHeight === this.activeLayer.height) {
			tctx.putImageData(this.activeLayer.imageData, 0, 0);
		} else {
			const origCanvas = document.createElement("canvas");
			origCanvas.width = this.activeLayer.width;
			origCanvas.height = this.activeLayer.height;
			origCanvas.getContext("2d").putImageData(this.activeLayer.imageData, 0, 0);
			tctx.drawImage(origCanvas, 0, 0, targetWidth, targetHeight);
		}

		tempCanvas.toBlob(blob => {
			if (!blob) return;
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = 'pixelatorrr.png';
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
			this.log("IMAGE DOWNLOADED");
		}, "image/png");
	}
}

// =====================
// HISTORY SUPPORT
// =====================
CanvasManager.prototype.getState = function () {
	return {
		activeLayer: this.activeLayer
			? {
				width: this.activeLayer.width,
				height: this.activeLayer.height,
				data: new Uint8ClampedArray(this.activeLayer.imageData.data)
			}
			: null,
		tileSize: this.tileSize,
		colorCount: this.colorCount,
		toggleGrid: this.toggleGrid
	};
};

CanvasManager.prototype.setState = function (state) {
	if (state.activeLayer) {
		this.activeLayer = {
			width: state.activeLayer.width,
			height: state.activeLayer.height,
			imageData: new ImageData(
				new Uint8ClampedArray(state.activeLayer.data),
				state.activeLayer.width,
				state.activeLayer.height
			)
		};
		this.resizeCanvas(state.activeLayer.width, state.activeLayer.height);
	}
	this.tileSize = state.tileSize;
	this.colorCount = state.colorCount;
	this.toggleGrid = state.toggleGrid;
	this.redraw();
};

CanvasManager.prototype.reQuantize = async function ({
	useRaw = true,
	tileSize = this.tileSize,
	colorCount = this.colorCount,
	preservePalette = false
} = {}) {
	const sourceImg = useRaw ? this.rawImage : this.activeLayer;
	if (!sourceImg) return;

	const tempCanvas = this.createTempCanvas(
		sourceImg,
		(this.dimensions.width / tileSize),
		(this.dimensions.height / tileSize)
	);

	let clusteredData, palette;
	if (preservePalette && this.activeLayer?.colors?.length) {
		palette = this.activeLayer.colors;
		clusteredData = mapPixelsToPalette(tempCanvas, palette);
	} else {
		({ palette, clusteredData } = await this.runQuantizationInWorker(tempCanvas, colorCount));
	}

	const layer = this.mapClusteredToLayer(clusteredData, this.dimensions.width, this.dimensions.height, tileSize);

	this.layers.push(layer);
	this.activeLayer = layer;
	layer.colors = palette;
	this.redraw();

	this.log(`Re-quantized using ${preservePalette ? 'existing palette' : colorCount + ' colors'}`);
};
