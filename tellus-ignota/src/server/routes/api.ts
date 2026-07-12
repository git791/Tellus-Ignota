/**
 * Server-side API routes — game endpoints added alongside existing template routes.
 *
 * Existing routes preserved:
 *   GET  /api/init        — template counter init (unchanged)
 *   POST /api/increment   — template counter (unchanged)
 *   POST /api/decrement   — template counter (unchanged)
 *
 * New game routes:
 *   GET  /api/game-init   — returns username, canActToday, frontier, tileCount
 *   GET  /api/tiles       — returns revealed tile data for a viewport chunk
 *   POST /api/reveal      — attempts to reveal a frontier tile
 */
import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import type {
  DecrementResponse,
  IncrementResponse,
  InitResponse,
  GameInitResponse,
  TilesResponse,
  RevealRequest,
  RevealResponse,
  TileData,
  LeaderboardResponse,
  ProfileResponse,
} from '../../shared/api';
import { terrainForTile } from '../core/terrain';
import { isFrontierTile, updateFrontierAfterReveal, getFrontier, initFrontier } from '../core/frontier';
import { checkArtifactSpawn, postClueComment } from '../core/artifacts';
import { getOrGenerateDailyGame, validateAnswer } from '../core/dailyGame';
import { triggerGoldenAgeReveal } from '../core/goldenAge';

type ErrorResponse = {
  status: 'error';
  message: string;
};

export const COMMUNITY_GOAL_THRESHOLD = 50;

export const api = new Hono();

// ─────────────────────────────────────────────────────────────────────────────
//  EXISTING TEMPLATE ROUTES (preserved)
// ─────────────────────────────────────────────────────────────────────────────

api.get('/init', async (c) => {
  const { postId } = context;

  if (!postId) {
    console.error('API Init Error: postId not found in devvit context');
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: 'postId is required but missing from context',
      },
      400
    );
  }

  try {
    const [count, username] = await Promise.all([
      redis.get('count'),
      reddit.getCurrentUsername(),
    ]);

    return c.json<InitResponse>({
      type: 'init',
      postId: postId,
      count: count ? parseInt(count) : 0,
      username: username ?? 'anonymous',
    });
  } catch (error) {
    console.error(`API Init Error for post ${postId}:`, error);
    let errorMessage = 'Unknown error during initialization';
    if (error instanceof Error) {
      errorMessage = `Initialization failed: ${error.message}`;
    }
    return c.json<ErrorResponse>(
      { status: 'error', message: errorMessage },
      400
    );
  }
});

api.post('/increment', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: 'postId is required',
      },
      400
    );
  }

  const count = await redis.incrBy('count', 1);
  return c.json<IncrementResponse>({
    count,
    postId,
    type: 'increment',
  });
});

