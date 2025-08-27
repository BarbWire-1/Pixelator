/*
MIT License
Copyright(c) 2025 Barbara Kälin aka BarbWire - 1
*/

import { snapshot } from "../main.js";
import { smoothSort } from "./smoothSort.js";

export class PaletteManager {
	constructor (canvasManager, swatchesContainer, colorPickerEl) {
		this.cm = canvasManager;
		this.container = swatchesContainer;
		this.colorPicker = colorPickerEl;
		this.swatches = [];
		this.selectedSwatch = null;

		this.swatchTemplate = document.createElement('template');
		this.swatchTemplate.innerHTML = `<div class="swatch"></div>`;

		this.container.addEventListener("click", (e) => this.handleClick(e));

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

	//=========================
	// PALETTE CREATION FROM LAYER
	//=========================
	createPalette() {
		if (!this.cm.activeLayer || !this.cm.activeLayer.colorClusters) return;

		//console.log(this.cm.activeLayer.colorClusters)
		this.clearPaletteContainer();
		this.addDeselectSwatch();

		// Extract colors
		const palette = this.cm.activeLayer.colorClusters.map(({ color }) => ({
			r: color[ 0 ],
			g: color[ 1 ],
			b: color[ 2 ],
			a: color[ 3 ]
		}));

		// Sort them perceptually
		const sorted = smoothSort(palette);

		sorted.forEach(color => {
			this.addColorSwatch(color);
		});
	}


	addDeselectSwatch() {
		const deselectDiv = document.createElement("div");
		deselectDiv.className = "swatch deselect";
		deselectDiv.title = "Deselect";
		this.container.appendChild(deselectDiv);
	}

	addColorSwatch(colorData) {
		const { r, g, b, a } = colorData;
		if (r + g + b + a === 0) return; // skip fully transparent black

		const div = this.swatchTemplate.content.firstElementChild.cloneNode(true);
		div.style.backgroundColor = `rgb(${r},${g},${b})`;
		div.title = "Keep pressed to highlight pixels";
		this.container.appendChild(div);

		const swatch = { r, g, b, div };
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

	//=========================
	// SWATCH SELECTION
	//=========================
	handleClick(e) {
		const div = e.target.closest(".swatch");
		if (!div) return null;
		if (div.classList.contains("deselect")) return this.deselectSwatch();

		const swatch = this.swatches.find(s => s.div === div);
		if (swatch) this.selectSwatch(swatch);
	}

	deselectSwatch() {
		if (!this.selectedSwatch) return;
		this.selectedSwatch.div.classList.remove("selected");
		this.selectedSwatch = null;
		this.cm.redraw();
		this.colorPicker.value = "#ff0000    ⎘";
	}

	selectSwatch(swatch) {
		if (this.selectedSwatch) this.selectedSwatch.div.classList.remove("selected");
		swatch.div.classList.add("selected");
		this.selectedSwatch = swatch;

		this.cm.redraw();
		this.drawBoundingBox(swatch);

		const hex = this.colorPicker.value = this.rgbToHex(swatch.r, swatch.g, swatch.b);
		this.updateHexDisplay(hex);
	}

	updateHexDisplay(hex) {
		const hexValue = document.getElementById("hexValue");
		hexValue.textContent = hex;
	}

	getSelectedColor() {
		if (!this.selectedSwatch) return null;
		return { r: this.selectedSwatch.r, g: this.selectedSwatch.g, b: this.selectedSwatch.b };
	}

	setSelectedColor(color) {
		if (!color) {
			this.deselectSwatch();
			return;
		}
		const swatch = this.swatches.find(s => s.r === color.r && s.g === color.g && s.b === color.b);
		if (swatch) this.selectSwatch(swatch);
	}

	//=========================
	// PIXEL OPERATIONS
	//=========================
	getPixels(swatchOrColor) {
		if (!this.cm.activeLayer || !this.cm.activeLayer.colorClusters) return [];

		if (swatchOrColor?.r != null && swatchOrColor?.g != null && swatchOrColor?.b != null) {
			const cluster = this.cm.activeLayer.colorClusters.find(c =>
				c.color[ 0 ] === swatchOrColor.r &&
				c.color[ 1 ] === swatchOrColor.g &&
				c.color[ 2 ] === swatchOrColor.b
			);
			if (cluster) return cluster.indices.map(i => ({ index: i }));
		}

		return [];
	}

	applyPixels(pixels, { r = null, g = null, b = null, erase = false } = {}) {
		if (!pixels.length || !this.cm.activeLayer) return;

		const data = this.cm.activeLayer.imageData.data;
		for (const p of pixels) {
			const idx = p.index;
			if (erase) {
				data[ idx + 3 ] = 0;
			} else {
				data[ idx ] = r;
				data[ idx + 1 ] = g;
				data[ idx + 2 ] = b;
				data[ idx + 3 ] = 255;
			}
		}
		this.cm.redraw();
	}

	drawBoundingBox(pixels, color = "limegreen") {
		if (!pixels.length) return;

		let minX = this.cm.canvas.width, maxX = -1, minY = this.cm.canvas.height, maxY = -1;
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

	// Unified operations:
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

		// Update cluster in layer
		const cluster = this.cm.activeLayer.colorClusters.find(c =>
			c.color[ 0 ] === sw.r && c.color[ 1 ] === sw.g && c.color[ 2 ] === sw.b
		);
		if (cluster) cluster.color = new Uint8Array([ r, g, b, 255 ]);

		// Update swatch and pixels
		sw.r = r;
		sw.g = g;
		sw.b = b;
		this.applyPixels(pixels, { r, g, b });

		sw.div.style.backgroundColor = `rgb(${r},${g},${b})`;
		this.colorPicker.value = this.rgbToHex(r, g, b);
	}


	//=========================
	// HISTORY SUPPORT
	//=========================
	getPaletteState() {
		return this.swatches.map(s => ({
			r: s.r,
			g: s.g,
			b: s.b,
			selected: this.selectedSwatch === s
		}));
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
