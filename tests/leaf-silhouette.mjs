// Shared reference comparison permits refractive color/position changes while detecting lost geometry.
export async function compareLeafSilhouette(page, reference, actual) {
  return await page.evaluate(
    async ([ref, actual]) => {
      async function mask(encoded) {
        const im = new Image();
        im.src = "data:image/png;base64," + encoded;
        await im.decode();
        const c = document.createElement("canvas");
        c.width = im.width;
        c.height = im.height;
        const ctx = c.getContext("2d");
        ctx.drawImage(im, 0, 0);
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        const mask = new Uint8Array(c.width * c.height);
        for (let y = 180; y < 700; y++)
          for (let x = 200; x < 1100; x++) {
            const i = (y * c.width + x) * 4;
            if (
              d[i] > 75 &&
              d[i + 1] > 75 &&
              d[i + 2] < Math.min(d[i], d[i + 1]) * 0.65
            )
              mask[y * c.width + x] = 1;
          }
        let points = [];
        for (let seed = 0; seed < mask.length; seed++) {
          if (!mask[seed]) continue;
          const queue = [seed],
            component = [];
          mask[seed] = 0;
          for (let k = 0; k < queue.length; k++) {
            const i = queue[k];
            component.push([i % c.width, Math.floor(i / c.width)]);
            for (const n of [i - 1, i + 1, i - c.width, i + c.width])
              if (n >= 0 && n < mask.length && mask[n]) {
                mask[n] = 0;
                queue.push(n);
              }
          }
          if (component.length > points.length) points = component;
        }
        return points;
      }
      const a = await mask(ref),
        b = await mask(actual);
      const cells = new Set(
        b.map(([x, y]) => Math.floor(x / 16) + "," + Math.floor(y / 16)),
      );
      let matched = 0;
      for (const [x, y] of a) {
        let hit = false;
        for (let dx = -1; dx <= 1; dx++)
          for (let dy = -1; dy <= 1; dy++)
            if (
              cells.has(
                Math.floor(x / 16) + dx + "," + (Math.floor(y / 16) + dy),
              )
            )
              hit = true;
        if (hit) matched++;
      }
      return {
        reference: a.length,
        actual: b.length,
        coverage: matched / Math.max(1, a.length),
        area: b.length / Math.max(1, a.length),
      };
    },
    [reference.toString("base64"), actual.toString("base64")],
  );
}
