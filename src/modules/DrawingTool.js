/*
MIT License
Copyright(c) 2025 Barbara Kälin aka BarbWire - 1
*/
// TODO this draws without being selected
import { snapshot } from '../main.js'
export class DrawingTool {
	constructor (canvasManager, colorPicker, modeSelect, displayEl) {
		this.cm = canvasManager; // store reference to CanvasManager
		this.canvas = canvasManager.canvas;
		this.ctx = canvasManager.ctx;
		this.colorPicker = colorPicker;
		this.modeSelect = modeSelect;
		this.displayEl = displayEl;
		this.tileSize = this.cm.tileSize;

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

		if (this.modeSelect) {
			this.modeSelect.addEventListener("change", () => {
				this.mode = this.modeSelect.value;
				this.updateDisplay();
			});
		}


	}

	updateDisplay() {
		this.displayEl.textContent = `Mode: ${this.mode} | Color: ${this.isEraser ? "Eraser" : this.colorPicker.value}`;
	}

	getMouseTile(e) {
		const rect = this.canvas.getBoundingClientRect();
		const scaleX = this.canvas.width / rect.width;
		const scaleY = this.canvas.height / rect.height;

		const x = Math.floor((e.clientX - rect.left) * scaleX / this.cm.tileSize);
		const y = Math.floor((e.clientY - rect.top) * scaleY / this.cm.tileSize);

		return { x, y };
	}

	getActiveTool() {
		const selected = document.querySelector('input[name="toolMode"]:checked');
		if (!selected) return null; // nothing selected
		return selected.value; // "brush" or "eraser"
	}
	startDraw(e) {
		const tool = this.getActiveTool();
		if (!tool) return; // no tool selected, don't start drawing

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
		snapshot("Draw"); // record the completed stroke
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
		if (!this.cm.activeLayer) return;
		const layer = this.cm.activeLayer;
		const data = layer.imageData.data;
		const size = this.cm.tileSize;

		const wTiles = Math.floor(layer.width / size);
		const hTiles = Math.floor(layer.height / size);

		const setPixel = (x, y, color, alpha = 255) => {
			if (x < 0 || x >= layer.width || y < 0 || y >= layer.height) return;
			const idx = (y * layer.width + x) * 4;
			data[ idx ] = color.r;
			data[ idx + 1 ] = color.g;
			data[ idx + 2 ] = color.b;
			data[ idx + 3 ] = alpha;
		};

		const color = this.isEraser ? { r: 0, g: 0, b: 0 } : this.currentColor;
		const alpha = this.isEraser ? 0 : 255;

		// Fill main tile
		for (let y = 0; y < size; y++) {
			for (let x = 0; x < size; x++) {
				setPixel(tx * size + x, ty * size + y, color, alpha);
			}
		}


		const mirrors = [];

		switch (this.mode) {
			case "H":
				mirrors.push({ tx, ty: hTiles - ty - 1 });
				break;
			case "V":
				mirrors.push({ tx: wTiles - tx - 1, ty });
				break;
			case "B":
				mirrors.push({ tx, ty: hTiles - ty - 1 });             // horizontal
				mirrors.push({ tx: wTiles - tx - 1, ty });             // vertical
				mirrors.push({ tx: wTiles - tx - 1, ty: hTiles - ty - 1 }); // both
				break;
			case "D":
				mirrors.push({ tx: wTiles - tx - 1, ty: hTiles - ty - 1 });; // diagonal swap
				break;
		}
		// Apply mirrored tiles
		mirrors.forEach(({ tx, ty }) => {
			for (let y = 0; y < size; y++) {
				for (let x = 0; x < size; x++) {
					setPixel(tx * size + x, ty * size + y, color, alpha);
				}
			}
		});

		this.cm.redraw();
	}




	setEraser() {
		this.isEraser = true;
		this.updateDisplay();
	}
}
