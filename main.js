import { DrawingTool } from "./DrawingTool.js";
import { CanvasManager } from "./Canvas.js";
import { PaletteManager } from "./PaletteManager.js"

import { HistoryManager, DEBUG, debug } from "./HistoryManager.js";

const history = new HistoryManager();


// TODO - on swatch select click colorPicker, set position near swatch
// TODO add range to CSS scale - check mousePos
// TODO implement drawing correct so has acces to tiles and imagedata binding
// TODO add download button
// TODO implement history
// TODO on image load, max color change clear old palette

//TODO TAKING WAY TOO MANY SNAPSHOTS







// --- Init ---
const canvas = document.getElementById("canvas");
const cm = new CanvasManager(canvas);
const swatchesContainer = document.getElementById("swatchesContainer");
const colorPicker = document.getElementById("colorPicker");
const pm = new PaletteManager(cm, swatchesContainer, colorPicker);

const fileInput = document.getElementById("fileInput");

const eraseBtn = document.getElementById("eraseBtn");
const createPaletteBtn = document.getElementById("createPalette");
const toggleGridCheckbox = document.getElementById("toggleGrid");

fileInput.addEventListener("change", (e) => {
	const file = e.target.files[ 0 ];
	if (!file) return;
	const img = new Image();
	img.onload = () => cm.loadImage(img);
	img.src = URL.createObjectURL(file);
});

// TODO add this into palette and if no selected add new swatch on change
// colorPicker.addEventListener("input", () =>
// 	cm.recolorPixels(colorPicker.value)
// );
eraseBtn.addEventListener("click", () => {
	pm.eraseSelectedSwatch();
	snapshot("Erase selected swatch");
});

createPaletteBtn.addEventListener("click", () => {
	pm.createPalette();
	snapshot("Create new palette");
});

colorPicker.addEventListener("input", () => {
	const hex = colorPicker.value;
	const r = parseInt(hex.substr(1, 2), 16);
	const g = parseInt(hex.substr(3, 2), 16);
	const b = parseInt(hex.substr(5, 2), 16);
	pm.recolorSelectedSwatch(r, g, b);
	snapshot(`Recolor swatch to ${hex}`);
});


toggleGridCheckbox.addEventListener("change", () => {
	cm.toggleGrid = toggleGridCheckbox.checked;
	cm.redraw();
	snapshot()
});

// --- wrap loadImage in a Promise so we can await it ---
CanvasManager.prototype.loadImageAsync = function (img) {
	return new Promise((resolve) => {
		this.loadImage(img); // call your existing method
		// wait for next tick to ensure the canvas has drawn
		requestAnimationFrame(() => resolve());
	});
};
// Trigger hidden file input when button clicked
document.getElementById("load-raw-image").addEventListener("click", () => {
	document.getElementById("raw-image-input").click();
});

// Existing listener for the hidden file input (your async-safe version)
document
	.getElementById("raw-image-input")
	.addEventListener("change", async (e) => {
		const file = e.target.files[ 0 ];
		if (!file) return;

		const img = new Image();
		img.src = URL.createObjectURL(file);

		await new Promise((resolve) => {
			img.onload = resolve;
		});

		await cm.loadImageAsync(img);
		document.getElementById("quantize-tile-btn").disabled = false;
		snapshot()
		//e.target.value = "";
	});

document
	.getElementById("quantize-tile-btn")
	.addEventListener("click", async () => {
		if (!cm.activeLayer || !cm.rawImage) return;
		const tileSize =
			parseInt(document.getElementById("tile-size-input").value, 10) || 1;
		const colorCount =
			parseInt(document.getElementById("color-count-input").value, 10) || 16;

		await cm.applyQuantizeAndTile(cm.rawImage, colorCount, tileSize);
		snapshot(`Quantize image with ${colorCount} colors, tile size ${tileSize}`);
	});
const modeSelect = document.getElementById("modeSelect");
const displayEl = document.getElementById("display");
const tileSize = 16; // size of each tile

const tool = new DrawingTool(canvas, colorPicker, modeSelect, displayEl, tileSize);

// Brush / Eraser toggle
document.querySelectorAll('input[name="toolMode"]').forEach(radio => {
	radio.addEventListener("change", () => {
		tool.isEraser = radio.value === "eraser";
		tool.updateDisplay();
	});
});

// Optional: when picking a color, revert to brush automatically
//colorPicker.addEventListener("input", () => tool.isEraser = false);
// HISTORY
export function snapshot(desc = "") {
	const state = {
		layer: cm.activeLayer
			? {
				width: cm.activeLayer.width,
				height: cm.activeLayer.height,
				imageData: new ImageData(
					new Uint8ClampedArray(cm.activeLayer.imageData.data),
					cm.activeLayer.width,
					cm.activeLayer.height
				)
			}
			: null,
		palette: pm.getPaletteState(),
		tool: {
			isEraser: tool.isEraser
		},
		desc // <-- store the description
	};
	history.push(state);
	debug("Snapshot taken:", desc);
}


async function restoreState(state) {
	if (state.layer) {
		// Restore the pixels directly
		cm.activeLayer.imageData = state.layer.imageData;
		cm.resizeCanvas(state.layer.width, state.layer.height);
		cm.redraw();
	}

	// Restore palette
	pm.setPaletteState(state.palette);

	// Restore tool
	tool.isEraser = state.tool.isEraser;
	tool.updateDisplay();
}




document.getElementById("undoBtn").addEventListener("click", () => {
	const state = history.undo();
	if (state) restoreState(state);
});

document.getElementById("redoBtn").addEventListener("click", () => {
	const state = history.redo();
	if (state) restoreState(state);
});
snapshot()

// TODO draw not connected yet !!!!!!
//TODO undo colorChange _> update picker