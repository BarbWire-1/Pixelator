import { Colors } from "./Colors.js";

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


// TODO seems a bit odd with layers.... drawing not integrated.
// TODO add layering stack!
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
	}

	async loadImage(img) {
		this.rawImage = img;
		const container = document.getElementById("canvas-container");
		const ratio = Math.min(
			container.clientWidth / img.width,
			container.clientHeight / img.height
		);
		const targetW = Math.round(img.width * ratio);
		const targetH = Math.round(img.height * ratio);
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


	async applyQuantizeAndTile(img, colorCount = 16, tileSize = 10) {
		if (!img) return;
		this.tileSize = tileSize;

		const rgbPalette = await Colors.kMeansQuantize(img, colorCount);
		const layer = new Layer(
			this.canvas.width,
			this.canvas.height,
			`Layer ${this.layers.length}`
		);
		this.drawTiled(layer, img, tileSize, rgbPalette);

		this.layers.push(layer);
		this.activeLayer = layer;

		this.redraw();
		return rgbPalette;
	}
	//  Multiple readback operations using getImageData are faster with the willReadFrequently attribute set to true. See: https://html.spec.whatwg.org/multipage/canvas.html#concept-canvas-will-read-frequently
	// THIS IS AWFULLY HEAVY
	drawTiled(layer, img, tileSize = 20, palette = null) {
		// Draw raw image to temp canvas
		const tempCanvas = document.createElement("canvas");
		tempCanvas.width = layer.width;
		tempCanvas.height = layer.height;
		const tctx = tempCanvas.getContext("2d");
		tctx.imageSmoothingEnabled = false;
		tctx.drawImage(img, 0, 0, layer.width, layer.height);

		// ✅ Store raw pixel data ONCE
		layer.rawPixelData = tctx.getImageData(0, 0, layer.width, layer.height).data;

		// Create output ImageData
		const outputImageData = tctx.createImageData(layer.width, layer.height);
		const outData = outputImageData.data;

		for (let y = 0; y < layer.height; y += tileSize) {
			for (let x = 0; x < layer.width; x += tileSize) {
				const idx = (y * layer.width + x) * 4;
				let color = [
					layer.rawPixelData[ idx ],
					layer.rawPixelData[ idx + 1 ],
					layer.rawPixelData[ idx + 2 ],
					layer.rawPixelData[ idx + 3 ]
				];

				if (palette) color = this.findClosestColor(color, palette);

				const w = Math.min(tileSize, layer.width - x);
				const h = Math.min(tileSize, layer.height - y);

				for (let ty = 0; ty < h; ty++) {
					for (let tx = 0; tx < w; tx++) {
						const outIdx = ((y + ty) * layer.width + (x + tx)) * 4;
						outData[ outIdx ] = color[ 0 ];
						outData[ outIdx + 1 ] = color[ 1 ];
						outData[ outIdx + 2 ] = color[ 2 ];
						outData[ outIdx + 3 ] = color[ 3 ];
					}
				}
			}
		}

		layer.imageData = outputImageData;
	}

	findClosestColor(px, palette) {
		let minDist = Infinity;
		let closest = px;
		for (const c of palette) {
			const d =
				(px[ 0 ] - c[ 0 ]) ** 2 +
				(px[ 1 ] - c[ 1 ]) ** 2 +
				(px[ 2 ] - c[ 2 ]) ** 2;
			if (d < minDist) {
				minDist = d;
				closest = c;
			}
		}
		return [ ...closest, px[ 3 ] ];
	}

	erasePixels(pixels) {
		if (!this.activeLayer) return;
		const data = this.activeLayer.imageData.data;
		pixels.forEach((p) => (data[ p.index + 3 ] = 0));
		this.redraw();
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
		//this.ctx.setLineDash([ 6, 4 ]);
		this.ctx.strokeRect(
			minX - 0.5,
			minY - 0.5,
			maxX - minX + 1,
			maxY - minY + 1
		);
		this.ctx.setLineDash([]);
	}
}