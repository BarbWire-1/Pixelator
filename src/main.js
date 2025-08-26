/*
MIT License
Copyright(c) 2025 Barbara Kälin aka BarbWire - 1
*/
import { initPixelator } from "./Pixelator.js";
import "./sidebarUI.js"


const pixelStuff = initPixelator();
const { snapshot } = pixelStuff;



// used in some modules ..
export { snapshot };

// TODO add a gif
// TODO implement the copy to cb correct
// TODO refactor all modules into Logic + exchangeable UI - decouple

// TODO implement Layer stack and logic, best in own Handler - use template for components
// TODO REFACTOR CANVAS!!! : imageProcessing, canvasHandling, layer-management
