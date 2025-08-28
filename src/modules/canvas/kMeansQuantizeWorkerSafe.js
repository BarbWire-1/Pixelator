/*
MIT License
Copyright(c) 2025 Barbara Kälin aka BarbWire - 1
*/
/*
MIT License
Copyright(c) 2025 Barbara Kälin aka BarbWire - 1
*/
function getColorAt(data, index) {
	return { r: data[ index ], g: data[ index + 1 ], b: data[ index + 2 ], a: data[ index + 3 ] };
}

function setColorAt(data, index, { r, g, b, a }) {
	data[ index ] = r;
	data[ index + 1 ] = g;
	data[ index + 2 ] = b;
	data[ index + 3 ] = a;
}
//TODO added a key to handle alpha. Add UI checkbox to switch!!!:::::::
// Switched to stay all in rgb - much quicker then converting forth and back:

// K-means color quantization.
// Optimized: instead of using every raw pixel, we run on the tile-reduced set,
// then map all original pixels to the nearest centroid.
// This makes it MUCH faster while preserving overall color fidelity.


// Expects imageData (Uint8ClampedArray) instead of <img>
/**
 * Performs k-means color quantization on an image.
 *
 * @param {ImageData} imageData - The image data to quantize.
 * @param {number} [k=16] - Number of colors to reduce to.
 * @param {number} [iterations=10] - Number of k-means iterations.
 * @param {boolean} [allOpaque=false] - If true, treats all pixels as fully opaque (ignores alpha channel).
 * @returns {{ palette: number[][], clusteredData: Uint8ClampedArray, uniqueCount: number }}
 * Returns the generated palette, clustered image data, and the count of unique colors.
 */
