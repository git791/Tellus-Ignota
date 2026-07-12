import { redis } from '@devvit/web/server';
import { terrainForTile } from './terrain';
import { checkArtifactSpawn, postClueComment } from './artifacts';
import { updateFrontierAfterReveal } from './frontier';
import type { TileData } from '../../shared/api';

export async function triggerGoldenAgeReveal(postId: string, cycleId: number) {
  // We'll pick a center point for the 5x5 reveal.
  // Ideally, this should be an unexplored area near the frontier.
  // For simplicity, we can just find a random unrevealed tile, but let's 
  // try to expand near the current frontier.
  
  // Get current frontier
  const frontierRaw = await redis.zRange('frontier', 0, -1);
  const frontier = frontierRaw.map((f: { member: string }) => f.member);
  
  if (frontier.length === 0) return;
  
  // Pick a random frontier tile as the center
  const centerTile = frontier[Math.floor(Math.random() * frontier.length)];
  if (!centerTile) return;
  const parts = centerTile.split(':').map(Number);
  const cx = parts[0] ?? 0;
  const cy = parts[1] ?? 0;
  
  const revealedTiles = [];
  
  // Reveal a 5x5 area around the center
  for (let x = cx - 2; x <= cx + 2; x++) {
    for (let y = cy - 2; y <= cy + 2; y++) {
      const tileKey = `tile:${x}:${y}`;
      const exists = await redis.get(tileKey);
      
      if (!exists) {
        const terrain = terrainForTile(x, y);
        const artifactId = await checkArtifactSpawn(x, y, postId);
        
        const tileData: TileData = {
          terrain,
          revealedBy: 'The Community',
          revealedAt: Date.now(),
          ...(artifactId ? { artifactId } : {}),
        };
        
        await redis.set(tileKey, JSON.stringify(tileData));
        revealedTiles.push({ x, y, artifactId });
      }
    }
  }
  
  // Update frontier for all revealed tiles (this might take a moment, so we batch it if possible, or just loop)
  for (const t of revealedTiles) {
    await updateFrontierAfterReveal(t.x, t.y);
    
    if (t.artifactId) {
      // Post clue comment for each new artifact found in the Golden Age 5x5!
      await postClueComment(t.artifactId, t.x, t.y, cycleId).catch((err) => {
        console.error('Failed to post clue comment during Golden Age:', err);
      });
    }
  }
}
