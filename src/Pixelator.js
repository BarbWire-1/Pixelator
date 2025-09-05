/**
 * /*
 * MIT License
 * Copyright(c) 2025 Barbara Kälin aka BarbWire - 1
 *
 * @format
 */

import { DrawingTool } from './modules/DrawingTool.js';
import { CanvasManager } from './modules/canvas/Canvas.js';
import { PaletteManager } from './modules/PaletteManager.js';
import { HistoryManager, debug } from './modules/HistoryManager.js';
import { DownloadModal } from './modules/DownloadModal.js';

import './UI/resizer.js';

export function initPixelator() {
	// --- DOM Elements ---
	const elements = {
		canvas: document.getElementById('canvas'),
		swatchesContainer: document.getElementById('swatchesContainer'),
		colorPicker: document.getElementById('colorPicker'),
		eraseBtn: document.getElementById('eraseBtn'),
		// createPaletteBtn: document.getElementById('createPalette'),
		toggleGridCheckbox: document.getElementById('toggleGrid'),
		modeSelect: document.getElementById('modeSelect'),
		displayEl: document.getElementById('display'),
		fileInput: document.getElementById('raw-image-input'),
		liveUpdateInput: document.getElementById('liveUpdateInput'),
		tileSizeInput: document.getElementById('tile-size-input'),
		colorCountInput: document.getElementById('color-count-input'),
		quantizeTileBtn: document.getElementById('quantize-tile-btn'),
		zoomInput: document.getElementById('zoom'),
		undoBtn: document.getElementById('undoBtn'),
		redoBtn: document.getElementById('redoBtn'),
		alphaCheck: document.getElementById('alpha'),
	};
	const logPanel = document.getElementById('log-panel');

	// --- Managers ---
	const history = new HistoryManager();
	const cm = new CanvasManager(elements.canvas);
	const pm = new PaletteManager(
		cm,
		elements.swatchesContainer,
		elements.colorPicker,
	);
	const tool = new DrawingTool(
		cm,
		elements.colorPicker,
		elements.modeSelect,
		elements.displayEl,
	);
	cm.tool = tool;

	// init once on page load
	const downloadModal = new DownloadModal(
		'downloadModal',
		'downloadWidth',
		'downloadHeight',
		'lockAspect',
		'cancelDownload',
		'confirmDownload',
	);

	elements.alphaCheck.addEventListener(
		'change',
		e => (cm.activeLayer.allOpaque = e.target.checked),
	);
	document.getElementById('downloadBtn').addEventListener('click', () => {
		console.log('clicked dl');
		// later, when user clicks download
		downloadModal.open(
			cm.activeLayer.rawImage?.width || cm.activeLayer.width,
			cm.activeLayer.rawImage?.height || cm.activeLayer.height,
			(targetW, targetH) => cm.downloadImage(targetW, targetH),
		);

		//cm.downloadImage()
		snapshot('Image loaded');
	});

	//HISTORY
	function snapshot(desc = '', { transient = false } = {}) {
		if (transient) return; // skip auto redraw snapshots

		const state = {
			canvas: cm.getState(),
			palette: pm.getState(),
			tool: tool.getState(),
			tileSize: cm.tileSize,
			colorCount: cm.colorCount,
			toggleGrid: cm.toggleGrid,
			zoom: elements.zoomInput.value,
			desc,
		};
		history.push(state);
		debug('Snapshot taken:', desc);
	}

	async function restoreState(state) {
		if (!state) return;

		cm.setState(state.canvas);
		pm.setState(state.palette);
		tool.setState(state.tool);

		elements.tileSizeInput.value = cm.tileSize;
		elements.colorCountInput.value = cm.colorCount;
		elements.toggleGridCheckbox.checked = cm.toggleGrid;
		elements.zoomInput.value = state.zoom;
		elements.canvas.style.transform = `scale(${parseFloat(state.zoom)})`;

		debug('Inputs synced to history state');
	}

	// --- Event Listeners ---
	// --- Tool listeners ---
	function setupToolListeners() {
		document.querySelectorAll('input[name="toolMode"]').forEach(radio => {
			radio.addEventListener('change', () => {
				tool.isEraser = radio.value === 'eraser';
				tool.updateDisplay();
				snapshot(`Tool changed to ${tool.mode}`);
			});
		});
	}

	// --- Palette listeners ---
	function setupPaletteListeners() {
		elements.eraseBtn.addEventListener('click', () => {
			pm.eraseSelectedPixels();
			snapshot('Erased selected swatch');
		});

		// elements.createPaletteBtn.addEventListener('click', () => {
		// 	pm.createPalette();
		// 	snapshot('Created new palette');
		// });

		const hexToRgb = hex =>
			hex.match(/[A-Fa-f0-9]{2}/g).map(v => parseInt(v, 16));

		const handlePicker = e => {
			const [r, g, b] = hexToRgb(e.target.value);
			const isCommit = e.type === 'change'; // only commit on release
			pm.recolorSelectedPixels(r, g, b, isCommit);
			if (isCommit) snapshot('Recolored selected swatch');
		};

		elements.colorPicker.addEventListener('input', handlePicker);
		elements.colorPicker.addEventListener('change', handlePicker);
	}

	// --- Grid toggle ---
	function setupGridListener() {
		elements.toggleGridCheckbox.addEventListener('change', () => {
			cm.toggleGrid = elements.toggleGridCheckbox.checked;
			cm.redraw();
			snapshot('Toggle grid');
		});
	}

	// --- Tile size & color count ---
	function setupTileAndColorInputs() {
		elements.liveUpdateInput.addEventListener(
			'change',
			e => (cm.liveUpdate = e.target.checked),
		);

		elements.tileSizeInput.addEventListener('change', async e => {
			cm.tileSize = parseInt(e.target.value, 10) || 1;
			tool.tileSize = cm.tileSize;
			if (cm.liveUpdate) {
				await cm.applyQuantizeAndTile();
				pm.createPalette();
				snapshot('Live update tileSize applied');
			} else {
				cm.redraw();
				snapshot(`Tile size changed to ${cm.tileSize}`);
			}
		});

		elements.colorCountInput.addEventListener('change', e => {
			cm.colorCount = parseInt(e.target.value, 10) || 16;
			snapshot(`Color count changed to ${cm.colorCount}`);
		});
	}

	// --- Quantize button ---
	function setupQuantizeButton() {
		elements.quantizeTileBtn.addEventListener('click', async () => {
			if (!cm.activeLayer || !cm.activeLayer.rawImage) return;
			await cm.applyQuantizeAndTile();
			pm.createPalette();
			snapshot(
				`Quantized image with ${cm.colorCount} colors, tile size ${cm.tileSize}`,
			);
		});
	}

	// --- Image loader ---
	function setupImageLoader() {
		elements.fileInput.addEventListener('change', e => {
			const file = e.target.files[0];
			if (!file) return;

			const img = new Image();
			img.src = URL.createObjectURL(file);

			img.onload = async () => {
				await cm.loadImage(img);
				setupLayerPanelBindings(cm);
				elements.quantizeTileBtn.disabled = false;
				snapshot('Image loaded');
			};

			logPanel.innerHTML = '';
			elements.swatchesContainer.innerHTML = '';
		});
	}
	function setupZoom() {
		const container = document.getElementById('canvas-container');
		const canvas = elements.canvas;
		let lastScale = 1;

		elements.zoomInput.addEventListener('input', () => {
			const scale = parseFloat(elements.zoomInput.value);

			// Change transform origin depending on scale
			canvas.style.transformOrigin =
				scale > 1.8 ? 'top left' : 'center center';
			canvas.style.transform = `scale(${scale})`;

			// Save scroll relative to canvas top-left
			const scrollX = container.scrollLeft;
			const scrollY = container.scrollTop;

			// Restore scroll proportionally
			container.scrollLeft = scrollX * (scale / lastScale);
			container.scrollTop = scrollY * (scale / lastScale);

			lastScale = scale;
		});

		// Commit snapshot only on release (change event), not every input
		elements.zoomInput.addEventListener('change', () => {
			snapshot(`Zoom set to ${elements.zoomInput.value}`);
		});
	}
	// --- Layer panel bindings ---
	function setupLayerPanelBindings(cm) {
		const panel = document.getElementById('layer-panel');
		if (!panel) return;

		cm.layers.forEach((layer, idx) => {
			const entry = panel.querySelector(
				`.layer-entry[data-index="${idx}"]`,
			);
			if (!entry) return;

			const checkbox = entry.querySelector('.layer-visible');
			const slider = entry.querySelector('.layer-opacity');

			if (checkbox) {
				checkbox.checked = layer.visible ?? true;
				checkbox.addEventListener('change', () => {
					layer.visible = checkbox.checked;
					layer.redraw();
					cm.redraw();
				});
			}

			if (slider) {
				slider.value = layer.opacity ?? 1;
				slider.addEventListener('input', () => {
					layer.opacity = parseFloat(slider.value);
					layer.redraw();
					cm.redraw();
				});
			}
		});
	}

	// --- Undo / Redo ---
	function setupUndoRedo() {
		elements.undoBtn.addEventListener('click', () => {
			const state = history.undo();
			if (state) restoreState(state);
		});

		elements.redoBtn.addEventListener('click', () => {
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

	const showLogsCheckbox = document.getElementById('show-logs-checkbox');

	cm.showLogs = showLogsCheckbox.checked;

	// Sync checkbox with flag
	showLogsCheckbox.addEventListener('change', () => {
		cm.showLogs = showLogsCheckbox.checked;
		logPanel.innerHTML = '';
	});

	// Wrap logEntries with Proxy
	cm.logEntries = new Proxy(cm.logEntries, {
		set(target, property, value) {
			target[property] = value;

			if (!isNaN(property)) {
				const entry = value;
				if (entry && entry.message && cm.showLogs) {
					const el = document.createElement('div');
					el.style.fontFamily = 'monospace';
					el.style.fontSize = '12px';
					el.style.color = 'limegreen';
					el.style.whiteSpace = 'pre';

					// Split the message into lines
					const lines = entry.message.split('\n');
					const firstLine = `[${entry.time}] ${lines[0]}`;
					const restLines = lines.slice(1).map(line => '    ' + line);

					el.textContent = [firstLine, ...restLines].join('\n');

					logPanel.appendChild(el);
					logPanel.scrollTop = logPanel.scrollHeight;
				}
			}
			return true;
		},
	});
	document
		.getElementById('kMeans-iter')
		.addEventListener(
			'change',
			e => (cm.kMeansIterations = +e.target.value),
		);
	snapshot('Initial state');

	// Return managers in case you need them outside
	return { cm, pm, tool, history, snapshot };
}



/*
import { DrawingTool } from './modules/DrawingTool.js';
import { CanvasManager } from './modules/canvas/Canvas.js';
import { PaletteManager } from './modules/PaletteManager.js';
import { HistoryManager, debug } from './modules/HistoryManager.js';
import { DownloadModal } from './modules/DownloadModal.js';

export function initPixelator() {
  // -----------------------------
  // MANAGERS
  // -----------------------------
  const history = new HistoryManager();
  const cm = new CanvasManager(null);
  const tool = new DrawingTool(cm, null, null, null);
  const pm = new PaletteManager(cm, null, null);
  cm.tool = tool;

  // -----------------------------
  // SNAPSHOT / HISTORY UTILS
  // -----------------------------
  function snapshot(desc = '') {
    const state = {
      canvas: cm.getState(),
      palette: pm.getState(),
      tool: tool.getState(),
      tileSize: cm.tileSize,
      colorCount: cm.colorCount,
      toggleGrid: cm.toggleGrid,
      zoom: document.getElementById('zoom')?.value || 1,
      desc,
    };
    history.push(state);
    debug('Snapshot taken:', desc);
  }

  async function restoreState(state) {
    if (!state) return;
    cm.setState(state.canvas);
    pm.setState(state.palette);
    tool.setState(state.tool);

    // update linked inputs automatically
    const uiMap = {
      tileSize: '#tile-size-input',
      colorCount: '#color-count-input',
      toggleGrid: '#toggleGrid',
      zoom: '#zoom',
    };

    for (const [prop, selector] of Object.entries(uiMap)) {
      const el = document.querySelector(selector);
      if (!el) continue;
      if (prop === 'toggleGrid') el.checked = state.toggleGrid;
      else el.value = state[prop] ?? el.value;
    }

    document.getElementById('canvas').style.transform = `scale(${parseFloat(state.zoom)})`;
  }

  // -----------------------------
  // HELPERS
  // -----------------------------
  const hexToRgb = hex => hex.match(/[A-Fa-f0-9]{2}/g).map(v => parseInt(v, 16));

  // -----------------------------
  // UI BINDINGS DECLARATIVE
  // -----------------------------
  const uiBindings = [
    { selector: '#modeSelect', events: { change: el => { tool.mode = el.value; tool.updateDisplay(); snapshot('Tool mode changed'); } } },
    { selector: 'input[name="toolMode"]', all: true, events: { change: el => { tool.isEraser = el.value === 'eraser'; tool.updateDisplay(); snapshot(`Tool changed to ${tool.mode}`); } } },
    { selector: '#eraseBtn', events: { click: el => { pm.eraseSelectedPixels(); snapshot('Erased selected swatch'); } } },
    { selector: '#colorPicker', events: {
        input: el => { const [r,g,b] = hexToRgb(el.value); pm.recolorSelectedPixels(r,g,b); },
        change: el => snapshot('Recolored selected swatch')
      }
    },
    { selector: '#toggleGrid', events: { change: el => { cm.toggleGrid = el.checked; cm.redraw(); snapshot('Toggled grid'); } } },
    { selector: '#tile-size-input', events: { change: async el => { cm.tileSize = parseInt(el.value,10); if(cm.liveUpdate){ await cm.applyQuantizeAndTile(); pm.createPalette(); snapshot('Tile size live-updated'); } else { cm.redraw(); snapshot('Tile size changed'); } } } },
    { selector: '#color-count-input', events: { change: el => { cm.colorCount = parseInt(el.value,10); snapshot('Color count changed'); } } },
    { selector: '#quantize-tile-btn', events: { click: async el => { await cm.applyQuantizeAndTile(); pm.createPalette(); snapshot('Quantized image'); } } },
    { selector: '#raw-image-input', events: { change: async el => {
        const file = el.files[0]; if(!file) return;
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = async () => { await cm.loadImage(img); snapshot('Image loaded'); };
      }
    } },
    { selector: '#zoom', events: {
        input: el => { const scale = parseFloat(el.value); document.getElementById('canvas').style.transformOrigin = scale>1.8?'top left':'center center'; document.getElementById('canvas').style.transform = `scale(${scale})`; },
        change: el => snapshot(`Zoom set to ${el.value}`)
      }
    },
    { selector: '#undoBtn', events: { click: el => restoreState(history.undo()) } },
    { selector: '#redoBtn', events: { click: el => restoreState(history.redo()) } },
  ];

  // -----------------------------
  // ATTACH ALL BINDINGS
  // -----------------------------
  for (const binding of uiBindings) {
    const elements = binding.all ? document.querySelectorAll(binding.selector) : [document.querySelector(binding.selector)];
    for (const el of elements) {
      if (!el) continue;
      for (const [evt, handler] of Object.entries(binding.events)) {
        el.addEventListener(evt, e => handler(el, e));
      }
    }
  }

  snapshot('Initial state');

  return { cm, tool, pm, history, snapshot, restoreState };
}
*/
