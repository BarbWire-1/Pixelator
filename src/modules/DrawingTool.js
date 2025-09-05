/**
 * /*
 * MIT License
 * Copyright(c) 2025 Barbara Kälin aka BarbWire - 1
 * Writes directly into clusterData
 *
 * @format
 */

import { snapshot } from '../main.js';

export class DrawingTool {
	constructor(cm, colorPicker, modeSelect, displayEl) {
		this.cm = cm;

		this.canvas = cm.canvas;
		this.ctx = cm.ctx;
		this.colorPicker = colorPicker;
		this.modeSelect = modeSelect;
		this.displayEl = displayEl;

		this.drawing = false;
		this.start = null;
		this.currentColor = { r: 0, g: 0, b: 0, a: 255 };
		this.mode = 'N'; // Normal, H, V, B, D
		this.isEraser = false;

		this.bindEvents();
		this.updateDisplay();
	}

	bindEvents() {
		const canvasEvents = {
			mousedown: e => this.startDraw(e),
			mousemove: e => this.drawMove(e),
			mouseup: () => this.endDraw(),
			mouseleave: () => this.endDraw(),
		};
		for (const [event, handler] of Object.entries(canvasEvents)) {
			this.canvas.addEventListener(event, handler);
		}
		if (this.modeSelect) {
			this.modeSelect.addEventListener('change', () => {
				this.mode = this.modeSelect.value;
				this.updateDisplay();
			});
		}
	}

	// -----------------------------
	// Color
	// -----------------------------
	updateCurrentColor() {
		const hex = this.colorPicker.value;
		this.currentColor = {
			r: parseInt(hex.substr(1, 2), 16),
			g: parseInt(hex.substr(3, 2), 16),
			b: parseInt(hex.substr(5, 2), 16),
			a: 255,
		};
	}

	// -----------------------------
	// Mouse -> Cluster Mapping (using renderMetrics)
	// -----------------------------
	mouseToCluster(e) {
		const layer = this.cm.activeLayer;
		const metrics = this.cm.renderMetrics;
		if (!layer || !layer.clusteredData || !metrics) return null;

		const rect = this.canvas.getBoundingClientRect();
		const mouseX = e.clientX - rect.left;
		const mouseY = e.clientY - rect.top;

		let cx = Math.floor((mouseX / rect.width) * metrics.tempW);
		let cy = Math.floor((mouseY / rect.height) * metrics.tempH);

		cx = Math.max(0, Math.min(cx, metrics.tempW - 1));
		cy = Math.max(0, Math.min(cy, metrics.tempH - 1));

		return { cx, cy };
	}

	// -----------------------------
	// Brush / Draw
	// -----------------------------
	applyClusterPixel(cx, cy, color = this.currentColor) {
		const layer = this.cm.activeLayer;
		if (!layer || !layer.clusteredData) return;

		const idx = (cy * layer.tempWidth + cx) * 4;
		const data = layer.clusteredData;

		if (this.isEraser) {
			data[idx + 3] = 0; // transparent
		} else {
			data[idx] = color.r;
			data[idx + 1] = color.g;
			data[idx + 2] = color.b;
			data[idx + 3] = color.a;
		}

		// Apply mirrors if needed
		this.applyMirrors(cx, cy, color);

		// Redraw with tilesize
		layer.applyClusteredData(
			data,
			layer.tempWidth,
			layer.tempHeight,
			this.cm.tileSize,
		);
		this.cm.redraw();
	}

