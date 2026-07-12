/**
 * ChunkManager — loads and unloads 32×32 tile chunks as the camera moves.
 *
 * The world is logically infinite. We only instantiate chunks near the camera
 * viewport. Chunks far out of view are destroyed to keep memory bounded.
 *
 * Each chunk is a Phaser Tilemap with two layers:
 *   - terrainLayer: revealed tile graphics
 *   - fogLayer:     fog overlay, cleared as tiles are revealed
 *
 * Chunk data is fetched from GET /api/tiles?minX&minY&maxX&maxY.
 */
import * as Phaser from 'phaser';
import type { TileData } from '../../shared/api';
import { TILE_SIZE, TERRAIN_TEXTURE_KEY, TILE_INDEX } from './TerrainPainter';

export const CHUNK_SIZE = 16; // tiles per chunk side (16×16 = manageable)
const LOAD_RADIUS_CHUNKS = 2; // chunks around camera to keep loaded
const UNLOAD_RADIUS_CHUNKS = 4; // chunks beyond this are destroyed

type ChunkKey = string; // "cx:cy" in chunk coords

type Chunk = {
  cx: number;
  cy: number;
  terrainSprites: Map<string, Phaser.GameObjects.Image>;
  fogSprites: Map<string, Phaser.GameObjects.Image>;
};

export class ChunkManager {
  private scene: Phaser.Scene;
  private chunks: Map<ChunkKey, Chunk> = new Map();
  private loadingChunks: Set<ChunkKey> = new Set();
  /** Revealed tile data cache — "x:y" → TileData */
  private tileCache: Map<string, TileData> = new Map();
  /** Frontier set — "x:y" strings of clickable fog tiles */
  frontier: Set<string> = new Set();

  // Frontier animated tiles — we twinkle them each frame
  private frontierObjects: Map<string, Phaser.GameObjects.Image> = new Map();
  private tweenTime = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Update the frontier from server data and refresh visual overlays.
   */
  setFrontier(coords: string[]): void {
    this.frontier = new Set(coords);
    this.refreshFrontierOverlays();
  }

  /**
   * Merge new tile data into cache and update the visual layers.
   */
  addTileData(tiles: Record<string, TileData>): void {
    for (const [key, data] of Object.entries(tiles)) {
      this.tileCache.set(key, data);
    }
    this.refreshAllChunks();
  }

  /**
   * Mark a single tile as revealed (after a successful POST /reveal).
   */
  revealTile(x: number, y: number, data: TileData): void {
    this.tileCache.set(`${x}:${y}`, data);

    const cx = Math.floor(x / CHUNK_SIZE);
    const cy = Math.floor(y / CHUNK_SIZE);
    const chunk = this.chunks.get(`${cx}:${cy}`);
    if (chunk) {
      const localX = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const localY = ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      this.paintTerrainTile(chunk, localX, localY, data);
      this.clearFogTile(chunk, localX, localY);
    }
  }

  /** Returns the internal tile cache for inspection from MapScene */
  getTileData(coord: string): TileData | undefined {
    return this.tileCache.get(coord);
  }

  /**
   * Called every frame from MapScene.update().
   * Loads missing chunks near camera, unloads distant ones.
   */
  update(cameraMidX: number, cameraMidY: number): void {
    const camChunkX = Math.floor(cameraMidX / (CHUNK_SIZE * TILE_SIZE));
    const camChunkY = Math.floor(cameraMidY / (CHUNK_SIZE * TILE_SIZE));

    // Unload far chunks
    for (const [key, chunk] of this.chunks) {
      const dx = Math.abs(chunk.cx - camChunkX);
      const dy = Math.abs(chunk.cy - camChunkY);
      if (dx > UNLOAD_RADIUS_CHUNKS || dy > UNLOAD_RADIUS_CHUNKS) {
        this.destroyChunk(key, chunk);
      }
    }

    // Load missing nearby chunks
    for (let dcx = -LOAD_RADIUS_CHUNKS; dcx <= LOAD_RADIUS_CHUNKS; dcx++) {
      for (let dcy = -LOAD_RADIUS_CHUNKS; dcy <= LOAD_RADIUS_CHUNKS; dcy++) {
        const cx = camChunkX + dcx;
        const cy = camChunkY + dcy;
        const key = `${cx}:${cy}`;
        if (!this.chunks.has(key) && !this.loadingChunks.has(key)) {
          this.loadingChunks.add(key);
          void this.loadChunk(cx, cy).finally(() => {
            this.loadingChunks.delete(key);
          });
        }
      }
    }

    // Animate frontier overlay tiles
    this.tweenTime += 0.03;
    const alpha = 0.55 + 0.35 * Math.sin(this.tweenTime);
    for (const img of this.frontierObjects.values()) {
      img.setAlpha(alpha);
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async loadChunk(cx: number, cy: number): Promise<void> {
    const key = `${cx}:${cy}`;

    const chunk: Chunk = { 
      cx, cy, 
      terrainSprites: new Map(), 
      fogSprites: new Map() 
    };
    this.chunks.set(key, chunk);

    // Fill fog layer
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let ly = 0; ly < CHUNK_SIZE; ly++) {
        const wx = (cx * CHUNK_SIZE + lx) * TILE_SIZE + TILE_SIZE / 2;
        const wy = (cy * CHUNK_SIZE + ly) * TILE_SIZE + TILE_SIZE / 2;
        const img = this.scene.add.image(wx, wy, TERRAIN_TEXTURE_KEY, TILE_INDEX.fog.toString());
        img.setDepth(1);
        chunk.fogSprites.set(`${lx}:${ly}`, img);
      }
    }

    // Paint terrain from cache
    const minX = cx * CHUNK_SIZE;
    const minY = cy * CHUNK_SIZE;
    const maxX = minX + CHUNK_SIZE - 1;
    const maxY = minY + CHUNK_SIZE - 1;

    this.paintChunkFromCache(chunk, minX, minY);

    // Fetch any missing tile data from server
    await this.fetchTileData(minX, minY, maxX, maxY, chunk);
  }

