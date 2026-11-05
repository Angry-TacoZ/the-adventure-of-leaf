export type SoundBus = "master" | "water" | "wind" | "effects";
export type Volumes = Record<SoundBus, number>;
export const defaultVolumes: Volumes = { master: 0.5, water: 0.4, wind: 0.35, effects: 0.45 };

/** Original procedural effects; audio time never advances gameplay physics. */
export function createGameAudio() {
  let context: AudioContext | undefined, buffer: AudioBuffer | undefined;
  let master: GainNode | undefined, water: GainNode | undefined, wind: GainNode | undefined, effects: GainNode | undefined;
  let unavailable = false;
  const volumes = { ...defaultVolumes };
  const sources = new Set<AudioScheduledSourceNode>();
  const loops: AudioBufferSourceNode[] = [];
  const targets = new Map<GainNode, number>();
  function gain(node: GainNode | undefined, value: number) {
    if (!node || !context) return;
    if (targets.get(node) === value) return;
    targets.set(node, value);
    node.gain.cancelScheduledValues(context.currentTime);
    node.gain.setValueAtTime(node.gain.value, context.currentTime);
    node.gain.linearRampToValueAtTime(value, context.currentTime + 0.05);
  }
  function ensure() {
    if (context || unavailable) return;
    try {
      context = new AudioContext();
      buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
      const data = buffer.getChannelData(0); let sample = 0;
      for (let i = 0; i < data.length; i++) {
        sample = sample * 0.85 + (Math.random() * 2 - 1) * 0.15;
        data[i] = sample;
      }
      master = context.createGain(); master.gain.value = volumes.master; master.connect(context.destination);
      effects = context.createGain(); effects.gain.value = volumes.effects; effects.connect(master);
      for (const kind of ["water", "wind"] as const) {
        const source = context.createBufferSource(); source.buffer = buffer; source.loop = true;
        const filter = context.createBiquadFilter(); filter.type = "lowpass";
        filter.frequency.value = kind === "water" ? 1600 : 450;
        const level = context.createGain(); level.gain.value = 0;
        source.connect(filter); filter.connect(level); level.connect(master); source.start(); loops.push(source);
        if (kind === "water") water = level; else wind = level;
      }
    } catch { unavailable = true; }
  }
  return {
    volumes,
    async unlock() {
      ensure();
      if (context?.state === "suspended") await context.resume().catch(() => {});
    },
    setVolume(bus: SoundBus, value: number) {
      volumes[bus] = Math.max(0, Math.min(1, value));
      if (bus === "master") gain(master, volumes.master);
      if (bus === "effects") gain(effects, volumes.effects);
    },
    update(playing: boolean, current: number, windStrength: number) {
      gain(water, playing ? volumes.water * Math.min(0.9, 0.16 + current * 0.1) : 0);
      gain(wind, playing ? volumes.wind * Math.min(0.8, windStrength * 0.3) : 0);
    },
    play(kind: "click" | "splash" | "tear" | "thunder") {
      if (!context || !master || !effects || !buffer || context.state !== "running" || sources.size >= 8) return;
      const now = context.currentTime, envelope = context.createGain(); envelope.connect(effects);
      envelope.gain.setValueAtTime(0, now);
      envelope.gain.linearRampToValueAtTime(kind === "click" ? 0.03 : kind === "thunder" ? 0.22 : 0.32, now + 0.015);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "click" ? 0.09 : kind === "thunder" ? 1.6 : 0.45));
      let source: AudioScheduledSourceNode;
      if (kind === "click") {
        const tone = context.createOscillator(); tone.type = "triangle"; tone.frequency.value = 260; source = tone; tone.connect(envelope);
      } else {
        const noise = context.createBufferSource(); noise.buffer = buffer;
        const filter = context.createBiquadFilter(); filter.type = kind === "thunder" ? "lowpass" : "bandpass";
        filter.frequency.value = kind === "tear" ? 2400 : kind === "thunder" ? 180 : 600;
        noise.connect(filter); filter.connect(envelope); source = noise;
        source.addEventListener("ended", () => filter.disconnect(), { once: true });
      }
      sources.add(source);
      source.addEventListener("ended", () => { source.disconnect(); envelope.disconnect(); sources.delete(source); }, { once: true });
      source.start(now); source.stop(now + (kind === "click" ? 0.1 : kind === "thunder" ? 1.7 : 0.5));
    },
    diagnostics: () => ({ state: unavailable ? "unavailable" : context?.state ?? "locked", volumes: { ...volumes },
      levels: { master: master?.gain.value ?? 0, water: water?.gain.value ?? 0, wind: wind?.gain.value ?? 0, effects: effects?.gain.value ?? 0 },
      activeEffects: sources.size, loops: loops.length }),
    async dispose() {
      for (const source of [...loops, ...sources]) { try { source.stop(); } catch {} source.disconnect(); }
      sources.clear(); loops.length = 0; await context?.close();
    },
  };
}
