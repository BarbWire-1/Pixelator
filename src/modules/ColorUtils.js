/*
MIT License
Copyright(c) 2025 Barbara Kälin aka BarbWire - 1
*/

export class ColorUtils {
	// Convert RGB to hex string, e.g., (255, 0, 128) -> "#ff0080"
	static rgbToHex(r, g, b) {
		return (
			"#" +
			[ r, g, b ]
				.map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, "0"))
				.join("")
		);
	}

	// Convert hex string to RGB object, e.g., "#ff0080" -> {r:255,g:0,b:128}
	static hexToRgb(hex) {
		if (!hex.startsWith("#") || (hex.length !== 7 && hex.length !== 4)) return null;

		if (hex.length === 4) {
			// shorthand "#f08"
			hex = "#" + hex[ 1 ] + hex[ 1 ] + hex[ 2 ] + hex[ 2 ] + hex[ 3 ] + hex[ 3 ];
		}

		const r = parseInt(hex.slice(1, 3), 16);
		const g = parseInt(hex.slice(3, 5), 16);
		const b = parseInt(hex.slice(5, 7), 16);
		return { r, g, b };
	}

	// Convert RGBA to CSS string, e.g., {r:255,g:0,b:128,a:128} -> "rgba(255,0,128,0.502)"
	static rgbaToCss({ r, g, b, a }) {
		return `rgba(${r},${g},${b},${a / 255})`;
	}

	// ColorUtils.js
	static fromImageData(data, index) {
		return { r: data[ index ], g: data[ index + 1 ], b: data[ index + 2 ], a: data[ index + 3 ] };
	}


	// Clone color object
	static clone(color) {
		return { r: color.r, g: color.g, b: color.b, a: color.a ?? 255 };
	}

	// Compare two colors, optional ignore alpha
	static equals(c1, c2, ignoreAlpha = false) {
		return (
			c1.r === c2.r &&
			c1.g === c2.g &&
			c1.b === c2.b &&
			(ignoreAlpha || (c1.a ?? 255) === (c2.a ?? 255))
		);
	}

	// Blend two colors with optional alpha
	static blend(c1, c2, t = 0.5) {
		return {
			r: Math.round(c1.r * (1 - t) + c2.r * t),
			g: Math.round(c1.g * (1 - t) + c2.g * t),
			b: Math.round(c1.b * (1 - t) + c2.b * t),
			a: Math.round((c1.a ?? 255) * (1 - t) + (c2.a ?? 255) * t),
		};
	}

	
}
