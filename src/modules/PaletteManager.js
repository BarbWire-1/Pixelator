/*
MIT License
Copyright(c) 2025 Barbara Kälin aka BarbWire - 1
*/
import { snapshot } from "../main.js";
import { smoothSort } from "./smoothSort.js";

export class PaletteManager {
	constructor (cm, swatchesContainer, colorPickerEl) {
		this.cm = cm;
		this.container = swatchesContainer;
		this.colorPicker = colorPickerEl;
		this.swatches = [];
		this.selectedSwatch = null;

		this.swatchTemplate = document.createElement('template');
		this.swatchTemplate.innerHTML = `<div class="swatch"></div>`;

		this.container.addEventListener("click", e => this.handleClick(e));

		const hexDisplay = document.getElementById("hexDisplay");
		const hexValue = document.getElementById("hexValue");

		hexDisplay.addEventListener("click", () => {
			const hex = hexValue.textContent.trim();
			navigator.clipboard.writeText(hex).then(() => {
				const origColor = hexDisplay.style.backgroundColor;
				hexDisplay.style.backgroundColor = "#0af";
				setTimeout(() => hexDisplay.style.backgroundColor = origColor, 150);
			});
		});
	}

	// -----------------------------
	// PALETTE CREATION
	// -----------------------------
	createPalette() {
		const layer = this.cm.activeLayer;
		if (!layer || !layer.imageData) return;

		const { width, height, data } = layer.imageData;
		const pixelCount = width * height;
		const clusterMap = new Map();

		for (let i = 0; i < pixelCount; i++) {
			const idx = i * 4;
			const r = data[ idx ], g = data[ idx + 1 ], b = data[ idx + 2 ], a = data[ idx + 3 ];
			if (r + g + b + a === 0) continue;

			const key = (r << 24) | (g << 16) | (b << 8) | a;
			if (!clusterMap.has(key)) clusterMap.set(key, { r, g, b, a, indices: [] });
			clusterMap.get(key).indices.push(idx);
		}

		this.clearPaletteContainer();
		this.addDeselectSwatch();

		const clusters = Array.from(clusterMap.values());
		const sorted = smoothSort(clusters.map(c => ({ r: c.r, g: c.g, b: c.b, a: c.a })));

		sorted.forEach(c => {
			const cluster = clusters.find(cl => cl.r === c.r && cl.g === c.g && cl.b === c.b && cl.a === c.a);
			if (!cluster) return;
			this.addColorSwatch(c, cluster.indices);
		});
	}

	addDeselectSwatch() {
		const div = document.createElement("div");
		div.className = "swatch deselect";
		div.title = "Deselect";
		this.container.appendChild(div);
	}

	addColorSwatch(colorData, indices = []) {
		const { r, g, b, a } = colorData;
		if (r + g + b + a === 0) return;

		const div = this.swatchTemplate.content.firstElementChild.cloneNode(true);
		div.style.backgroundColor = `rgb(${r},${g},${b})`;
		div.title = "Keep pressed to highlight pixels";
		this.container.appendChild(div);

		const swatch = { r, g, b,  div, indices };
		this.swatches.push(swatch);
		this.attachSwatchListeners(swatch);
		return swatch;
	}

	attachSwatchListeners(swatch) {
		swatch.div.addEventListener("mousedown", () => this.highlightSwatch(swatch));
		swatch.div.addEventListener("mouseup", () => this.resetSwatchColor(swatch));
	}

	clearPaletteContainer() {
		this.container.innerHTML = "";
		this.swatches = [];
	}

	// -----------------------------
	// SWATCH SELECTION
	// -----------------------------
	handleClick(e) {
		const div = e.target.closest(".swatch");
		if (!div) return;
		if (div.classList.contains("deselect")) return this.deselectSwatch();

		const swatch = this.swatches.find(s => s.div === div);
		if (swatch) this.selectSwatch(swatch);
	}

	deselectSwatch() {
		if (!this.selectedSwatch) return;
		this.selectedSwatch.div.classList.remove("selected");
		this.selectedSwatch = null;
		this.cm.redraw();
		this.colorPicker.value = "#ff0000";
	}

