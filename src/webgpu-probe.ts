import { WebGPURenderer } from "three/webgpu";

/** Experimental backend probe. The production scene remains on its existing
 * renderer until the node-based water capture path supports both backends. */
export async function probeWebGPUBackend(forceWebGL = false) {
  const renderer = new WebGPURenderer({ forceWebGL, antialias: true });
  try {
    await renderer.init();
    return "isWebGPUBackend" in renderer.backend ? "WebGPU" : "WebGL2";
  } finally {
    renderer.dispose();
  }
}