	applyMirrors(cx, cy, color) {
		const layer = this.cm.activeLayer;
		if (!layer || this.mode === 'N') return;

		const w = layer.tempWidth;
		const h = layer.tempHeight;
		const mirrors = [];

		switch (this.mode) {
			case 'H':
				mirrors.push({ cx, cy: h - cy - 1 });
				break;
			case 'V':
				mirrors.push({ cx: w - cx - 1, cy });
				break;
			case 'B':
				mirrors.push({ cx, cy: h - cy - 1 });
				mirrors.push({ cx: w - cx - 1, cy });
				mirrors.push({ cx: w - cx - 1, cy: h - cy - 1 });
				break;
			case 'D':
				mirrors.push({ cx: w - cx - 1, cy: h - cy - 1 });
				break;
		}

		const data = layer.clusteredData;
		for (const m of mirrors) {
			const idx = (m.cy * w + m.cx) * 4;
			if (this.isEraser) data[idx + 3] = 0;
			else {
				data[idx] = color.r;
				data[idx + 1] = color.g;
				data[idx + 2] = color.b;
				data[idx + 3] = color.a;
			}
		}
	}

	// -----------------------------
	// Line Drawing (Bresenham)
	// -----------------------------
	drawLine(p0, p1) {
		const pixels = this.bresenham(p0.cx, p0.cy, p1.cx, p1.cy);
		for (const { x, y } of pixels) this.applyClusterPixel(x, y);
	}

	bresenham(x0, y0, x1, y1) {
		const pixels = [];
		let dx = Math.abs(x1 - x0),
			sx = x0 < x1 ? 1 : -1;
		let dy = -Math.abs(y1 - y0),
			sy = y0 < y1 ? 1 : -1;
		let err = dx + dy;

		while (true) {
			pixels.push({ x: x0, y: y0 });
			if (x0 === x1 && y0 === y1) break;
			const e2 = 2 * err;
			if (e2 >= dy) {
				err += dy;
				x0 += sx;
			}
			if (e2 <= dx) {
				err += dx;
				y0 += sy;
			}
		}
		return pixels;
	}

	// -----------------------------
	// Flood Fill (cluster coords)
	// -----------------------------
	floodFillCluster(startCx, startCy) {
		const layer = this.cm.activeLayer;
		if (!layer || !layer.clusteredData) return;

		const data = layer.clusteredData;
		const w = layer.tempWidth;
		const h = layer.tempHeight;

		const startIdx = (startCy * w + startCx) * 4;
		const startColor = [
			data[startIdx],
			data[startIdx + 1],
			data[startIdx + 2],
			data[startIdx + 3],
		];

		const stack = [{ x: startCx, y: startCy }];
		const visited = new Set();

		while (stack.length) {
			const { x, y } = stack.pop();
			const key = `${x},${y}`;
			if (visited.has(key)) continue;
			visited.add(key);

			if (x < 0 || y < 0 || x >= w || y >= h) continue;

			const idx = (y * w + x) * 4;
			if (
				data[idx] !== startColor[0] ||
				data[idx + 1] !== startColor[1] ||
				data[idx + 2] !== startColor[2] ||
				data[idx + 3] !== startColor[3]
			)
				continue;

			this.applyClusterPixel(x, y);

			stack.push({ x: x + 1, y });
			stack.push({ x: x - 1, y });
			stack.push({ x, y: y + 1 });
			stack.push({ x, y: y - 1 });
		}

		snapshot('Flood Fill');
	}

	// -----------------------------
	// Mouse Events
	// -----------------------------
	startDraw(e) {
		const tool = this.getActiveTool();
		if (!tool) return;

		const pos = this.mouseToCluster(e);
		if (!pos) return;
		this.updateCurrentColor();

		if (tool === 'fillRegion') {
			this.floodFillCluster(pos.cx, pos.cy);
			return;
		}

		this.drawing = true;
		this.start = pos;
		this.applyClusterPixel(pos.cx, pos.cy);
	}

	drawMove(e) {
		if (!this.drawing || !this.start) return;
		const pos = this.mouseToCluster(e);
		if (!pos) return;
		this.drawLine(this.start, pos);
		this.start = pos;
	}

	endDraw() {
		if (!this.drawing) return;
		this.drawing = false;
		this.start = null;
		snapshot('Draw');
	}

