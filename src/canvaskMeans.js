// Switched to stay all in rgb - much quicker then converting forth and backfaceVisibility:

	// K-means color quantization.
	// Optimized: instead of using every raw pixel, we run on the tile-reduced set,
	// then map all original pixels to the nearest centroid.
	// This makes it MUCH faster while preserving overall color fidelity.

export function kMeansQuantize(img, k = 16, iterations = 10) {
	// Draw image to temp canvas and get pixel data
	const tempCanvas = document.createElement("canvas");
	tempCanvas.width = img.width;
	tempCanvas.height = img.height;
	const ctx = tempCanvas.getContext("2d");
	ctx.drawImage(img, 0, 0);
	const data = ctx.getImageData(0, 0, img.width, img.height);
	const pixels = new Uint8Array(img.width * img.height * 3); // flat RGB array
	const uniqueColors = new Set();

	// Fill pixels array and track unique colors using 24-bit keys
	let pIndex = 0;
	for (let i = 0; i < data.data.length; i += 4) {
		const r = data.data[ i ], g = data.data[ i + 1 ], b = data.data[ i + 2 ];
		pixels[ pIndex++ ] = r;
		pixels[ pIndex++ ] = g;
		pixels[ pIndex++ ] = b;
		uniqueColors.add((r << 16) | (g << 8) | b);
	}

	const actualK = Math.min(k, uniqueColors.size);

	// Initialize palette randomly from unique pixels
	const palette = [];
	const usedKeys = new Set();
	while (palette.length < actualK) {
		const idx = Math.floor(Math.random() * (pixels.length / 3)) * 3;
		const key = (pixels[ idx ] << 16) | (pixels[ idx + 1 ] << 8) | pixels[ idx + 2 ];
		if (!usedKeys.has(key)) {
			palette.push([ pixels[ idx ], pixels[ idx + 1 ], pixels[ idx + 2 ] ]);
			usedKeys.add(key);
		}
	}

	// Preallocate clusters for reuse
	const clusters = Array.from({ length: actualK }, () => []);
	const clusterSums = Array.from({ length: actualK }, () => [ 0, 0, 0 ]);

	// K-means iterations
	for (let iter = 0; iter < iterations; iter++) {
		// Clear clusters and sums
		for (let c = 0; c < actualK; c++) {
			clusters[ c ].length = 0;
			clusterSums[ c ][ 0 ] = clusterSums[ c ][ 1 ] = clusterSums[ c ][ 2 ] = 0;
		}

		// Assign each pixel to nearest centroid
		for (let i = 0; i < pixels.length; i += 3) {
			const pr = pixels[ i ], pg = pixels[ i + 1 ], pb = pixels[ i + 2 ];
			let best = 0, bestDist = Infinity;

			for (let j = 0; j < actualK; j++) {
				const c = palette[ j ];
				const dr = pr - c[ 0 ], dg = pg - c[ 1 ], db = pb - c[ 2 ];
				const d = dr * dr + dg * dg + db * db;
				if (d < bestDist) { bestDist = d; best = j; }
			}

			clusters[ best ].push(i);
			clusterSums[ best ][ 0 ] += pr;
			clusterSums[ best ][ 1 ] += pg;
			clusterSums[ best ][ 2 ] += pb;
		}

		// Update centroids
		for (let j = 0; j < actualK; j++) {
			const cluster = clusters[ j ];
			if (!cluster.length) continue;
			palette[ j ][ 0 ] = Math.round(clusterSums[ j ][ 0 ] / cluster.length);
			palette[ j ][ 1 ] = Math.round(clusterSums[ j ][ 1 ] / cluster.length);
			palette[ j ][ 2 ] = Math.round(clusterSums[ j ][ 2 ] / cluster.length);
		}
	}

	// Map all pixels to nearest centroid
	const clusteredData = new Uint8ClampedArray(data.data.length);
	for (let i = 0; i < pixels.length; i += 3) {
		const pr = pixels[ i ], pg = pixels[ i + 1 ], pb = pixels[ i + 2 ];
		let best = 0, bestDist = Infinity;

		for (let j = 0; j < actualK; j++) {
			const c = palette[ j ];
			const dr = pr - c[ 0 ], dg = pg - c[ 1 ], db = pb - c[ 2 ];
			const d = dr * dr + dg * dg + db * db;
			if (d < bestDist) { bestDist = d; best = j; }
		}

		const outIdx = (i / 3) * 4;
		clusteredData[ outIdx ] = palette[ best ][ 0 ];
		clusteredData[ outIdx + 1 ] = palette[ best ][ 1 ];
		clusteredData[ outIdx + 2 ] = palette[ best ][ 2 ];
		clusteredData[ outIdx + 3 ] = data.data[ outIdx + 3 ]; // preserve alpha
	}

	return { palette, clusteredData, uniqueCount: uniqueColors.size };
}
