/*
MIT License
Copyright(c) 2025 Barbara Kälin aka BarbWire - 1
*/
// TODO SEPARATE DRAWING FROM LOGIC FROM LAYERING!!!!
// TODO HOW to handle colorChanges to quantize new????

import { snapshot } from "../../main.js";

// FULLY IMPLEMENT THIS
export const messages = {
	LOAD_IMAGE: (ctx) => `2 Image loaded: ${ctx.rawImage?.width}x${ctx.rawImage?.height}, scaled to ${ctx.dimensions?.width}x${ctx.dimensions?.height}`,
	LOAD_IMAGE_COMPLETE: (ctx) => `Task "loadImage" completed in ${((performance.now() - ctx._taskStart)?.toFixed(2)) || 0} ms`,
	PREPARE_CANVAS: (ctx) => `Step 1 (prepare canvas) done in ${((performance.now() - ctx._taskStart)?.toFixed(2)) || 0} ms`,
	DRAW_IMAGE: (ctx) => `Step 2 (draw image) done in ${((performance.now() - ctx._taskStart)?.toFixed(2)) || 0} ms`,
	TEMP_CANVAS: (ctx) => `${ctx._stepName || "Temp Canvas"} done in ${((performance.now() - ctx._taskStart)?.toFixed(2)) || 0} ms`,
	BASE_LAYER: (ctx) => `Step 3 (create base layer) done in ${((performance.now() - ctx._taskStart)?.toFixed(2)) || 0} ms`,
	QUANTIZATION_START: (ctx) => `Starting quantization and tiling with colorCount=${ctx.colorCount}, tileSize=${ctx.tileSize}`,
	QUANTIZATION_DONE: (ctx) => `Step 2 (quantize in ${ctx.kMeansIterations} iterations) done in ${((performance.now() - ctx._taskStart)?.toFixed(2)) || 0} ms`,
	UNIQUE_COLORS: (ctx) => `Unique colors found: ${ctx._uniqueCount || 0}`,
	PALETTE_LENGTH: (ctx) => `Palette length after quantization: ${ctx._paletteLength || 0}`,
	MAP_LAYER: (ctx) => `Step 3&4 (map & upscale) done in ${((performance.now() - ctx._taskStart)?.toFixed(2)) || 0} ms`,
	PUSH_LAYER: (ctx) => `Step 5 (push layer & redraw) done in ${((performance.now() - ctx._taskStart)?.toFixed(2)) || 0} ms`,
	APPLY_QUANTIZE_COMPLETE: (ctx) => `Task "applyQuantizeAndTile" completed in ${((performance.now() - ctx._taskStart)?.toFixed(2)) || 0} ms`,
	PIXELS_ERASED: (ctx) => `Erased ${ctx._pixels?.length || 0} pixels`,
	PIXELS_RECOLORED: (ctx) => {
		const p = ctx._pixels || [];
		return `Recolored ${p.length} pixels to rgb(${ctx._r},${ctx._g},${ctx._b})`;
	},
	BOUNDING_BOX_DRAWN: (ctx) => `Bounding box drawn for ${ctx._pixels?.length || 0} pixels`,
	IMAGE_DOWNLOADED: (ctx) => `Image downloaded as "${ctx._filename || 'unknown'}"`,
	RE_QUANTIZE: (ctx) => `Re-quantized using ${ctx._preservePalette ? 'existing palette' : ctx.colorCount + ' colors'}`
};


// // Internal helpers for dynamic log data
// this._taskStart = 0;
// this._pixels = null;
// this._r = this._g = this._b = 0;
// this._filename = null;
// this._stepName = "";
// this._uniqueCount = 0;
// this._paletteLength = 0;
// this._preservePalette = false;
//
// 	}
// log2(key) {
// 	if (!this.showLogs) return;
// 	const now = performance.now();
// 	const elapsed = ((now - this.startTime) / 1000).toFixed(3);
// 	const messageFn = messages[ key ];
// 	const message = typeof messageFn === "function" ? messageFn(this) : key;
// 	this.logEntries.push({
// 		time: new Date().toLocaleTimeString(),
// 		elapsed: parseFloat(elapsed),
// 		message
// 	});
// }
//
// getLogs2() { return this.logEntries; }
// clearLogs2() { this.logEntries = []; }


