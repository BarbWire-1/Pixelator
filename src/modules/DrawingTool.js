/*
MIT License
Copyright(c) 2025 Barbara Kälin aka BarbWire - 1
*/
import { snapshot } from '../main.js';

// !!! CAREFUL: THIS FUNCTION USES TILE INDICES, NOT PIXEL COORDINATES
// Mixing these up will silently break drawing & fill.
// Spent HOURS in the rabbit hole on this one!

// TODO - currently decided AGAINST writing changes to cluster, so drawing is lost on re-quantize. Later maybe use layers to preserve drawing as separate layer(s).
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
		// Canvas events
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

	getMouseTile(e) {
		const rect = this.canvas.getBoundingClientRect();
		const scaleX = this.canvas.width / rect.width;
		const scaleY = this.canvas.height / rect.height;
		const ts = this.tileSize;

		const x = Math.floor((e.clientX - rect.left) * scaleX / ts);
		const y = Math.floor((e.clientY - rect.top) * scaleY / ts);

		return { x, y };
	}
	getActiveTool() {
		const selected = document.querySelector('input[name="toolMode"]:checked');
		return selected ? selected.value : null;
	}

	// ----------------------------
	// Drawing / Mouse Actions
	// ----------------------------
	startDraw(e) {
		const tool = this.getActiveTool();
		if (!tool) return;

		const { x, y } = this.getMouseTile(e);
		this.updateCurrentColor();

		// in startDraw
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

	endDraw(e) {
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
		//snapshot("Color Changed");
	}

	// ----------------------------
	// Pixel Operations
	// ----------------------------
	getPixelColor(x, y) {
		const { width, imageData } = this.cm.activeLayer;
		const idx = (y * width + x) * 4;
		const d = imageData.data;
		return {
			r: d[ idx ],
			g: d[ idx + 1 ],
			b: d[ idx + 2 ],
			a: d[ idx + 3 ]
		};
	}

	setPixel(x, y, color, alpha = 255) {
		const { width, imageData } = this.cm.activeLayer;
		const d = imageData.data;
		const { r, g, b, a } = color;
		const idx = (y * width + x) * 4;
		d[ idx ] = r;
		d[ idx + 1 ] = g;
		d[ idx + 2 ] = b;
		d[ idx + 3 ] =a;
	}

	// applyTile works for brush and eraser
	applyTile(tx, ty, color = this.currentColor, alpha = 255) {
		const ts = this.tileSize;
		const { width, height, imageData } = this.cm.activeLayer;
		const d = imageData.data;

		for (let y = 0; y < ts; y++) {
			for (let x = 0; x < ts; x++) {
				const px = tx * ts + x;
				const py = ty * ts + y;
				if (px >= width || py >= height) continue;
				const idx = (py * width + px) * 4;

				if (this.isEraser) {
					d[ idx + 3 ] = 0; // erase
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
		const { width, height } = this.cm.activeLayer;
		const ts = this.tileSize;
		const cols = Math.floor(width / ts);
		const rows = Math.floor(height / ts);
		const mirrors = [];

		switch (this.mode) {
			case "H":
				mirrors.push({ tx, ty: rows - ty - 1 });
				break;
			case "V":
				mirrors.push({ tx: cols - tx - 1, ty });
				break;
			case "B":
				mirrors.push({ tx, ty: rows - ty - 1 });
				mirrors.push({ tx: cols - tx - 1, ty });
				mirrors.push({ tx: cols - tx - 1, ty: rows - ty - 1 });
				break;
			case "D":
				mirrors.push({ tx: cols - tx - 1, ty: rows - ty - 1 });
				break;
		}

		mirrors.forEach(m => this.applyTile(m.tx, m.ty, color, alpha));
	}

	floodFillTile(startTx, startTy) {
		const { width: layerWidth, height: layerHeight } = this.cm.activeLayer;
		const ts = this.tileSize;
		const width = Math.floor(layerWidth / ts);
		const height = Math.floor(layerHeight / ts);

		const stack = [ { x: startTx, y: startTy } ];
		const visited = new Set();
		const newColor = this.currentColor;
		const startColor = this.getPixelColor(startTx * ts, startTy * ts);

		const getTileColor = (tx, ty) => {
			const px = tx *ts;
			const py = ty * ts;
			return this.getPixelColor(px, py);
		};

		// search neighbours
		while (stack.length) {
			const { x: tx, y: ty } = stack.pop();
			const key = `${tx},${ty}`;
			if (visited.has(key)) continue;
			visited.add(key);

			if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;

			const c = getTileColor(tx, ty);
			if (c.r !== startColor.r || c.g !== startColor.g || c.b !== startColor.b) continue;

			this.applyTile(tx, ty, newColor, 255);

			stack.push({ x: tx + 1, y: ty });
			stack.push({ x: tx - 1, y: ty });
			stack.push({ x: tx, y: ty + 1 });
			stack.push({ x: tx, y: ty - 1 });
		}

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
			if (this.mode !== "N") {
				this.applyMirrors(x, y, this.currentColor, 255);
			}
		});

		// NEW: sync layer’s buffer to its canvas
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

// DrawingTool.js prototype augmentation
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

	// update radio buttons in DOM
	document.querySelectorAll('input[name="toolMode"]').forEach(radio => {
		radio.checked = (radio.value === this.mode || (this.isEraser && radio.value === "eraser"));
	});
};
