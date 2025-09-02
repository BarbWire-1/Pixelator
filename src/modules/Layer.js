import { snapshot } from "../main.js";

export class Layer {
	constructor (width, height, name = "Layer", rawImage = null) {
		this.width = width;
		this.height = height;
		this.name = name;

		this.visible = true;
		this.opacity = 1;
		this.colors = [];
		this.effects = [];
		this.history = [];

		this.rawImage = rawImage;
		this.allOpaque = false;

		// Initialize canvas and tempCanvas cache
		this.initCanvas();
		this.initTempCanvas();
		this.initImageData();
	}

	initCanvas() {
		this.canvas = document.createElement("canvas");
		this.canvas.width = this.width;
		this.canvas.height = this.height;
		this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
		this.ctx.imageSmoothingEnabled = false;
	}

	initTempCanvas() {
		this._tempCanvas = document.createElement("canvas");
		this._tempCtx = this._tempCanvas.getContext("2d");
	}

	initImageData() {
		this.imageData = new ImageData(this.width, this.height);
		this.redraw();
	}



	redraw() {
		this.ctx.putImageData(this.imageData, 0, 0);
	}

	drawTo(ctx, x = 0, y = 0) {
		if (!this.visible) return;
		ctx.globalAlpha = this.opacity;
		ctx.drawImage(this.canvas, x, y);
		ctx.globalAlpha = 1;// reset
	}


	applyClusteredData(clusteredData, tempWidth, tempHeight, highlight = -1) {
		const w = this.width;
		const h = this.height;
		const scaleX = w / tempWidth;
		const scaleY = h / tempHeight;
		const alpha = Math.round(this.opacity * 255);

		// Start with current image data so we don't overwrite with black
		const output = new Uint8ClampedArray(this.imageData.data);

		const getColor = (idx) => {
			const base = idx * 4;
			const r = clusteredData[ base ];
			const g = clusteredData[ base + 1 ];
			const b = clusteredData[ base + 2 ];
			const a = clusteredData[ base + 3 ];

			// skip invalid/empty pixels
			if (r === 0 && g === 0 && b === 0 && a === 0) return null;

			return { r, g, b, a: this.allOpaque ? 255 : a };
		};

		const fillRect = (xStart, yStart, wRect, hRect, { r, g, b, a }) => {
			const rowStride = w * 4;
			for (let y = yStart; y < yStart + hRect; y++) {
				let offset = y * rowStride + xStart * 4;
				for (let x = 0; x < wRect; x++, offset += 4) {
					output[ offset ] = r;
					output[ offset + 1 ] = g;
					output[ offset + 2 ] = b;
					output[ offset + 3 ] = a;
				}
			}
		};

		for (let i = 0; i < tempWidth * tempHeight; i++) {
			const color = getColor(i);
			if (!color) continue;

			const xS = i % tempWidth;
			const yS = Math.floor(i / tempWidth);

			const xStart = Math.floor(xS * scaleX);
			const yStart = Math.floor(yS * scaleY);
			const wRect = Math.ceil(scaleX);
			const hRect = Math.ceil(scaleY);

			const rowStride = w * 4;
			for (let y = yStart; y < yStart + hRect; y++) {
				let offset = y * rowStride + xStart * 4;
				for (let x = 0; x < wRect; x++, offset += 4) {
					this.imageData.data[ offset ] = color.r;
					this.imageData.data[ offset + 1 ] = color.g;
					this.imageData.data[ offset + 2 ] = color.b;
					this.imageData.data[ offset + 3 ] = color.a;
				}
			}
		}
		this.redraw();
	}


	getState() {
		return {
			width: this.width,
			height: this.height,
			imageData: new ImageData(
				new Uint8ClampedArray(this.imageData.data),
				this.width,
				this.height
			),
			visible: this.visible,
			opacity: this.opacity,
			name: this.name,
			rawImage: this.rawImage // optional reference
		};
	}

	static fromState(state) {
		const layer = new Layer(state.width, state.height, state.name);
		layer.imageData = state.imageData;
		layer.visible = state.visible;
		layer.opacity = state.opacity;
		layer.rawImage = state.rawImage;
		layer.ctx.putImageData(layer.imageData, 0, 0);
		return layer;
	}
}
