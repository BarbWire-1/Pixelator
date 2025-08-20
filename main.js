class Colors {
	static rgbToHex([ r, g, b ]) {
		return (
			"#" +
			[ r, g, b ].map((v) => v.toString(16).padStart(2, "0")).join("")
		);
	}

	static rgbToXyz(r, g, b) {
		r /= 255;
		g /= 255;
		b /= 255;
		r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
		g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
		b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
		const x = r * 0.4124 + g * 0.3576 + b * 0.1805;
		const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
		const z = r * 0.0193 + g * 0.1192 + b * 0.9505;
		return [ x * 100, y * 100, z * 100 ];
	}

	static xyzToLab(x, y, z) {
		const refX = 95.047,
			refY = 100.0,
			refZ = 108.883;
		x /= refX;
		y /= refY;
		z /= refZ;
		x = x > 0.008856 ? Math.cbrt(x) : 7.787 * x + 16 / 116;
		y = y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116;
		z = z > 0.008856 ? Math.cbrt(z) : 7.787 * z + 16 / 116;
		const L = 116 * y - 16;
		const a = 500 * (x - y);
		const b = 200 * (y - z);
		return [ L, a, b ];
	}

	static rgbToLab(r, g, b) {
		const [ x, y, z ] = Colors.rgbToXyz(r, g, b);
		return Colors.xyzToLab(x, y, z);
	}

	static deltaE(lab1, lab2) {
		return Math.sqrt(
			(lab1[ 0 ] - lab2[ 0 ]) ** 2 +
			(lab1[ 1 ] - lab2[ 1 ]) ** 2 +
			(lab1[ 2 ] - lab2[ 2 ]) ** 2
		);
	}

	static smoothSortPaletteA(palette) {
		return palette.slice().sort((a, b) => {
			const labA = Colors.rgbToLab(...a);
			const labB = Colors.rgbToLab(...b);
			return (
				labA[ 0 ] - labB[ 0 ] || labA[ 1 ] - labB[ 1 ] || labA[ 2 ] - labB[ 2 ]
			);
		});
	}
	// Convert hex string to RGB array [r,g,b]
	static hexToRgb(hex) {
		hex = hex.replace(/^#/, "");
		if (hex.length === 3)
			hex = hex
				.split("")
				.map((c) => c + c)
				.join("");
		return [
			parseInt(hex.slice(0, 2), 16),
			parseInt(hex.slice(2, 4), 16),
			parseInt(hex.slice(4, 6), 16)
		];
	}

	// Convert hex to Lab
	static hexToLab(hex) {
		const [ r, g, b ] = Colors.hexToRgb(hex);
		return Colors.rgbToLab(r, g, b);
	}

	// RGB -> XYZ
	static rgbToXyz(r, g, b) {
		r /= 255;
		g /= 255;
		b /= 255;
		r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
		g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
		b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
		const x = r * 0.4124 + g * 0.3576 + b * 0.1805;
		const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
		const z = r * 0.0193 + g * 0.1192 + b * 0.9505;
		return [ x * 100, y * 100, z * 100 ];
	}

	// XYZ -> Lab
	static xyzToLab(x, y, z) {
		const refX = 95.047,
			refY = 100.0,
			refZ = 108.883;
		x /= refX;
		y /= refY;
		z /= refZ;
		const fx = x > 0.008856 ? Math.cbrt(x) : 7.787 * x + 16 / 116;
		const fy = y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116;
		const fz = z > 0.008856 ? Math.cbrt(z) : 7.787 * z + 16 / 116;
		const L = 116 * fy - 16;
		const a = 500 * (fx - fy);
		const b = 200 * (fy - fz);
		return [ L, a, b ];
	}

	static rgbToLab(r, g, b) {
		const [ x, y, z ] = Colors.rgbToXyz(r, g, b);
		return Colors.xyzToLab(x, y, z);
	}

	// Delta E (CIE76)
	static deltaE(lab1, lab2) {
		return Math.sqrt(
			(lab1[ 0 ] - lab2[ 0 ]) ** 2 +
			(lab1[ 1 ] - lab2[ 1 ]) ** 2 +
			(lab1[ 2 ] - lab2[ 2 ]) ** 2
		);
	}

	// Total deltaE along array
	static totalDeltaE(labs) {
		let sum = 0;
		for (let i = 1; i < labs.length; i++) {
			sum += Colors.deltaE(labs[ i - 1 ].lab, labs[ i ].lab);
		}
		return sum;
	}

	// Smooth sort iterative
	static smoothSortPalette(hexColors) {
		const labs = hexColors.map((c) => ({
			hex: c,
			lab: Colors.hexToLab(c)
		}));
		let bestOrder = null;
		let bestScore = Infinity;

		for (let start = 0; start < labs.length; start++) {
			const remaining = [ ...labs ];
			let current = remaining.splice(start, 1)[ 0 ];
			const result = [ current ];

			while (remaining.length) {
				let nearestIndex = 0;
				let nearestDist = Infinity;
				for (let i = 0; i < remaining.length; i++) {
					const d = Colors.deltaE(current.lab, remaining[ i ].lab);
					if (d < nearestDist) {
						nearestDist = d;
						nearestIndex = i;
					}
				}
				current = remaining.splice(nearestIndex, 1)[ 0 ];
				result.push(current);
			}

			const score = Colors.totalDeltaE(result);
			if (score < bestScore) {
				bestScore = score;
				bestOrder = result;
			}
		}

		return bestOrder.map((o) => o.hex);
	}




	// Accepts: ["#rrggbb", ...] OR [{r,g,b,...}, ...]
	// Returns the same type it was given (hex strings or the original objects)
	static smoothSort(palette) {
		if (!Array.isArray(palette) || palette.length <= 2) return palette?.slice?.() ?? palette;

		// Build a list with LAB precomputed + a reference to the original item
		const items = palette.map(item => {
			if (typeof item === "string") {
				// hex input
				return { ref: item, lab: Colors.hexToLab(item) };
			} else {
				// object input with r,g,b
				const lab =
					item.lab
						? item.lab
						: (Colors.rgbToLab
							? Colors.rgbToLab(item.r, item.g, item.b)
							: Colors.hexToLab(Colors.rgbToHex(item.r, item.g, item.b)));
				return { ref: item, lab };
			}
		});

		// Nearest-neighbor with multi-start; O(n^3) but fine for typical palette sizes
		let bestOrder = null;
		let bestScore = Infinity;

		for (let start = 0; start < items.length; start++) {
			const remaining = items.slice();
			let current = remaining.splice(start, 1)[ 0 ];
			const ordered = [ current ];

			while (remaining.length) {
				let nearestIdx = 0;
				let nearestDist = Infinity;
				for (let i = 0; i < remaining.length; i++) {
					const d = Colors.deltaE(current.lab, remaining[ i ].lab);
					if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
				}
				current = remaining.splice(nearestIdx, 1)[ 0 ];
				ordered.push(current);
			}

			// Sum ΔE along the path
			let score = 0;
			for (let i = 1; i < ordered.length; i++) {
				score += Colors.deltaE(ordered[ i - 1 ].lab, ordered[ i ].lab);
			}

			if (score < bestScore) {
				bestScore = score;
				bestOrder = ordered;
			}
		}

		// Return same type as input (hex strings or original objects w/ pixels intact)
		return bestOrder.map(n => n.ref);
	}

	// Fallback if you don’t already have it:
	static rgbToHex(r, g, b) {
		return "#" + [ r, g, b ].map(v => v.toString(16).padStart(2, "0")).join("");
	}

}

// =======================
// KMEANS COLOR QUANTIZATION
// =======================
function kMeansQuantize(img, k = 16) {
	const tempCanvas = document.createElement("canvas");
	tempCanvas.width = img.width;
	tempCanvas.height = img.height;
	const ctx = tempCanvas.getContext("2d");
	ctx.drawImage(img, 0, 0);
	const data = ctx.getImageData(0, 0, img.width, img.height).data;

	const pixels = [];
	for (let i = 0; i < data.length; i += 4) {
		pixels.push([ data[ i ], data[ i + 1 ], data[ i + 2 ] ]);
	}

	let palette = [];
	for (let i = 0; i < k; i++) {
		palette.push(pixels[ Math.floor(Math.random() * pixels.length) ]);
	}

	for (let iter = 0; iter < 5; iter++) {
		const clusters = Array.from({ length: k }, () => []);
		for (const px of pixels) {
			let best = 0,
				bestDist = Infinity;
			for (let i = 0; i < palette.length; i++) {
				const c = palette[ i ];
				const d =
					(px[ 0 ] - c[ 0 ]) ** 2 +
					(px[ 1 ] - c[ 1 ]) ** 2 +
					(px[ 2 ] - c[ 2 ]) ** 2;
				if (d < bestDist) {
					bestDist = d;
					best = i;
				}
			}
			clusters[ best ].push(px);
		}
		for (let i = 0; i < k; i++) {
			if (clusters[ i ].length === 0) continue;
			const sum = [ 0, 0, 0 ];
			clusters[ i ].forEach((p) => {
				sum[ 0 ] += p[ 0 ];
				sum[ 1 ] += p[ 1 ];
				sum[ 2 ] += p[ 2 ];
			});
			palette[ i ] = sum.map((v) => Math.round(v / clusters[ i ].length));
		}
	}
	return palette;
}
//=========================
// CANVAS MANAGER
//=========================
/*
// TODO TO INTEGRATE BORROWED METHODS
 drawTiledPixels(layer, img, tileSize = 20, palette = null) {
		  const ctx = layer.ctx;
		  ctx.clearRect(0, 0, layer.width, layer.height);
		  ctx.imageSmoothingEnabled = false;

		  const tempCanvas = document.createElement("canvas");
		  tempCanvas.width = layer.width;
		  tempCanvas.height = layer.height;
		  const tctx = tempCanvas.getContext("2d");
		  tctx.imageSmoothingEnabled = false;
		  tctx.drawImage(img, 0, 0, layer.width, layer.height);

		  for (let y = 0; y < layer.height; y += tileSize) {
			   for (let x = 0; x < layer.width; x += tileSize) {
					const px = tctx.getImageData(x, y, 1, 1).data;
					let color = px;
					if (palette) color = this.findClosestColor(px, palette);

					const w = Math.min(tileSize, layer.width - x);
					const h = Math.min(tileSize, layer.height - y);

					ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${
						 color[3] / 255
					})`;
					ctx.fillRect(x, y, w, h);
			   }
		  }
	 }

 findClosestColor(px, palette) {
		  let minDist = Infinity,
			   closest = px;
		  for (const c of palette) {
			   const d =
					(px[0] - c[0]) ** 2 +
					(px[1] - c[1]) ** 2 +
					(px[2] - c[2]) ** 2;
			   if (d < minDist) {
					minDist = d;
					closest = c;
			   }
		  }
		  return [...closest, px[3]];
	 }

	 applyQuantizeAndTile(img, k = 16) {
		  const rgbPalette = kMeansQuantize(img, k);

		  let hexPalette = rgbPalette.map((c) => Colors.rgbToHex(c));

		  const layer = new Layer(
			   this.width,
			   this.height,
			   `Layer ${this.layers.length}`
		  );
		  this.drawTiledPixels(layer, img, this.tileSize, rgbPalette);
		  this.layers.push(layer);

		  hexPalette = [...new Set(hexPalette)];
		  const sortedHexPalette = Colors.smoothSortPalette(hexPalette);
		  const sortedRgbPalette = sortedHexPalette.map((c) =>
			   Colors.hexToRgb(c)
		  );

		  return sortedHexPalette;
	 }
*/

// TODO INTEGRATE THIS TO LOAD IN CANVAS -DONE
/*
function fitCanvasToImage(img) {
	 const container = document.getElementById("canvas-container");
	 const ratio = Math.min(
		  container.clientWidth / img.width,
		  container.clientHeight / img.height
	 );
	 canvasManager.resizeCanvas(
		  Math.round(img.width * ratio),
		  Math.round(img.height * ratio)
	 );
}
*/
//=========================
// LAYER CLASS
//=========================
class Layer {
	constructor (width, height, name = "Layer") {
		this.width = width;
		this.height = height;
		this.name = name;
		this.imageData = new ImageData(width, height);
		this.colors = []; // [{r,g,b,pixels,erased}]
	}
}

//=========================
// CANVAS MANAGER
//=========================
class CanvasManager {
	constructor (canvas) {
		this.canvas = canvas;
		this.ctx = canvas.getContext("2d", { willReadFrequently: true });
		this.layers = [];
		this.activeLayer = null;
		this.toggleGrid = false;
		this.tileSize = 1;
		this.rawImage = null;
	}

	async loadImage(img) {
		this.rawImage = img;
		const container = document.getElementById("canvas-container");
		const ratio = Math.min(
			container.clientWidth / img.width,
			container.clientHeight / img.height
		);
		const targetW = Math.round(img.width * ratio);
		const targetH = Math.round(img.height * ratio);
		this.resizeCanvas(targetW, targetH);

		this.ctx.imageSmoothingEnabled = false;
		this.ctx.clearRect(0, 0, targetW, targetH);
		this.ctx.drawImage(img, 0, 0, targetW, targetH);

		const data = this.ctx.getImageData(0, 0, targetW, targetH);
		const layer = new Layer(targetW, targetH, "Base Layer");
		layer.imageData = data;
		this.layers = [ layer ];
		this.activeLayer = layer;

		this.redraw();
	}

	resizeCanvas(width, height) {
		this.canvas.width = width;
		this.canvas.height = height;
	}

	redraw() {
		if (!this.activeLayer) return;
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.ctx.putImageData(this.activeLayer.imageData, 0, 0);
		if (this.toggleGrid) this.drawGrid();
	}

	drawGrid() {
		if (!this.activeLayer) return;
		const ctx = this.ctx;
		const width = this.activeLayer.width;
		const height = this.activeLayer.height;
		const ts = this.tileSize;

		ctx.strokeStyle = "#ccc";
		ctx.lineWidth = 1;

		for (let x = 0; x <= width; x += ts) {
			ctx.beginPath();
			ctx.moveTo(x + 0.5, 0);
			ctx.lineTo(x + 0.5, height);
			ctx.stroke();
		}
		for (let y = 0; y <= height; y += ts) {
			ctx.beginPath();
			ctx.moveTo(0, y + 0.5);
			ctx.lineTo(width, y + 0.5);
			ctx.stroke();
		}
	}


	async applyQuantizeAndTile(img, colorCount = 16, tileSize = 10) {
		if (!img) return;
		this.tileSize = tileSize;

		const rgbPalette = await kMeansQuantize(img, colorCount);
		const layer = new Layer(
			this.canvas.width,
			this.canvas.height,
			`Layer ${this.layers.length}`
		);
		this.drawTiled(layer, img, tileSize, rgbPalette);

		this.layers.push(layer);
		this.activeLayer = layer;

		this.redraw();
		return rgbPalette;
	}
	//  Multiple readback operations using getImageData are faster with the willReadFrequently attribute set to true. See: https://html.spec.whatwg.org/multipage/canvas.html#concept-canvas-will-read-frequently
	// THIS IS AWFULLY HEAVY
	drawTiled(layer, img, tileSize = 20, palette = null) {
		// Draw raw image to temp canvas
		const tempCanvas = document.createElement("canvas");
		tempCanvas.width = layer.width;
		tempCanvas.height = layer.height;
		const tctx = tempCanvas.getContext("2d");
		tctx.imageSmoothingEnabled = false;
		tctx.drawImage(img, 0, 0, layer.width, layer.height);

		// ✅ Store raw pixel data ONCE
		layer.rawPixelData = tctx.getImageData(0, 0, layer.width, layer.height).data;

		// Create output ImageData
		const outputImageData = tctx.createImageData(layer.width, layer.height);
		const outData = outputImageData.data;

		for (let y = 0; y < layer.height; y += tileSize) {
			for (let x = 0; x < layer.width; x += tileSize) {
				const idx = (y * layer.width + x) * 4;
				let color = [
					layer.rawPixelData[ idx ],
					layer.rawPixelData[ idx + 1 ],
					layer.rawPixelData[ idx + 2 ],
					layer.rawPixelData[ idx + 3 ]
				];

				if (palette) color = this.findClosestColor(color, palette);

				const w = Math.min(tileSize, layer.width - x);
				const h = Math.min(tileSize, layer.height - y);

				for (let ty = 0; ty < h; ty++) {
					for (let tx = 0; tx < w; tx++) {
						const outIdx = ((y + ty) * layer.width + (x + tx)) * 4;
						outData[ outIdx ] = color[ 0 ];
						outData[ outIdx + 1 ] = color[ 1 ];
						outData[ outIdx + 2 ] = color[ 2 ];
						outData[ outIdx + 3 ] = color[ 3 ];
					}
				}
			}
		}

		layer.imageData = outputImageData;
	}

	findClosestColor(px, palette) {
		let minDist = Infinity;
		let closest = px;
		for (const c of palette) {
			const d =
				(px[ 0 ] - c[ 0 ]) ** 2 +
				(px[ 1 ] - c[ 1 ]) ** 2 +
				(px[ 2 ] - c[ 2 ]) ** 2;
			if (d < minDist) {
				minDist = d;
				closest = c;
			}
		}
		return [ ...closest, px[ 3 ] ];
	}

	erasePixels(pixels) {
		if (!this.activeLayer) return;
		const data = this.activeLayer.imageData.data;
		pixels.forEach((p) => (data[ p.index + 3 ] = 0));
		this.redraw();
	}

	recolorPixels(pixels, r, g, b) {
		if (!this.activeLayer) return;
		const data = this.activeLayer.imageData.data;
		pixels.forEach((p) => {
			data[ p.index ] = r;
			data[ p.index + 1 ] = g;
			data[ p.index + 2 ] = b;
			data[ p.index + 3 ] = 255;
		});
		this.redraw();
	}

	drawBoundingBox(pixels, color = "limegreen") {
		if (!pixels.length) return;
		let minX = this.canvas.width,
			maxX = -1,
			minY = this.canvas.height,
			maxY = -1;
		pixels.forEach((p) => {
			const idx = p.index / 4;
			const x = idx % this.canvas.width;
			const y = Math.floor(idx / this.canvas.width);
			minX = Math.min(minX, x);
			maxX = Math.max(maxX, x);
			minY = Math.min(minY, y);
			maxY = Math.max(maxY, y);
		});
		this.ctx.strokeStyle = color;
		this.ctx.lineWidth = 2;
		//this.ctx.setLineDash([ 6, 4 ]);
		this.ctx.strokeRect(
			minX - 0.5,
			minY - 0.5,
			maxX - minX + 1,
			maxY - minY + 1
		);
		this.ctx.setLineDash([]);
	}
}

//=========================
// PALETTE MANAGER
//=========================
class PaletteManager {
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
eraseBtn.addEventListener("click", () => pm.eraseSelectedSwatch());
createPaletteBtn.addEventListener("click", () => pm.createPalette());
colorPicker.addEventListener("input", () => {
	const hex = colorPicker.value;
	const r = parseInt(hex.substr(1, 2), 16);
	const g = parseInt(hex.substr(3, 2), 16);
	const b = parseInt(hex.substr(5, 2), 16);
	pm.recolorSelectedSwatch(r, g, b);
});

toggleGridCheckbox.addEventListener("change", () => {
	cm.toggleGrid = toggleGridCheckbox.checked;
	cm.redraw();
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
		//e.target.value = "";
	});

document
	.getElementById("quantize-tile-btn")
	.addEventListener("click", async () => {
		if (!cm.activeLayer || !cm.rawImage) return;
		const tileSize =
			parseInt(document.getElementById("tile-size-input").value, 10) ||
			1;
		const colorCount =
			parseInt(
				document.getElementById("color-count-input").value,
				10
			) || 16;

		// 🔹 use the stored image, not the canvas
		await cm.applyQuantizeAndTile(cm.rawImage, colorCount, tileSize);


	});
