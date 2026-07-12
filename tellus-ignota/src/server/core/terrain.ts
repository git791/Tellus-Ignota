/**
 * Deterministic terrain generation via simplex-noise + alea seedable PRNG.
 * Runs server-side only. Same WORLD_SEED → same terrain forever.
 */
import { createNoise2D } from 'simplex-noise';
import type { TerrainType } from '../../shared/api';

// Fixed per-season seed. Change this to start a new season with a fresh map.
export const WORLD_SEED = 'tellus-ignota-season-1';

// ---------------------------------------------------------------------------
// Noise function — initialised once at module load, deterministic via seed.
// alea is imported as a CommonJS-compatible seedable PRNG factory.
// ---------------------------------------------------------------------------
function makeAlea(seed: string) {
  // Pure JS Mash-based PRNG (copied inline to avoid @types/alea issues)
  let s0 = 0, s1 = 0, s2 = 0, c = 1;
  function mash(data: string) {
    let n = 0xefc8249d;
    for (let i = 0; i < data.length; i++) {
      n += data.charCodeAt(i);
      let h = 0.02519603282416938 * n;
      n = h >>> 0;
      h -= n;
      h *= n;
      n = h >>> 0;
      h -= n;
      n += h * 0x100000000;
    }
    return (n >>> 0) * 2.3283064365386963e-10;
  }
  s0 = mash(' ');
  s1 = mash(' ');
  s2 = mash(' ');
  s0 -= mash(seed);
  if (s0 < 0) s0 += 1;
  s1 -= mash(seed);
  if (s1 < 0) s1 += 1;
  s2 -= mash(seed);
  if (s2 < 0) s2 += 1;
  return function () {
    const t = 2091639 * s0 + c * 2.3283064365386963e-10;
    s0 = s1;
    s1 = s2;
    return (s2 = t - (c = t | 0));
  };
}

const noise2D = createNoise2D(makeAlea(WORLD_SEED));

// ---------------------------------------------------------------------------
// Terrain classification
// Noise value is in [-1, 1]. Thresholds chosen for world variety and rarity.
// ---------------------------------------------------------------------------

/**
 * Returns the terrain type for tile (x, y) deterministically.
 * No storage is needed until the tile is actually revealed.
 */
export function terrainForTile(x: number, y: number): TerrainType {
  const n = noise2D(x * 0.05, y * 0.05); // -1..1

  if (n < -0.45) return 'water';
  if (n < -0.1)  return 'forest';
  if (n < 0.2)   return 'plains';
  if (n < 0.45)  return 'desert';
  if (n < 0.62)  return 'mountain';
  return 'ruins'; // rare ~10% band
}

