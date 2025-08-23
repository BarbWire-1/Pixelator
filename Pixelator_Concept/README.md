# Pixelator

Pixelator is a standalone browser-based tool for image pixelation, color quantization, and interactive pixel editing. Designed for artists and pixel enthusiasts, it lets you transform any image into a pixel-perfect canvas with a limited color palette.

## Features

- Load and fit images to a flexible container while maintaining aspect ratio.
- Pixelate images with configurable tile size.
- Quantize colors using K-means clustering to reduce palette.
- Interactive color palette: recolor, erase, or highlight color groups.
- Drawing and erasing tools with optional mirror drawing modes.
- Toggle grid overlay for precise pixel-level editing.
- Modular layer architecture for future multi-layer support.

## How it Works

1. **Load Image:** Image is scaled to fit the container and stored in a base layer.
2. **Pixelation:** Image is downscaled to a grid based on `tileSize`.
3. **Quantization:** Colors are clustered to a palette of `maxColors`.
4. **Upscale:** Quantized tiles are scaled back to canvas size for crisp pixel edges.
5. **Interactive Editing:** Users can draw, erase, and recolor pixels.
6. **Layer Management:** Each editing stage can be stored in separate layers.

## Technical Details

- Uses HTML5 Canvas API for all pixel operations.
- K-means clustering for color quantization.
- `ImageData` manipulation for fast pixel-level edits.
- No external libraries needed; fully standalone.
- Layer abstraction for modularity and future expansion.

## Usage

```js
const canvas = document.getElementById("pixel-canvas");
const manager = new CanvasManager(canvas);

// Load image
manager.loadImage(img);

// Apply pixelation and quantization
await manager.applyQuantizeAndTile(img, 16, 10);

// Toggle grid
manager.toggleGrid = true;
manager.redraw();

// Edit pixels
manager.erasePixels(pixels);
manager.recolorPixels(pixels, r, g, b);
```

## License

MIT License

