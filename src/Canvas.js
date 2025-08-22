import { kMeansQuantize } from "./canvaskMeans.js";


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
	}

	log(message) {
		if (!this.showLogs) return
		const now = performance.now();
		const elapsed = ((now - this.startTime) / 1000).toFixed(3); // seconds
		const entry = {
			time: new Date().toLocaleTimeString(),
			elapsed: parseFloat(elapsed),

			message
		};
		this.logEntries.push(entry);
		//console.log(`[${entry.time}]  ${message}`);

	}

	getLogs() {
		return this.logEntries; // Retrieve the log array
	}

	clearLogs() {
		this.logEntries = []; // Clear all stored logs
	}

	async loadImage(img) {
		const taskStart = performance.now();
		this.rawImage = img;
		const container = document.getElementById("canvas-container");

		const ratio = Math.min(
			container.clientWidth / img.width,
			container.clientHeight / img.height
		);
		const targetW = Math.round(img.width * ratio);
		const targetH = Math.round(img.height * ratio);

		this.dimensions = { width: targetW, height: targetH, ratio };
		this.resizeCanvas(targetW, targetH);

		this.ctx.imageSmoothingEnabled = false;
		this.ctx.clearRect(0, 0, targetW, targetH);
		this.ctx.drawImage(img, 0, 0, targetW, targetH);

		const data = this.ctx.getImageData(0, 0, targetW, targetH);
		const layer = new Layer(targetW, targetH, "Base Layer");
		layer.imageData = data;
		this.layers = [ layer ];
		this.activeLayer = layer;

		this.redraw();
		this.log(`Image loaded: ${img.width}x${img.height}, scaled to ${targetW}x${targetH}`);
		this.log(`Task "loadImage" completed in ${(performance.now() - taskStart).toFixed(2)} ms`);
	}

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
		if (!this.activeLayer) return;
		const ctx = this.ctx;
		const width = this.activeLayer.width;
		const height = this.activeLayer.height;
		const ts = this.tileSize;

		ctx.strokeStyle = "#ccc";
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

// 	async applyQuantizeAndTile(img, colorCount = 16, tileSize = 10) {
// 		const taskStart = performance.now();
// 		if (!img || !this.dimensions) return;
//
// 		this.tileSize = tileSize;
// 		const { width: canvasW, height: canvasH } = this.dimensions;
//
// 		this.log(`Starting quantization and tiling with colorCount=${colorCount}, tileSize=${tileSize}`);
//
// 		// STEP 1: Downscale
// 		const step1Start = performance.now();
// 		const tempWidth = Math.ceil(canvasW / tileSize);
// 		const tempHeight = Math.ceil(canvasH / tileSize);
// 		const tempCanvas = document.createElement("canvas");
// 		tempCanvas.width = tempWidth;
// 		tempCanvas.height = tempHeight;
// 		const tctx = tempCanvas.getContext("2d");
// 		tctx.imageSmoothingEnabled = false;
// 		tctx.drawImage(img, 0, 0, tempWidth, tempHeight);
// 		this.log(`Step 1 (downscale) done in ${(performance.now() - step1Start).toFixed(2)} ms`);
//
// 		// STEP 2: Quantize
// 		const step2Start = performance.now();
// 		const { palette, clusteredData, uniqueCount } = await kMeansQuantize(tempCanvas, colorCount, this.kMeansIterations);
// 		this.log(`Step 2 (quantize) done in ${(performance.now() - step2Start).toFixed(2)} ms`);
// 		this.log(`Unique colors found: ${uniqueCount}`);
// 		this.log(`Palette length after quantization: ${palette.length}`);
//
// 		// STEP 3&4: Create full-size layer and upscale
// 		const step3Start = performance.now();
// 		const layer = new Layer(canvasW, canvasH, `Layer ${this.layers.length}`);
// 		const outData = layer.imageData.data;
//
// 		if (tileSize === 1) {
// 			// Direct copy for pixel-per-pixel
// 			outData.set(clusteredData);
// 		} else {
// 			// Existing tile-based upscale
// 			const cw = canvasW, ch = canvasH, ts = tileSize;
// 			const tempW = tempWidth, tempH = tempHeight;
// 			const data = outData;
// 			const clustered = clusteredData;
//
// 			for (let y = 0; y < tempH; y++) {
// 				const startY = y * ts;
// 				const tileH = Math.min(ts, ch - startY);
//
// 				for (let x = 0; x < tempW; x++) {
// 					const i = (y * tempW + x) * 4;
// 					const r = clustered[ i ];
// 					const g = clustered[ i + 1 ];
// 					const b = clustered[ i + 2 ];
// 					const a = clustered[ i + 3 ];
//
// 					const startX = x * ts;
// 					const tileW = Math.min(ts, cw - startX);
//
// 					for (let ty = 0; ty < tileH; ty++) {
// 						let rowIndex = ((startY + ty) * cw + startX) * 4;
// 						for (let tx = 0; tx < tileW; tx++, rowIndex += 4) {
// 							data[ rowIndex ] = r;
// 							data[ rowIndex + 1 ] = g;
// 							data[ rowIndex + 2 ] = b;
// 							data[ rowIndex + 3 ] = a;
// 						}
// 					}
// 				}
// 			}
// 		}
//
// 		this.log(`Step 3&4 (layer creation & upscale) done in ${(performance.now() - step3Start).toFixed(2)} ms`);
//
// 		// STEP 5: Push layer & redraw
// 		const step5Start = performance.now();
// 		this.layers.push(layer);
// 		this.activeLayer = layer;
// 		this.redraw();
// 		this.log(`Step 5 (push layer & redraw) done in ${(performance.now() - step5Start).toFixed(2)} ms`);
//
// 		this.log(`Task "applyQuantizeAndTile" completed in ${(performance.now() - taskStart).toFixed(2)} ms`);
//
// 		return palette;
// 	}
	// Helper to create temporary canvas and draw image, with logging
