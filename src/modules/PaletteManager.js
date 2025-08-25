/*
MIT License
Copyright(c) 2025 Barbara Kälin aka BarbWire - 1
*/

import { snapshot } from "../main.js";
import { Colors } from "./Colors.js"
// TODO - move listeners OUT wire history in int
// TODO not sure about the listeners in here....
//=========================
// PALETTE MANAGER
//=========================
export class PaletteManager {
	constructor (canvasManager, swatchesContainer, colorPickerEl) {
		this.cm = canvasManager;
		this.container = swatchesContainer;
		this.colorPicker = colorPickerEl;
		this.swatches = [];
		this.selectedSwatch = null;

		this.swatchTemplate = document.createElement('template');
		this.swatchTemplate.innerHTML = `<div class="swatch"></div>`

		// Handle clicks on swatches
		this.container.addEventListener("click", (e) => this.handleClick(e));
		const hexDisplay = document.getElementById("hexDisplay");
		const hexValue = document.getElementById("hexValue");

		hexDisplay.addEventListener("click", () => {
			const hex = hexValue.textContent.trim();
			navigator.clipboard.writeText(hex).then(() => {
				// flash feedback
				const origColor = hexDisplay.style.backgroundColor;
				hexDisplay.style.backgroundColor = "#0af";
				setTimeout(() => hexDisplay.style.backgroundColor = origColor, 150);
			});
		});


	}

	//=========================
	// PALETTE CREATION WORKFLOW
	//=========================
	createPalette() {
		if (!this.cm.activeLayer) return null;
		this.clearPaletteContainer();

		// Extract and sort palette from active layer
		const palette = Colors.smoothSort(this.getPixelData());
		this.addDeselectSwatch();
		palette.forEach((color) => this.addColorSwatch(color));
	}

	getPixelData() {
		const data = this.cm.activeLayer.imageData.data;
		const palette = [];
		const colorMap = new Map();

		for (let i = 0; i < data.length; i += 4) {
			const r = data[ i ], g = data[ i + 1 ], b = data[ i + 2 ];
			const key = (r << 16) | (g << 8) | b;

			let entry = colorMap.get(key);
			if (!entry) {
				entry = { r, g, b, pixels: [] };
				colorMap.set(key, entry);
				palette.push(entry);
			}
			entry.pixels.push(i);
		}

		return palette;
	}

	addDeselectSwatch() {
		const deselectDiv = document.createElement("div");
		deselectDiv.className = "swatch deselect";
		deselectDiv.title = "Deselect";
		this.container.appendChild(deselectDiv);
	}

	addColorSwatch(colorData) {
		const { r, g, b, pixels } = colorData;

		// Clone the template
		const div = this.swatchTemplate.content.firstElementChild.cloneNode(true);
		div.style.backgroundColor = `rgb(${r},${g},${b})`;
		div.title = `Keep pressed to highlight pixels`;
		this.container.appendChild(div);

		// Create the swatch object before pushing to ref
		const swatch = {
			r,
			g,
			b,
			pixels: pixels.map(idx => ({ index: idx })), // keep as objects
			div
		};

		this.swatches.push(swatch);
		// Attach listeners via a class method
		this.attachSwatchListeners(swatch);

		return swatch;


	}

	attachSwatchListeners(swatch) {
		const applyNeon = () => this.cm.recolorPixels(swatch.pixels, 0, 255, 255, false);
		const resetColor = () => this.cm.recolorPixels(swatch.pixels, swatch.r, swatch.g, swatch.b, false);

		swatch.div.addEventListener("mousedown", applyNeon);
		swatch.div.addEventListener("mouseup", resetColor);
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

		const swatch = this.swatches.find((s) => s.div === div);

		swatch && this.selectSwatch(swatch);
	}

	deselectSwatch() {
		if (!this.selectedSwatch) return null;

		this.selectedSwatch.div.classList.remove("selected");
		this.selectedSwatch = null;
		this.cm.redraw();
		this.colorPicker.value = "#ff0000    ⎘";
	}

	selectSwatch(swatch) {
		if (this.selectedSwatch)
			this.selectedSwatch.div.classList.remove("selected");
		swatch.div.classList.add("selected");
		this.selectedSwatch = swatch;

		this.cm.redraw();
		// marks a bbox around the pixels of selected color
		this.cm.drawBoundingBox(swatch.pixels);

		const { r, g, b } = swatch;
		const hex = this.colorPicker.value = this.rgbToHex(r, g, b);

		this.updateHex(hex)



	}

	// update the hex programmatically
	updateHex(hex) {
		hexValue.textContent = hex;
	}


	getSelectedColor() {
		if (!this.selectedSwatch) return null;
		return {
			r: this.selectedSwatch.r,
			g: this.selectedSwatch.g,
			b: this.selectedSwatch.b
		};
	}

	setSelectedColor(color) {
		if (!color) {
			this.deselectSwatch();
			return;
		}
		const swatch = this.swatches.find((s) => s.r === color.r && s.g === color.g && s.b === color.b);
		if (swatch) this.selectSwatch(swatch);
	}

	//=========================
	// PIXEL OPERATIONS
	//=========================
	eraseSelectedPixels() {
		if (!this.selectedSwatch) return;
		this.cm.erasePixels(this.selectedSwatch.pixels);
		this.selectedSwatch.div.classList.add("erased");
		snapshot("Erase selected swatch");
	}

	recolorSelectedPixels(r, g, b) {
		if (!this.selectedSwatch) return;
		const sw = this.selectedSwatch;
		sw.r = r;
		sw.g = g;
		sw.b = b;
		sw.div.style.backgroundColor = `rgb(${r},${g},${b})`;


		//sw.div.classList.remove("erased");

		this.colorPicker.value = this.rgbToHex(r, g, b);
		this.cm.recolorPixels(this.selectedSwatch.pixels, r, g, b);


	}

	//=========================
	// HISTORY SUPPORT
	//=========================
	getPaletteState() {
		return this.swatches.map((s) => ({
			r: s.r,
			g: s.g,
			b: s.b,
			pixels: s.pixels.map((p) => p.index),
			selected: this.selectedSwatch === s
		}));
	}

	setPaletteState(state) {
		this.clearPaletteContainer();
		this.addDeselectSwatch();

		state.forEach(({ r, g, b, pixels, selected }) => {
			// Manually create swatch
			const div = this.swatchTemplate.content.firstElementChild.cloneNode(true);
			div.style.backgroundColor = `rgb(${r},${g},${b})`;
			this.container.appendChild(div);

			const swatch = { r, g, b, pixels: pixels.map(idx => ({ index: idx })), div };
			this.swatches.push(swatch);

			// Attach listeners
			this.attachSwatchListeners(swatch);

			if (selected) this.selectSwatch(swatch);
		});
	}

	//=========================
	// UTILITY - here needed for colorPicker.value
	//=========================
	rgbToHex(r, g, b) {
		return "#" + [ r, g, b ].map((x) => x.toString(16).padStart(2, "0")).join("");
	}
}
