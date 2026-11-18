// TELUK EMAS — seeded chance: one small generator that stages the whole
// city the same way for a given seed, so a screenshot can be retaken
// exactly. mulberry32 is tiny and fast; the helpers on top of it are the
// only random calls the rest of the game is allowed to make. The same seed
// always draws the same city, the same traffic loops and the same crowds —
// that is what makes ?shot=…&seed=7 reproducible. Never call Math.random
// for gameplay: a stray unseeded draw would make two runs of the same
// seed disagree, and the screenshots would stop matching.

export function createRandom(seed) {
  let s = seed >>> 0;
  if (s === 0) s = 0x9e3779b9;

  // one uniform draw in [0, 1)
  function next() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function range(min, max) {
    return min + next() * (max - min);
  }

  function int(min, max) {
    return Math.floor(range(min, max + 1));
  }

  function pick(list) {
    return list[Math.floor(next() * list.length)];
  }

  function chance(p) {
    return next() < p;
  }

  // True roughly one time in n: a readable name for the common
  // "rare event" roll, so callers never write chance(1 / n) by hand.
  function oneIn(n) {
    return n <= 1 ? true : next() < 1 / n;
  }

  // Fisher-Yates on a copy, so callers never mutate their source list.
  // The shuffle is unbiased: every permutation is equally likely.
  function shuffle(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(next() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  // Draw n distinct items from a list, in random order.
  function sample(list, n) {
    return shuffle(list).slice(0, Math.max(0, Math.min(n, list.length)));
  }

  // Pick one item with weights: the weights need not add up to 1, they
  // only set the odds relative to each other. An empty list or a zero
  // total falls back to the last item instead of throwing.
  function pickWeighted(items, weights) {
    let total = 0;
    for (const w of weights) total += w;
    if (total <= 0 || items.length === 0) return items[items.length - 1];
    let roll = next() * total;
    for (let i = 0; i < items.length; i += 1) {
      roll -= weights[i];
      if (roll <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  return { next, range, int, pick, chance, oneIn, shuffle, sample, pickWeighted };
}
