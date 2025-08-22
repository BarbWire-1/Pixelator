
import { initPixelator } from "./Pixelator.js";

const pixelStuff = initPixelator();
const { snapshot } = pixelStuff;



// used in some modules ..
export { snapshot };



//TODO - make sidebar sections draggable (get other code from editor)
// UI UX
const sidebar = document.getElementById('sidebar');

sidebar.addEventListener('click', (e) => {
	// Only handle clicks on section headers
	const header = e.target.closest('.sidebar-section > h3');
	if (!header) return;

	const section = header.parentElement;
	section.classList.toggle('collapsed');
});
