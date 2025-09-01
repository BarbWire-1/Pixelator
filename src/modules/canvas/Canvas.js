/*
MIT License
Copyright(c) 2025 Barbara Kälin aka BarbWire - 1
*/
// TODO SEPARATE DRAWING FROM LOGIC FROM LAYERING!!!!
// TODO HOW to handle colorChanges to quantize new????

import { Layer } from "../Layer.js";


//=========================
// CANVAS MANAGER
//=========================
export class CanvasManager {
	constructor (canvas, MAXW = 1920, MAXH = 1080){ // max canvas height) {
		this.canvas = canvas;
		this.canvas.MAXW = MAXW;
		this.canvas.MAXH = MAXH;
		this.ctx = canvas.getContext("2d", { willReadFrequently: true });
		this.originalLayer = null;
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
		const { targetW, targetH } = this.setContainerDimensions(img);

		const tempCanvas = this.createTempCanvas(img, targetW, targetH, false);
		const imageData = tempCanvas.getContext("2d").getImageData(0, 0, targetW, targetH);


		const layerNames = [ "Original Image", "Base Layer" ];
		this.layers = layerNames.map(name => {
			const layer = new Layer(targetW, targetH, name, img);
			// create a copy of the imageData for each layer
			layer.imageData = new ImageData(
				new Uint8ClampedArray(imageData.data),
				imageData.width,
				imageData.height
			);
			layer.ctx.putImageData(layer.imageData, 0, 0); // bake imageData into canvas
			return layer;
		});

		this.activeLayer = this.layers[ 1 ]; // Base Layer active
		//TODO for testing only - implement ranges and checkboxes for visibility per layer
		this.layers[ 0 ].opacity = 0;

		this.redraw();



		this.log(`Image loaded: ${img.width}x${img.height}, scaled to ${targetW}x${targetH} in ${(performance.now() - start).toFixed(2)} ms`);
	}


	setContainerDimensions(img) {
		const container = document.getElementById("canvas-container");
		const margin = 100;
const {MAXW,MAXH} = this.canvas
		// Calculate ratio to fit container
		let ratio = Math.min(container.clientWidth / img.width, container.clientHeight / img.height);

		// Apply the ratio to image dimensions
		let targetW = Math.round(img.width * ratio) - margin;
		let targetH = Math.round(img.height * ratio) - margin;

		// Enforce maximum dimensions
		if (targetW >this.canvas. MAXW) {
			const scale = MAXW / targetW;
			targetW = MAXW;
			targetH = Math.round(targetH * scale);
		}
		if (targetH > MAXH) {
			const scale = MAXH / targetH;
			targetH = MAXH;
			targetW = Math.round(targetW * scale);
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
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		// Draw original layer first
		if (this.originalLayer?.visible) this.originalLayer.drawTo(this.ctx);

		// Draw all other layers
		for (const layer of this.layers) {
			if (layer === this.originalLayer) continue; // already drawn
			layer.drawTo(this.ctx);
		}

		if (this.toggleGrid) this.drawGrid();
	}




	drawGrid() {
		if (!this.activeLayer) return;
		const ctx = this.ctx;
		const w = this.canvas.width;
		const h = this.canvas.height;

		// Determine number of columns/rows
		const tempW = this.activeLayer.tempWidth || Math.floor(w / this.tileSize) || 1;
		const tempH = this.activeLayer.tempHeight || Math.floor(h / this.tileSize) || 1;

		ctx.strokeStyle = "#4b4b4b";
		ctx.lineWidth = 1;

		// Draw vertical lines
		for (let i = 0; i <= tempW; i++) {
			const x = Math.round((i * w) / tempW);
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, h);
			ctx.stroke();
		}

		// Draw horizontal lines
		for (let i = 0; i <= tempH; i++) {
			const y = Math.round((i * h) / tempH);
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
		const { palette, clusteredData, uniqueCount, clusters } = await this.timedLog("kMeans Quantization", async () => {
			return this.runQuantizationInWorker(tempCanvas, this.colorCount);
		});

		// Step 3: Store palette & clustered data
		await this.timedLog("Store clustered data", async () => {

			Object.assign(layer, {
				clusteredData,
				tempWidth: downscaledWidth,
				tempHeight: downscaledHeight,
				colors: palette,
				clusters
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