	selectSwatch(swatch) {
		if (this.selectedSwatch) this.selectedSwatch.div.classList.remove("selected");
		swatch.div.classList.add("selected");
		this.selectedSwatch = swatch;

		this.cm.redraw();
		this.drawBoundingBox(this.getPixels(swatch));

		const hex = this.colorPicker.value = this.rgbToHex(swatch.r, swatch.g, swatch.b);
		document.getElementById("hexValue").textContent = hex;
	}

	// -----------------------------
	// PIXEL OPERATIONS
	// -----------------------------
	getPixels(swatch) {
		if (!swatch?.indices?.length) return [];
		return swatch.indices.map(i => ({ index: i }));
	}

	applyPixels(pixels, { r = null, g = null, b = null, erase = false } = {}) {
		const layer = this.cm.activeLayer;
		if (!pixels.length || !layer || !layer.imageData) return;

		const data = layer.imageData.data;
		for (const p of pixels) {
			const idx = p.index;
			if (erase) data[ idx + 3 ] = 0;
			else {
				data[ idx ] = r; data[ idx + 1 ] = g; data[ idx + 2 ] = b; data[ idx + 3 ] = 255;
			}
		}

		layer.ctx.putImageData(layer.imageData, 0, 0);
		this.cm.redraw();
	}

	drawBoundingBox(pixels, color = "limegreen") {
		if (!pixels.length) return;

		let minX = Infinity, maxX = -1, minY = Infinity, maxY = -1;
		for (const p of pixels) {
			const idx = p.index / 4;
			const x = idx % this.cm.canvas.width;
			const y = Math.floor(idx / this.cm.canvas.width);
			minX = Math.min(minX, x);
			maxX = Math.max(maxX, x);
			minY = Math.min(minY, y);
			maxY = Math.max(maxY, y);
		}

		const ctx = this.cm.ctx;
		ctx.strokeStyle = color;
		ctx.lineWidth = 1;
		ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
	}

	highlightSwatch(swatch) {
		const pixels = this.getPixels(swatch);
		if (!pixels.length) return;
		this.applyPixels(pixels, { r: 0, g: 255, b: 255 });
		this.drawBoundingBox(pixels);
	}

	resetSwatchColor(swatch) {
		const pixels = this.getPixels(swatch);
		if (!pixels.length) return;
		this.applyPixels(pixels, { r: swatch.r, g: swatch.g, b: swatch.b });
	}

	eraseSelectedPixels() {
		if (!this.selectedSwatch) return;
		const pixels = this.getPixels(this.selectedSwatch);
		if (!pixels.length) return;
		this.applyPixels(pixels, { erase: true });
		this.selectedSwatch.div.classList.add("erased");
		snapshot("Erase selected swatch");
	}

	recolorSelectedPixels(r, g, b) {
		if (!this.selectedSwatch) return;
		const sw = this.selectedSwatch;
		const pixels = this.getPixels(sw);
		if (!pixels.length) return;

		sw.r = r; sw.g = g; sw.b = b;
		this.applyPixels(pixels, { r, g, b });

		sw.div.style.backgroundColor = `rgb(${r},${g},${b})`;
		this.colorPicker.value = this.rgbToHex(r, g, b);
	}

	// -----------------------------
	// HISTORY SUPPORT
	// -----------------------------
	getPaletteState() {
		return this.swatches.map(s => ({ r: s.r, g: s.g, b: s.b, selected: this.selectedSwatch === s }));
	}

	setPaletteState(state) {
		this.clearPaletteContainer();
		this.addDeselectSwatch();

		state.forEach(({ r, g, b, selected }) => {
			const div = this.swatchTemplate.content.firstElementChild.cloneNode(true);
			div.style.backgroundColor = `rgb(${r},${g},${b})`;
			this.container.appendChild(div);

			const swatch = { r, g, b, div };
			this.swatches.push(swatch);
			this.attachSwatchListeners(swatch);

			if (selected) this.selectSwatch(swatch);
		});
	}

	rgbToHex(r, g, b) {
		return "#" + [ r, g, b ].map(x => x.toString(16).padStart(2, "0")).join("");
	}
}
