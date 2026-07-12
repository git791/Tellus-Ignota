/**
 * TerrainPainter — generates procedural terrain tile textures at runtime
 * using Phaser 4's Graphics API and RenderTexture.
 *
 * Produces 8 named textures: water, forest, plains, desert, mountain, ruins, fog, frontier.
 * Each is a 32×32 pixel-art style tile with distinctive color + pattern.
 *
 * Call TerrainPainter.generate(scene) once during Preloader.
 */
import * as Phaser from 'phaser';
import type { TerrainType } from '../../shared/api';

export const TILE_SIZE = 32;

// Texture key constants — used everywhere tiles are placed
export const TERRAIN_TEXTURE_KEY = 'terrain-tileset';

// Tile indices in the generated atlas texture (single row)
export const TILE_INDEX: Record<TerrainType | 'fog' | 'frontier', number> = {
  water:    0,
  forest:   1,
  plains:   2,
  desert:   3,
  mountain: 4,
  ruins:    5,
  fog:      6,
  frontier: 7,
};

export const TOTAL_TILES = Object.keys(TILE_INDEX).length; // 8

type TileSpec = {
  base: number;      // Phaser hex color for the base fill
  accent: number;    // accent/pattern color
  pattern: 'water' | 'forest' | 'plains' | 'desert' | 'mountain' | 'ruins' | 'fog' | 'frontier';
};

const TILE_SPECS: TileSpec[] = [
  // 0 water
  { base: 0x1a4a7a, accent: 0x2d6fa8, pattern: 'water' },
  // 1 forest
  { base: 0x1a3d1a, accent: 0x2d6b2d, pattern: 'forest' },
  // 2 plains
  { base: 0x3d6b2d, accent: 0x5a9440, pattern: 'plains' },
  // 3 desert
  { base: 0x9e7c3a, accent: 0xc9a45a, pattern: 'desert' },
  // 4 mountain
  { base: 0x4a4a55, accent: 0x7a7a88, pattern: 'mountain' },
  // 5 ruins
  { base: 0x3d2d4a, accent: 0x7a5a9e, pattern: 'ruins' },
  // 6 fog
  { base: 0x111122, accent: 0x1a1a33, pattern: 'fog' },
  // 7 frontier (highlighted fog — golden border)
  { base: 0x111122, accent: 0xd4a017, pattern: 'frontier' },
];

