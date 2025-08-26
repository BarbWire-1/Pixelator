export class Layer {
	constructor (width, height, name = "Layer", rawImage = null) {
		this.width = width;
		this.height = height;
		this.name = name;

		// Layer properties
		this.visible = true;
		this.opacity = 1.0;
		this.colors = [];       // [{ r,g,b,pixels,erased }]
		this.effects = [];
		this.history = [];

		this.rawImage = rawImage; // Layer owns its raw image

		// Initialize canvas
		this.initCanvas();
		this.initImageData();
	}

	initCanvas() {
		this.canvas = document.createElement("canvas");
		this.canvas.width = this.width;
		this.canvas.height = this.height;
		// optimize for frequent pixel reads
		this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
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
		ctx.globalAlpha = 1.0;
	}

	applyClusteredData(clusteredData, tempWidth, tempHeight, tileSize = 1) {
		const w = this.width;
		const h = this.height;

		if (tileSize === 1) {
			this.imageData.data.set(clusteredData);
			this.redraw();
		} else {
			const tempCanvas = document.createElement("canvas");
			tempCanvas.width = tempWidth;
			tempCanvas.height = tempHeight;
			tempCanvas.getContext("2d").putImageData(new ImageData(clusteredData, tempWidth, tempHeight), 0, 0);

			const ctx = this.ctx;
			ctx.imageSmoothingEnabled = false;
			ctx.clearRect(0, 0, w, h);
			ctx.drawImage(
				tempCanvas,
				0, 0, tempWidth, tempHeight,
				0, 0, tempWidth * tileSize, tempHeight * tileSize
			);
			this.imageData.data.set(ctx.getImageData(0, 0, w, h).data);
		}
	}
}
