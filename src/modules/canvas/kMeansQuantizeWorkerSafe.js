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
export async function kMeansQuantize(imageData, k = 16, iterations = 10, allOpaque = false) {

	//console.log(imageData.data.length / 4)
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
		

		// alpha handling
		if (r + g + b + a === 0) {
			pixels[ pIndex++ ] = 0;        // keep fully transparent pixels as 0
		} else if (allOpaque) {
			pixels[ pIndex++ ] = 255;      // force opaque for all non-empty pixels
		} else {
			pixels[ pIndex++ ] = a;        // keep original alpha
		}

			uniqueColors.add((r << 24) | (g << 16) | (b << 8) | a);



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
