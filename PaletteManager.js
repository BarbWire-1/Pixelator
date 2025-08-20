import { Colors } from "./Colors.js";

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

		// ✅ sync the picker right here
		const hex = this.rgbToHex(swatch.r, swatch.g, swatch.b);
		if (this.colorPicker.value !== hex) {
			this.colorPicker.value = hex;
			// Optional: notify any 'change' listeners
			this.colorPicker.dispatchEvent(new Event("change", { bubbles: true }));
		}
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
		this.container.innerHTML = "";
		this.swatches = [];

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


	rgbToHex(r, g, b) {
		return (
			"#" +
			[ r, g, b ].map((x) => x.toString(16).padStart(2, "0")).join("")
		);
	}
}