api.post('/decrement', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: 'postId is required',
      },
      400
    );
  }

  const count = await redis.incrBy('count', -1);
  return c.json<DecrementResponse>({
    count,
    postId,
    type: 'decrement',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  NEW GAME ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/game-init
 * Returns everything the client needs to bootstrap the map:
 * - who the user is
 * - whether they can act today
 * - the current frontier (clickable tiles)
 * - total tile count revealed so far
 */
api.get('/game-init', async (c) => {
  const { postId } = context;

  if (!postId) {
    return c.json<ErrorResponse>({ status: 'error', message: 'postId missing' }, 400);
  }

  try {
    const today = new Date().toISOString().slice(0, 10); // UTC day

    const username = await reddit.getCurrentUsername().catch(() => undefined);
    const actualUsername = username ?? 'anonymous';
    const [lastAction, hasWonGame, frontier, tileCount, scoreRaw, post] = await Promise.all([
      redis.get(`lastAction:${actualUsername}`),
      redis.get(`wonDailyGame:${actualUsername}:${today}`),
      getFrontier(),
      redis.zCard('frontier').catch(() => 0),
      redis.zScore('leaderboard:score', actualUsername),
      reddit.getPostById(postId),
    ]);
    
    const communityGoalReached = post.score >= COMMUNITY_GOAL_THRESHOLD;

    const canActToday = lastAction !== today; // This is a simplification for the UI flag
    const needsToPlayGame = !hasWonGame && canActToday;

    return c.json<GameInitResponse & { needsToPlayGame: boolean }>({
      type: 'game-init',
      postId,
      username: actualUsername,
      canActToday,
      needsToPlayGame,
      score: scoreRaw ?? 0,
      communityGoalReached,
      frontier,
      tileCount,
    });
  } catch (error) {
    console.error('game-init error:', error);
    return c.json<ErrorResponse>(
      { status: 'error', message: error instanceof Error ? error.message : 'Unknown error' },
      400
    );
  }
});

/**
 * GET /api/tiles?minX=&minY=&maxX=&maxY=
 * Returns all revealed tile data within the bounding box.
 * Client calls this once per chunk as the camera moves.
 */
api.get('/tiles', async (c) => {
  const minX = parseInt(c.req.query('minX') ?? '-16');
  const minY = parseInt(c.req.query('minY') ?? '-16');
  const maxX = parseInt(c.req.query('maxX') ?? '16');
  const maxY = parseInt(c.req.query('maxY') ?? '16');

  // Clamp to a reasonable chunk size to avoid abuse
  const MAX_DIM = 64;
  if (maxX - minX > MAX_DIM || maxY - minY > MAX_DIM) {
    return c.json<ErrorResponse>({ status: 'error', message: 'Chunk too large' }, 400);
  }

  const tiles: Record<string, TileData> = {};

  // Seed tile (0,0) is always revealed — it's the starting point
  const startTileRaw = await redis.get('tile:0:0');
  if (!startTileRaw) {
    // Initialize the starting tile if not yet set
    const startTile: TileData = {
      terrain: 'plains',
      revealedBy: 'the-cartographer',
      revealedAt: Date.now(),
    };
    await redis.set('tile:0:0', JSON.stringify(startTile));
    await initFrontier();
    if (minX <= 0 && maxX >= 0 && minY <= 0 && maxY >= 0) {
      tiles['0:0'] = startTile;
    }
  } else {
    if (minX <= 0 && maxX >= 0 && minY <= 0 && maxY >= 0) {
      tiles['0:0'] = JSON.parse(startTileRaw) as TileData;
    }
  }

  // Fetch tiles in the requested bounding box
  const promises: Array<Promise<void>> = [];
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      if (x === 0 && y === 0) continue; // already handled above
      promises.push(
        redis.get(`tile:${x}:${y}`).then((raw) => {
          if (raw) {
            tiles[`${x}:${y}`] = JSON.parse(raw) as TileData;
          }
        })
      );
    }
  }
  await Promise.all(promises);

  return c.json<TilesResponse>({ type: 'tiles', tiles });
});

/**
 * POST /api/reveal  { x, y }
 * Core game action — attempts to reveal a fog tile.
 *
 * Validation (server-authoritative):
 * 1. User must not have acted today (one action per UTC day)
 * 2. Tile must be in the frontier (adjacent to revealed land)
 *
 * On success: stores tile, updates frontier, stamps username,
 * checks for artifact spawn, posts clue comment if artifact found.
 */
