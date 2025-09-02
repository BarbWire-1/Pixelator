/*
MIT License
Copyright(c) 2025 Barbara Kälin aka BarbWire - 1
*/
import { snapshot } from '../main.js';

export class DrawingTool {
	constructor (cm, colorPicker, modeSelect, displayEl) {
		this.cm = cm;
		this.canvas = cm.canvas;
		this.ctx = cm.ctx;
		this.colorPicker = colorPicker;
		this.modeSelect = modeSelect;
		this.displayEl = displayEl;
		this.tileSize = cm.tileSize;

		this.drawing = false;
		this.start = null;
		this.currentColor = { r: 0, g: 0, b: 0 };
		this.mode = "N";
		this.isEraser = false;

		this.bindEvents();
		this.updateDisplay();
	}

	// ----------------------------
	// Mouse / Input Handling
	// ----------------------------
	bindEvents() {
		const canvasEvents = {
			mousedown: e => this.startDraw(e),
			mousemove: e => this.drawMove(e),
			mouseup: e => this.endDraw(e),
			mouseleave: e => this.endDraw(e),
		};
		for (const [ event, handler ] of Object.entries(canvasEvents)) {
			this.canvas.addEventListener(event, handler);
		}
		if (this.modeSelect) {
			this.modeSelect.addEventListener("change", () => {
				this.mode = this.modeSelect.value;
				this.updateDisplay();
			});
		}
	}

	// ----------------------------
	// Tile Helpers
	// ----------------------------
	getTileMetrics() {
		const layer = this.cm.activeLayer;
		const canvas = this.canvas;
		if (!layer) return { tileW: [ this.cm.tileSize ], tileH: [ this.cm.tileSize ], cols: 1, rows: 1 };

		const cols = layer.tempWidth || Math.floor(canvas.width / this.cm.tileSize) || 1;
		const rows = layer.tempHeight || Math.floor(canvas.height / this.cm.tileSize) || 1;

		const tileW = Array.from({ length: cols }, (_, i) =>
			Math.round(((i + 1) * canvas.width) / cols) - Math.round((i * canvas.width) / cols)
		);
		const tileH = Array.from({ length: rows }, (_, i) =>
			Math.round(((i + 1) * canvas.height) / rows) - Math.round((i * canvas.height) / rows)
		);

		return { tileW, tileH, cols, rows };
	}

	getMouseTile(e) {
		const rect = this.canvas.getBoundingClientRect();
		const { tileW, tileH, cols, rows } = this.getTileMetrics();

		const mx = e.clientX - rect.left;
		const my = e.clientY - rect.top;

		const cx = (mx / rect.width) * this.canvas.width;
		const cy = (my / rect.height) * this.canvas.height;

		let tx = 0, sumX = 0;
		for (; tx < cols; tx++) {
			sumX += tileW[ tx ];
			if (cx < sumX) break;
		}
		let ty = 0, sumY = 0;
		for (; ty < rows; ty++) {
			sumY += tileH[ ty ];
			if (cy < sumY) break;
		}

		return { x: tx, y: ty };
	}

	// ----------------------------
	// Drawing / Mouse Actions
	// ----------------------------
	getActiveTool() {
		const selected = document.querySelector('input[name="toolMode"]:checked');
		return selected ? selected.value : null;
	}

	startDraw(e) {
		const tool = this.getActiveTool();
		if (!tool) return;

		const { x, y } = this.getMouseTile(e);
		this.updateCurrentColor();

		if (tool === "fillRegion") {
			this.drawing = false;
			this.floodFillTile(x, y);
			return;
		}

		this.drawing = true;
		this.start = { x, y };
		this.drawLine(this.start, this.start);
	}

	drawMove(e) {
		if (!this.drawing) return;
		const pos = this.getMouseTile(e);
		this.drawLine(this.start, pos);
		this.start = pos;
	}

	endDraw() {
		if (!this.drawing) return;
		this.drawing = false;
		this.start = null;
		snapshot("Draw");
	}

	// ----------------------------
	// Color Handling
	// ----------------------------
	updateCurrentColor() {
		const hex = this.colorPicker.value;
		this.currentColor = {
			r: parseInt(hex.substr(1, 2), 16),
			g: parseInt(hex.substr(3, 2), 16),
			b: parseInt(hex.substr(5, 2), 16),
		};
	}

	// ----------------------------
	// Pixel / Tile Operations
	// ----------------------------
	getPixelColor(x, y) {
		const layer = this.cm.activeLayer;
		if (!layer) return { r: 0, g: 0, b: 0, a: 0 };

		const px = Math.min(Math.max(Math.floor(x), 0), layer.width - 1);
		const py = Math.min(Math.max(Math.floor(y), 0), layer.height - 1);
		const idx = (py * layer.width + px) * 4;
		const d = layer.imageData.data;

		return { r: d[ idx ], g: d[ idx + 1 ], b: d[ idx + 2 ], a: d[ idx + 3 ] };
	}
	colorsMatch(c1, c2, tolerance = 0) {
	if (!c1 || !c2) return false;
	return (
		Math.abs(c1.r - c2.r) <= tolerance &&
		Math.abs(c1.g - c2.g) <= tolerance &&
		Math.abs(c1.b - c2.b) <= tolerance &&
		Math.abs((c1.a ?? 255) - (c2.a ?? 255)) <= tolerance
	);
}