function drawTile(
  g: Phaser.GameObjects.Graphics,
  xOff: number,
  spec: TileSpec
): void {
  const ts = TILE_SIZE;
  const x = xOff;
  const y = 0;

  // Base fill
  g.fillStyle(spec.base, 1);
  g.fillRect(x, y, ts, ts);

  // Thin border
  g.lineStyle(1, spec.accent, 0.5);
  g.strokeRect(x, y, ts, ts);

  switch (spec.pattern) {
    case 'water': {
      // Horizontal shimmer lines
      g.lineStyle(1, spec.accent, 0.6);
      for (let row = 6; row < ts; row += 8) {
        g.beginPath();
        g.moveTo(x + 4, y + row);
        g.lineTo(x + ts - 4, y + row);
        g.strokePath();
      }
      // Small wave dots
      g.fillStyle(spec.accent, 0.4);
      g.fillCircle(x + 8, y + 10, 2);
      g.fillCircle(x + 20, y + 18, 2);
      g.fillCircle(x + 12, y + 24, 2);
      break;
    }
    case 'forest': {
      // Tree silhouettes
      g.fillStyle(spec.accent, 0.8);
      // Tree 1
      g.fillTriangle(x + 8, y + 5, x + 4, y + 16, x + 12, y + 16);
      g.fillRect(x + 7, y + 16, 2, 4);
      // Tree 2
      g.fillTriangle(x + 22, y + 8, x + 18, y + 18, x + 26, y + 18);
      g.fillRect(x + 21, y + 18, 2, 4);
      // Small shrub
      g.fillStyle(0x1e5c1e, 0.6);
      g.fillCircle(x + 16, y + 24, 4);
      break;
    }
    case 'plains': {
      // Grass tufts
      g.lineStyle(1, spec.accent, 0.7);
    const tufts: Array<[number, number]> = [[6, 10], [16, 6], [24, 14], [10, 22], [22, 24]];
      for (const [tx, ty] of tufts) {
        g.beginPath();
        g.moveTo(x + tx, y + ty + 4);
        g.lineTo(x + tx - 2, y + ty);
        g.moveTo(x + tx, y + ty + 4);
        g.lineTo(x + tx, y + ty - 1);
        g.moveTo(x + tx, y + ty + 4);
        g.lineTo(x + tx + 2, y + ty);
        g.strokePath();
      }
      break;
    }
    case 'desert': {
      // Sand dune dots
      g.fillStyle(spec.accent, 0.4);
      for (let row = 4; row < ts; row += 6) {
        for (let col = 4; col < ts; col += 8) {
          g.fillCircle(x + col, y + row, 1);
        }
      }
      // Dune curve
      g.lineStyle(1, spec.accent, 0.5);
      g.beginPath();
      g.moveTo(x, y + 18);
      g.lineTo(x + 8, y + 14);
      g.lineTo(x + 16, y + 16);
      g.lineTo(x + 24, y + 12);
      g.lineTo(x + ts, y + 15);
      g.strokePath();
      break;
    }
    case 'mountain': {
      // Mountain peak
      g.fillStyle(spec.accent, 0.7);
      g.fillTriangle(x + 16, y + 4, x + 4, y + 24, x + 28, y + 24);
      g.fillStyle(0xffffff, 0.4);
      g.fillTriangle(x + 16, y + 4, x + 12, y + 12, x + 20, y + 12);
      // Rocky base
      g.fillStyle(spec.accent, 0.3);
      g.fillRect(x + 2, y + 24, 28, 5);
      break;
    }
    case 'ruins': {
      // Stone block pattern
      g.fillStyle(spec.accent, 0.4);
      const blocks: Array<[number, number, number, number]> = [[4, 6, 10, 7], [16, 6, 10, 7], [2, 15, 12, 7], [16, 15, 12, 7]];
      for (const [bx, by, bw, bh] of blocks) {
        g.fillRect(x + bx, y + by, bw, bh);
        g.lineStyle(1, 0x000000, 0.4);
        g.strokeRect(x + bx, y + by, bw, bh);
      }
      // Central arch hint
      g.lineStyle(2, spec.accent, 0.6);
      g.beginPath();
      g.arc(x + 16, y + 24, 6, Math.PI, 2 * Math.PI);
      g.strokePath();
      break;
    }
    case 'fog': {
      // Fog swirl
      g.lineStyle(1, spec.accent, 0.3);
      for (let i = 0; i < 3; i++) {
        const cy = y + 8 + i * 8;
        g.beginPath();
        g.moveTo(x + 2, cy);
        g.lineTo(x + ts - 2, cy);
        g.strokePath();
      }
      // Dark vignette corners
      g.fillStyle(0x000011, 0.3);
      g.fillRect(x, y, 6, 6);
      g.fillRect(x + ts - 6, y, 6, 6);
      g.fillRect(x, y + ts - 6, 6, 6);
      g.fillRect(x + ts - 6, y + ts - 6, 6, 6);
      break;
    }
    case 'frontier': {
      // Fog base (like above)
      g.lineStyle(1, 0x333355, 0.3);
      for (let i = 0; i < 3; i++) {
        const cy = y + 8 + i * 8;
        g.beginPath();
        g.moveTo(x + 4, cy);
        g.lineTo(x + ts - 4, cy);
        g.strokePath();
      }
      // Golden glowing border
      g.lineStyle(2, spec.accent, 0.9);
      g.strokeRect(x + 1, y + 1, ts - 2, ts - 2);
      g.lineStyle(1, spec.accent, 0.4);
      g.strokeRect(x + 3, y + 3, ts - 6, ts - 6);
      // Corner sparkles
      g.fillStyle(spec.accent, 0.8);
      g.fillCircle(x + 3, y + 3, 1.5);
      g.fillCircle(x + ts - 3, y + 3, 1.5);
      g.fillCircle(x + 3, y + ts - 3, 1.5);
      g.fillCircle(x + ts - 3, y + ts - 3, 1.5);
      break;
    }
  }
}

/**
 * Generates all terrain tile textures and registers them in the Phaser
 * texture manager as a single atlas image (TERRAIN_TEXTURE_KEY).
 *
 * Call this in Preloader.create() — after this, MapScene can use the
 * TILE_INDEX constants to place tiles.
 */
export function generateTerrainTextures(scene: Phaser.Scene): void {
  const atlasWidth = TILE_SIZE * TOTAL_TILES;
  const atlasHeight = TILE_SIZE;

  const g = scene.add.graphics();

  // Draw each tile at its x-offset
  TILE_SPECS.forEach((spec, i) => {
    drawTile(g, i * TILE_SIZE, spec);
  });

  // Rasterize the graphics directly to a texture
  g.generateTexture(TERRAIN_TEXTURE_KEY, atlasWidth, atlasHeight);

  const tex = scene.textures.get(TERRAIN_TEXTURE_KEY);
  for (let i = 0; i < TOTAL_TILES; i++) {
    tex.add(i.toString(), 0, i * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE);
  }

  // Clean up — the texture manager now owns the texture
  g.destroy();
}

