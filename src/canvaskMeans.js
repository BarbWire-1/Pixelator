// Switched to stay all in rgb - much quicker then converting forth and backfaceVisibility:

	// K-means color quantization.
	// Optimized: instead of using every raw pixel, we run on the tile-reduced set,
	// then map all original pixels to the nearest centroid.
	// This makes it MUCH faster while preserving overall color fidelity.

	export  function kMeansQuantize(img, k = 16, iterations = 10) {
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