
import { initPixelator } from "./Pixelator.js";

const pixelStuff = initPixelator();

// Destructure snapshot from pixelStuff
const { snapshot, cm } = pixelStuff;



// Named export
export { snapshot };
