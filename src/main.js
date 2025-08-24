/*
MIT License
Copyright(c) 2025 Barbara Kälin aka BarbWire - 1
*/
import { initPixelator } from "./Pixelator.js";
import "./ui-ux.js"


const pixelStuff = initPixelator();
const { snapshot } = pixelStuff;



// used in some modules ..
export { snapshot };

// TODO add a gif
// TODO implement the copy to cb correct
// TODO refactor all modules into Logic + exchangeable UI - decouple

// TODO implement Layer stack and logic, best in own Handler - use template for components
// TODO REFACTOR CANVAS!!! : imageProcessing, canvasHandling, layer-management
const resizer = document.getElementById('resizer');
const sidebar = document.getElementById('sidebar');
let isResizing = false;

resizer.addEventListener('mousedown', (e) => {
//	e.preventDefault();
	isResizing = true;
	document.body.style.cursor = 'col-resize';
});

document.addEventListener('mousemove', (e) => {
	if (!isResizing) return;

	// Calculate new width relative to viewport
	const newWidth = Math.min(Math.max(50, window.innerWidth - e.clientX), 1000);
	sidebar.style.width = newWidth + 'px';
});

document.addEventListener('mouseup', () => {
	if (!isResizing) return;
	isResizing = false;
	document.body.style.cursor = '';
});

// // wheel zoom to canvas container - LOL
// const container = document.getElementById("canvas-container");
// const canvas = document.getElementById("canvas");
//
// container.addEventListener("wheel", (e) => {
// 	e.preventDefault(); // prevent from scrolling - STRANGE, but really SPOOKY without
// 	const zoomStep = 0.01;
// 	let scale = parseFloat(canvas.style.transform.replace(/scale\((.+)\)/, "$1")) || 1;
//
// 	if (e.deltaY < 0) {
// 		scale += zoomStep; // zoom in
// 	} else {
// 		scale = Math.max(0.01, scale - zoomStep); // zoom out, min 0.1
// 	}
//
// 	canvas.style.transform = `scale(${scale})`;
// }, { passive: false });