	applyTile(tx, ty, color = this.currentColor, alpha = 255) {
		const layer = this.cm.activeLayer;
		const { tileW, tileH } = this.getTileMetrics();
		const { width, height, imageData } = layer;
		const d = imageData.data;

		const w = tileW[ tx ];
		const h = tileH[ ty ];
		const startX = tileW.slice(0, tx).reduce((a, v) => a + v, 0);
		const startY = tileH.slice(0, ty).reduce((a, v) => a + v, 0);

		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				const px = startX + x;
				const py = startY + y;
				if (px >= width || py >= height) continue;
				const idx = (py * width + px) * 4;

				if (this.isEraser) {
					d[ idx + 3 ] = 0;
				} else {
					d[ idx ] = color.r;
					d[ idx + 1 ] = color.g;
					d[ idx + 2 ] = color.b;
					d[ idx + 3 ] = alpha;
				}
			}
		}
	}

	applyMirrors(tx, ty, color, alpha) {
		const { cols, rows } = this.getTileMetrics();
		const mirrors = [];

		switch (this.mode) {
			case "H": mirrors.push({ tx, ty: rows - ty - 1 }); break;
			case "V": mirrors.push({ tx: cols - tx - 1, ty }); break;
			case "B":
				mirrors.push({ tx, ty: rows - ty - 1 });
				mirrors.push({ tx: cols - tx - 1, ty });
				mirrors.push({ tx: cols - tx - 1, ty: rows - ty - 1 });
				break;
			case "D": mirrors.push({ tx: cols - tx - 1, ty: rows - ty - 1 }); break;
		}

		mirrors.forEach(m => this.applyTile(m.tx, m.ty, color, alpha));
	}

	getTileColor(tx, ty) {
		const { tileW, tileH } = this.getTileMetrics();
		const px = tileW.slice(0, tx).reduce((a, v) => a + v, 0);
		const py = tileH.slice(0, ty).reduce((a, v) => a + v, 0);
		return this.getPixelColor(px, py);
	}

	floodFillTile(startTx, startTy) {
		const layer = this.cm.activeLayer;
		if (!layer) return;

		const { cols, rows } = this.getTileMetrics();
		const startColor = this.getTileColor(startTx, startTy);

		const stack = [ { x: startTx, y: startTy } ];
		const visited = new Set();

		while (stack.length) {
			const { x: tx, y: ty } = stack.pop();
			const key = `${tx},${ty}`;
			if (visited.has(key)) continue;
			visited.add(key);

			if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) continue;

			const c = this.getTileColor(tx, ty);
			if (!this.colorsMatch(c, startColor)) continue;

			this.applyTile(tx, ty, this.currentColor, 255);

			// Push neighbors AFTER current tile is applied
			const neighbors = [
				{ x: tx + 1, y: ty },
				{ x: tx - 1, y: ty },
				{ x: tx, y: ty + 1 },
				{ x: tx, y: ty - 1 }
			];

			for (const n of neighbors) {
				const nKey = `${n.x},${n.y}`;
				if (!visited.has(nKey)) {
					stack.push(n);
				}
			}
		}

		layer.redraw();
		this.cm.redraw();
		snapshot("Flood Fill");
	}

	// ----------------------------
	// Line Drawing
	// ----------------------------
	drawLine(p0, p1) {
		const pixels = this.bresenham(p0.x, p0.y, p1.x, p1.y);

		pixels.forEach(({ x, y }) => {
			this.applyTile(x, y);
			if (this.mode !== "N") this.applyMirrors(x, y, this.currentColor, 255);
		});

		this.cm.activeLayer.redraw();
		this.cm.redraw();
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

	// ----------------------------
	// Misc
	// ----------------------------
	setEraser() {
		this.isEraser = true;
		this.updateDisplay();
	}

	updateDisplay() {
		this.displayEl.textContent = `Mode: ${this.mode} | Color: ${this.isEraser ? "Eraser" : this.colorPicker.value}`;
	}
}

// ----------------------------
// Prototype augmentation
// ----------------------------
DrawingTool.prototype.getState = function () {
	return {
		mode: this.mode,
		isEraser: this.isEraser,
		tileSize: this.tileSize
	};
};

DrawingTool.prototype.setState = function (state) {
	this.mode = state.mode;
	this.isEraser = state.isEraser;
	this.tileSize = state.tileSize;
	this.updateDisplay();
};
