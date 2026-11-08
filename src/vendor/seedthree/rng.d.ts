export class Rng {
  constructor(seed: string | number);
  next(): number;
  range(min: number, max: number): number;
  vary(value: number, variation: number): number;
}
