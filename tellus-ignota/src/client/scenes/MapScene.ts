/**
 * MapScene — the core game scene for Tellus Ignota.
 *
 * Responsibilities:
 * - Chunked tilemap rendering (terrain + fog layers via ChunkManager)
 * - Camera pan/zoom (CameraController)
 * - Tile click interaction (reveal flow)
 * - Archaeologist avatar sprite
 * - Artifact particle effect on discovery
 * - Emits events to UIScene (tile info, reveal result, HUD state)
 */
import * as Phaser from 'phaser';
import { ChunkManager } from '../systems/ChunkManager';
import { CameraController } from '../systems/CameraController';
import { TILE_SIZE } from '../systems/TerrainPainter';
import type { GameInitResponse, TileData, RevealRequest, RevealResponse } from '../../shared/api';

// World origin pixel coords — tile (0,0) maps here
export const WORLD_ORIGIN_X = 0;
export const WORLD_ORIGIN_Y = 0;

export class MapScene extends Phaser.Scene {
  private chunkManager!: ChunkManager;
  private camController!: CameraController;

  // Player state
  private username = 'explorer';
  private score = 0;
  private frontier: Set<string> = new Set();

  // Archaeologist avatar
  private avatar: Phaser.GameObjects.Sprite | null = null;

  // Drag detection — prevent reveal on drag end
  private pointerDownX = 0;
  private pointerDownY = 0;
  private isDragThreshold = false;

  // Particle emitter for artifact glow
  private particles: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  // Forest decoration sprites placed on revealed tiles
  private decorations: Map<string, Phaser.GameObjects.Image> = new Map();

  // Forest decoration keys available
  private readonly FOREST_DECO_KEYS = [
    'forest_Curved_tree1', 'forest_Curved_tree2', 'forest_Willow1', 'forest_Willow2',
    'forest_White_tree1', 'forest_Luminous_tree1', 'forest_Beige_green_mushroom1',
    'forest_White-red_mushroom1', 'forest_Chanterelles1',
  ];

  constructor() {
    super('MapScene');
  }

  create() {
    // System setup
    this.chunkManager = new ChunkManager(this);
    this.camController = new CameraController(this);

    // Camera starts at world origin (tile 0,0)
    this.cameras.main.centerOn(WORLD_ORIGIN_X, WORLD_ORIGIN_Y);
    this.cameras.main.setBackgroundColor(0x080812);
    this.cameras.main.zoom = 1.5;

    // Particle emitter for artifact reveal
    this.setupParticles();

    // Avatar
    this.setupAvatar();

    // Fade in camera just in case it got stuck faded out from MainMenu
    this.cameras.main.fadeIn(400, 0, 0, 0);
    // Pointer input
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);

    // Responsive resize
    this.scale.on('resize', (size: Phaser.Structs.Size) => {
      this.cameras.resize(size.width, size.height);
    });

