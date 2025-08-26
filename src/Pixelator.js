/*
MIT License
Copyright(c) 2025 Barbara Kälin aka BarbWire - 1
*/
// TODO update all UI inputs on snapshot change!!!!!!
// TODO ADD A GET-/SETSTATE TO ALL MODULES INVOLVED
// tools, colorPicker and select not updated correctly, ramge???
import { DrawingTool } from "./modules/DrawingTool.js";
import { CanvasManager } from "./modules/canvas/Canvas.js";
import { PaletteManager } from "./modules/PaletteManager.js";
import { HistoryManager, debug } from "./modules/HistoryManager.js";
import { DimensionModal } from "./modules/ModalManager.js";

import "./UI/resizer.js"

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
		liveUpdateInput: document.getElementById("liveUpdateInput"),
		tileSizeInput: document.getElementById("tile-size-input"),
		colorCountInput: document.getElementById("color-count-input"),
		quantizeTileBtn: document.getElementById("quantize-tile-btn"),
		zoomInput: document.getElementById("zoom"),
		undoBtn: document.getElementById("undoBtn"),
		redoBtn: document.getElementById("redoBtn"),
		alphaCheck: document.getElementById('alpha')
	};
	const logPanel = document.getElementById("log-panel");

	// --- Managers ---
	const history = new HistoryManager();
	const cm = new CanvasManager(elements.canvas);
	const pm = new PaletteManager(cm, elements.swatchesContainer, elements.colorPicker);
	const tool = new DrawingTool(cm, elements.colorPicker, elements.modeSelect, elements.displayEl);



	// init once on page load
	const downloadModal = new DimensionModal(
		"downloadModal",
		"downloadWidth",
		"downloadHeight",
		"lockAspect",
		"cancelDownload",
		"confirmDownload"
	);


elements.alphaCheck.addEventListener('change',(e)=> cm.allOpaque = e.target.checked)
	document.getElementById("downloadBtn")
		.addEventListener('click', () => {
			console.log("clicked dl")
			// later, when user clicks download
			downloadModal.open(
				cm.rawImage?.width || cm.activeLayer.width,
				cm.rawImage?.height || cm.activeLayer.height,
				(targetW, targetH) => cm.downloadImage(targetW, targetH)
			);

			//cm.downloadImage()
			snapshot("Image loaded")
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
			// TODO HERE IS STH WRONG - also need upate select
			tool: {
				mode: tool.mode,          // "N", "H", "V", "B", "D", or "fillRegion"
				isEraser: tool.isEraser
			},

			tileSize: cm.tileSize,
			colorCount: cm.colorCount,
			toggleGrid: cm.toggleGrid,
			mode: tool.isEraser ? "eraser" : "draw",
			zoom: elements.zoomInput.value,
			desc
		};
		history.push(state);
		debug("Snapshot taken:", desc);
	}


	async function restoreState(state) {
		if (state.layer) {
			// Replace activeLayer completely
			cm.activeLayer = {
				width: state.layer.width,
				height: state.layer.height,
				imageData: new ImageData(
					new Uint8ClampedArray(state.layer.imageData.data),
					state.layer.width,
					state.layer.height
				)
			};
			cm.resizeCanvas(cm.activeLayer.width, cm.activeLayer.height);
			cm.redraw();
		} else {
			// Clear visible canvas without touching rawImage
			cm.activeLayer &&  cm.activeLayer.imageData.data.fill(0);
			cm.redraw();

		}


		// Restore palette and tool
		pm.setPaletteState(state.palette);
		tool.isEraser = state.tool.isEraser;
		tool.updateDisplay();

		// --- Sync input elements ---
		if (state.tileSize !== undefined) {
			cm.tileSize = state.tileSize;
			tool.tileSize = state.tileSize;
			elements.tileSizeInput.value = state.tileSize;
		}
		if (state.colorCount !== undefined) {
			cm.colorCount = state.colorCount;
			elements.colorCountInput.value = state.colorCount;
		}
		if (state.toggleGrid !== undefined) {
			cm.toggleGrid = state.toggleGrid;
			elements.toggleGridCheckbox.checked = state.toggleGrid;
			cm.redraw();
		}
		// Restore tool
		if (state.tool) {
			tool.mode = state.tool.mode;
			tool.isEraser = state.tool.isEraser;
			tool.updateDisplay();

			// Update radio buttons
			document.querySelectorAll('input[name="toolMode"]').forEach(radio => {
				if (radio.value === tool.mode || (tool.isEraser && radio.value === "eraser")) {
					radio.checked = true;
				} else {
					radio.checked = false;
				}
			});
		}
		if (state.zoom !== undefined) {
			elements.zoomInput.value = state.zoom;
			const scale = parseFloat(state.zoom);
			elements.canvas.style.transform = `scale(${scale})`;
		}

		debug("Inputs synced to history state");
	}

