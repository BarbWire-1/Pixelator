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




// //________________________________________________
export async function kMeansQuantize(imageData, k = 16, iterations = 10, allOpaque = false) {


	const stride = allOpaque ? 3 : 4; // allocated // number of array slots per pixel (RGB or RGBA)
	const pixels = new Uint8Array((imageData.data.length / 4) * stride);
	const uniqueColors = new Set();

	let pIndex = 0;
	for (let i = 0; i < imageData.data.length; i += 4) {
		// direct handle
// 		const r = imageData.data[ i ];
// 		const g = imageData.data[ i + 1 ];
// 		const b = imageData.data[ i + 2 ];
// 		const a = imageData.data[ i + 3 ];
//
// 		pixels[ pIndex++ ] = r;
// 		pixels[ pIndex++ ] = g;
// 		pixels[ pIndex++ ] = b;
// 		if (!allOpaque) pixels[ pIndex++ ] = a;
//
// 		if (allOpaque) {
// 			uniqueColors.add((r << 16) | (g << 8) | b);
// 		} else {
// 			uniqueColors.add((r << 24) | (g << 16) | (b << 8) | a);
// 		}

// using named functions for clarity and readability
		const { r, g, b, a } = getColorAt(imageData.data, i);

		// Write directly to flat pixel array, forcing alpha if needed
		setColorAt(pixels, pIndex, { r, g, b, a: allOpaque ? 255 : a });
		pIndex += stride;

		// Track unique colors
		const key = allOpaque
			? (r << 16) | (g << 8) | b// 24 bit
			: (r << 24) | (g << 16) | (b << 8) | a;// 32 bit
		uniqueColors.add(key);
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



///////////////
// TEST ------------------
// function getColorAt(data, index) {
// 	return { r: data[ index ], g: data[ index + 1 ], b: data[ index + 2 ], a: data[ index + 3 ] };
// }
//
// function setColorAt(data, index, { r, g, b, a }) {
// 	data[ index ] = r;
// 	data[ index + 1 ] = g;
// 	data[ index + 2 ] = b;
// 	data[ index + 3 ] = a;
// }
//
// function forEachPixel(imageData, fn) {
// 	for (let i = 0; i < imageData.data.length; i += 4) {
// 		const color = getColorAt(imageData.data, i);
// 		fn(i, color);
// 	}
// }
//
// function rgbaKey({ r, g, b, a }) {
// 	return (r << 24) | (g << 16) | (b << 8) | a;
// }
//
// function rgbaKeyOpaque({ r, g, b }) {
// 	return (r << 16) | (g << 8) | b;
// }
//
//
// function distanceSq(c1, c2, stride) {
// 	let d = (c1.r - c2[ 0 ]) ** 2 + (c1.g - c2[ 1 ]) ** 2 + (c1.b - c2[ 2 ]) ** 2;
// 	if (stride === 4) d += (c1.a - (c2[ 3 ] ?? 255)) ** 2;
// 	return d;
// }
//
// export async function kMeansQuantize(imageData, k = 16, iterations = 10, allOpaque = false) {
// 	const stride = allOpaque ? 3 : 4;
// 	const pixels = new Uint8Array((imageData.data.length / 4) * stride);
// 	const uniqueColors = new Set();
// 	let pIndex = 0;
//
// 	// extract pixels into flat array
// 	forEachPixel(imageData, (_, color) => {
// 		color.a = allOpaque ? 255 : color.a;
// 		setColorAt(pixels, pIndex, color);
// 		pIndex += stride;
// 		uniqueColors.add(rgbaKey(color, allOpaque));
// 	});
//
// 	const actualK = Math.min(k, uniqueColors.size);
//
// 	// initialize palette randomly
// 	const palette = [];
// 	const usedKeys = new Set();
// 	while (palette.length < actualK) {
// 		const idx = Math.floor(Math.random() * (pIndex / stride)) * stride;
// 		const r = pixels[ idx ];
// 		const g = pixels[ idx + 1 ];
// 		const b = pixels[ idx + 2 ];
// 		const a = stride === 4 ? pixels[ idx + 3 ] : 255;
//
// 		const key = stride === 4 ? rgbaKey({ r, g, b, a }) : rgbaKeyOpaque({ r, g, b });
//
// 		if (!usedKeys.has(key)) {
// 			const entry = [];
// 			for (let s = 0; s < stride; s++) entry.push(pixels[ idx + s ]);
// 			palette.push(entry);
// 			usedKeys.add(key);
// 		}
// 	}
//
// 	// K-means iterations
// 	const clusters = Array.from({ length: actualK }, () => []);
// 	const clusterSums = Array.from({ length: actualK }, () => new Array(stride).fill(0));
//
// 	for (let iter = 0; iter < iterations; iter++) {
// 		clusters.forEach(c => c.length = 0);
// 		clusterSums.forEach(s => s.fill(0));
//
// 		for (let i = 0; i < pIndex; i += stride) {
// 			const color = { r: pixels[ i ], g: pixels[ i + 1 ], b: pixels[ i + 2 ], a: stride === 4 ? pixels[ i + 3 ] : 255 };
// 			let best = 0, bestDist = Infinity;
//
// 			palette.forEach((c, j) => {
// 				const d = distanceSq(color, c, stride);
// 				if (d < bestDist) { bestDist = d; best = j; }
// 			});
//
// 			clusters[ best ].push(i);
// 			for (let s = 0; s < stride; s++) clusterSums[ best ][ s ] += pixels[ i + s ];
// 		}
//
// 		// update centroids
// 		clusters.forEach((cluster, j) => {
// 			if (!cluster.length) return;
// 			for (let s = 0; s < stride; s++) palette[ j ][ s ] = Math.round(clusterSums[ j ][ s ] / cluster.length);
// 		});
// 	}
//
// 	// Map back to clustered imageData
// 	const clusteredData = new Uint8ClampedArray(imageData.data.length);
// 	forEachPixel(imageData, (i, color) => {
// 		let best = 0, bestDist = Infinity;
// 		palette.forEach((c, j) => {
// 			const d = distanceSq(color, c, stride);
// 			if (d < bestDist) { bestDist = d; best = j; }
// 		});
//
// 		clusteredData[ i ] = color.a === 0 ? color.r : palette[ best ][ 0 ];
// 		clusteredData[ i + 1 ] = color.a === 0 ? color.g : palette[ best ][ 1 ];
// 		clusteredData[ i + 2 ] = color.a === 0 ? color.b : palette[ best ][ 2 ];
// 		clusteredData[ i + 3 ] = color.a === 0 ? 0 : (allOpaque ? 255 : (palette[ best ][ 3 ] ?? 255));
// 	});
//
// 	return { palette, clusteredData, uniqueCount: uniqueColors.size };
// }