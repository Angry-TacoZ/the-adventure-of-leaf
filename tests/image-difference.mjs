export async function changedPixelFraction(page, a, b, [left, right, top, bottom]) {
  return page.evaluate(async ([a, b, left, right, top, bottom]) => {
    async function read(encoded) {
      const image = new Image(); image.src = `data:image/png;base64,${encoded}`; await image.decode();
      const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext("2d"); ctx.drawImage(image, 0, 0);
      return ctx.getImageData(0, 0, image.width, image.height);
    }
    const x = await read(a), y = await read(b); let changed = 0, total = 0;
    for (let row = Math.floor(x.height * top); row < x.height * bottom; row++)
      for (let col = Math.floor(x.width * left); col < x.width * right; col++) {
        const i = (row * x.width + col) * 4;
        if (Math.abs(x.data[i] - y.data[i]) + Math.abs(x.data[i + 1] - y.data[i + 1]) + Math.abs(x.data[i + 2] - y.data[i + 2]) > 15) changed++;
        total++;
      }
    return changed / total;
  }, [a.toString("base64"), b.toString("base64"), left, right, top, bottom]);
}