// => OPTIONAL USE RAW IMAGE, LAST IMAGE ???
//=========================
// LAYER CLASS
//=========================
class Layer {
	constructor (width, height, name = "Layer") {
		this.width = width;
		this.height = height;
		this.name = name;
		this.imageData = new ImageData(width, height);
		this.colors = []; // [{r,g,b,pixels,erased}]
	}
}

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
				const { success, palette, clusteredData, uniqueCount, error } = e.data;
				if (success) resolve({ palette, clusteredData, uniqueCount });
				else reject(new Error(error));
				this.worker.removeEventListener("message", handler);
			};

			this.worker.addEventListener("message", handler);
			this.worker.postMessage({ imageData, colorCount, iterations: this.kMeansIterations });
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
		this.rawImage = img;

		const start = performance.now();
		const { targetW, targetH } = this.prepareCanvasForImage(img);
		const imageData = this.drawImageOnCanvas(img, targetW, targetH);
		const layer = this.createBaseLayer(targetW, targetH, imageData);
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

	prepareCanvasForImage(img) {
		const start = performance.now();
		const { targetW, targetH } = this.setContainerDimensions(img);
		this.ctx.imageSmoothingEnabled = false;
		this.ctx.clearRect(0, 0, targetW, targetH);
		this.log(`Step 1 (prepare canvas) done in ${(performance.now() - start).toFixed(2)} ms`);
		return { targetW, targetH };
	}

	drawImageOnCanvas(img, width, height) {
		const start = performance.now();
		this._drawToCtx(this.ctx, img, width, height, false);
		const imageData = this.ctx.getImageData(0, 0, width, height);
		this.log(`Step 2 (draw image) done in ${(performance.now() - start).toFixed(2)} ms`);
		return imageData;
	}

	createBaseLayer(width, height, imageData) {
		const start = performance.now();
		const layer = new Layer(width, height, "Base Layer");
		layer.imageData = imageData;
		this.layers = [ layer ];
		this.activeLayer = layer;
		this.log(`Step 3 (create base layer) done in ${(performance.now() - start).toFixed(2)} ms`);
		return layer;
	}

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
		const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height, ts = this.tileSize;
		ctx.strokeStyle = "#4b4b4b";
		ctx.lineWidth = 1;

		for (let x = 0; x <= w; x += ts) {
			ctx.beginPath();
			ctx.moveTo(x + 0.5, 0);
			ctx.lineTo(x + 0.5, h);
			ctx.stroke();
		}

		for (let y = 0; y <= h; y += ts) {
			ctx.beginPath();
			ctx.moveTo(0, y + 0.5);
			ctx.lineTo(w, y + 0.5);
			ctx.stroke();
		}
	}

	// --------------------
	// Quantization
	// --------------------
	mapClusteredToLayer(clusteredData, canvasW, canvasH, tileSize) {
		const start = performance.now();
		const layer = new Layer(canvasW, canvasH, `Layer ${this.layers.length}`);
		const outData = layer.imageData.data;

		if (tileSize === 1) {
			outData.set(clusteredData);
		} else {
			const cw = canvasW, ch = canvasH, ts = tileSize;
			const tempW = Math.ceil(cw / ts), tempH = Math.ceil(ch / ts);

			for (let y = 0; y < tempH; y++) {
				const startY = y * ts, tileH = Math.min(ts, ch - startY);
				for (let x = 0; x < tempW; x++) {
					const i = (y * tempW + x) * 4;
					const [ r, g, b, a ] = clusteredData.slice(i, i + 4);
					const startX = x * ts, tileW = Math.min(ts, cw - startX);
					for (let ty = 0; ty < tileH; ty++) {
						let rowIndex = ((startY + ty) * cw + startX) * 4;
						for (let tx = 0; tx < tileW; tx++, rowIndex += 4) {
							outData[ rowIndex ] = r;
							outData[ rowIndex + 1 ] = g;
							outData[ rowIndex + 2 ] = b;
							outData[ rowIndex + 3 ] = a;
						}
					}
				}
			}
		}

		this.log(`Mapped clustered data to layer in ${(performance.now() - start).toFixed(2)} ms`);
		return layer;
	}