  private destroyChunk(key: ChunkKey, chunk: Chunk): void {
    // Remove frontier overlays for tiles in this chunk
    const minX = chunk.cx * CHUNK_SIZE;
    const minY = chunk.cy * CHUNK_SIZE;
    for (let x = minX; x < minX + CHUNK_SIZE; x++) {
      for (let y = minY; y < minY + CHUNK_SIZE; y++) {
        const tileKey = `${x}:${y}`;
        const img = this.frontierObjects.get(tileKey);
        if (img) {
          img.destroy();
          this.frontierObjects.delete(tileKey);
        }
      }
    }

    for (const img of chunk.terrainSprites.values()) img.destroy();
    for (const img of chunk.fogSprites.values()) img.destroy();
    this.chunks.delete(key);
  }

  private paintChunkFromCache(chunk: Chunk, minX: number, minY: number): void {
    for (let x = minX; x < minX + CHUNK_SIZE; x++) {
      for (let y = minY; y < minY + CHUNK_SIZE; y++) {
        const cached = this.tileCache.get(`${x}:${y}`);
        if (cached) {
          const lx = x - minX;
          const ly = y - minY;
          this.paintTerrainTile(chunk, lx, ly, cached);
          this.clearFogTile(chunk, lx, ly);
        }
      }
    }
  }

  private refreshAllChunks(): void {
    for (const chunk of this.chunks.values()) {
      const minX = chunk.cx * CHUNK_SIZE;
      const minY = chunk.cy * CHUNK_SIZE;
      this.paintChunkFromCache(chunk, minX, minY);
    }
  }

  private paintTerrainTile(chunk: Chunk, lx: number, ly: number, data: TileData): void {
    const idx: number = TILE_INDEX[data.terrain] ?? TILE_INDEX.plains;
    
    chunk.terrainSprites.get(`${lx}:${ly}`)?.destroy();
    
    const wx = (chunk.cx * CHUNK_SIZE + lx) * TILE_SIZE + TILE_SIZE / 2;
    const wy = (chunk.cy * CHUNK_SIZE + ly) * TILE_SIZE + TILE_SIZE / 2;
    const img = this.scene.add.image(wx, wy, TERRAIN_TEXTURE_KEY, idx.toString());
    img.setDepth(0);
    chunk.terrainSprites.set(`${lx}:${ly}`, img);
  }

  private clearFogTile(chunk: Chunk, lx: number, ly: number): void {
    const fog = chunk.fogSprites.get(`${lx}:${ly}`);
    if (fog) {
      fog.destroy();
      chunk.fogSprites.delete(`${lx}:${ly}`);
    }
  }

  private async fetchTileData(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    chunk: Chunk
  ): Promise<void> {
    try {
      const url = `/api/tiles?minX=${minX}&minY=${minY}&maxX=${maxX}&maxY=${maxY}`;
      const res = await fetch(url);
      if (!res.ok) return;

      const data = await res.json() as { type: string; tiles: Record<string, TileData>; activeUsers?: any[] };
      if (data.type !== 'tiles') return;

      for (const [key, tileData] of Object.entries(data.tiles)) {
        this.tileCache.set(key, tileData);
      }

      this.paintChunkFromCache(chunk, minX, minY);
      
      // Emit active users for the MapScene to render
      if (data.activeUsers && data.activeUsers.length > 0) {
        this.scene.events.emit('active-users-loaded', data.activeUsers);
      }
    } catch (err) {
      console.error('ChunkManager fetch error:', err);
    }
  }

  private refreshFrontierOverlays(): void {
    // Remove old overlays that are no longer on the frontier
    for (const [key, img] of this.frontierObjects) {
      if (!this.frontier.has(key)) {
        img.destroy();
        this.frontierObjects.delete(key);
      }
    }

    // Add overlays for new frontier tiles
    for (const coord of this.frontier) {
      if (this.frontierObjects.has(coord)) continue;
      const parts = coord.split(':');
      const xVal = parts[0];
      const yVal = parts[1];
      if (xVal === undefined || yVal === undefined) continue;
      const wx = parseInt(xVal) * TILE_SIZE + TILE_SIZE / 2;
      const wy = parseInt(yVal) * TILE_SIZE + TILE_SIZE / 2;

      const frameIdx: number = TILE_INDEX.frontier;
      const img = this.scene.add.image(wx, wy, TERRAIN_TEXTURE_KEY, frameIdx);
      img.setDepth(10);
      img.setAlpha(0.8);
      this.frontierObjects.set(coord, img);
    }
  }

  destroy(): void {
    for (const [key, chunk] of this.chunks) {
      this.destroyChunk(key, chunk);
    }
    for (const img of this.frontierObjects.values()) img.destroy();
    this.frontierObjects.clear();
  }
}
