# Pixelation & Color Reduction Workflow Documentation

## Overview

This workflow implements efficient pixelation and color reduction for images, leveraging **browser canvas downsampling**, **k-means color quantization**, and **tile-based upscaling**. It is designed to handle large images (millions of pixels) while maintaining quality and speed.

---

## Workflow Steps

### 1. Image Loading

* The image is loaded into a canvas element.
* It is resized proportionally to fit the display area.
* Image smoothing is disabled (`ctx.imageSmoothingEnabled = false`) to preserve pixel-level accuracy.
* The original pixel data is captured in an `ImageData` object for further processing.

**Purpose:** Capture the full-resolution image while preparing for tile-based manipulation.

---

### 2. Downscaling for Tiles

* The canvas is scaled down to `width / tileSize × height / tileSize`.
* Each pixel in this downscaled canvas represents a **tile of pixels** in the original image.
* The browser handles the averaging (if smoothing is enabled) or simply picks a representative pixel (if smoothing disabled).

**Purpose:** Reduce the number of pixels for quantization, turning potentially millions of pixels into a few thousand, depending on the tile size.

**Effect:**

* Tile size = 1 → full resolution; no downsampling needed.
* Tile size > 1 → fewer pixels, faster k-means, pixelated effect amplified.

---

### 3. Color Quantization (k-means)

* k-means clustering is applied to the downscaled image data.
* The algorithm reduces the number of unique colors to a specified `colorCount`.
* Output:

  * `palette`: The reduced set of colors.
  * `clusteredData`: Pixel data where each pixel is mapped to its nearest cluster color.

**Notes:**

* This step runs **on the downscaled canvas**, not the full image, making it extremely efficient.
* K-means iterations can be configured for a balance between quality and speed.

---

### 4. Upscaling & Tile Filling

* Each pixel in the clustered (quantized) downscaled image is **expanded into a `tileSize × tileSize` block** in the full-size canvas.
* This reconstructs the pixelated image without needing to process every pixel individually.
* If `tileSize = 1`, the quantized pixel data can be directly copied without further expansion.

**Purpose:** Generate the final pixelated image at original resolution while reflecting the reduced color palette.

---

### 5. Optional Grid Overlay

* A grid can be drawn to highlight tile boundaries.
* Only applies if `tileSize > 1`.
* Helps visually identify the pixel blocks.

---

## Performance Notes

* **Speed bottleneck:** k-means clustering.

  * Reduced drastically by downscaling the image to one pixel per tile before quantization.
* **Tile expansion:** Fast, linear in number of tiles, negligible compared to clustering.
* **Browser optimizations:** Using `ImageData.set()` or typed arrays avoids slow per-pixel loops.

---

## Summary of Tricks

1. **Browser canvas downsampling** replaces manual averaging for tiles.
2. **Run k-means on downscaled image** → fewer pixels → faster computation.
3. **Upscale clustered pixels** → reconstruct original-size pixel blocks efficiently.
4. **Direct copy if tileSize = 1** → avoids unnecessary loops.

---

## Visual Workflow

```
Original Image (WxH)
       |
       v
Downscaled Canvas (W/tileSize x H/tileSize)
       |
       v
k-means Clustering -> Reduced Color Palette
       |
       v
Upscaled to Original Canvas (tileSize x tileSize blocks)
       |
       v
Final Pixelated Image
```

---

## Key Advantages

* **Efficiency:** Only cluster thousands of pixels instead of millions.
* **Quality:** The tile color accurately represents the average color of the block.
* **Flexibility:** Tile size and color count can be adjusted for different effects.
* **Browser-native averaging:** No need to manually calculate tile averages.