	//NEW
	// Apply new color to associated clusters
	applyPixels(swatch, { erase = false, r = null, g = null, b = null } = {}) {
		if (!swatch?.pixelRefs?.length) return;

		const layer = this.cm.activeLayer;
		if (!layer || !layer.clusteredData) return;

		const data = layer.clusteredData;
		const newR = r ?? swatch.r;
		const newG = g ?? swatch.g;
		const newB = b ?? swatch.b;

		for (const idx of swatch.pixelRefs) {
			if (erase) {
				data[idx + 3] = 0;
			} else {
				data[idx] = newR;
				data[idx + 1] = newG;
				data[idx + 2] = newB;
				data[idx + 3] = 255;
			}
		}

		layer.applyClusteredData(
			data,
			layer.tempWidth,
			layer.tempHeight,
			this.cm.tileSize,
		);
		this.cm.redraw();
	}

	// Draw bounding box around a set of pixelRefs
	drawSwatchBoundingBox(pixelRefs, color = 'limegreen') {
		if (!pixelRefs?.length) return;
		const layer = this.cm.activeLayer;
		if (!layer) return;

		const { tileSize, renderMetrics } = this.cm;
		const { tempW, scaleX } = renderMetrics;

		let minLeft = Infinity,
			minTop = Infinity,
			maxRight = -Infinity,
			maxBottom = -Infinity;

		for (const idx of pixelRefs) {
			const p = Math.floor(idx / 4);
			const cx = p % tempW;
			const cy = Math.floor(p / tempW);

			const left = cx * tileSize;
			const right = (cx + 1) * tileSize;
			const top = cy * tileSize;
			const bottom = (cy + 1) * tileSize;

			if (left < minLeft) minLeft = left;
			if (top < minTop) minTop = top;
			if (right > maxRight) maxRight = right;
			if (bottom > maxBottom) maxBottom = bottom;
		}

		const ctx = this.cm.ctx;
		ctx.save();
		console.log(scaleX);
		ctx.strokeStyle = color;
		ctx.lineWidth = 1 * scaleX;

		ctx.strokeRect(
			Math.floor(minLeft),
			Math.floor(minTop),
			Math.max(1, Math.ceil(maxRight - minLeft)),
			Math.max(1, Math.ceil(maxBottom - minTop)),
		);
		ctx.restore();
	}
	// Apply a swatch, optionally overriding color or erasing
	applySwatch(swatch, { erase = false, r = null, g = null, b = null } = {}) {
		const color = erase
			? null
			: { r: r ?? swatch.r, g: g ?? swatch.g, b: b ?? swatch.b, a: 255 };

		this.applyPixels(swatch, {
			erase,
			r: color?.r,
			g: color?.g,
			b: color?.b,
		});
	}
	// Highlight / restore swatch using DrawingTool
	highlightSwatch(swatch) {
		this.applySwatch(swatch, { r: 0, g: 255, b: 255 }); // cyan highlight
		this.drawSwatchBoundingBox(swatch.pixelRefs);
	}

	// Restore original swatch color
	restoreSwatchColor(swatch) {
		if (!swatch) return;
		this.applySwatch(swatch); // no override => uses swatch.r/g/b
	}

	// -----------------------------
	// Misc
	// -----------------------------
	getActiveTool() {
		const selected = document.querySelector(
			'input[name="toolMode"]:checked',
		);
		return selected ? selected.value : null;
	}

	setEraser() {
		this.isEraser = true;
		this.updateDisplay();
	}

	updateDisplay() {
		this.displayEl.textContent = `Mode: ${this.mode} | Color: ${
			this.isEraser ? 'Eraser' : this.colorPicker.value
		}`;
	}
}

// -----------------------------
// Prototype augmentation
// -----------------------------
DrawingTool.prototype.getState = function () {
	return {
		mode: this.mode,
		isEraser: this.isEraser,
	};
};

DrawingTool.prototype.setState = function (state) {
	this.mode = state.mode;
	this.isEraser = state.isEraser;
	this.updateDisplay();
};