    // Fetch game state from server
    void this.initFromServer();
  }

  private async initFromServer(): Promise<void> {
    try {
      const res = await fetch('/api/game-init');
      if (!res.ok) {
        console.error('game-init failed:', res.status);
        return;
      }
      const data = await res.json() as GameInitResponse;

      this.username = data.username;
      this.score = data.score;
      this.frontier = new Set(data.frontier);
      this.chunkManager.setFrontier(data.frontier);
      
      this.applyCosmetics();

      // Tell UIScene about the initial state
      this.events.emit('game-init', data);
      this.scene.get('UIScene')?.events.emit('game-init', data);

    } catch (err) {
      console.error('initFromServer error:', err);
    }
  }

  override update(): void {
    const cam = this.cameras.main;
    const midX = cam.midPoint.x;
    const midY = cam.midPoint.y;

    this.chunkManager.update(midX, midY);
    this.camController.update();
  }

  // ─── Avatar ─────────────────────────────────────────────────────────────────

  private setupAvatar(): void {
    try {
      this.avatar = this.add.sprite(TILE_SIZE / 2, TILE_SIZE / 2, 'cartographer');
      this.avatar.setDepth(20);
      const scale = (TILE_SIZE / Math.max(this.avatar.width, this.avatar.height)) * 0.8;
      this.avatar.setScale(scale);
      this.applyCosmetics();
    } catch (e) {
      console.warn('Avatar setup failed:', e);
    }
  }

  private applyCosmetics(): void {
    if (!this.avatar) return;

    if (this.score >= 500) {
      // Golden Cartographer
      this.avatar.setTint(0xffd700);
      this.setupGoldenAura();
    } else if (this.score >= 100) {
      // Silver Cartographer
      this.avatar.setTint(0xc0c0c0);
    } else {
      // Standard Cartographer
      this.avatar.clearTint();
    }
  }

  private setupGoldenAura(): void {
    if (!this.avatar) return;
    const gfx = this.add.graphics();
    gfx.fillStyle(0xffd700, 1);
    gfx.fillCircle(2, 2, 2);
    gfx.generateTexture('aura-dot', 4, 4);
    gfx.destroy();

    const particles = this.add.particles(0, 0, 'aura-dot', {
      speed: { min: 10, max: 20 },
      scale: { start: 1, end: 0 },
      alpha: { start: 0.5, end: 0 },
      lifespan: 1000,
      quantity: 1,
      blendMode: 'ADD',
    });
    particles.setDepth(19);
    particles.startFollow(this.avatar);
  }

  private moveAvatarToTile(tx: number, ty: number): void {
    if (!this.avatar) return;

    const wx = tx * TILE_SIZE + TILE_SIZE / 2;
    const wy = ty * TILE_SIZE + TILE_SIZE / 2;

    this.tweens.add({
      targets: this.avatar,
      x: wx,
      y: wy,
      duration: 400,
      ease: 'Power2',
    });
  }

  // ─── Particles ───────────────────────────────────────────────────────────────

  private setupParticles(): void {
    // Use a simple white pixel as particle source — no asset needed
    const gfx = this.add.graphics();
    gfx.fillStyle(0xffffff, 1);
    gfx.fillRect(0, 0, 4, 4);
    gfx.generateTexture('particle-dot', 4, 4);
    gfx.destroy();

    this.particles = this.add.particles(0, 0, 'particle-dot', {
      speed: { min: 40, max: 120 },
      scale: { start: 1.2, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 800,
      quantity: 30,
      tint: [0xd4a017, 0xffffff, 0xffe066],
      emitting: false,
    });
    this.particles.setDepth(50);
  }

  private emitArtifactParticles(wx: number, wy: number): void {
    if (!this.particles) return;
    this.particles.setPosition(wx, wy);
    this.particles.explode(40, wx, wy);
  }

  // ─── Pointer handling ────────────────────────────────────────────────────────

  private onPointerDown(ptr: Phaser.Input.Pointer): void {
    this.pointerDownX = ptr.x;
    this.pointerDownY = ptr.y;
    this.isDragThreshold = false;
  }

  private onPointerMove(ptr: Phaser.Input.Pointer): void {
    if (!ptr.isDown) return;
    const dx = ptr.x - this.pointerDownX;
    const dy = ptr.y - this.pointerDownY;
    if (Math.sqrt(dx * dx + dy * dy) > 8) {
      this.isDragThreshold = true;
    }
  }

  private onPointerUp(ptr: Phaser.Input.Pointer): void {
    // Ignore if this was a drag gesture
    if (this.isDragThreshold) return;

    // Convert screen point to world tile coords
    const worldPoint = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
    const tileX = Math.floor(worldPoint.x / TILE_SIZE);
    const tileY = Math.floor(worldPoint.y / TILE_SIZE);
    const coord = `${tileX}:${tileY}`;

    if (this.frontier.has(coord)) {
      void this.attemptReveal(tileX, tileY);
    }
    if (!this.isDragThreshold) {
      const tileData = this.chunkManager.getTileData(coord);
      if (tileData) {
        this.emitTileInfo(tileX, tileY, tileData);
      }
    }
  }

  private emitTileInfo(x: number, y: number, data: TileData): void {
    const uiScene = this.scene.get('UIScene');
    if (uiScene) {
      uiScene.events.emit('show-tile-info', { x, y, ...data });
    }
  }

  // ─── Reveal flow ─────────────────────────────────────────────────────────────

  private async attemptReveal(tx: number, ty: number): Promise<void> {
    // We rely entirely on the server to reject the reveal if the user has no actions left (including bonus actions).

    // We rely entirely on the server to reject the reveal if the user has no actions left (including bonus actions).

    const body: RevealRequest = { x: tx, y: ty };

    try {
      const res = await fetch('/api/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json() as RevealResponse;

      if (!data.ok) {
        // Restore if server rejected
        const uiScene = this.scene.get('UIScene');
        uiScene?.events.emit('reveal-rejected', data.error);
        return;
      }

      const tileData: TileData = {
        terrain: data.terrain,
        revealedBy: this.username,
        revealedAt: Date.now(),
        ...(data.artifactId ? { artifactId: data.artifactId } : {}),
      };

      // Update chunk manager
      this.chunkManager.revealTile(tx, ty, tileData);

      // Update frontier
      this.frontier = new Set(data.newFrontier);
      this.chunkManager.setFrontier(data.newFrontier);

      // Move avatar
      this.moveAvatarToTile(tx, ty);

      // Camera pan to revealed tile
      const wx = tx * TILE_SIZE + TILE_SIZE / 2;
      const wy = ty * TILE_SIZE + TILE_SIZE / 2;
      this.camController.panTo(wx, wy, 600);

      // Artifact effect
      if (data.artifactId) {
        this.emitArtifactParticles(wx, wy);
        // Camera shake
        this.cameras.main.shake(400, 0.008);
      }

      // Add forest decoration if applicable
      this.addDecoration(tx, ty, data.terrain);

      // Notify UI
      const uiScene = this.scene.get('UIScene');
      uiScene?.events.emit('reveal-success', {
        x: tx, y: ty,
        terrain: data.terrain,
        artifactId: data.artifactId,
      });

    } catch (err) {
      console.error('Reveal fetch error:', err);
    }
  }

  // ─── Decorations ─────────────────────────────────────────────────────────────

  private addDecoration(tx: number, ty: number, terrain: string): void {
    if (terrain !== 'forest' && terrain !== 'plains') return;
    if (Math.random() > 0.35) return; // ~35% of forest/plains tiles get a deco

    const key = `${tx}:${ty}`;
    if (this.decorations.has(key)) return;

    const decoKey = this.FOREST_DECO_KEYS[Math.floor(Math.random() * this.FOREST_DECO_KEYS.length)];
    if (!decoKey || !this.textures.exists(decoKey)) return;

    const wx = tx * TILE_SIZE + TILE_SIZE / 2;
    const wy = ty * TILE_SIZE + TILE_SIZE / 2;

    const img = this.add.image(wx, wy, decoKey);
    img.setDepth(15);
    const scale = (TILE_SIZE / Math.max(img.width, img.height)) * 1.2;
    img.setScale(scale);

    // Fade in
    img.setAlpha(0);
    this.tweens.add({ targets: img, alpha: 0.85, duration: 400, ease: 'Power1' });

    this.decorations.set(key, img);
  }
}
