/** Identifies material pixels, excluding background refraction changes. */
export async function compareDiagnosticLeaf(page, reference, actual) {
  return page.evaluate(async (images) => {
    const points = async (encoded) => {
      const im = new Image(); im.src = `data:image/png;base64,${encoded}`; await im.decode();
      const c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
      const ctx = c.getContext("2d"); ctx.drawImage(im, 0, 0);
      const data = ctx.getImageData(0, 0, c.width, c.height).data, p = [];
      for (let y = 250; y < c.height; y++) for (let x = 150; x < c.width - 150; x++) {
        const i = (y * c.width + x) * 4;
        if (data[i] > 40 && data[i+2] > 40 && data[i] > data[i+1] * 1.2 && data[i+2] > data[i+1] * 1.2) p.push([x,y]);
      }
      return p;
    };
    const [a,b] = await Promise.all(images.map(points));
    const cells = new Set(b.map(([x,y]) => `${Math.floor(x/16)},${Math.floor(y/16)}`));
    const matched = a.filter(([x,y]) => cells.has(`${Math.floor(x/16)},${Math.floor(y/16)}`)).length;
    return { reference: a.length, actual: b.length, coverage: matched/a.length, area: b.length/a.length };
  }, [reference,actual].map((b) => b.toString("base64")));
}