// 	async applyQuantizeAndTile(img, colorCount = 16, tileSize = 10) {
// 		if (!img || !this.dimensions) return;
// 		this.tileSize = tileSize;
// 		const { width: canvasW, height: canvasH } = this.dimensions;
//
// 		this.log(`Starting quantization and tiling with colorCount=${colorCount}, tileSize=${tileSize}`);
// 		const start = performance.now();
//
// 		const tempCanvas = this.createTempCanvas(
// 			img,
// 			Math.ceil(canvasW / tileSize),
// 			Math.ceil(canvasH / tileSize),
// 			false,
// 			"Step 1 (downscale)"
// 		);
//
// 		const { palette, clusteredData } = await this.runQuantizationInWorker(tempCanvas, colorCount);
//
// 		const layer = this.mapClusteredToLayer(clusteredData, canvasW, canvasH, tileSize);
//
//
// 		this.layers.push(layer);
// 		this.activeLayer = layer;
// 		layer.colors = palette;
// 		this.redraw();
//
// 		this.log(`Quantization & tiling completed in ${(performance.now() - start).toFixed(2)} ms`);
// 		console.log(palette, clusteredData)
// 		return palette;
	// 	}

	async applyQuantizeAndTile(img, colorCount = 16, tileSize = 10) {
		if (!img || !this.dimensions) return;
		this.tileSize = tileSize;
		const { width: canvasW, height: canvasH } = this.dimensions;

		const start = performance.now();
		this.log(`Starting quantization and tiling with colorCount=${colorCount}, tileSize=${tileSize}`);

		// Determine quantization canvas size
		const tempWidth = tileSize === 1 ? canvasW : Math.ceil(canvasW / tileSize);
		const tempHeight = tileSize === 1 ? canvasH : Math.ceil(canvasH / tileSize);

		// Downscale only if tileSize > 1
		const tempCanvas = tileSize === 1
			? this.createTempCanvas(img, canvasW, canvasH, false, "Step 1 (direct)")
			: this.createTempCanvas(img, tempWidth, tempHeight, false, "Step 1 (downscale)");

		// Quantize
		const { palette, clusteredData } = await this.runQuantizationInWorker(tempCanvas, colorCount);
		this.log(`Step 2: Quantization complete in ${(performance.now() - start).toFixed(2)} ms, palette ready.`);

		// Create final layer
		const layer = new Layer(canvasW, canvasH, `Layer ${this.layers.length}`);
		this.log(`Step 3: Created layer ${layer.name}`);

		if (tileSize === 1) {
			// Direct copy if no tiling
			layer.imageData.data.set(clusteredData);
			this.log("TileSize=1: copied clusteredData directly to layer.imageData");
		} else {
			// Draw scaled for tileSize > 1
			const tinyCanvas = document.createElement("canvas");
			tinyCanvas.width = tempWidth;
			tinyCanvas.height = tempHeight;
			tinyCanvas.getContext("2d").putImageData(new ImageData(clusteredData, tempWidth, tempHeight), 0, 0);

			const finalCtx = this.layerCanvas(layer); // helper to get canvas context for the layer
			finalCtx.imageSmoothingEnabled = false;
			finalCtx.drawImage(tinyCanvas, 0, 0, tempWidth, tempHeight, 0, 0, canvasW, canvasH);

			// Copy final pixels
			layer.imageData.data.set(finalCtx.getImageData(0, 0, canvasW, canvasH).data);
			this.log(`TileSize>1: scaled clusteredData to final layer`);
		}

		// Push layer
		this.layers.push(layer);
		this.activeLayer = layer;
		layer.colors = palette;
		this.redraw();
		this.log(`Quantization & tiling done in ${(performance.now() - start).toFixed(2)} ms`);

		return palette;
	}


