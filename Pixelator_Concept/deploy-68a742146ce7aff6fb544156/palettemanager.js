import { Colors } from "./Colors.js";
function getElementAbsolutePosition(el) {
	let x = 0, y = 0;
	while (el) {
		x += el.offsetLeft - el.scrollLeft + el.clientLeft;
		y += el.offsetTop - el.scrollTop + el.clientTop;
		el = el.offsetParent;
	}
	return { left: x, top: y };
}


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

		this.container.addEventListener("click", (e) => this.handleClick(e));


		// this.colorPicker.addEventListener("blur", () => {
		// 	this.colorPicker.style.display = "none";
		// });

	}

	handleClick(e) {
		const div = e.target.closest(".swatch");
		if (!div) return;
		if (div.classList.contains("deselect")) return this.deselectSwatch();

		const swatch = this.swatches.find((s) => s.div === div);
		if (!swatch) return;
		this.selectSwatch(swatch);
	}

	deselectSwatch() {
		if (this.selectedSwatch)
			this.selectedSwatch.div.classList.remove("selected");
		this.selectedSwatch = null;
		this.cm.redraw();
		colorPicker.value = "#000000";

	}

	selectSwatch(swatch) {
		if (this.selectedSwatch) this.selectedSwatch.div.classList.remove("selected");
		swatch.div.classList.add("selected");
		this.selectedSwatch = swatch;

		this.cm.redraw();
		this.cm.drawBoundingBox(swatch.pixels);

		// --- cleanup any old temp picker first ---
		if (this.tempPicker && document.body.contains(this.tempPicker)) {
			this.tempPicker.remove();
		}

		// Create new temporary color input
		const tempPicker = document.createElement("input");
		tempPicker.type = "color";
		tempPicker.value = this.rgbToHex(swatch.r, swatch.g, swatch.b);
		document.body.appendChild(tempPicker);

		this.tempPicker = tempPicker; // keep reference

		// Position exactly at swatch
		const pos = getElementAbsolutePosition(swatch.div);
		tempPicker.style.position = "fixed";
		tempPicker.style.left = pos.left -5+ "px";
		tempPicker.style.top = (pos.top -5+ "px");
		tempPicker.type = "color";
		tempPicker.classList.add("circle-picker");
		tempPicker.style.zIndex = 1000;

		// Update swatch color on input
		const onInput = () => {
			const [ r, g, b ] = tempPicker.value.match(/\w\w/g).map(h => parseInt(h, 16));
			this.recolorSelectedSwatch(r, g, b);
		};

		// Cleanup
		const cleanup = () => {
			if (document.body.contains(tempPicker)) {
				tempPicker.remove();
			}
			this.tempPicker = null;

			tempPicker.removeEventListener("input", onInput);
			tempPicker.removeEventListener("change", cleanup);
			tempPicker.removeEventListener("blur", cleanup);
		};

		tempPicker.addEventListener("input", onInput);
		tempPicker.addEventListener("change", cleanup);
		tempPicker.addEventListener("blur", cleanup);

//tempPicker.click()
	}







	// Add two helper methods in PaletteManager:
	eraseSelectedSwatch() {
		if (!this.selectedSwatch) return;
		this.cm.erasePixels(this.selectedSwatch.pixels);
		this.selectedSwatch.div.classList.add("erased"); // 🔹 add style
	}


	recolorSelectedSwatch(r, g, b) {
		if (!this.selectedSwatch) return;
		this.cm.recolorPixels(this.selectedSwatch.pixels, r, g, b);

		// 🔹 update swatch color
		this.selectedSwatch.r = r;
		this.selectedSwatch.g = g;
		this.selectedSwatch.b = b;
		this.selectedSwatch.div.style.backgroundColor = `rgb(${r},${g},${b})`;

		// 🔹 ensure colorPicker shows same color
		colorPicker.value = this.rgbToHex(r, g, b);

		// remove "erased" if recolored
		this.selectedSwatch.div.classList.remove("erased");
	}



	createPalette() {
		if (!this.cm.activeLayer) return;
		this.clear();

		const data = this.cm.activeLayer.imageData.data;
		const colorMap = {};
		for (let i = 0; i < data.length; i += 4) {
			const key = `${data[ i ]},${data[ i + 1 ]},${data[ i + 2 ]}`;
			if (!colorMap[ key ]) colorMap[ key ] = [];
			colorMap[ key ].push(i);
		}

		// Convert map → array
		let palette = Object.entries(colorMap).map(([ k, pixels ]) => {
			const [ r, g, b ] = k.split(",").map(Number);
			return { r, g, b, pixels };
		});

		// 🔹 your existing smoother
		palette = Colors.smoothSort(palette);

		// First add the deselect swatch
		const deselectDiv = document.createElement("div");
		deselectDiv.className = "swatch deselect";
		deselectDiv.title = "Deselect";
		this.container.appendChild(deselectDiv);

		// Build swatches in sorted order
		palette.forEach(({ r, g, b, pixels }) => {
			const div = document.createElement("div");
			div.className = "swatch";
			div.style.backgroundColor = `rgb(${r},${g},${b})`;
			this.container.appendChild(div);

			this.swatches.push({
				r,
				g,
				b,
				pixels: pixels.map(idx => ({ index: idx })),
				div
			});
		});
	}
	addColorSwatch() {

	}

	clear() {
		this.container.innerHTML = "";
		this.swatches = [];
}
	rgbToHex(r, g, b) {
		return (
			"#" +
			[ r, g, b ].map((x) => x.toString(16).padStart(2, "0")).join("")
		);
	}
	// =========================
	// HISTORY SUPPORT
	// =========================

	// Return a serializable palette state
	getPaletteState() {
		return this.swatches.map(s => ({
			r: s.r,
			g: s.g,
			b: s.b,
			// optional: store pixel indices if you want to re-bind exactly
			pixels: s.pixels.map(p => p.index),
			selected: this.selectedSwatch === s
		}));
	}

	// Restore a palette from saved state
	setPaletteState(state) {
		this.clear();

		// First add the deselect swatch
		const deselectDiv = document.createElement("div");
		deselectDiv.className = "swatch deselect";
		deselectDiv.title = "Deselect";
		this.container.appendChild(deselectDiv);

		state.forEach(({ r, g, b, pixels, selected }) => {
			const div = document.createElement("div");
			div.className = "swatch";
			div.style.backgroundColor = `rgb(${r},${g},${b})`;
			this.container.appendChild(div);

			const swatch = {
				r,
				g,
				b,
				pixels: pixels.map(idx => ({ index: idx })), // rebuild pixel refs
				div
			};
			this.swatches.push(swatch);

			if (selected) {
				this.selectSwatch(swatch);
			}
		});
	}

	// Return currently selected swatch’s color (or null)
	getSelectedColor() {
		if (!this.selectedSwatch) return null;
		return {
			r: this.selectedSwatch.r,
			g: this.selectedSwatch.g,
			b: this.selectedSwatch.b
		};
	}

	// Restore selection by matching color
	setSelectedColor(color) {
		if (!color) {
			this.deselectSwatch();
			return;
		}
		const swatch = this.swatches.find(
			s => s.r === color.r && s.g === color.g && s.b === color.b
		);
		if (swatch) {
			this.selectSwatch(swatch);
		}
	}


}
