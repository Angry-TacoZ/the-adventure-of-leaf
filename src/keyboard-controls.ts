/** DOM button transitions survive taps between fixed simulation steps. */
export function createKeyboardControls() {
  const held = new Set<string>(), up: boolean[] = [], down: boolean[] = [];
  let raising = false, lowering = false, releasePending = false;
  const read = () => ({ raise: Number(raising), lower: Number(lowering) });
  return {
    keys: held as ReadonlySet<string>,
    press(key: string, repeat = false) {
      if (repeat || held.has(key)) return;
      held.add(key);
      if (key === "e") up.push(true);
      if (key === "q") down.push(true);
    },
    release(key: string) {
      if (!held.delete(key)) return;
      if (key === "e") up.push(false);
      if (key === "q") down.push(false);
    },
    read,
    step() {
      if (releasePending) { releasePending = false; return { raise: 0, lower: 0 }; }
      raising = up.shift() ?? raising; lowering = down.shift() ?? lowering;
      return read();
    },
    clear() { held.clear(); up.length = down.length = 0; raising = lowering = false; releasePending = true; },
  };
}
