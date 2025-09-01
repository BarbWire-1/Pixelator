/*
MIT License
Copyright(c) 2025 Barbara Kälin aka BarbWire - 1
*/
// TODO CRASHED!!!!!!
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
// TODO - check to receive the clusters from kMeans and store on layer
	//=========================
	// PALETTE CREATION FROM LAYER
	//=========================
	createPalette() {
		if (!this.cm.activeLayer || !this.cm.activeLayer.imageData) return;

		const { width, height, data } = this.cm.activeLayer.imageData;
		const pixelCount = width * height;

		// We'll store 32-bit color keys for quick lookup
		const clusterMap = new Map();

		// Pre-pass over imageData
		for (let i = 0; i < pixelCount; i++) {
			const idx = i * 4;
			const r = data[ idx ], g = data[ idx + 1 ], b = data[ idx + 2 ], a = data[ idx + 3 ];
			if (r + g + b + a === 0) continue; // skip fully transparent

			const colorKey = (r << 24) | (g << 16) | (b << 8) | a;
			if (!clusterMap.has(colorKey)) {
				clusterMap.set(colorKey, { indices: new Uint32Array(pixelCount), count: 0, r, g, b, a });
			}
			const cluster = clusterMap.get(colorKey);
			cluster.indices[ cluster.count++ ] = idx;
		}

		// Clear previous palette
		this.clearPaletteContainer();
		this.addDeselectSwatch();

		// Convert clusters to swatches
		const clusters = Array.from(clusterMap.values());
		const sortedColors = smoothSort(clusters.map(c => ({ r: c.r, g: c.g, b: c.b, a: c.a })));

		sortedColors.forEach(c => {
			const cluster = clusters.find(cl => cl.r === c.r && cl.g === c.g && cl.b === c.b && cl.a === c.a);
			if (!cluster) return;

			this.addColorSwatch(c, cluster.indices.subarray(0, cluster.count));
		});

	}


	addDeselectSwatch() {
		const deselectDiv = document.createElement("div");
		deselectDiv.className = "swatch deselect";
		deselectDiv.title = "Deselect";
		this.container.appendChild(deselectDiv);
	}

	addColorSwatch(colorData, clusterIndices = null) {
		const { r, g, b, a } = colorData;
		if (r + g + b + a === 0) return; // skip fully transparent

		const div = this.swatchTemplate.content.firstElementChild.cloneNode(true);
		div.style.backgroundColor = `rgb(${r},${g},${b})`;
		div.title = "Keep pressed to highlight pixels";
		this.container.appendChild(div);

		const swatch = { r, g, b, a, div };
		if (clusterIndices) swatch.indices = clusterIndices;

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
		this.colorPicker.value = "#ff0000";
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
	getPixels(swatch) {
		if (!swatch?.indices || !swatch.indices.length) return [];

		// Wrap each index for compatibility with applyPixels
		return Array.from(swatch.indices, i => ({ index: i }));
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
///////////////