api.post('/reveal', async (c) => {
  const { postId } = context;

  if (!postId) {
    return c.json<RevealResponse>({ ok: false, error: 'postId missing' });
  }

  let body: RevealRequest;
  try {
    body = await c.req.json<RevealRequest>();
  } catch {
    return c.json<RevealResponse>({ ok: false, error: 'Invalid request body' });
  }

  const { x, y } = body;

  if (typeof x !== 'number' || typeof y !== 'number') {
    return c.json<RevealResponse>({ ok: false, error: 'x and y must be numbers' });
  }

  try {
    const username = await reddit.getCurrentUsername();
    if (!username) {
      return c.json<RevealResponse>({ ok: false, error: 'Not logged in' });
    }

    // 1 — Actions per UTC day
    const today = new Date().toISOString().slice(0, 10);
    const [dailyActionsCountRaw, hasWonGame, bonusAction] = await Promise.all([
      redis.get(`dailyActions:${username}:${today}`),
      redis.get(`wonDailyGame:${username}:${today}`),
      redis.get(`bonusAction:${username}:${today}`)
    ]);

    const dailyActionsCount = parseInt(dailyActionsCountRaw || '0');
    
    // Calculate max actions
    const post = await reddit.getPostById(postId);
    let maxActions = 1;
    if (bonusAction === 'true') maxActions += 1;
    if (post.score >= COMMUNITY_GOAL_THRESHOLD) maxActions += 1;

    if (dailyActionsCount >= maxActions) {
      return c.json<RevealResponse>({
        ok: false,
        error: 'You have reached your maximum exploration limit for today.',
      });
    }

    if (!hasWonGame && dailyActionsCount === 0) {
      return c.json<RevealResponse>({
        ok: false,
        error: 'You must complete the Daily Game before revealing a tile!',
      });
    }

    // 2 — Tile must be on the frontier
    const onFrontier = await isFrontierTile(x, y);
    if (!onFrontier) {
      return c.json<RevealResponse>({
        ok: false,
        error: 'That tile is not adjacent to revealed land.',
      });
    }

    // 3 — Generate terrain
    const terrain = terrainForTile(x, y);

    // 4 — Check artifact spawn
    const artifactId = await checkArtifactSpawn(x, y, postId);

    // 4.5 — Award Points
    const TERRAIN_POINTS: Record<string, number> = {
      plains: 10,
      forest: 10,
      water: 20,
      mountain: 20,
      desert: 30,
      ruins: 50
    };
    let points = TERRAIN_POINTS[terrain] || 10;
    
    // User History Bonus (Veteran Cartographer)
    const userObj = await reddit.getCurrentUser();
    if (userObj) {
      const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
      const isVeteran = (Date.now() - userObj.createdAt.getTime()) > ONE_YEAR_MS || userObj.commentKarma > 1000;
      if (isVeteran) {
        points += 20; // Veteran Bonus
      }
    }

    if (artifactId) {
      points += 100;
      await redis.zAdd(`user_artifacts:${username}`, { member: artifactId, score: Date.now() });
    }
    
    // Golden Age Multiplier removed; Community Goal gives extra actions instead.
    
    await redis.zIncrBy('leaderboard:score', username, points);

    // 5 — Persist tile
    const tileData: TileData = {
      terrain,
      revealedBy: username,
      revealedAt: Date.now(),
      ...(artifactId ? { artifactId } : {}),
    };
    await redis.set(`tile:${x}:${y}`, JSON.stringify(tileData));

    // 6 — Update frontier
    await updateFrontierAfterReveal(x, y);

    // 7 — Stamp daily action
    await redis.incrBy(`dailyActions:${username}:${today}`, 1);
    
    // Also set lastAction for backward compatibility with UI checks
    await redis.set(`lastAction:${username}`, today);

    // 8 — Post clue comment if artifact found
    if (artifactId) {
      await postClueComment(artifactId, x, y).catch((err) => {
        // Don't fail the reveal if comment posting fails
        console.error('Failed to post clue comment:', err);
      });
    }

    // 9 — Return updated frontier to client
    const newFrontier = await getFrontier();

    return c.json<RevealResponse>({
      ok: true,
      terrain,
      ...(artifactId ? { artifactId } : {}),
      newFrontier,
    });
  } catch (error) {
    console.error('reveal error:', error);
    return c.json<RevealResponse>({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown server error',
    });
  }
});

/**
 * GET /api/daily-game
 * Fetch today's game.
 */
api.get('/daily-game', async (c) => {
  try {
    const game = await getOrGenerateDailyGame();
    // Return game without the answer
    const clientGame = { ...game, answer: undefined };
    return c.json({ ok: true, game: clientGame });
  } catch (error) {
    return c.json({ ok: false, error: 'Failed to fetch game' }, 500);
  }
});

/**
 * POST /api/daily-game/submit
 * Submit an answer to today's game.
 */
api.post('/daily-game/submit', async (c) => {
  try {
    const username = await reddit.getCurrentUsername();
    if (!username) return c.json({ ok: false, error: 'Not logged in' });

    const body = await c.req.json<{ answer: string }>();
    if (!body || typeof body.answer !== 'string') {
      return c.json({ ok: false, error: 'Invalid answer' });
    }

    const game = await getOrGenerateDailyGame();
    const isValid = validateAnswer(game, body.answer);

    if (isValid) {
      const today = new Date().toISOString().slice(0, 10);
      await redis.set(`wonDailyGame:${username}:${today}`, 'true');
      return c.json({ ok: true, correct: true });
    } else {
      return c.json({ ok: true, correct: false });
    }
  } catch (error) {
    return c.json({ ok: false, error: 'Failed to submit' }, 500);
  }
});