export async function kMeansQuantizeOLD(imageData, k = 16, iterations = 10, allOpaque = false) {

	console.log(imageData.data.length / 4)
	const stride = allOpaque ? 3 : 4; // allocated // number of array slots per pixel (RGB or RGBA)
	const pixels = new Uint8Array((imageData.data.length / 4) * stride);
	const uniqueColors = new Set();

	let pIndex = 0;
	for (let i = 0; i < imageData.data.length; i += 4) {
		// direct handle
		const r = imageData.data[ i ];
		const g = imageData.data[ i + 1 ];
		const b = imageData.data[ i + 2 ];
		const a = imageData.data[ i + 3 ];

		pixels[ pIndex++ ] = r;
		pixels[ pIndex++ ] = g;
		pixels[ pIndex++ ] = b;
		if (!allOpaque) pixels[ pIndex++ ] = a;

		if (allOpaque) {
			uniqueColors.add((r << 16) | (g << 8) | b);
		} else {
			uniqueColors.add((r << 24) | (g << 16) | (b << 8) | a);
		}


	}



	const actualK = Math.min(k, uniqueColors.size);

	// Initialize palette randomly from used pixels
	const palette = [];
	const usedKeys = new Set();
	while (palette.length < actualK) {
		const idx = Math.floor(Math.random() * (pIndex / stride)) * stride;
		const key = !allOpaque
			? ((pixels[ idx ] << 24) | (pixels[ idx + 1 ] << 16) | (pixels[ idx + 2 ] << 8) | pixels[ idx + 3 ])
			: ((pixels[ idx ] << 16) | (pixels[ idx + 1 ] << 8) | pixels[ idx + 2 ]);

		if (!usedKeys.has(key)) {
			const entry = [];
			for (let s = 0; s < stride; s++) entry.push(pixels[ idx + s ]);
			palette.push(entry);
			usedKeys.add(key);
		}
	}

	// K-means iterations
	const clusters = Array.from({ length: actualK }, () => []);
	const clusterSums = Array.from({ length: actualK }, () => new Array(stride).fill(0));

	for (let iter = 0; iter < iterations; iter++) {
		for (let c = 0; c < actualK; c++) {
			clusters[ c ].length = 0;
			clusterSums[ c ].fill(0);
		}

		// assign pixels
		for (let i = 0; i < pIndex; i += stride) {
			const pr = pixels[ i ], pg = pixels[ i + 1 ], pb = pixels[ i + 2 ];
			const pa = (stride === 4) ? pixels[ i + 3 ] : 255;

			let best = 0, bestDist = Infinity;
			for (let j = 0; j < actualK; j++) {
				const c = palette[ j ];
				const dr = pr - c[ 0 ], dg = pg - c[ 1 ], db = pb - c[ 2 ];
				let d = dr * dr + dg * dg + db * db;
				if (stride === 4) {
					const da = pa - (c[ 3 ] ?? 255);
					d += da * da;
				}
				if (d < bestDist) { bestDist = d; best = j; }
			}

			clusters[ best ].push(i);
			for (let s = 0; s < stride; s++) clusterSums[ best ][ s ] += pixels[ i + s ];
		}

		// update centroids
		for (let j = 0; j < actualK; j++) {
			const cluster = clusters[ j ];
			if (!cluster.length) continue;
			for (let s = 0; s < stride; s++) {
				palette[ j ][ s ] = Math.round(clusterSums[ j ][ s ] / cluster.length);
			}
		}
	}

	// Map back to RGBA
	const clusteredData = new Uint8ClampedArray(imageData.data.length);
	for (let i = 0; i < imageData.data.length; i += 4) {
		const r = imageData.data[ i ],
			g = imageData.data[ i + 1 ],
			b = imageData.data[ i + 2 ],
			a = imageData.data[ i + 3 ];

		let best = 0, bestDist = Infinity;
		for (let j = 0; j < actualK; j++) {
			const c = palette[ j ];
			const dr = r - c[ 0 ], dg = g - c[ 1 ], db = b - c[ 2 ];
			let d = dr * dr + dg * dg + db * db;
			if (stride === 4) {
				const da = a - (c[ 3 ] ?? 255);
				d += da * da;
			}
			if (d < bestDist) { bestDist = d; best = j; }
		}

		clusteredData[ i ] = (a === 0) ? r : palette[ best ][ 0 ];
		clusteredData[ i + 1 ] = (a === 0) ? g : palette[ best ][ 1 ];
		clusteredData[ i + 2 ] = (a === 0) ? b : palette[ best ][ 2 ];
		clusteredData[ i + 3 ] = (a === 0)
			? 0
			: (allOpaque ? 255 : (palette[ best ][ 3 ] ?? 255));
	}

	return { palette, clusteredData, uniqueCount: uniqueColors.size, clusters };
}
export async function kMeansQuantize(imageData, k = 16, iterations = 10, canvasW, canvasH, allOpaque = false) {
	const smallW = imageData.width;
	const smallH = imageData.height;

	const stride = allOpaque ? 3 : 4;
	const pixels = new Uint8Array((smallW * smallH) * stride);
	const uniqueColors = new Set();

	let pIndex = 0;
	for (let i = 0; i < imageData.data.length; i += 4) {
		const r = imageData.data[ i ];
		const g = imageData.data[ i + 1 ];
		const b = imageData.data[ i + 2 ];
		const a = imageData.data[ i + 3 ];

		pixels[ pIndex++ ] = r;
		pixels[ pIndex++ ] = g;
		pixels[ pIndex++ ] = b;
		if (!allOpaque) pixels[ pIndex++ ] = a;

		const key = allOpaque
			? (r << 16 | g << 8 | b)
			: (r << 24 | g << 16 | b << 8 | a);
		uniqueColors.add(key);
	}

	const actualK = Math.min(k, uniqueColors.size);

	// Initialize palette randomly
	const palette = [];
	const usedKeys = new Set();
	while (palette.length < actualK) {
		const idx = Math.floor(Math.random() * (pIndex / stride)) * stride;
		const key = !allOpaque
			? ((pixels[ idx ] << 24) | (pixels[ idx + 1 ] << 16) | (pixels[ idx + 2 ] << 8) | pixels[ idx + 3 ])
			: ((pixels[ idx ] << 16) | (pixels[ idx + 1 ] << 8) | (pixels[ idx + 2 ]));
		if (!usedKeys.has(key)) {
			const entry = [];
			for (let s = 0; s < stride; s++) entry.push(pixels[ idx + s ]);
			palette.push(entry);
			usedKeys.add(key);
		}
	}

	// K-means clustering
	const clusters = Array.from({ length: actualK }, () => []);
	const clusterSums = Array.from({ length: actualK }, () => new Array(stride).fill(0));

	for (let iter = 0; iter < iterations; iter++) {
		for (let c = 0; c < actualK; c++) {
			clusters[ c ].length = 0;
			clusterSums[ c ].fill(0);
		}

		for (let i = 0; i < pIndex; i += stride) {
			const pr = pixels[ i ], pg = pixels[ i + 1 ], pb = pixels[ i + 2 ];
			const pa = stride === 4 ? pixels[ i + 3 ] : 255;

			let best = 0, bestDist = Infinity;
			for (let j = 0; j < actualK; j++) {
				const c = palette[ j ];
				const dr = pr - c[ 0 ], dg = pg - c[ 1 ], db = pb - c[ 2 ];
				let d = dr * dr + dg * dg + db * db;
				if (stride === 4) d += (pa - (c[ 3 ] ?? 255)) ** 2;
				if (d < bestDist) { bestDist = d; best = j; }
			}
			clusters[ best ].push(i);
			for (let s = 0; s < stride; s++) clusterSums[ best ][ s ] += pixels[ i + s ];
		}

		// Update centroids
		for (let j = 0; j < actualK; j++) {
			const cluster = clusters[ j ];
			if (!cluster.length) continue;
			for (let s = 0; s < stride; s++) {
				palette[ j ][ s ] = Math.round(clusterSums[ j ][ s ] / cluster.length);
			}
		}
	}

	// Build clusteredData for small canvas
	const clusteredData = new Uint8ClampedArray(imageData.data.length);
	for (let i = 0; i < imageData.data.length; i += 4) {
		const r = imageData.data[ i ], g = imageData.data[ i + 1 ], b = imageData.data[ i + 2 ], a = imageData.data[ i + 3 ];

		let best = 0, bestDist = Infinity;
		for (let j = 0; j < actualK; j++) {
			const c = palette[ j ];
			let d = (r - c[ 0 ]) ** 2 + (g - c[ 1 ]) ** 2 + (b - c[ 2 ]) ** 2;
			if (stride === 4) d += (a - (c[ 3 ] ?? 255)) ** 2;
			if (d < bestDist) { bestDist = d; best = j; }
		}

		clusteredData[ i ] = a === 0 ? r : palette[ best ][ 0 ];
		clusteredData[ i + 1 ] = a === 0 ? g : palette[ best ][ 1 ];
		clusteredData[ i + 2 ] = a === 0 ? b : palette[ best ][ 2 ];
		clusteredData[ i + 3 ] = a === 0 ? 0 : (allOpaque ? 255 : (palette[ best ][ 3 ] ?? 255));
	}

	// 🟢 Bloat clusters to full canvas
	const bloatedClusters = clusters.map(() => []);
	const factorX = canvasW / smallW;
	const factorY = canvasH / smallH;

	for (let c = 0; c < clusters.length; c++) {
		const smallIndices = clusters[ c ];
		for (const idxSmall of smallIndices) {
			const x = (idxSmall / stride) % smallW;
			const y = Math.floor(idxSmall / stride / smallW);

			const startX = Math.floor(x * factorX);
			const startY = Math.floor(y * factorY);
			const endX = Math.ceil((x + 1) * factorX);
			const endY = Math.ceil((y + 1) * factorY);

			for (let by = startY; by < endY; by++) {
				for (let bx = startX; bx < endX; bx++) {
					const idxBig = (by * canvasW + bx) * 4;
					bloatedClusters[ c ].push(idxBig);
				}
			}
		}
	}

	// Build colorClusters directly usable in PaletteManager
	const colorClusters = palette.map((color, i) => ({
		color: new Uint8Array(color),
		indices: bloatedClusters[ i ]
	}));

	return { palette, clusteredData, uniqueCount: uniqueColors.size, colorClusters };
}
// BACK TO NOT MAPPING!!!!!!
export function fastKMeansQuantize(imageData, k = 16, iterations = 5, allOpaque = false, tileStep = 1) {
	const { data, width, height } = imageData;
	const stride = 4;
	const pixelCount = width * height;

	// --- 1. Sample pixels for K-means ---
	const samples = [];
	for (let y = 0; y < height; y += tileStep) {
		for (let x = 0; x < width; x += tileStep) {
			const idx = (y * width + x) * stride;
			const r = data[ idx ], g = data[ idx + 1 ], b = data[ idx + 2 ], a = data[ idx + 3 ];
			samples.push(allOpaque ? [ r, g, b ] : [ r, g, b, a ]);
		}
	}

	const sStride = allOpaque ? 3 : 4;
	const actualK = Math.min(k, samples.length);

	// --- 2. Initialize palette randomly ---
	const palette = [];
	const used = new Set();
	while (palette.length < actualK) {
		const idx = Math.floor(Math.random() * samples.length);
		const key = samples[ idx ].join(',');
		if (!used.has(key)) {
			palette.push(samples[ idx ].slice());
			used.add(key);
		}
	}

	// --- 3. K-means iterations ---
	for (let iter = 0; iter < iterations; iter++) {
		const clusterSums = Array.from({ length: actualK }, () => new Array(sStride).fill(0));
		const clusterCounts = new Array(actualK).fill(0);

		for (const s of samples) {
			let best = 0, bestDist = Infinity;
			for (let i = 0; i < palette.length; i++) {
				const c = palette[ i ];
				let d = 0;
				for (let j = 0; j < sStride; j++) {
					const diff = s[ j ] - c[ j ];
					d += diff * diff;
				}
				if (d < bestDist) { best = i; bestDist = d; }
			}
			for (let j = 0; j < sStride; j++) clusterSums[ best ][ j ] += s[ j ];
			clusterCounts[ best ]++;
		}

		// Update centroids
		for (let i = 0; i < actualK; i++) {
			if (clusterCounts[ i ] === 0) continue;
			for (let j = 0; j < sStride; j++) palette[ i ][ j ] = Math.round(clusterSums[ i ][ j ] / clusterCounts[ i ]);
		}
	}

	// --- 4. Map all pixels in one pass ---
	const clusteredData = new Uint8ClampedArray(data.length);
	const view = new Uint32Array(clusteredData.buffer); // write RGBA as single 32-bit int
	for (let i = 0; i < pixelCount; i++) {
		const idx = i * stride;
		const px = allOpaque ? [ data[ idx ], data[ idx + 1 ], data[ idx + 2 ] ] : [ data[ idx ], data[ idx + 1 ], data[ idx + 2 ], data[ idx + 3 ] ];

		let best = 0, bestDist = Infinity;
		for (let j = 0; j < palette.length; j++) {
			const c = palette[ j ];
			let d = 0;
			for (let t = 0; t < sStride; t++) {
				const diff = px[ t ] - c[ t ];
				d += diff * diff;
			}
			if (d < bestDist) { best = j; bestDist = d; }
		}

		const c = palette[ best ];
		const a = allOpaque ? 255 : c[ 3 ] ?? 255;
		view[ i ] = (a << 24) | (c[ 2 ] << 16) | (c[ 1 ] << 8) | c[ 0 ];
	}

	return { palette, clusteredData };
}
