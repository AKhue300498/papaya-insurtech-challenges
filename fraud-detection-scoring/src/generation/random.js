export function createRandom(seed) {
  let state = seed >>> 0;
  return {
    integer(minimum, maximum) {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = Math.imul(state ^ (state >>> 15), state | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      const fraction = ((value ^ (value >>> 14)) >>> 0) / 4294967296;
      return minimum + Math.floor(fraction * (maximum - minimum + 1));
    },
  };
}
