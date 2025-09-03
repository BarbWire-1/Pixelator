/*
MIT License
Copyright(c) 2025 Barbara Kälin aka BarbWire - 1
*/

export function smoothSort(palette) {
	if (!Array.isArray(palette) || palette.length <= 2) return palette?.slice?.() ?? palette;

	// Internal helper: convert RGB array [r,g,b] to Lab
	function rgbToLab([ r, g, b ]) {
		// sRGB -> XYZ
		r /= 255; g /= 255; b /= 255;
		r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
		g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
		b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
		const x = r * 0.4124 + g * 0.3576 + b * 0.1805;
		const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
		const z = r * 0.0193 + g * 0.1192 + b * 0.9505;

		// XYZ -> Lab
		const refX = 95.047, refY = 100.0, refZ = 108.883;
		let fx = x / refX, fy = y / refY, fz = z / refZ;
		fx = fx > 0.008856 ? Math.cbrt(fx) : 7.787 * fx + 16 / 116;
		fy = fy > 0.008856 ? Math.cbrt(fy) : 7.787 * fy + 16 / 116;
		fz = fz > 0.008856 ? Math.cbrt(fz) : 7.787 * fz + 16 / 116;

		const L = 116 * fy - 16;
		const a = 500 * (fx - fy);
		const bLab = 200 * (fy - fz);
		return [ L, a, bLab ];
	}

	function deltaE(lab1, lab2) {
		return Math.sqrt(
			(lab1[ 0 ] - lab2[ 0 ]) ** 2 +
			(lab1[ 1 ] - lab2[ 1 ]) ** 2 +
			(lab1[ 2 ] - lab2[ 2 ]) ** 2
		);
	}

	function totalDeltaE(labs) {
		let sum = 0;
		for (let i = 1; i < labs.length; i++) {
			sum += deltaE(labs[ i - 1 ].lab, labs[ i ].lab);
		}
		return sum;
	}

	// Precompute Lab for each palette item
	const items = palette.map(item => {
		if (typeof item === "string") {
			// hex string
			const r = parseInt(item.slice(1, 3), 16);
			const g = parseInt(item.slice(3, 5), 16);
			const b = parseInt(item.slice(5, 7), 16);
			return { ref: item, lab: rgbToLab([ r, g, b ]) };
		} else if (Array.isArray(item) && item.length >= 3) {
    return { ref: item, lab: rgbToLab([item[0], item[1], item[2]]) };
}
 else {
			throw new Error("Unsupported palette item format");
		}
	});

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
				const d = deltaE(current.lab, remaining[ i ].lab);
				if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
			}
			current = remaining.splice(nearestIdx, 1)[ 0 ];
			ordered.push(current);
		}

		const score = totalDeltaE(ordered);
		if (score < bestScore) {
			bestScore = score;
			bestOrder = ordered;
		}
	}

	return bestOrder.map(o => o.ref);
}
