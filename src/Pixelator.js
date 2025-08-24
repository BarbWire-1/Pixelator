/*
MIT License
Copyright(c) 2025 Barbara Kälin aka BarbWire - 1
*/

import { DrawingTool } from "./modules/DrawingTool.js";
import { CanvasManager } from "./modules/Canvas.js";
import { PaletteManager } from "./modules/PaletteManager.js";
import { HistoryManager, debug } from "./modules/HistoryManager.js";

export function initPixelator() {
	// --- DOM Elements ---
	const elements = {
		canvas: document.getElementById("canvas"),
		swatchesContainer: document.getElementById("swatchesContainer"),
		colorPicker: document.getElementById("colorPicker"),
		eraseBtn: document.getElementById("eraseBtn"),
		createPaletteBtn: document.getElementById("createPalette"),
		toggleGridCheckbox: document.getElementById("toggleGrid"),
		modeSelect: document.getElementById("modeSelect"),
		displayEl: document.getElementById("display"),
		fileInput: document.getElementById("raw-image-input"),
		tileSizeInput: document.getElementById("tile-size-input"),
		colorCountInput: document.getElementById("color-count-input"),
		quantizeTileBtn: document.getElementById("quantize-tile-btn"),
		zoomInput: document.getElementById("zoom"),
		undoBtn: document.getElementById("undoBtn"),
		redoBtn: document.getElementById("redoBtn")
	};
	const logPanel = document.getElementById("log-panel");

	// --- Managers ---
	const history = new HistoryManager();
	const cm = new CanvasManager(elements.canvas);
	const pm = new PaletteManager(cm, elements.swatchesContainer, elements.colorPicker);
	const tool = new DrawingTool(cm, elements.colorPicker, elements.modeSelect, elements.displayEl);
	document.getElementById("downloadBtn")
		.addEventListener('click', () => {
			console.log("clicked dl")
			cm.downloadImage()
		})
	// --- Snapshot / History ---
	function snapshot(desc = "") {
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
			tool: { isEraser: tool.isEraser },
			desc
		};
		history.push(state);
		debug("Snapshot taken:", desc);
	}

	async function restoreState(state) {
		if (state.layer) {
			cm.activeLayer.imageData = state.layer.imageData;
			cm.resizeCanvas(state.layer.width, state.layer.height);
			cm.redraw();
		}
		pm.setPaletteState(state.palette);
		tool.isEraser = state.tool.isEraser;
		tool.updateDisplay();
	}

	// --- Event Listeners ---
	function setupToolListeners() {
		document.querySelectorAll('input[name="toolMode"]').forEach(radio => {
			radio.addEventListener("change", () => {
				tool.isEraser = radio.value === "eraser";
				tool.updateDisplay();
			});
		});
	}

	function setupPaletteListeners() {
		elements.eraseBtn.addEventListener("click", () => {
			pm.eraseSelectedPixels();
			snapshot("Erase selected swatch");
		});

		elements.createPaletteBtn.addEventListener("click", () => {
			pm.createPalette();
			snapshot("Created new palette");
		});

		elements.colorPicker.addEventListener("input", () => {
			const hex = elements.colorPicker.value;
			const r = parseInt(hex.substr(1, 2), 16);
			const g = parseInt(hex.substr(3, 2), 16);
			const b = parseInt(hex.substr(5, 2), 16);
			pm.recolorSelectedPixels(r, g, b);

		});

	}

	function setupGridListener() {
		elements.toggleGridCheckbox.addEventListener("change", () => {
			cm.toggleGrid = elements.toggleGridCheckbox.checked;
			cm.redraw();
			snapshot("Toggle grid");
		});

	}

	function setupTileAndColorInputs() {
		elements.tileSizeInput.addEventListener("input", (e) => {
			cm.tileSize = parseInt(e.target.value, 10) || 1;
			tool.tileSize = cm.tileSize;
			cm.redraw()

		});
		elements.colorCountInput.addEventListener("change", (e) => {
			cm.colorCount = parseInt(e.target.value, 10) || 16;
		});
	}

	function setupQuantizeButton() {
		elements.quantizeTileBtn.addEventListener("click", async () => {
			if (!cm.activeLayer || !cm.rawImage) return;
			await cm.applyQuantizeAndTile(cm.rawImage, cm.colorCount, cm.tileSize);
			snapshot(`Quantize image with ${cm.colorCount} colors, tile size ${cm.tileSize}`);
			pm.createPalette();
			snapshot("quantized and pixelated");
		});
	}

	function setupImageLoader() {
		CanvasManager.prototype.loadImageAsync = function (img) {
			return new Promise(resolve => {
				this.loadImage(img);
				requestAnimationFrame(() => resolve());
			});
		};

		elements.fileInput.addEventListener("change", (e) => {
			const file = e.target.files[ 0 ];
			if (!file) return;

			const img = new Image();
			img.src = URL.createObjectURL(file);

			img.onload = async () => {
				await cm.loadImageAsync(img);
				elements.quantizeTileBtn.disabled = false;
				snapshot("Load image");
			};
			logPanel.innerHTML = "";
			elements.swatchesContainer.innerHTML = ""
		});
	}

	function setupZoom() {
		const container = document.getElementById("canvas-container");
		const canvas = elements.canvas;
		let lastScale = 1;

		elements.zoomInput.addEventListener("input", () => {
			const scale = parseFloat(elements.zoomInput.value);

			// switch origin depending on scale
			canvas.style.transformOrigin = scale > 1 ? "top left" : "center center";
			canvas.style.transform = `scale(${scale})`;

			// save scroll relative to canvas top-left
			const scrollX = container.scrollLeft;
			const scrollY = container.scrollTop;

			// restore scroll proportionally
			container.scrollLeft = scrollX * (scale / lastScale);
			container.scrollTop = scrollY * (scale / lastScale);

			lastScale = scale;
		});
	}






	function setupUndoRedo() {
		elements.undoBtn.addEventListener("click", () => {
			const state = history.undo();
			if (state) restoreState(state);
		});

		elements.redoBtn.addEventListener("click", () => {
			const state = history.redo();
			if (state) restoreState(state);
		});
	}



	// --- Initialize all ---
	setupToolListeners();
	setupPaletteListeners();
	setupGridListener();
	setupTileAndColorInputs();
	setupQuantizeButton();
	setupImageLoader();
	setupZoom();
	setupUndoRedo();


	// JUST spliced in to log the quantization stuff in panel

	const showLogsCheckbox = document.getElementById("show-logs-checkbox");

	cm.showLogs = showLogsCheckbox.checked;

	// Sync checkbox with flag
	showLogsCheckbox.addEventListener("change", () => {
		cm.showLogs = showLogsCheckbox.checked;
		logPanel.innerHTML = ''
	});


	// Wrap logEntries with Proxy
	cm.logEntries = new Proxy(cm.logEntries, {
		set(target, property, value) {
			target[ property ] = value;

			if (!isNaN(property)) {
				const entry = value;
				if (entry && entry.message && cm.showLogs) {
					const el = document.createElement("div");
					el.style.fontFamily = "monospace";
					el.style.fontSize = "12px";
					el.style.color = "limegreen";
					el.style.whiteSpace = "pre";

					// Split the message into lines
					const lines = entry.message.split("\n");
					const firstLine = `[${entry.time}] ${lines[ 0 ]}`;
					const restLines = lines.slice(1).map(line => "    " + line);

					el.textContent = [ firstLine, ...restLines ].join("\n");

					logPanel.appendChild(el);
					logPanel.scrollTop = logPanel.scrollHeight;
				}
			}
			return true;
		}
	});
	document.getElementById('kMeans-iter').addEventListener('change', (e) => cm.kMeansIterations = +e.target.value)
	snapshot("Initial state");

	// Return managers in case you need them outside
	return { cm, pm, tool, history, snapshot };
}
