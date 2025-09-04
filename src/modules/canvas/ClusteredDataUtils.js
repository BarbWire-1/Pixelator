/** @format */

// ClusteredDataUtils.js

export function upscaleClusteredData(
	clusteredData,
	tempW,
	tempH,
	targetW,
	targetH
) {
	const outData = new Uint8ClampedArray(targetW * targetH * 4);

	for (let ty = 0; ty < tempH; ty++) {
		for (let tx = 0; tx < tempW; tx++) {
			const srcIdx = (ty * tempW + tx) * 4;
			const r = clusteredData[srcIdx + 0];
			const g = clusteredData[srcIdx + 1];
			const b = clusteredData[srcIdx + 2];
			const a = clusteredData[srcIdx + 3];

			const x0 = Math.floor((tx * targetW) / tempW);
			const x1 = Math.floor(((tx + 1) * targetW) / tempW);
			const y0 = Math.floor((ty * targetH) / tempH);
			const y1 = Math.floor(((ty + 1) * targetH) / tempH);

			for (let y = y0; y < y1; y++) {
				for (let x = x0; x < x1; x++) {
					const outIdx = (y * targetW + x) * 4;
					outData[outIdx + 0] = r;
					outData[outIdx + 1] = g;
					outData[outIdx + 2] = b;
					outData[outIdx + 3] = a;
				}
			}
		}
	}
	return new ImageData(outData, targetW, targetH);
}

export function clusteredDataToCanvas(clusteredData, tempW, tempH, scale = 1) {
	const canvas = document.createElement('canvas');
	canvas.width = tempW * scale;
	canvas.height = tempH * scale;
	const ctx = canvas.getContext('2d', { willReadFrequently: true });

	const imgData = upscaleClusteredData(
		clusteredData,
		tempW,
		tempH,
		canvas.width,
		canvas.height
	);
	ctx.putImageData(imgData, 0, 0);

	return canvas;
}

export function getUniqueColors(clusteredData) {
	const seen = new Set();
	for (let i = 0; i < clusteredData.length; i += 4) {
		seen.add(
			`${clusteredData[i]},${clusteredData[i + 1]},${
				clusteredData[i + 2]
			},${clusteredData[i + 3]}`
		);
	}
	return seen.size;
}
