// ─────────────────────────────────────────────
//  Shared API types — used by both client & server
// ─────────────────────────────────────────────

// ---- Terrain ----

export type TerrainType = 'water' | 'forest' | 'plains' | 'desert' | 'mountain' | 'ruins';

/** Human-readable display labels for each terrain type — safe to import on both client and server */
export const TERRAIN_LABELS: Record<TerrainType, string> = {
  water:    '🌊 Shallow Water',
  forest:   '🌲 Ancient Forest',
  plains:   '🌿 Open Plains',
  desert:   '🏜️ Scorched Desert',
  mountain: '⛰️ Craggy Mountain',
  ruins:    '🏛️ Lost Ruins',
};

// ---- Tile ----

export type TileData = {
  terrain: TerrainType;
  revealedBy: string;
  revealedAt: number; // unix ms
  artifactId?: string;
};

// ---- API Responses ----

/** GET /api/game-init */
export type GameInitResponse = {
  type: 'game-init';
  postId: string;
  username: string;
  canActToday: boolean;
  needsToPlayGame?: boolean;
  score: number;
  communityGoalReached: boolean;
  /** frontier tiles the current user is allowed to click */
  frontier: string[]; // "x:y" strings
  tileCount: number;
};

/** GET /api/tiles?minX&minY&maxX&maxY */
export type TilesResponse = {
  type: 'tiles';
  /** key = "x:y", value = TileData */
  tiles: Record<string, TileData>;
};

/** POST /api/reveal  body: RevealRequest */
export type RevealRequest = {
  x: number;
  y: number;
};

export type RevealResponse =
  | {
      ok: true;
      terrain: TerrainType;
      artifactId?: string;
      /** updated frontier after reveal */
      newFrontier: string[];
    }
  | {
      ok: false;
      error: string;
    };

// ---- Progression & Leaderboard ----

export type LeaderboardEntry = {
  rank: number;
  username: string;
  score: number;
};

export type LeaderboardResponse = {
  ok: true;
  entries: LeaderboardEntry[];
} | {
  ok: false;
  error: string;
};

export type ProfileResponse = {
  ok: true;
  username: string;
  score: number;
  rank: number;
  artifacts: string[]; // array of artifactIds
} | {
  ok: false;
  error: string;
};

// ---- Legacy counter types (preserved from template) ----

export type InitResponse = {
  type: 'init';
  postId: string;
  count: number;
  username: string;
};

export type IncrementResponse = {
  type: 'increment';
  postId: string;
  count: number;
};

export type DecrementResponse = {
  type: 'decrement';
  postId: string;
  count: number;
};
