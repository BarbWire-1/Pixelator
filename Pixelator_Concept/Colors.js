export class Colors {
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



	// Switched to stay all in rgb - much quicker then converting forth and backfaceVisibility: 

	// K-means color quantization.
	// Optimized: instead of using every raw pixel, we run on the tile-reduced set,
	// then map all original pixels to the nearest centroid.
	// This makes it MUCH faster while preserving overall color fidelity.

	static kMeansQuantize(img, k = 16, iterations = 10) {
		const tempCanvas = document.createElement("canvas");
		tempCanvas.width = img.width;
		tempCanvas.height = img.height;
		const ctx = tempCanvas.getContext("2d");
		ctx.drawImage(img, 0, 0);
		console.log(iterations)
		const data = ctx.getImageData(0, 0, img.width, img.height);
		const pixels = [];
		const uniqueColors = new Set();

		for (let i = 0; i < data.data.length; i += 4) {
			const r = data.data[ i ], g = data.data[ i + 1 ], b = data.data[ i + 2 ];
			pixels.push([ r, g, b ]);
			uniqueColors.add(`${r},${g},${b}`);
		}

		// Clamp k to number of unique colors
		const actualK = Math.min(k, uniqueColors.size);

		// initialize palette randomly
		let palette = [];
		const used = new Set();
		while (palette.length < actualK) {
			const px = pixels[ Math.floor(Math.random() * pixels.length) ];
			const key = px.join(",");
			if (!used.has(key)) {
				palette.push(px.slice());
				used.add(key);
			}
		}

		// k-means iterations
		for (let iter = 0; iter < iterations; iter++) {

			console.log(`kMeans iteration: ${iter + 1}`);

			const clusters = Array.from({ length: actualK }, () => []);
			for (const px of pixels) {
				let best = 0, bestDist = Infinity;
				for (let i = 0; i < palette.length; i++) {
					const c = palette[ i ];
					const d = (px[ 0 ] - c[ 0 ]) ** 2 + (px[ 1 ] - c[ 1 ]) ** 2 + (px[ 2 ] - c[ 2 ]) ** 2;
					if (d < bestDist) { bestDist = d; best = i; }
				}
				clusters[ best ].push(px);
			}
			for (let i = 0; i < actualK; i++) {
				if (!clusters[ i ].length) continue;
				const sum = [ 0, 0, 0 ];
				clusters[ i ].forEach(p => { sum[ 0 ] += p[ 0 ]; sum[ 1 ] += p[ 1 ]; sum[ 2 ] += p[ 2 ]; });
				palette[ i ] = sum.map(v => Math.round(v / clusters[ i ].length));
			}
		}

		// map pixels to centroids
		const clusteredData = new Uint8ClampedArray(data.data.length);
		for (let i = 0; i < pixels.length; i++) {
			const px = pixels[ i ];
			let best = 0, bestDist = Infinity;
			for (let j = 0; j < palette.length; j++) {
				const c = palette[ j ];
				const d = (px[ 0 ] - c[ 0 ]) ** 2 + (px[ 1 ] - c[ 1 ]) ** 2 + (px[ 2 ] - c[ 2 ]) ** 2;
				if (d < bestDist) { bestDist = d; best = j; }
			}
			clusteredData[ i * 4 ] = palette[ best ][ 0 ];
			clusteredData[ i * 4 + 1 ] = palette[ best ][ 1 ];
			clusteredData[ i * 4 + 2 ] = palette[ best ][ 2 ];
			clusteredData[ i * 4 + 3 ] = data.data[ i * 4 + 3 ];
		}


		return { palette, clusteredData, uniqueCount: uniqueColors.size };
	}



}