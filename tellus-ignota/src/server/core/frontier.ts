/**
 * Frontier management — tracks the set of fog tiles adjacent to revealed land.
 * The frontier is stored in Redis as a SortedSet of "x:y" strings.
 * Server-authoritative: the client never decides what's clickable on its own.
 */
import { redis } from '@devvit/web/server';

export const FRONTIER_KEY = 'frontier';
export const START_X = 0;
export const START_Y = 0;

/** The 4 orthogonal neighbors of a tile */
function neighbors(x: number, y: number): Array<[number, number]> {
  return [
    [x, y - 1],
    [x, y + 1],
    [x - 1, y],
    [x + 1, y],
  ];
}

/**
 * Seeds the map's initial state: adds the 4 neighbors of (0,0) to the frontier.
 * Call once when the post is first created. Idempotent — safe to call multiple times.
 */
export async function initFrontier(): Promise<void> {
  const count = await redis.zCard(FRONTIER_KEY).catch(() => 0);
  if (count > 0) return;

  for (const [nx, ny] of neighbors(START_X, START_Y)) {
    await redis.zAdd(FRONTIER_KEY, { score: 0, member: `${nx}:${ny}` });
  }
}

/**
 * Returns true if the given tile coordinate is currently in the frontier.
 */
export async function isFrontierTile(x: number, y: number): Promise<boolean> {
  const score = await redis.zScore(FRONTIER_KEY, `${x}:${y}`);
  return score !== null && score !== undefined;
}

/**
 * After revealing tile (x, y):
 * 1. Remove it from the frontier (it's no longer fog).
 * 2. For each of its 4 neighbors, if that neighbor has no Redis tile record,
 *    add it to the frontier.
 */
export async function updateFrontierAfterReveal(x: number, y: number): Promise<void> {
  // Remove the just-revealed tile from frontier
  await redis.zRem(FRONTIER_KEY, [`${x}:${y}`]);

  // Add unrevealed neighbors to frontier
  for (const [nx, ny] of neighbors(x, y)) {
    const key = `tile:${nx}:${ny}`;
    const existing = await redis.get(key);
    if (!existing) {
      await redis.zAdd(FRONTIER_KEY, { score: 0, member: `${nx}:${ny}` });
    }
  }
}

/**
 * Returns the current frontier as an array of "x:y" strings.
 * zRange returns { member, score }[] — we extract just the member strings.
 */
export async function getFrontier(): Promise<string[]> {
  const results = await redis.zRange(FRONTIER_KEY, 0, 499);
  return results.map((r) => r.member);
}
