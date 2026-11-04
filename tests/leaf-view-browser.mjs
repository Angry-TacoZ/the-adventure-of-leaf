import { chromium } from "playwright";
import assert from "node:assert/strict";
const b = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const p = await b.newPage();
  await p.goto(process.env.LEAF_BASE_URL);
  const result = await p.evaluate(async () => {
    const { createLeafView } = await import("/src/leaf-view.ts");
    const view = createLeafView();
    await view.ready;
    const positions = new Float32Array([1, 2, 3, 2, 2, 3, 1, 2, 4]),
      original = Array.from(positions);
    const mesh = {
      id: "piece",
      positions,
      normals: new Float32Array(9),
      uvs: new Float32Array(6),
      indices: new Uint32Array([0, 1, 2]),
      topologyRevision: 0,
    };
    const frame = {
      pose: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
      fragments: [mesh],
    };
    view.update(frame, { x: 1, y: 2, z: 3 });
    const first = view.group.children[0].children[0].geometry;
    const material = view.group.children[0].children[0].material;
    const detailed = material.map.image.width >= 1024 && !!material.bumpMap;
    view.update(frame, { x: 1, y: 2, z: 3 });
    const reused = first === view.group.children[0].children[0].geometry;
    const local = Array.from(first.attributes.position.array);
    mesh.topologyRevision++;
    let disposed = 0;
    first.addEventListener("dispose", () => disposed++);
    view.update(frame, { x: 1, y: 2, z: 3 });
    const replaced = first !== view.group.children[0].children[0].geometry;
    view.update({ ...frame, fragments: [] }, { x: 0, y: 0, z: 0 });
    const removed = view.group.children.length === 0;
    view.dispose();
    return {
      detailed,
      sourceUnchanged:
        JSON.stringify(original) === JSON.stringify(Array.from(positions)),
      reused,
      local,
      replaced,
      disposed,
      removed,
    };
  });
  assert.ok(result.detailed, "hero leaf texture and relief must load");
  assert.ok(result.sourceUnchanged);
  assert.ok(result.reused);
  assert.deepEqual(result.local, [0, 0, 0, 1, 0, 0, 0, 0, 1]);
  assert.ok(result.replaced);
  assert.equal(result.disposed, 1);
  assert.ok(result.removed);
  console.log(
    "Leaf renderer buffer ownership, reuse, topology replacement and removal passed",
  );
} finally {
  await b.close();
}