// 	function snapshot(desc = "") {
// 		const state = {
// 			canvas: cm.getState(),
// 			palette: pm.getState(),
// 			tool: tool.getState(),
// 			zoom: elements.zoomInput.value,
// 			desc
// 		};
// 		history.push(state);
// 		debug("Snapshot taken:", desc);
// 	}
//
// 	async function restoreState(state) {
// 		cm.setState(state.canvas);
// 		pm.setState(state.palette);
// 		tool.setState(state.tool);
//
// 		elements.zoomInput.value = state.zoom;
// 		elements.canvas.style.transform = `scale(${parseFloat(state.zoom)})`;
//
// 		debug("Inputs synced to history state");
// 	}



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
			//snapshot("Erase selected swatch");
		});

		elements.createPaletteBtn.addEventListener("click", () => {
			pm.createPalette();
			//snapshot("Created new palette");
		});

		const hexToRgb = hex =>
			hex.match(/[A-Fa-f0-9]{2}/g).map(v => parseInt(v, 16));

		const handlePicker = (e) => {
			const [ r, g, b ] = hexToRgb(e.target.value);
			const isCommit = e.type === "change"; // only true when user releases
			pm.recolorSelectedPixels(r, g, b, isCommit);
			if (isCommit) snapshot("Recolored");
		};

		elements.colorPicker.addEventListener("input", handlePicker);
		elements.colorPicker.addEventListener("change", handlePicker);


	}

	function setupGridListener() {
		elements.toggleGridCheckbox.addEventListener("change", () => {
			cm.toggleGrid = elements.toggleGridCheckbox.checked;
			cm.redraw();
			//snapshot("Toggle grid");
		});

	}

	function setupTileAndColorInputs() {
		elements.liveUpdateInput.addEventListener('change', (e) => cm.liveUpdate = e.target.checked)
		elements.tileSizeInput.addEventListener("change", (e) => {
			cm.tileSize = parseInt(e.target.value, 10) || 1;
			tool.tileSize = cm.tileSize;
			if (cm.liveUpdate) {
				cm.applyQuantizeAndTile(); pm.createPalette(); snapshot('Live update')
			} else {
				cm.redraw()
			}

		});
		elements.colorCountInput.addEventListener("change", (e) => {
			cm.colorCount = parseInt(e.target.value, 10) || 16;
		});
	}

	function setupQuantizeButton() {
		elements.quantizeTileBtn.addEventListener("click", async () => {
			if (!cm.activeLayer || !cm.rawImage) return;
			await cm.applyQuantizeAndTile(cm.rawImage, cm.colorCount, cm.tileSize);
			pm.createPalette();
			snapshot(`Quantize image with ${cm.colorCount} colors, tile size ${cm.tileSize}`);


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




	//MORE MESSY ADDITIONS



	// Return managers in case you need them outside
	return { cm, pm, tool, history, snapshot };
}
