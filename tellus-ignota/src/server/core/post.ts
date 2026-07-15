import { reddit } from '@devvit/web/server';
import { initFrontier } from './frontier';
import { redis } from '@devvit/web/server';
import type { TileData } from '../../shared/api';

export const createPost = async () => {
  const post = await reddit.submitCustomPost({
    title: 'Welcome to Tellus Ignota 🌍 | A massive multiplayer map we uncover together. You get ONE move per day.',
  });

  // Seed the map: reveal tile (0,0) as the starting point
  const startTile: TileData = {
    terrain: 'plains',
    revealedBy: 'the-cartographer',
    revealedAt: Date.now(),
  };
  await redis.set('tile:0:0', JSON.stringify(startTile));

  // Initialize the frontier (the 4 tiles adjacent to (0,0))
  await initFrontier();

  // Automate posting the Demo instructions!
  const demoInstructions = `**How to Play:**
We are all exploring this massive, infinite map together—one tile at a time.

⛏️ **One Move Per Day:** Click any glowing "frontier tile" at the edge of the fog to uncover it. Your username is permanently stamped on it!

🏆 **Streaks & Skins:** Play the Daily Minigame to build your Exploration Streak. As you earn more points, you'll automatically unlock new colored skins for your avatar! 

💎 **Artifact Hunting:** As you uncover tiles, you might stumble upon rare Artifacts. When you find one, a clue will be automatically posted in the comments below! 

🏃‍♂️ **Scavenger Hunt:** See a clue in the comments? Be the first to reply to the bot with the exact word "**Claim**" to steal a copy of that artifact for your own profile!

🌟 **The Golden Age:** See the Pickaxe icon in the top right? If the community works together to reach the clicker goal, a massive "Golden Age" explosion will instantly clear a 5x5 chunk of the map for everyone and drop crazy loot!

Let's see how far we can expand the frontier! Click the map to start your journey. 👇`;

  await reddit.submitComment({
    id: post.id,
    text: demoInstructions
  });

  return post;
};

export const createDailyPost = async () => {
  const post = await reddit.submitCustomPost({
    title: 'Tellus Ignota — Daily Expedition',
  });

  return post;
};