/**
 * GET /api/leaderboard
 */
api.get('/leaderboard', async (c) => {
  try {
    // Fetch top 10 highest scores. zRange defaults to ascending, so -10 to -1 gets the top 10, then we reverse it.
    const results = await redis.zRange('leaderboard:score', -10, -1);
    
    // results is { member, score }[] in ascending order
    results.reverse();

    const entries = results.map((r, i) => ({
      rank: i + 1,
      username: r.member,
      score: r.score
    }));

    return c.json<LeaderboardResponse>({ ok: true, entries });
  } catch (error) {
    return c.json<LeaderboardResponse>({ ok: false, error: 'Failed to load leaderboard' }, 500);
  }
});

/**
 * GET /api/profile
 */
api.get('/profile', async (c) => {
  try {
    const username = await reddit.getCurrentUsername();
    if (!username) return c.json<ProfileResponse>({ ok: false, error: 'Not logged in' }, 401);

    const [scoreStr, artifactsZSet, allMembers] = await Promise.all([
      redis.zScore('leaderboard:score', username),
      redis.zRange(`user_artifacts:${username}`, 0, -1),
      redis.zRange('leaderboard:score', 0, -1) // Fetch all to find rank, or use zRevRank if supported
    ]);

    const score = scoreStr ?? 0;
    const artifactsRaw = artifactsZSet.map((a: { member: string }) => a.member);
    
    // Reverse all members to get descending order for rank calculation
    allMembers.reverse();
    const rankIndex = allMembers.findIndex((m: any) => m.member === username);
    const rank = rankIndex >= 0 ? rankIndex + 1 : 0;

    return c.json<ProfileResponse>({
      ok: true,
      username,
      score,
      rank,
      artifacts: artifactsRaw ?? []
    });
  } catch (error) {
    return c.json<ProfileResponse>({ ok: false, error: 'Failed to load profile' }, 500);
  }
});

/**
 * POST /api/clicker/sync
 */
api.post('/clicker/sync', async (c) => {
  try {
    const { postId } = context;
    if (!postId) return c.json({ ok: false, error: 'postId missing' }, 400);

    const username = await reddit.getCurrentUsername().catch(() => null);
    if (!username) return c.json({ ok: false, error: 'Not logged in' }, 401);

    const body = await c.req.json<{ clicks: number }>();
    const clicksToAdd = body?.clicks || 0;

    // 6-hour cycle ID
    const cycleId = Math.floor(Date.now() / (6 * 3600 * 1000));
    
    const globalKey = `globalClicks:${postId}:${cycleId}`;
    const userKey = `userClicks:${postId}:${cycleId}:${username}`;
    const triggeredKey = `goldenAgeTriggered:${postId}:${cycleId}`;

    let globalClicks = 0;
    let personalClicks = 0;

    if (clicksToAdd > 0) {
      [globalClicks, personalClicks] = await Promise.all([
        redis.incrBy(globalKey, clicksToAdd),
        redis.incrBy(userKey, clicksToAdd)
      ]);
    } else {
      const [g, p] = await Promise.all([
        redis.get(globalKey),
        redis.get(userKey)
      ]);
      globalClicks = g ? parseInt(g) : 0;
      personalClicks = p ? parseInt(p) : 0;
    }

    const TARGET = 100000;
    let goldenAgeTriggered = false;

    if (globalClicks >= TARGET) {
      // Use incrBy for atomic first-check
      const isFirstCount = await redis.incrBy(triggeredKey, 1);
      if (isFirstCount === 1) {
        // We triggered the golden age!
        console.log(`Golden Age triggered for post ${postId} cycle ${cycleId}!`);
        await triggerGoldenAgeReveal(postId, cycleId).catch(e => console.error('Golden Age Reveal Error:', e));
      }
      goldenAgeTriggered = true; // It's triggered for this cycle
    }

    return c.json({
      ok: true,
      globalClicks,
      personalClicks,
      goldenAgeTriggered
    });
  } catch (error) {
    console.error('clicker sync error:', error);
    return c.json({ ok: false, error: 'Failed to sync clicks' }, 500);
  }
});
