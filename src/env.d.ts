interface Window {
  setWaterOptics?: (reflection: number, refraction: number) => void;
  render_game_to_text: () => string;
  advanceTime?: (ms: number) => void;
}
