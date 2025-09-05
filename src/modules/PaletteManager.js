/**
 * MIT License
 * Copyright(c) 2025 Barbara Kälin aka BarbWire - 1
 *
 * @format
 */

import { snapshot } from '../main.js';
import { smoothSort } from './smoothSort.js';

export class PaletteManager {
	constructor(cm, swatchesContainer, colorPickerEl) {
		this.cm = cm;

		this.container = swatchesContainer;
		this.colorPicker = colorPickerEl;
		this.swatches = [];
		this.selectedSwatch = null;

		this.swatchTemplate = document.createElement('template');
		this.swatchTemplate.innerHTML = `<div class="swatch"></div>`;

		this.container.addEventListener('click', e => this.handleClick(e));
	}

	// -----------------------------
	// PALETTE CREATION
	// -----------------------------
	createPalette() {
		const layer = this.cm.activeLayer;
		if (!layer || !layer.colors || !layer.clusters) return;

		this.clearPaletteContainer();
		this.addDeselectSwatch();

		const colorPairs = layer.colors.map((color, i) => ({
			color,
			clusterIndex: i,
		}));

		const sortedPairs = smoothSort(colorPairs.map(p => p.color)).map(
			sortedColor => colorPairs.find(p => p.color === sortedColor),
		);

		sortedPairs.forEach(p => {
			const indices = layer.clusters[p.clusterIndex];
			this.addColorSwatch(p.color, indices);
		});
	}

	addDeselectSwatch() {
		const div = document.createElement('div');
		div.className = 'swatch deselect';
		div.title = 'Deselect';
		this.container.appendChild(div);
	}

	addColorSwatch(colorArray, indices) {
		const [r, g, b] = colorArray;
		if (r + g + b === 0) return;

		const div =
			this.swatchTemplate.content.firstElementChild.cloneNode(true);
		div.style.backgroundColor = `rgb(${r},${g},${b})`;
		div.title = 'Keep pressed to highlight pixels';
		this.container.appendChild(div);

		const swatch = { r, g, b, div, pixelRefs: indices };
		this.swatches.push(swatch);
		this.attachSwatchListeners(swatch);
		return swatch;
	}

	attachSwatchListeners(swatch) {
		swatch.div.addEventListener('mousedown', () =>
			this.highlightSwatch(swatch),
		);
		swatch.div.addEventListener('mouseup', () =>
			this.resetSwatchColor(swatch),
		);
	}

	clearPaletteContainer() {
		this.container.innerHTML = '';
		this.swatches = [];
	}

	// -----------------------------
	// SWATCH SELECTION
	// -----------------------------
	handleClick(e) {
		const div = e.target.closest('.swatch');
		if (!div) return;
		if (div.classList.contains('deselect')) return this.deselectSwatch();

		const swatch = this.swatches.find(s => s.div === div);
		if (swatch) this.selectSwatch(swatch);
	}

	selectSwatch(swatch) {
		if (this.selectedSwatch)
			this.selectedSwatch.div.classList.remove('selected');
		swatch.div.classList.add('selected');
		this.selectedSwatch = swatch;

		this.cm.redraw();

		this.colorPicker.value = this.rgbToHex(swatch.r, swatch.g, swatch.b);
		document.getElementById('hexValue').textContent =
			this.colorPicker.value;
	}

	deselectSwatch() {
		if (!this.selectedSwatch) return;
		this.selectedSwatch.div.classList.remove('selected');
		this.selectedSwatch = null;
		this.cm.redraw();
		this.colorPicker.value = '#ff0000';
	}

	// -----------------------------
	// PIXEL OPERATIONS (delegated to DrawingTool)
	// -----------------------------
	applyPixels(swatch, options = {}) {
		this.cm.tool.applyPixels(swatch, options);
	}

	highlightSwatch(swatch) {
		if (!swatch) return;
		this.cm.tool.highlightSwatch(swatch);
	}

	resetSwatchColor(swatch) {
		if (!swatch) return;
		this.cm.tool.restoreSwatchColor(swatch);
	}

	// -----------------------------
// SWATCH OPERATIONS
// -----------------------------
eraseSelectedPixels() {
	const sw = this.selectedSwatch;
	if (!sw) return;
	// Delegate erasing to DrawingTool
	this.cm.tool.applySwatch(sw, { erase: true });
	sw.div.classList.add('erased');
}

recolorSelectedPixels(r, g, b) {
	const sw = this.selectedSwatch;
	if (!sw) return;

	// Update swatch color
	sw.r = r;
	sw.g = g;
	sw.b = b;

	// Delegate recoloring to DrawingTool
	this.cm.tool.applySwatch(sw, { erase: false, r, g, b });

	// Update swatch element and color picker
	sw.div.style.backgroundColor = `rgb(${r},${g},${b})`;
	this.colorPicker.value = this.cm.tool.rgbToHex
		? this.cm.tool.rgbToHex(r, g, b)
		: this.rgbToHex(r, g, b);
	document.getElementById('hexValue').textContent = this.colorPicker.value;
}

highlightSwatch(swatch) {
	if (!swatch) return;
	// Use DrawingTool to apply highlight
	this.cm.tool.applySwatch(swatch, { erase: false, r: 0, g: 255, b: 255 });
	this.cm.tool.drawSwatchBoundingBox(swatch.pixelRefs);
}

restoreSwatchColor(swatch) {
	if (!swatch) return;
	// Restore original swatch color via DrawingTool
	this.cm.tool.applySwatch(swatch);
}


	// -----------------------------
	// UTILITIES
	// -----------------------------
	rgbToHex(r, g, b) {
		return (
			'#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
		);
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
			pixelRefs: s.pixelRefs,
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
