/** Compare the hero's image contribution, including changed refracted colors.
 * An absolute gold mask is unsuitable when Fresnel reflection desaturates it.
 */
export async function compareLeafContribution(page, reference, referenceBackground, actual, actualBackground) {
  return page.evaluate(async (images) => {
    async function read(encoded) {
      const image = new Image(); image.src = `data:image/png;base64,${encoded}`; await image.decode();
      const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext("2d"); ctx.drawImage(image, 0, 0);
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
    const [ref, refBg, actual, actualBg] = await Promise.all(images.map(read));
    const points = (a, b, threshold) => {
      const p = [];
      for (let y = 250; y < a.height; y++) for (let x = 150; x < a.width - 150; x++) {
        const i = (y * a.width + x) * 4;
        if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > threshold) p.push([x, y]);
      }
      return p;
    };
    const a = points(ref, refBg, 30), b = points(actual, actualBg, 15);
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (const [x, y] of a) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
    const candidates = b.filter(([x, y]) => x >= left - 24 && x <= right + 24 && y >= top - 24 && y <= bottom + 24);
    const cells = new Set(candidates.map(([x, y]) => `${Math.floor(x / 16)},${Math.floor(y / 16)}`));
    const matched = a.filter(([x, y]) => cells.has(`${Math.floor(x / 16)},${Math.floor(y / 16)}`)).length;
    return { reference: a.length, actual: candidates.length, coverage: matched / a.length, area: candidates.length / a.length };
  }, [reference, referenceBackground, actual, actualBackground].map((b) => b.toString("base64")));
}
