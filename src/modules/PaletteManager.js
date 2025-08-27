/*
MIT License
Copyright(c) 2025 Barbara Kälin aka BarbWire - 1
*/

import { snapshot } from "../main.js";

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
		this.clearPaletteContainer();
		this.addDeselectSwatch();

		this.cm.activeLayer.colorClusters.forEach(({ color }) => {
			this.addColorSwatch({
				r: color[ 0 ],
				g: color[ 1 ],
				b: color[ 2 ],
				a: color[ 3 ]
			});
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
		const applyHighlight = () => {
			const pixels = this.getPixels(swatch);
			this.cm.recolorPixels(pixels, 0, 255, 255, false); // highlight neon
			this.cm.drawBoundingBox(pixels); // show bbox while holding
		};

		const resetColor = () => {
			const pixels = this.getPixels(swatch);
			this.cm.recolorPixels(pixels, swatch.r, swatch.g, swatch.b, false);
			this.cm.redraw(); // remove bbox after release
		};

		swatch.div.addEventListener("mousedown", applyHighlight);
		swatch.div.addEventListener("mouseup", resetColor);
		swatch.div.addEventListener("mouseleave", resetColor); // cancel if mouse leaves
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

		const pixels = this.getPixels(swatch);
		this.cm.redraw();
		this.cm.drawBoundingBox(pixels);

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

		const { r, g, b } = swatchOrColor;
		const cluster = this.cm.activeLayer.colorClusters.find(c =>
			c.color[ 0 ] === r && c.color[ 1 ] === g && c.color[ 2 ] === b
		);
		return cluster ? cluster.indices.map(i => ({ index: i })) : [];
	}

	eraseSelectedPixels() {
		if (!this.selectedSwatch) return;
		const pixels = this.getPixels(this.selectedSwatch);
		this.cm.erasePixels(pixels);
		this.selectedSwatch.div.classList.add("erased");
		snapshot("Erase selected swatch");
	}

	recolorSelectedPixels(r, g, b, log = true) {
		if (!this.selectedSwatch) return;

		const sw = this.selectedSwatch;

		// Get old pixels
		const pixels = this.getPixels(sw);

		// Recolor in canvas
		this.cm.recolorPixels(pixels, r, g, b, log);

		// Update cluster in layer
		const cluster = this.cm.activeLayer.colorClusters.find(c =>
			c.color[ 0 ] === sw.r && c.color[ 1 ] === sw.g && c.color[ 2 ] === sw.b
		);
		if (cluster) cluster.color = [ r, g, b, cluster.color[ 3 ] ]; // preserve alpha

		// Update swatch
		sw.r = r; sw.g = g; sw.b = b;
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
