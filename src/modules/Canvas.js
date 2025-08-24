/*
MIT License
Copyright(c) 2025 Barbara Kälin aka BarbWire - 1
*/

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

		this.startTime = performance.now(); // Track overall elapsed time
		this.logEntries = []; // Store logs for UI or export
		this.showLogs = true;

		this.kMeansIterations = 1;

		this.worker = null;
		this.colorCount =16;


	}

	// create once
	initWorker() {
		if (!this.worker) {
			this.worker = new Worker(new URL("./quantizeWorker.js", import.meta.url), { type: "module" });
		}
	}

	async runQuantizationInWorker(tempCanvas, colorCount) {
		return new Promise((resolve, reject) => {
			this.initWorker();

			const ctx = tempCanvas.getContext("2d");
			const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);

			const handler = (e) => {
				const { success, palette, clusteredData, uniqueCount, error } = e.data;
				if (success) {
					resolve({ palette, clusteredData, uniqueCount });
				} else {
					reject(new Error(error));
				}
				this.worker.removeEventListener("message", handler); // cleanup
			};

			this.worker.addEventListener("message", handler);

			this.worker.postMessage({
				imageData,
				colorCount,
				iterations: this.kMeansIterations
			});
		});
	}


	// --------------------
	// Logging helpers
	// --------------------
	log(message) {
		if (!this.showLogs) return;
		const now = performance.now();
		const elapsed = ((now - this.startTime) / 1000).toFixed(3);
		const entry = {
			time: new Date().toLocaleTimeString(),
			elapsed: parseFloat(elapsed),
			message
		};
		this.logEntries.push(entry);
	}
	getLogs() { return this.logEntries; }
	clearLogs() { this.logEntries = []; }

	// --------------------
	// Low-level core draw helper
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

	// --------------------
	// Image loading
	// --------------------
	async loadImage(img) {
		const taskStart = performance.now();
		this.rawImage = img;

		const { targetW, targetH } = this.prepareCanvasForImage(img);
		const imageData = this.drawImageOnCanvas(img, targetW, targetH);
		this.createBaseLayer(targetW, targetH, imageData);

		this.redraw();

		this.log(`Image loaded: ${img.width}x${img.height}, scaled to ${targetW}x${targetH}`);
		this.log(`Task "loadImage" completed in ${(performance.now() - taskStart).toFixed(2)} ms`);
	}

	setContainerDimensions(img) {
		const container = document.getElementById("canvas-container");
		const ratio = Math.min(
			container.clientWidth / img.width,
			container.clientHeight / img.height
		);
		const targetW = Math.round(img.width * ratio);
		const targetH = Math.round(img.height * ratio);

		this.dimensions = { width: targetW, height: targetH, ratio };
		this.resizeCanvas(targetW, targetH);

		return { targetW, targetH };
	}

	prepareCanvasForImage(img) {
		const taskStart = performance.now();
		const { targetW, targetH } = this.setContainerDimensions(img);
		this.ctx.imageSmoothingEnabled = false;
		this.ctx.clearRect(0, 0, targetW, targetH);
		this.log(`Step 1 (prepare canvas) done in ${(performance.now() - taskStart).toFixed(2)} ms`);
		return { targetW, targetH };
	}

	// Step 2: draw into MAIN canvas
	drawImageOnCanvas(img, width, height) {
		const taskStart = performance.now();
		this._drawToCtx(this.ctx, img, width, height, false);
		const imageData = this.ctx.getImageData(0, 0, width, height);
		this.log(`Step 2 (draw image) done in ${(performance.now() - taskStart).toFixed(2)} ms`);
		return imageData;
	}

	// Temp canvas for quantization
	createTempCanvas(img, width, height, smoothing = false, stepName = "Temp Canvas") {
		const start = performance.now();
		const tempCanvas = document.createElement("canvas");
		const tctx = tempCanvas.getContext("2d");
		this._drawToCtx(tctx, img, width, height, smoothing);
		this.log(`${stepName} done in ${(performance.now() - start).toFixed(2)} ms`);
		return tempCanvas;
	}

	// Step 3: wrap into a base layer
	createBaseLayer(width, height, imageData) {
		const taskStart = performance.now();
		const layer = new Layer(width, height, "Base Layer");
		layer.imageData = imageData;
		this.layers = [ layer ];
		this.activeLayer = layer;
		this.log(`Step 3 (create base layer) done in ${(performance.now() - taskStart).toFixed(2)} ms`);
		return layer;
	}

	// --------------------
	// Download/export image
	// --------------------
	downloadImage() {
		if (!this.activeLayer) return;

		// build filename
		const pixelated = this.tileSize > 1 ? "pixelated" : "original";
		const colors = this.activeLayer.colors?.length ?? "full";
		const filename = `canvas-${pixelated}-ts${this.tileSize}-c${colors}.png`;
		// Create a temporary canvas to hold the current layer
		const tempCanvas = document.createElement("canvas");
		tempCanvas.width = this.activeLayer.width;
		tempCanvas.height = this.activeLayer.height;
		const tctx = tempCanvas.getContext("2d");
		tctx.putImageData(this.activeLayer.imageData, 0, 0);

		// Convert canvas to a blob and trigger download
		tempCanvas.toBlob((blob) => {
			if (!blob) return;
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
		}, "image/png");

		this.log(`Image downloaded as "${filename}"`);
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
	//	if (!this.activeLayer) return;
		const ctx = this.ctx;
		const width = this.canvas.width;
		const height = this.canvas.height;
		const ts = this.tileSize;

		ctx.strokeStyle = "#4b4b4b";
		ctx.lineWidth = 1;

		for (let x = 0; x <= width; x += ts) {
			ctx.beginPath();
			ctx.moveTo(x + 0.5, 0);
			ctx.lineTo(x + 0.5, height);
			ctx.stroke();
		}
		for (let y = 0; y <= height; y += ts) {
			ctx.beginPath();
			ctx.moveTo(0, y + 0.5);
			ctx.lineTo(width, y + 0.5);
			ctx.stroke();
		}
	}

	// --------------------
	// Quantization
	// --------------------
	mapClusteredToLayer(clusteredData, canvasW, canvasH, tileSize, stepName = "Map to Layer") {
		const start = performance.now();
		const layer = new Layer(canvasW, canvasH, `Layer ${this.layers.length}`);
		const outData = layer.imageData.data;

		if (tileSize === 1) {
			outData.set(clusteredData);
		} else {
			const cw = canvasW, ch = canvasH, ts = tileSize;
			const tempW = Math.ceil(cw / ts);
			const tempH = Math.ceil(ch / ts);

			for (let y = 0; y < tempH; y++) {
				const startY = y * ts;
				const tileH = Math.min(ts, ch - startY);

				for (let x = 0; x < tempW; x++) {
					const i = (y * tempW + x) * 4;
					const r = clusteredData[ i ], g = clusteredData[ i + 1 ], b = clusteredData[ i + 2 ], a = clusteredData[ i + 3 ];
					const startX = x * ts;
					const tileW = Math.min(ts, cw - startX);

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
		this.log(`${stepName} done in ${(performance.now() - start).toFixed(2)} ms`);
		return layer;
	}

	async applyQuantizeAndTile(img, colorCount = 16, tileSize = 10) {
		const taskStart = performance.now();
		if (!img || !this.dimensions) return;

		this.tileSize = tileSize;
		const { width: canvasW, height: canvasH } = this.dimensions;

		this.log(`Starting quantization and tiling with colorCount=${colorCount}, tileSize=${tileSize}`);

		const tempCanvas = this.createTempCanvas(img, Math.ceil(canvasW / tileSize), Math.ceil(canvasH / tileSize), false, "Step 1 (downscale)");

		const step2Start = performance.now();
		// running kmeans internally
		//const { palette, clusteredData, uniqueCount } = await kMeansQuantize(tempCanvas, colorCount, this.kMeansIterations);

		//running kMeans in webworker
		const { palette, clusteredData, uniqueCount } = await this.runQuantizationInWorker(tempCanvas, colorCount, this.kMeansIterations);


		this.log(`Step 2 (quantize in ${this.kMeansIterations} iterations) done in ${(performance.now() - step2Start).toFixed(2)} ms`);
		this.log(`Unique colors found: ${uniqueCount}`);
		this.log(`Palette length after quantization: ${palette.length}`);

		const layer = this.mapClusteredToLayer(clusteredData, canvasW, canvasH, tileSize, "Step 3&4 (map & upscale)");

		const step5Start = performance.now();
		this.layers.push(layer);
		this.activeLayer = layer;
		this.redraw();
		this.log(`Step 5 (push layer & redraw) done in ${(performance.now() - step5Start).toFixed(2)} ms`);

		this.log(`Task "applyQuantizeAndTile" completed in ${(performance.now() - taskStart).toFixed(2)} ms`);

		layer.colors = palette;
		return palette;
	}

	// --------------------
	// Pixel editing
	// --------------------
	erasePixels(pixels) {
		if (!this.activeLayer) return;
		const data = this.activeLayer.imageData.data;
		pixels.forEach((p) => (data[ p.index + 3 ] = 0));
		this.redraw();
		this.log(`Erased ${pixels.length} pixels`);
	}

	recolorPixels(pixels, r, g, b) {
		if (!this.activeLayer) return;
		const data = this.activeLayer.imageData.data;
		pixels.forEach((p) => {
			data[ p.index ] = r;
			data[ p.index + 1 ] = g;
			data[ p.index + 2 ] = b;
			data[ p.index + 3 ] = 255;
		});
		this.redraw();
		this.log(`Recolored ${pixels.length} pixels to rgb(${r},${g},${b})`);
	}

	drawBoundingBox(pixels, color = "limegreen") {
		if (!pixels.length) return;

		let minX = this.canvas.width, maxX = -1, minY = this.canvas.height, maxY = -1;
		const coords = [];

		pixels.forEach((p) => {
			const idx = p.index / 4;
			const x = idx % this.canvas.width;
			const y = Math.floor(idx / this.canvas.width);
			coords.push({ x, y });
			minX = Math.min(minX, x);
			maxX = Math.max(maxX, x);
			minY = Math.min(minY, y);
			maxY = Math.max(maxY, y);
		});

		// draw bounding box
		this.ctx.strokeStyle = color;
		this.ctx.lineWidth = 0.5;
		this.ctx.strokeRect(minX - 0.5, minY - 0.5, maxX - minX + 1, maxY - minY + 1);
		this.ctx.setLineDash([]);
		this.log(`Bounding box drawn for ${pixels.length} pixels`);

		//TODO - the idea is an overlay fading in and out, but I do not really like it _TEST
// 		const backup = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
//
// 		let step = 0;
// 		let increasing = true;
// 		const steps =4;
// 		let animationId;
//
// 		const animate = () => {
//
// 			this.ctx.putImageData(backup, 0, 0);
//
// 			const opacity = increasing ? step / steps : 1 - step / steps;
//
// 			// draw overlay per pixel
// 			pixels.forEach(p => {
// 				const idx = p.index;
// 				const r = backup.data[ idx ];
// 				const g = backup.data[ idx + 1 ];
// 				const b = backup.data[ idx + 2 ];
//
// 				// complementary color
// 				const cr = 255 - r;
// 				const cg = 255 - g;
// 				const cb = 255 - b;
//
// 				this.ctx.fillStyle = `rgba(${cr},${cg},${cb},${opacity / 4})`;
// 				const x = idx / 4 % this.canvas.width;
// 				const y = Math.floor(idx / 4 / this.canvas.width);
// 				this.ctx.fillRect(x, y, 1, 1);
// 			});
//
// 			step++;
// 			if (step <= steps) {
// 				animationId = requestAnimationFrame(animate);
// 			} else if (increasing) {
// 				step = 0;
// 				increasing = false;
// 				animationId = requestAnimationFrame(animate);
// 			} else {
// 				// final cleanup
// 				this.ctx.putImageData(backup, 0, 0);
// 				cancelAnimationFrame(animationId);
// 			}
// 		};
//
// 		animate();
//
 	}

}


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
