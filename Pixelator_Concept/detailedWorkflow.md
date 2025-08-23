# Pixelation and Color Quantization Workflow

This document describes the workflow implemented in `CanvasManager` for pixelating images and reducing their colors using a combination of browser canvas scaling and k-means quantization.

---

## Overview

The workflow is designed to efficiently pixelate an image while controlling the number of colors. The main idea is:

1. Use the browser's canvas to downscale the image, effectively averaging pixels within each block.
2. Apply k-means clustering to reduce the number of colors in the downscaled image.
3. Upscale the processed image back to its original size, generating colored tiles of the desired size.

This approach minimizes expensive per-pixel operations while preserving image quality.

---

## Steps

### 1. Image Loading

* The image is loaded into a canvas scaled to fit the container.
* `ImageData` is extracted from the canvas and stored in a `Layer` object.

```javascript
const data = ctx.getImageData(0, 0, width, height);
layer.imageData = data;
```

### 2. Downscaling

* A temporary canvas of size `(canvasWidth / tileSize, canvasHeight / tileSize)` is created.
* The original image is drawn onto this temporary canvas with `imageSmoothingEnabled = false`.
* The canvas automatically averages pixel colors within each tile.

```javascript
tctx.drawImage(img, 0, 0, tempWidth, tempHeight);
```

### 3. Color Quantization with k-Means

* The downscaled canvas is passed to `kMeansQuantize`.
* k-means reduces the number of colors to a target `colorCount`.
* Output includes the `palette` and `clusteredData`.

```javascript
const { palette, clusteredData, uniqueCount } = await kMeansQuantize(tempCanvas, colorCount, iterations);
```

### 4. Upscaling to Tiles

* If `tileSize === 1`, the `clusteredData` is copied directly to the output `ImageData`.
* If `tileSize > 1`, each pixel in the downscaled image becomes a `tileSize x tileSize` block in the output canvas.
* Nested loops fill each tile with the quantized color.

```javascript
for (let y = 0; y < tempH; y++) {
    for (let x = 0; x < tempW; x++) {
        const color = clusteredData[(y*tempW + x)*4 ...];
        for (let ty = 0; ty < tileH; ty++) {
            for (let tx = 0; tx < tileW; tx++) {
                // Fill each output pixel
            }
        }
    }
}
```

### 5. Final Layer & Redraw

* A new `Layer` is created with the upscaled `ImageData`.
* This layer is pushed to `layers` and set as `activeLayer`.
* The canvas is redrawn using `putImageData`.

```javascript
ctx.putImageData(activeLayer.imageData, 0, 0);
```

---

## Key Notes

* The downscaling step leverages the browser's canvas to compute the average of pixels per tile automatically.
* k-means operates on a smaller number of pixels (downscaled canvas), improving performance drastically.
* Upscaling fills each tile with a solid color, producing crisp pixelated visuals.
* `tileSize = 1` allows direct pixel-per-pixel mapping without extra loops.

---

## Advantages

* **Performance:** Reduces the number of pixels processed by k-means.
* **Quality:** Downscaling preserves the average color per tile before quantization.
* **Flexibility:** Supports arbitrary `tileSize` and `colorCount`.

---

## Summary

The workflow can be summarized as:

1. Load and scale image to canvas.
2. Downscale to `(canvasWidth / tileSize, canvasHeight / tileSize)`.
3. Quantize colors using k-means.
4. Upscale back to original size, filling each tile with quantized color.
5. Push layer and redraw.

This method ensures efficient and high-quality pixelation and color reduction for large images.
