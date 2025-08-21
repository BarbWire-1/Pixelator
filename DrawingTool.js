// TODO diagonal is funny!!!!!
// TODO check relation layer/canvas/textOverflow: // TODO update imageData after draw/erase to not loose on swatch usage
// TODO not working on the same page ;)

import { snapshot } from "./main.js";
export class DrawingTool {
	constructor (canvas, colorPicker, modeSelect, displayEl, tileSize = 16) {
		this.canvas = canvas;
		this.ctx = canvas.getContext("2d");
		this.colorPicker = colorPicker;
		this.modeSelect = modeSelect;
		this.displayEl = displayEl;
		this.tileSize = tileSize;

		this.drawing = false;
		this.start = null;

		this.currentColor = { r: 0, g: 0, b: 0 };
		this.mode = "N";
		this.isEraser = false;

		this.bindEvents();
		this.updateDisplay();
	}

	bindEvents() {
		this.canvas.addEventListener("mousedown", e => this.startDraw(e));
		this.canvas.addEventListener("mousemove", e => this.drawMove(e));
		this.canvas.addEventListener("mouseup", e => this.endDraw(e));
		this.canvas.addEventListener("mouseleave", e => this.endDraw(e));

		this.colorPicker.addEventListener("input", e => {
			const hex = e.target.value;
			this.currentColor = {
				r: parseInt(hex.substr(1, 2), 16),
				g: parseInt(hex.substr(3, 2), 16),
				b: parseInt(hex.substr(5, 2), 16),
			};
			this.isEraser = false;
			this.updateDisplay();
			snapshot()
		});

		this.modeSelect.addEventListener("change", e => {
			this.mode = e.target.value;
			this.updateDisplay();
		});
	}

	updateDisplay() {
		this.displayEl.textContent = `Mode: ${this.mode} | Color: ${this.isEraser ? "Eraser" : this.colorPicker.value}`;
	}

	getMouseTile(e) {
		const rect = this.canvas.getBoundingClientRect();
		const x = Math.floor((e.clientX - rect.left) / this.tileSize);
		const y = Math.floor((e.clientY - rect.top) / this.tileSize);
		return { x, y };
	}

	startDraw(e) {
		// Update color on draw start
		const hex = this.colorPicker.value;
		this.currentColor = {
			r: parseInt(hex.substr(1, 2), 16),
			g: parseInt(hex.substr(3, 2), 16),
			b: parseInt(hex.substr(5, 2), 16),
		};
		this.isEraser = this.isEraser; // keep current tool

		this.drawing = true;
		this.start = this.getMouseTile(e);
		this.drawLine(this.start, this.start);
	}


	drawMove(e) {
		if (!this.drawing) return;
		const pos = this.getMouseTile(e);
		this.drawLine(this.start, pos);
		this.start = pos;
	}

	endDraw(e) {
		if (!this.drawing) return;
		this.drawing = false;
		this.start = null;
		snapshot()
	}

	drawLine(p0, p1) {
		const pixels = this.bresenham(p0.x, p0.y, p1.x, p1.y);
		pixels.forEach(({ x, y }) => {
			this.applyTile(x, y);
		});
	}

	bresenham(x0, y0, x1, y1) {
		const pixels = [];
		let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
		let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
		let err = dx + dy;

		while (true) {
			pixels.push({ x: x0, y: y0 });
			if (x0 === x1 && y0 === y1) break;
			const e2 = 2 * err;
			if (e2 >= dy) { err += dy; x0 += sx; }
			if (e2 <= dx) { err += dx; y0 += sy; }
		}
		return pixels;
	}

	applyTile(tx, ty) {
		const size = this.tileSize;
		const colors = this.isEraser ? { r: 255, g: 255, b: 255 } : this.currentColor;

		// Draw main tile
		this.ctx.fillStyle = `rgb(${colors.r},${colors.g},${colors.b})`;
		this.ctx.fillRect(tx * size, ty * size, size, size);

		// Apply mirrored modes
		const w = Math.floor(this.canvas.width / size);
		const h = Math.floor(this.canvas.height / size);

		switch (this.mode) {
			case "H":
				this.ctx.fillRect((w - tx - 1) * size, ty * size, size, size);
				break;
			case "V":
				this.ctx.fillRect(tx * size, (h - ty - 1) * size, size, size);
				break;
			case "B":
				this.ctx.fillRect((w - tx - 1) * size, ty * size, size, size);
				this.ctx.fillRect(tx * size, (h - ty - 1) * size, size, size);
				this.ctx.fillRect((w - tx - 1) * size, (h - ty - 1) * size, size, size);
				break;
			case "D":
				this.ctx.fillRect(ty * size, tx * size, size, size);
				break;
		}
	}

	setEraser() {
		this.isEraser = true;
		this.updateDisplay();
	}
}
