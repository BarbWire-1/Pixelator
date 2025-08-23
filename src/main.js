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

// TODO fix html structure and CSS
// TODO implement sidebar resize
const resizer = document.getElementById('resizer');
const sidebar = document.getElementById('sidebar');
let isResizing = false;

resizer.addEventListener('mousedown', (e) => {
	e.preventDefault();
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