createTempCanvas(img, width, height, smoothing = false, stepName = "Temp Canvas") {
    const start = performance.now();
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tctx = tempCanvas.getContext("2d");
    tctx.imageSmoothingEnabled = smoothing;
    tctx.drawImage(img, 0, 0, width, height);
    this.log(`${stepName} done in ${(performance.now() - start).toFixed(2)} ms`);
    return tempCanvas;
}

// Helper to map clusteredData back to full resolution using tileSize, with logging
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
                const r = clusteredData[i], g = clusteredData[i+1], b = clusteredData[i+2], a = clusteredData[i+3];
                const startX = x * ts;
                const tileW = Math.min(ts, cw - startX);

                for (let ty = 0; ty < tileH; ty++) {
                    let rowIndex = ((startY + ty) * cw + startX) * 4;
                    for (let tx = 0; tx < tileW; tx++, rowIndex += 4) {
                        outData[rowIndex] = r;
                        outData[rowIndex+1] = g;
                        outData[rowIndex+2] = b;
                        outData[rowIndex+3] = a;
                    }
                }
            }
        }
    }

    this.log(`${stepName} done in ${(performance.now() - start).toFixed(2)} ms`);
    return layer;
}

// === Original applyQuantizeAndTile with all logs preserved ===
async applyQuantizeAndTile(img, colorCount = 16, tileSize = 10) {
    const taskStart = performance.now();
    if (!img || !this.dimensions) return;

    this.tileSize = tileSize;
    const { width: canvasW, height: canvasH } = this.dimensions;

    this.log(`Starting quantization and tiling with colorCount=${colorCount}, tileSize=${tileSize}`);

    // STEP 1: Downscale
    const tempCanvas = this.createTempCanvas(img, Math.ceil(canvasW / tileSize), Math.ceil(canvasH / tileSize), false, "Step 1 (downscale)");

    // STEP 2: Quantize
    const step2Start = performance.now();
    const { palette, clusteredData, uniqueCount } = await kMeansQuantize(tempCanvas, colorCount, this.kMeansIterations);
    this.log(`Step 2 (quantize) done in ${(performance.now() - step2Start).toFixed(2)} ms`);
    this.log(`Unique colors found: ${uniqueCount}`);
    this.log(`Palette length after quantization: ${palette.length}`);

    // STEP 3&4: Map to full resolution
    const layer = this.mapClusteredToLayer(clusteredData, canvasW, canvasH, tileSize, "Step 3&4 (map & upscale)");

    // STEP 5: Push layer & redraw
    const step5Start = performance.now();
    this.layers.push(layer);
    this.activeLayer = layer;
    this.redraw();
    this.log(`Step 5 (push layer & redraw) done in ${(performance.now() - step5Start).toFixed(2)} ms`);

    this.log(`Task "applyQuantizeAndTile" completed in ${(performance.now() - taskStart).toFixed(2)} ms`);

    return palette;
}

// === Fast preview variant (internal downscale) with logs preserved ===
async applyQuantizeAndTileFastPreview(img, colorCount = 16, internalDownscale = 10) {
    const taskStart = performance.now();
    if (!img || !this.dimensions) return;

    const { width: canvasW, height: canvasH } = this.dimensions;

    this.log(`Starting FAST quantization preview with colorCount=${colorCount}, internalDownscale=${internalDownscale}`);

    // STEP 1: Internal downscale
    const tempCanvas = this.createTempCanvas(img, Math.ceil(canvasW / internalDownscale), Math.ceil(canvasH / internalDownscale), true, "Step 1 (internal downscale)");

    // STEP 2: Quantize
    const step2Start = performance.now();
    const { palette, clusteredData, uniqueCount } = await kMeansQuantize(tempCanvas, colorCount, this.kMeansIterations);
    this.log(`Step 2 (k-means) done in ${(performance.now() - step2Start).toFixed(2)} ms`);
    this.log(`Unique colors found: ${uniqueCount}`);
    this.log(`Palette length after quantization: ${palette.length}`);

    // STEP 3: Map back full resolution (1:1 pixels)
    const layer = this.mapClusteredToLayer(clusteredData, canvasW, canvasH, 1, "Step 3 (map back to full resolution)");

    // STEP 4: Push layer & redraw
    const step4Start = performance.now();
    this.layers.push(layer);
    this.activeLayer = layer;
    this.redraw();
    this.log(`Step 4 (push layer & redraw) done in ${(performance.now() - step4Start).toFixed(2)} ms`);

    this.log(`Task "applyQuantizeAndTileFastPreview" completed in ${(performance.now() - taskStart).toFixed(2)} ms`);

    return palette;
}



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
		let minX = this.canvas.width,
			maxX = -1,
			minY = this.canvas.height,
			maxY = -1;
		pixels.forEach((p) => {
			const idx = p.index / 4;
			const x = idx % this.canvas.width;
			const y = Math.floor(idx / this.canvas.width);
			minX = Math.min(minX, x);
			maxX = Math.max(maxX, x);
			minY = Math.min(minY, y);
			maxY = Math.max(maxY, y);
		});
		this.ctx.strokeStyle = color;
		this.ctx.lineWidth = 2;
		this.ctx.strokeRect(minX - 0.5, minY - 0.5, maxX - minX + 1, maxY - minY + 1);
		this.ctx.setLineDash([]);
		this.log(`Bounding box drawn for ${pixels.length} pixels`);
	}
}
