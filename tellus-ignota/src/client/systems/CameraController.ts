/**
 * CameraController — handles map navigation for Tellus Ignota.
 *
 * Desktop: click-drag to pan, mouse wheel to zoom.
 * Mobile: single-finger drag to pan, two-finger pinch to zoom.
 *
 * Attached to the MapScene's main camera.
 */
import * as Phaser from 'phaser';

export const MIN_ZOOM = 0.3;
export const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.1;
const PAN_SPEED = 1.0; // multiplier on drag delta

export class CameraController {
  private scene: Phaser.Scene;
  private cam: Phaser.Cameras.Scene2D.Camera;

  // Drag state
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private camScrollXAtDragStart = 0;
  private camScrollYAtDragStart = 0;

  // Pinch state
  private pinchDist = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.cam = scene.cameras.main;
    this.setup();
  }

  private setup(): void {
    const input = this.scene.input;

    // ── Desktop drag ──────────────────────────────────────────────────────────
    input.on(Phaser.Input.Events.POINTER_DOWN, (ptr: Phaser.Input.Pointer) => {
      if (ptr.button === 0) {
        this.isDragging = true;
        this.dragStartX = ptr.x;
        this.dragStartY = ptr.y;
        this.camScrollXAtDragStart = this.cam.scrollX;
        this.camScrollYAtDragStart = this.cam.scrollY;
      }
    });

    input.on(Phaser.Input.Events.POINTER_UP, () => {
      this.isDragging = false;
    });

    input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, () => {
      this.isDragging = false;
    });

    input.on(Phaser.Input.Events.POINTER_MOVE, (ptr: Phaser.Input.Pointer) => {
      if (this.isDragging && !ptr.isDown) {
        this.isDragging = false;
        return;
      }
      if (!this.isDragging) return;

      const dx = (ptr.x - this.dragStartX) * PAN_SPEED;
      const dy = (ptr.y - this.dragStartY) * PAN_SPEED;

      this.cam.scrollX = this.camScrollXAtDragStart - dx / this.cam.zoom;
      this.cam.scrollY = this.camScrollYAtDragStart - dy / this.cam.zoom;
    });

    // ── Mouse wheel zoom ──────────────────────────────────────────────────────
    input.on(
      Phaser.Input.Events.POINTER_WHEEL,
      (_ptr: Phaser.Input.Pointer, _gos: unknown, _dx: number, dy: number) => {
        const newZoom = Phaser.Math.Clamp(
          this.cam.zoom - dy * ZOOM_STEP * 0.01,
          MIN_ZOOM,
          MAX_ZOOM
        );
        this.cam.zoom = newZoom;
      }
    );

    // ── Touch pinch zoom ──────────────────────────────────────────────────────
    input.on(
      Phaser.Input.Events.POINTER_DOWN,
      (_ptr: Phaser.Input.Pointer) => {
        const pointers = input.manager.pointers;
        const active = pointers.filter((p) => p.isDown);
        if (active.length === 2) {
          this.isDragging = false; // stop drag during pinch
          const p0 = active[0];
          const p1 = active[1];
          if (p0 && p1) {
            this.pinchDist = Phaser.Math.Distance.Between(p0.x, p0.y, p1.x, p1.y);
          }
        }
      }
    );

    input.on(
      Phaser.Input.Events.POINTER_MOVE,
      (_ptr: Phaser.Input.Pointer) => {
        const pointers = input.manager.pointers;
        const active2 = pointers.filter((p) => p.isDown);
        if (active2.length === 2) {
          const p0 = active2[0];
          const p1 = active2[1];
          if (p0 && p1 && this.pinchDist > 0) {
            const newDist = Phaser.Math.Distance.Between(p0.x, p0.y, p1.x, p1.y);
            const ratio = newDist / this.pinchDist;
            const newZoom = Phaser.Math.Clamp(
              this.cam.zoom * ratio,
              MIN_ZOOM,
              MAX_ZOOM
            );
            this.cam.zoom = newZoom;
            this.pinchDist = newDist;
          }
        }
      }
    );
  }

  /** Call from MapScene's update() to keep camera state current. */
  update(): void {
    // Nothing continuous needed — all handled via events
  }

  /** Smoothly move the camera to world coordinates (wx, wy). */
  panTo(wx: number, wy: number, duration = 500): void {
    this.scene.cameras.main.pan(wx, wy, duration, 'Power2');
  }

  /** Zoom to a specific level. */
  zoomTo(level: number, duration = 300): void {
    const clamped = Phaser.Math.Clamp(level, MIN_ZOOM, MAX_ZOOM);
    this.scene.cameras.main.zoomTo(clamped, duration);
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE);
    this.scene.input.off(Phaser.Input.Events.POINTER_WHEEL);
  }
}
