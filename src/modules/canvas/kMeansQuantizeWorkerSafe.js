/*
MIT License
Copyright(c) 2025 Barbara Kälin aka BarbWire - 1
*/


//TODO added a key to handle alpha. Add UI checkbox to switch!!!
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
 *          Returns the generated palette, clustered image data, and the count of unique colors.
 */
export async function kMeansQuantize(imageData, k = 16, iterations = 10, allOpaque = false) {


	const stride = allOpaque ? 3 : 4;
	const pixels = new Uint8Array((imageData.data.length / 4) * stride);
	const uniqueColors = new Set();

	// Extract pixels
	let pIndex = 0;
	for (let i = 0; i < imageData.data.length; i += 4) {
		const r = imageData.data[ i ],
			g = imageData.data[ i + 1 ],
			b = imageData.data[ i + 2 ],
			a = imageData.data[ i + 3 ];

		pixels[ pIndex++ ] = r;
		pixels[ pIndex++ ] = g;
		pixels[ pIndex++ ] = b;
		if (!allOpaque) {
			pixels[ pIndex++ ] = a;
			uniqueColors.add((r << 24) | (g << 16) | (b << 8) | a);
		} else {
			uniqueColors.add((r << 16) | (g << 8) | b);
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

	return { palette, clusteredData, uniqueCount: uniqueColors.size };
}


// export async function kMeansQuantize(imageData, k = 16, iterations = 10) {
// 	const pixels = new Uint8Array(imageData.data.length / 4 * 3);
// 	const uniqueColors = new Set();
//
// 	// Extract RGB from ImageData
// 	let pIndex = 0;
// 	for (let i = 0; i < imageData.data.length; i += 4) {
// 		const r = imageData.data[ i ],
// 			g = imageData.data[ i + 1 ],
// 			b = imageData.data[ i + 2 ];
// 		pixels[ pIndex++ ] = r;
// 		pixels[ pIndex++ ] = g;
// 		pixels[ pIndex++ ] = b;
// 		uniqueColors.add((r << 16) | (g << 8) | b);
// 	}
//
// 	const actualK = Math.min(k, uniqueColors.size);
//
// 	// Initialize palette randomly from unique pixels
// 	const palette = [];
// 	const usedKeys = new Set();
// 	while (palette.length < actualK) {
// 		const idx = Math.floor(Math.random() * (pixels.length / 3)) * 3;
// 		const key = (pixels[ idx ] << 16) | (pixels[ idx + 1 ] << 8) | pixels[ idx + 2 ];
// 		if (!usedKeys.has(key)) {
// 			palette.push([ pixels[ idx ], pixels[ idx + 1 ], pixels[ idx + 2 ] ]);
// 			usedKeys.add(key);
// 		}
// 	}
//
// 	// Typed arrays for clusters and sums
// 	const clusterSums = new Uint32Array(actualK * 3);            // RGB sums
// 	const clustersFlat = new Uint32Array(pixels.length / 3);     // pixel indices
// 	const clusterCounts = new Uint32Array(actualK);              // pixels per cluster
//
// 	// Helper for adding to cluster sum
// 	const addToClusterSum = (clusterIndex, r, g, b) => {
// 		const base = clusterIndex * 3;
// 		clusterSums[ base ] += r;
// 		clusterSums[ base + 1 ] += g;
// 		clusterSums[ base + 2 ] += b;
// 	};
//
// 	// K-means iterations
// 	for (let iter = 0; iter < iterations; iter++) {
// 		clusterCounts.fill(0);
// 		clusterSums.fill(0);
//
// 		// Assign pixels to clusters
// 		for (let i = 0; i < pixels.length; i += 3) {
// 			const pr = pixels[ i ], pg = pixels[ i + 1 ], pb = pixels[ i + 2 ];
// 			let best = 0, bestDist = Infinity;
//
// 			for (let j = 0; j < actualK; j++) {
// 				const c = palette[ j ];
// 				const dr = pr - c[ 0 ], dg = pg - c[ 1 ], db = pb - c[ 2 ];
// 				const d = dr * dr + dg * dg + db * db;
// 				if (d < bestDist) { bestDist = d; best = j; }
// 			}
//
// 			// Add pixel index to flattened cluster array
// 			const pos = clusterCounts[ best ]++;
// 			clustersFlat[ pos ] = i;
//
// 			// Add RGB to cluster sum
// 			addToClusterSum(best, pr, pg, pb);
// 		}
//
// 		// Update centroids
// 		for (let j = 0; j < actualK; j++) {
// 			const count = clusterCounts[ j ];
// 			if (count === 0) continue;
// 			const base = j * 3;
// 			palette[ j ][ 0 ] = Math.round(clusterSums[ base ] / count);
// 			palette[ j ][ 1 ] = Math.round(clusterSums[ base + 1 ] / count);
// 			palette[ j ][ 2 ] = Math.round(clusterSums[ base + 2 ] / count);
// 		}
// 	}
//
// 	// Map pixels back to RGBA
// 	const clusteredData = new Uint8ClampedArray(imageData.data.length);
// 	for (let i = 0; i < pixels.length; i += 3) {
// 		const pr = pixels[ i ], pg = pixels[ i + 1 ], pb = pixels[ i + 2 ];
// 		let best = 0, bestDist = Infinity;
//
// 		for (let j = 0; j < actualK; j++) {
// 			const c = palette[ j ];
// 			const dr = pr - c[ 0 ], dg = pg - c[ 1 ], db = pb - c[ 2 ];
// 			const d = dr * dr + dg * dg + db * db;
// 			if (d < bestDist) { bestDist = d; best = j; }
// 		}
//
// 		const outIdx = (i / 3) * 4;
// 		clusteredData[ outIdx ] = palette[ best ][ 0 ];
// 		clusteredData[ outIdx + 1 ] = palette[ best ][ 1 ];
// 		clusteredData[ outIdx + 2 ] = palette[ best ][ 2 ];
// 		clusteredData[ outIdx + 3 ] = imageData.data[ outIdx + 3 ]; // preserve alpha
// 	}
//
// 	return { palette, clusteredData, uniqueCount: uniqueColors.size };
// }
