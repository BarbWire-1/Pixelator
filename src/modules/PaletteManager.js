/*
MIT License
Copyright(c) 2025 Barbara Kälin aka BarbWire - 1
*/
import { snapshot } from "../main.js";
import { smoothSort } from "./smoothSort.js";

export class PaletteManager {
	constructor(cm, swatchesContainer, colorPickerEl) {
		this.cm = cm;
		this.container = swatchesContainer;
		this.colorPicker = colorPickerEl;
		this.swatches = [];
		this.selectedSwatch = null;

		this.swatchTemplate = document.createElement('template');
		this.swatchTemplate.innerHTML = `<div class="swatch"></div>`;

		this.container.addEventListener("click", e => this.handleClick(e));
	}

	// -----------------------------
	// PALETTE CREATION
	// -----------------------------
	createPalette() {
		const layer = this.cm.activeLayer;
		if (!layer || !layer.colors || !layer.clusters) return;

		this.clearPaletteContainer();
		this.addDeselectSwatch();

		// 1. pair each color with its cluster index
const colorPairs = layer.colors.map((color, i) => ({ color, clusterIndex: i }));

// 2. sort by color (smoothSort works on color arrays)
const sortedPairs = smoothSort(colorPairs.map(p => p.color))
    .map(sortedColor => colorPairs.find(p => p.color === sortedColor));

// 3. create swatches in sorted order
sortedPairs.forEach(p => {
    const indices = layer.clusters[p.clusterIndex];
    this.addColorSwatch(p.color, indices);
});

	}

	addDeselectSwatch() {
		const div = document.createElement("div");
		div.className = "swatch deselect";
		div.title = "Deselect";
		this.container.appendChild(div);
	}

	addColorSwatch(colorArray, indices) {
		const [r, g, b] = colorArray;
		if (r + g + b === 0) return;

		const div = this.swatchTemplate.content.firstElementChild.cloneNode(true);
		div.style.backgroundColor = `rgb(${r},${g},${b})`;
		div.title = "Keep pressed to highlight pixels";
		this.container.appendChild(div);

		const swatch = { r, g, b, div, pixelRefs: indices };
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

	selectSwatch(swatch) {
		if (this.selectedSwatch) this.selectedSwatch.div.classList.remove("selected");
		swatch.div.classList.add("selected");
		this.selectedSwatch = swatch;

		this.cm.redraw();
		this.drawBoundingBox(swatch.pixelRefs);

		this.colorPicker.value = this.rgbToHex(swatch.r, swatch.g, swatch.b);
		document.getElementById("hexValue").textContent = this.colorPicker.value;
	}

	deselectSwatch() {
		if (!this.selectedSwatch) return;
		this.selectedSwatch.div.classList.remove("selected");
		this.selectedSwatch = null;
		this.cm.redraw();
		this.colorPicker.value = "#ff0000";
	}

	// -----------------------------
	// PIXEL OPERATIONS
	// -----------------------------
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

		layer.applyClusteredData(data, layer.tempWidth, layer.tempHeight, this.cm.tileSize);
		this.cm.redraw();
	}

	// WRONG
	drawBoundingBox(pixelRefs, color = "limegreen") {
		if (!pixelRefs?.length) return;

		const layer = this.cm.activeLayer;
		const tempWidth = layer.tempWidth || layer.imageData.width;

		let minX = Infinity, maxX = -1, minY = Infinity, maxY = -1;

		for (const idx of pixelRefs) {
			const x = idx % tempWidth;
			const y = Math.floor(idx / tempWidth);
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
    if (!swatch.pixelRefs.length) return;
    this.applyPixels(swatch, { r: 0, g: 255, b: 255 }); // cyan highlight
}

resetSwatchColor(swatch) {
    if (!swatch.pixelRefs.length) return;
    this.applyPixels(swatch); // restore swatch’s r,g,b
}


	eraseSelectedPixels() {
		const sw = this.selectedSwatch;
		if (!sw) return;
		this.applyPixels(sw, { erase: true });
		sw.div.classList.add("erased");
	}

	recolorSelectedPixels(r, g, b) {
		const sw = this.selectedSwatch;
		if (!sw) return;
		sw.r = r; sw.g = g; sw.b = b;

		this.applyPixels(sw, { r, g, b });
		sw.div.style.backgroundColor = `rgb(${r},${g},${b})`;
		this.colorPicker.value = this.rgbToHex(r, g, b);
	}

	rgbToHex(r, g, b) {
		return "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("");
	}

	// -----------------------------
	// STATE MANAGEMENT
	// -----------------------------
	getState() {
		return this.swatches.map(s => ({
			r: s.r,
			g: s.g,
			b: s.b,
			selected: this.selectedSwatch === s,
			pixelRefs: s.pixelRefs
		}));
	}

	setState(state) {
		this.clearPaletteContainer();
		this.addDeselectSwatch();

		state.forEach(s => {
			const swatch = this.addColorSwatch([s.r, s.g, s.b], s.pixelRefs);
			if (swatch && s.selected) this.selectSwatch(swatch);
		});
	}
}