// helper to create a canvas context for a layer
layerCanvas(layer) {
	if (!layer.canvas) {
		const canvas = document.createElement("canvas");
		canvas.width = layer.width;
		canvas.height = layer.height;
		layer.canvas = canvas;
	}
	return layer.canvas.getContext("2d");
}




	// --------------------
	// Pixel editing
	// --------------------
	_updatePixels(pixels, fn) {
		if (!this.activeLayer) return;
		const data = this.activeLayer.imageData.data;
		pixels.forEach(p => fn(data, p.index));
		this.redraw();
	}

	erasePixels(pixels) {
		this._updatePixels(pixels, (data, idx) => data[ idx + 3 ] = 0);
		this.log(`Erased ${pixels.length} pixels`);
	}

	recolorPixels(pixels, r, g, b, log = true) {
		this._updatePixels(pixels, (data, idx) => {
			data[ idx ] = r;
			data[ idx + 1 ] = g;
			data[ idx + 2 ] = b;
			data[ idx + 3 ] = 255;
		});
		log && this.log(`Recolored ${pixels.length} pixels to rgb(${r},${g},${b})`);

	}

	drawBoundingBox(pixels, color = "limegreen") {
		if (!pixels.length) return;
		let minX = this.canvas.width, maxX = -1, minY = this.canvas.height, maxY = -1;

		pixels.forEach(p => {
			const idx = p.index / 4;
			const x = idx % this.canvas.width;
			const y = Math.floor(idx / this.canvas.width);
			minX = Math.min(minX, x);
			maxX = Math.max(maxX, x);
			minY = Math.min(minY, y);
			maxY = Math.max(maxY, y);
		});

		// Optional: get color of the first pixel
		const data = this.activeLayer.imageData.data; // <-- get pixel data


		const firstIdx = pixels[ 0 ].index;
		const r = data[ firstIdx ];
		const g = data[ firstIdx + 1 ];
		const b = data[ firstIdx + 2 ];


		this.ctx.strokeStyle = color;
		const S = 1;
		this.ctx.lineWidth = S;
		this.ctx.strokeRect(minX + S, minY + S, maxX - minX - 2 * S, maxY - minY - 2 * S);
		this.ctx.setLineDash([]);
		this.log(`Highlighted pixels: ${pixels.length}\tcolor: rgb(${r}, ${g}, ${b})`);
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
		Math.ceil(this.dimensions.width / tileSize),
		Math.ceil(this.dimensions.height / tileSize)
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





// NOT IMPLEMENTED - just an idea
// 	async applyQuantizeAndTileFastPreview(img, colorCount = 16, internalDownscale = 10) {
// 		const taskStart = performance.now();
// 		if (!img || !this.dimensions) return;
//
// 		const { width: canvasW, height: canvasH } = this.dimensions;
//
// 		this.log(`Starting FAST quantization preview with colorCount=${colorCount}, internalDownscale=${internalDownscale}`);
//
// 		const tempCanvas = this.createTempCanvas(img, Math.ceil(canvasW / internalDownscale), Math.ceil(canvasH / internalDownscale), true, "Step 1 (internal downscale)");
//
// 		const step2Start = performance.now();
// 		const { palette, clusteredData, uniqueCount } = await kMeansQuantize(tempCanvas, colorCount, this.kMeansIterations);
// 		this.log(`Step 2 (k-means) done in ${(performance.now() - step2Start).toFixed(2)} ms`);
// 		this.log(`Unique colors found: ${uniqueCount}`);
// 		this.log(`Palette length after quantization: ${palette.length}`);
//
// 		const layer = this.mapClusteredToLayer(clusteredData, canvasW, canvasH, 1, "Step 3 (map back to full resolution)");
//
// 		const step4Start = performance.now();
// 		this.layers.push(layer);
// 		this.activeLayer = layer;
// 		this.redraw();
// 		this.log(`Step 4 (push layer & redraw) done in ${(performance.now() - step4Start).toFixed(2)} ms`);
//
// 		this.log(`Task "applyQuantizeAndTileFastPreview" completed in ${(performance.now() - taskStart).toFixed(2)} ms`);
// 		return palette;
// 	}
