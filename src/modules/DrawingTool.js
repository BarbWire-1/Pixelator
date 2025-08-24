/*
MIT License
Copyright(c) 2025 Barbara Kälin aka BarbWire - 1
*/
import { snapshot } from '../main.js';

// !!! CAREFUL: THIS FUNCTION USES TILE INDICES, NOT PIXEL COORDINATES
// Mixing these up will silently break drawing & fill.
// Spent HOURS in the rabbit hole on this one!


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

	getMouseTile(e) {
		const rect = this.canvas.getBoundingClientRect();
		const scaleX = this.canvas.width / rect.width;
		const scaleY = this.canvas.height / rect.height;

		const x = Math.floor((e.clientX - rect.left) * scaleX / this.tileSize);
		const y = Math.floor((e.clientY - rect.top) * scaleY / this.tileSize);

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
		const layer = this.cm.activeLayer;
		const idx = (y * layer.width + x) * 4;
		const d = layer.imageData.data;
		return {
			r: d[ idx ],
			g: d[ idx + 1 ],
			b: d[ idx + 2 ],
			a: d[ idx + 3 ]
		};
	}

	setPixel(x, y, color, alpha = 255) {
		const layer = this.cm.activeLayer;
		//if (!layer || x < 0 || y < 0 || x >= layer.width || y >= layer.height) return;
		const idx = (y * layer.width + x) * 4;
		const d = layer.imageData.data;
		d[ idx ] = color.r;
		d[ idx + 1 ] = color.g;
		d[ idx + 2 ] = color.b;
		d[ idx + 3 ] = alpha;
	}

	// applyTile works for brush and eraser
	applyTile(tx, ty, color = this.currentColor, alpha = 255) {
		const ts = this.tileSize;
		const layer = this.cm.activeLayer;
		const d = layer.imageData.data;

		for (let y = 0; y < ts; y++) {
			for (let x = 0; x < ts; x++) {
				const px = tx * ts + x;
				const py = ty * ts + y;
				if (px >= layer.width || py >= layer.height) continue;
				const idx = (py * layer.width + px) * 4;

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
		const layer = this.cm.activeLayer;

		const cols = Math.floor(layer.width / this.tileSize);
		const rows = Math.floor(layer.height / this.tileSize);
		// store the commands to set "pixels"
		const mirrors = [];

		// Push mirrored coordinates based on mode
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

		// Apply mirrored tiles
		mirrors.forEach(m => {
			for (let y = 0; y < this.tileSize; y++) {
				for (let x = 0; x < this.tileSize; x++) {
					this.setPixel(m.tx * this.tileSize + x, m.ty * this.tileSize + y, color, alpha);
				}
			}
		});
	}


	// ----------------------------
	// Line Drawing
	// ----------------------------
	drawLine(p0, p1) {
		// Bresenham line calculation
		const pixels = this.bresenham(p0.x, p0.y, p1.x, p1.y);
		// apply brush/eraser per tile
		pixels.forEach(({ x, y }) => this.applyTile(x, y));
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
	// Flood Fill
	// ----------------------------
	floodFillTile(startTx, startTy) {
    const layer = this.cm.activeLayer;
    const width = Math.floor(layer.width / this.tileSize);
    const height = Math.floor(layer.height / this.tileSize);
    const stack = [ { x: startTx, y: startTy } ];
    const visited = new Set();
    const newColor = this.currentColor;

    // sample start color once
    const startColor = this.getPixelColor(startTx * this.tileSize, startTy * this.tileSize);

    const getTileColor = (tx, ty) => {
        const px = tx * this.tileSize;
        const py = ty * this.tileSize;
        return this.getPixelColor(px, py);
    };

    while (stack.length) {
        const { x: tx, y: ty } = stack.pop();
        const key = `${tx},${ty}`;
        if (visited.has(key)) continue;
        visited.add(key);

        if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;

        const c = getTileColor(tx, ty);

        if (c.r !== startColor.r || c.g !== startColor.g || c.b !== startColor.b) continue;

        this.applyTile(tx, ty, newColor, 255);

        // push 4-neighbours
        stack.push({ x: tx + 1, y: ty });
        stack.push({ x: tx - 1, y: ty });
        stack.push({ x: tx, y: ty + 1 });
        stack.push({ x: tx, y: ty - 1 });
    }

    // only redraw once at the end
		this.cm.redraw();
		snapshot("Flood Fill");
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
