export class PRNG {
  private _seed: number;

  constructor(seed: number) {
    this._seed = seed;
  }

  public setSeed(seed: number) {
    this._seed = seed;
  }

  public next(): number {
    this._seed = (this._seed * 9301 + 49297) % 233280;
    return this._seed / 233280;
  }

  public shuffle<T>(originalArray: T[]): T[] {
    const array = originalArray.slice();
    let currentIndex = array.length;
    let randomIndex;

    while (currentIndex !== 0) {
      randomIndex = Math.floor(this.next() * currentIndex);
      currentIndex--;
      [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }

    return array;
  }
}

export const globalPRNG = new PRNG(Date.now());
