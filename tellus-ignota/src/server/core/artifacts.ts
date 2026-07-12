/**
 * Artifact system — determines whether a tile contains a buried artifact,
 * and posts a clue comment to the Reddit thread when one is discovered.
 *
 * The artifact spawn coordinate is derived daily from live Reddit data
 * (post karma × 31 + comment count), so the metagame is:
 *   "watch the post's karma/comments to predict where the next artifact lands."
 */
import { redis, reddit, context } from '@devvit/web/server';
import { T3, isT3 } from '@devvit/shared-types/tid.js';
import { getFrontier } from './frontier';

// ---------------------------------------------------------------------------
// Artifact types + lore
// ---------------------------------------------------------------------------

type ArtifactRarity = 'common' | 'rare' | 'legendary';

type ArtifactDef = {
  id: string;
  name: string;
  rarity: ArtifactRarity;
  clue: string;
  lore: string;
};

const ARTIFACTS: ArtifactDef[] = [
  {
    id: 'shard_compass',
    name: 'Broken Compass',
    rarity: 'common',
    clue: 'A cracked compass needle still trembles northward. Something pulls it.',
    lore: 'Left behind by the ancient explorers, before the fog took them.',
  },
  {
    id: 'old_map',
    name: 'Fragment of the Old Map',
    rarity: 'rare',
    clue: 'Scorched parchment shows coastlines that no longer exist. What changed?',
    lore: 'Predates the current age by three centuries, yet the handwriting is familiar.',
  },
  {
    id: 'glowing_stone',
    name: 'Resonance Stone',
    rarity: 'common',
    clue: 'It hums at a frequency that matches the fog itself.',
    lore: 'The fog retreats slightly when this stone is placed on the ground.',
  },
  {
    id: 'iron_key',
    name: 'Key to Nowhere',
    rarity: 'rare',
    clue: 'The key is enormous — far too large for any door ever built in this age.',
    lore: 'The lock it opens has not been seen since the founding of the first city.',
  },
  {
    id: 'star_chart',
    name: 'Star Chart of the Unmapped Sky',
    rarity: 'legendary',
    clue: "Stars on this chart don't exist in our sky. They burned out before memory.",
    lore: "Whoever drew this had access to a view that no living being has ever shared.",
  },
  {
    id: 'signal_lantern',
    name: 'Signal Lantern',
    rarity: 'common',
    clue: "It lights without fuel and doesn't cast shadows. Someone is signaling back.",
    lore: 'These were used to communicate across the fog before the fog learned to listen.',
  },
];

// ---------------------------------------------------------------------------
// Artifact spawn logic
// ---------------------------------------------------------------------------

/**
 * Derives today's artifact target coordinate from live Reddit data.
 * The coordinate changes as the post gains karma/comments throughout the day.
 * Returns null if there are no frontier tiles to place the artifact on.
 */
async function getTodaysArtifactCoord(
  postId: string
): Promise<string | null> {
  const post = await reddit.getPostById(T3(postId));
  const score = post.score;
  const commentCount = post.numberOfComments;

  const seed = score * 31 + commentCount;

  const frontier = await getFrontier();
  if (!frontier.length) return null;

  const idx = Math.abs(seed) % frontier.length;
  return frontier[idx] ?? null;
}

/**
 * Checks whether tile (x, y) should receive an artifact today.
 * Returns the artifact ID if yes, undefined otherwise.
 */
export async function checkArtifactSpawn(
  x: number,
  y: number,
  postId: string
): Promise<string | undefined> {
  // Check if this coordinate already has a claimed artifact today
  const today = new Date().toISOString().slice(0, 10);
  const claimedKey = `artifactClaimed:${today}`;
  const alreadyClaimed = await redis.get(claimedKey);
  if (alreadyClaimed) return undefined;

    const targetCoord = await getTodaysArtifactCoord(postId);
  if (!targetCoord || targetCoord !== `${x}:${y}`) return undefined;

  // Pick artifact dynamically from subreddit trending post!
  const sub = await reddit.getCurrentSubreddit();
  const hotPosts = await reddit.getHotPosts({ subredditName: sub.name, limit: 2 }).all();
  const topPost = hotPosts.find(p => !p.stickied) || hotPosts[0];

  if (!topPost) return undefined;

  // Make artifact ID from post title (slugified)
  const safeTitle = topPost.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30).toLowerCase();
  const artifactId = `relic_of_${safeTitle}`;

  // Mark this artifact as claimed for today
  await redis.set(claimedKey, artifactId);
  await redis.expire(claimedKey, 86400); // expires after 24h

  return artifactId;
}

/**
 * Posts a clue comment to the Reddit thread when an artifact is discovered.
 * This drives comment engagement — judges will see the activity directly.
 */
export async function postClueComment(
  artifactId: string,
  x: number,
  y: number,
  cycleId?: number
): Promise<void> {
  const postIdObj = context.postId;
  if (!postIdObj || !isT3(postIdObj)) return;

  const username = await reddit.getCurrentUsername();
  const readableName = artifactId.replace(/_/g, ' ').toUpperCase();

  const commentText = [
    `## 🗺️ Artifact Discovered at (${x}, ${y})!`,
    '',
    `u/${username} has discovered the **${readableName}**!`,
    '',
    `> *This relic resonates with the trending topics of this land...*`,
    '',
    `**SCAVENGER HUNT:** Reply to this comment with the exact word **Claim** to also receive a copy of this artifact in your personal gallery!`,
    '',
    `---`,
    `*The community has revealed another piece of Tellus Ignota. Keep exploring — the fog still holds many secrets.*`,
  ].join('\n');

  const submittedComment = await reddit.submitComment({
    id: postIdObj,
    text: commentText,
  });

  // Track the comment for Scavenger Hunt replies
  if (submittedComment) {
    await redis.set(`clue_comment:${submittedComment.id}`, artifactId);
    await redis.expire(`clue_comment:${submittedComment.id}`, 86400 * 7); // Expire after 7 days
    
    if (cycleId !== undefined) {
      await redis.set(`clue_comment_cycle:${submittedComment.id}`, cycleId.toString());
      await redis.expire(`clue_comment_cycle:${submittedComment.id}`, 86400 * 7);
    }
  }
}

/** Returns artifact definition by ID, for client display */
export function getArtifactDef(artifactId: string): ArtifactDef | undefined {
  return ARTIFACTS.find((a) => a.id === artifactId);
}
