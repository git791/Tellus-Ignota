import { reddit } from '@devvit/web/server';
import { initFrontier } from './frontier';
import { redis } from '@devvit/web/server';
import type { TileData } from '../../shared/api';

export const createPost = async () => {
  const post = await reddit.submitCustomPost({
    title: 'Tellus Ignota — Community Map',
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

  return post;
};

export const createDailyPost = async () => {
  const post = await reddit.submitCustomPost({
    title: 'Tellus Ignota — Daily Expedition',
  });

  return post;
};
