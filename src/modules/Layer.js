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
	}

	initTempCanvas() {
		this._tempCanvas = document.createElement("canvas");
		this._tempCtx = this._tempCanvas.getContext("2d");
	}

	initImageData() {
		this.imageData = new ImageData(this.width, this.height);
		this.redraw();
	}

	pushHistory(label = "edit") {
		const snapshot = new ImageData(new Uint8ClampedArray(this.imageData.data), this.width, this.height);
		this.history.push({ snapshot, label });
	}

	undo() {
		if (!this.history.length) return;
		const last = this.history.pop();
		this.imageData.data.set(last.snapshot.data);
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
		const alpha = Math.round(this.opacity * 255); // layer opacity baked in

		const output = new Uint8ClampedArray(w * h * 4);

		const getColor = (idx) => {
			const base = idx * 4;
			return {
				r: clusteredData[ base ],
				g: clusteredData[ base + 1 ],
				b: clusteredData[ base + 2 ],
				a: alpha // use layer opacity
			};
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
			const xS = i % tempWidth;
			const yS = Math.floor(i / tempWidth);
			const color = getColor(i);

			const xStart = Math.floor(xS * scaleX);
			const yStart = Math.floor(yS * scaleY);
			const wRect = Math.ceil(scaleX);
			const hRect = Math.ceil(scaleY);

			fillRect(xStart, yStart, wRect, hRect, color);
		}

		this.imageData.data.set(output);
		this.pushHistory("quantize");
		this.redraw(); // redraw into this.canvas
	}


}
