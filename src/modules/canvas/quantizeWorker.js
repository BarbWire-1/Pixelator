
import { kMeansQuantize } from "./kMeansQuantizeWorkerSafe.js";

self.onmessage = async (e) => {
	const { imageData, colorCount, iterations, allOpaque } = e.data;

	//console.log(e.data)

    try {
        const result = await kMeansQuantize(imageData, colorCount, iterations, allOpaque);
        self.postMessage({ success: true, ...result });
    } catch (err) {
        self.postMessage({ success: false, error: err.message });
    }
};
