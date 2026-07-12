/**
 * UIScene — HUD overlay running parallel to MapScene.
 *
 * Renders on top of MapScene (higher depth).
 * Contains:
 *   - Top bar: title, username, tile count, daily action status / countdown
 *   - Tile info card: shown when a revealed tile is tapped
 *   - Artifact discovery banner: shown on artifact reveal
 *   - Toast notifications: rejections, errors
 */
import * as Phaser from 'phaser';
import type { GameInitResponse, TerrainType } from '../../shared/api';
import { TERRAIN_LABELS } from '../../shared/api';
import { DailyGameModal } from '../components/DailyGameModal';
import { ProgressionModal } from '../components/ProgressionModal';
import { ClickerModal } from '../components/ClickerModal';

const TERRAIN_COLORS: Record<TerrainType, number> = {
  water:    0x2d6fa8,
  forest:   0x2d6b2d,
  plains:   0x5a9440,
  desert:   0xc9a45a,
  mountain: 0x7a7a88,
  ruins:    0x7a5a9e,
};

export class UIScene extends Phaser.Scene {
  // HUD elements
  private topBar!: Phaser.GameObjects.Rectangle;
  private titleText!: Phaser.GameObjects.Text;
  private usernameText!: Phaser.GameObjects.Text;
  private actionText!: Phaser.GameObjects.Text;
  private countdownText!: Phaser.GameObjects.Text;

  // Info card
  private infoCard!: Phaser.GameObjects.Container;
  private infoCardBg!: Phaser.GameObjects.Rectangle;
  private infoTerrainText!: Phaser.GameObjects.Text;
  private infoFoundByText!: Phaser.GameObjects.Text;
  private infoArtifactText!: Phaser.GameObjects.Text;
  private infoCardVisible = false;

  // Artifact banner
  private artifactBanner!: Phaser.GameObjects.Container;

  // Toast
  private toastBg!: Phaser.GameObjects.Rectangle;
  private toastText!: Phaser.GameObjects.Text;

  // State
  private username = '';
  private canActToday = true;
  private needsToPlayGame = false;
  private tileCount = 0;
  private communityGoalReached = false;
  private currentStreak = 0;
  private currentFreezes = 0;
  private countdownTimer: Phaser.Time.TimerEvent | null = null;
  private dailyGameModal!: DailyGameModal;
  private progressionModal!: ProgressionModal;
  private clickerModal!: ClickerModal;
  private dailyGameBtn!: Phaser.GameObjects.Container;
  private progBtn!: Phaser.GameObjects.Container;
  private clickerBtn!: Phaser.GameObjects.Container;
  private communityGoalBanner!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'UIScene', active: false });
  }

  create() {
    const { width, height } = this.scale;


    // Top bar
    this.topBar = this.add.rectangle(0, 0, width, 64, 0x000011, 0.82).setOrigin(0);

    this.titleText = this.add.text(16, 8, 'TELLUS IGNOTA', {
      fontFamily: '"Georgia", serif',
      fontSize: '16px',
      color: '#d4a017',
    });

    this.usernameText = this.add.text(width - 16, 8, '', {
      fontFamily: '"Georgia", serif',
      fontSize: '13px',
      color: '#aaaacc',
    }).setOrigin(1, 0);

    this.actionText = this.add.text(width / 2, 28, '', {
      fontFamily: '"Georgia", serif',
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0.5, 0);

    this.countdownText = this.add.text(width / 2, 46, '', {
      fontFamily: '"Georgia", serif',
      fontSize: '11px',
      color: '#888899',
    }).setOrigin(0.5, 0);

    // Tile info card
    this.buildInfoCard(width, height);

    // Artifact banner
    this.buildArtifactBanner(width, height);

    // Toast
    this.buildToast(width, height);

    // Daily Game Modal
    this.dailyGameModal = new DailyGameModal();
    this.dailyGameModal.onSuccess = () => {
      this.needsToPlayGame = false;
      this.refreshHUD();
      this.showToast('Daily Challenge Completed! You can now uncover a tile.', 0x22aa22);
    };

    // Progression Modal
    this.progressionModal = new ProgressionModal();

    // Clicker Modal
    this.clickerModal = new ClickerModal(this);
    this.clickerModal.onGoldenAgeTriggered = () => {
      this.showToast('✨ GOLDEN AGE TRIGGERED! ✨', 0xffd700);
      // MapScene should refresh to see new tiles
      this.scene.get('MapScene')?.events.emit('golden-age-triggered');
    };

    // Listen for events from MapScene
    const mapScene = this.scene.get('MapScene');

    mapScene?.events.on('game-init', (data: GameInitResponse) => {
      this.username = data.username;
      this.canActToday = data.canActToday;
      this.needsToPlayGame = data.needsToPlayGame ?? false;
      this.communityGoalReached = data.communityGoalReached ?? false;
      this.tileCount = data.tileCount;
      this.currentStreak = data.streak ?? 0;
      this.currentFreezes = data.streakFreezes ?? 0;
      this.refreshHUD();
    });

    this.events.on('game-init', (data: GameInitResponse) => {
      this.username = data.username;
      this.canActToday = data.canActToday;
      this.needsToPlayGame = data.needsToPlayGame ?? false;
      this.communityGoalReached = data.communityGoalReached ?? false;
      this.tileCount = data.tileCount;
      this.currentStreak = data.streak ?? 0;
      this.currentFreezes = data.streakFreezes ?? 0;
      this.refreshHUD();
    });

    this.events.on('show-tile-info', (info: {
      x: number; y: number; terrain: TerrainType;
      revealedBy: string; revealedAt: number; artifactId?: string;
    }) => {
      this.showInfoCard(info);
    });

    this.events.on('reveal-success', (info: {
      x: number; y: number; terrain: TerrainType; artifactId?: string;
    }) => {
      this.canActToday = false;
      this.tileCount++;
      this.refreshHUD();
      this.hideInfoCard();
      if (info.artifactId) {
        this.showArtifactBanner(info.artifactId);
      }
    });

    this.events.on('reveal-rejected', (msg: string) => {
      this.showToast(msg, 0xaa2222);
    });

    // Responsive
    this.scale.on('resize', (size: Phaser.Structs.Size) => {
      this.cameras.resize(size.width, size.height);
      this.repositionUI(size.width, size.height);
    });

    // Tap anywhere to dismiss info card
    this.input.on(Phaser.Input.Events.POINTER_DOWN, () => {
      if (this.infoCardVisible) this.hideInfoCard();
    });

    // Create a dedicated floating button for Daily Game
    this.dailyGameBtn = this.add.container(width / 2, 75);
    const dgBtnBg = this.add.rectangle(0, 0, 200, 36, 0x5a2a2a, 0.9).setStrokeStyle(2, 0xffaaaa, 1);
    const dgBtnTxt = this.add.text(0, 0, '✦ Play Daily Challenge ✦', {
      fontFamily: '"Georgia", serif',
      fontSize: '14px',
      color: '#ffaaaa',
    }).setOrigin(0.5);
    this.dailyGameBtn.add([dgBtnBg, dgBtnTxt]);
    this.dailyGameBtn.setDepth(200);
    this.dailyGameBtn.setVisible(false);
    
    dgBtnBg.setInteractive({ useHandCursor: true });
    dgBtnBg.on('pointerdown', () => {
      if (this.needsToPlayGame) {
        this.dailyGameModal.show();
      }
    });

    // Create a Progression button (Leaderboard / Profile)
    this.progBtn = this.add.container(width - 60, height - 40);
    const progBtnBg = this.add.rectangle(0, 0, 100, 36, 0x111122, 0.8).setStrokeStyle(1, 0xd4a017, 1);
    const progBtnTxt = this.add.text(0, 0, '🏆 Rank', {
      fontFamily: '"Georgia", serif',
      fontSize: '14px',
      color: '#d4a017',
    }).setOrigin(0.5);
    this.progBtn.add([progBtnBg, progBtnTxt]);
    this.progBtn.setDepth(200);
    
    progBtnBg.setInteractive({ useHandCursor: true });
    progBtnBg.on('pointerdown', () => {
      this.progressionModal.show();
    });

    // Clicker Button (Top Right next to username)
    this.clickerBtn = this.add.container(width - 24, 40).setDepth(100);
    const cbBg = this.add.circle(0, 0, 16, 0xd4a017, 0.8).setStrokeStyle(1, 0xffffff);
    const cbIcon = this.add.text(0, 0, '⛏️', { fontSize: '14px' }).setOrigin(0.5);
    this.clickerBtn.add([cbBg, cbIcon]);
    this.clickerBtn.setSize(32, 32).setInteractive({ useHandCursor: true });
    this.clickerBtn.on('pointerdown', () => {
      this.clickerModal.show();
    });

    this.buildCommunityGoalBanner(width);

    // Start countdown if needed
    this.startCountdown();
  }

  private buildCommunityGoalBanner(width: number) {
    this.communityGoalBanner = this.add.text(width / 2, 80, '✨ COMMUNITY GOAL REACHED: EXTRA TILE UNLOCKED ✨', {
      fontFamily: '"Cinzel", serif',
      fontSize: '14px',
      color: '#fff2c8',
      backgroundColor: 'rgba(212, 160, 23, 0.2)',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5, 0).setVisible(false).setDepth(200);

    this.tweens.add({
      targets: this.communityGoalBanner,
      alpha: { from: 0.6, to: 1 },
      yoyo: true,
      repeat: -1,
      duration: 1500
    });
  }

  // ─── HUD ─────────────────────────────────────────────────────────────────────

  private refreshHUD(): void {
    let streakDisplay = '';
    if (this.currentStreak > 0) {
      streakDisplay = `  🔥 ${this.currentStreak}`;
      if (this.currentFreezes > 0) {
        streakDisplay += ` ❄️ ${this.currentFreezes}`;
      }
    }
    this.usernameText.setText(`u/${this.username}${streakDisplay}`);
    
    if (this.communityGoalReached) {
      this.communityGoalBanner.setVisible(true);
    } else {
      this.communityGoalBanner.setVisible(false);
    }

    if (this.needsToPlayGame) {
      this.actionText.setText('✦ You must complete the Daily Challenge first ✦');
      this.actionText.setStyle({ color: '#ffaaaa' });
      this.countdownText.setText('');
      this.dailyGameBtn.setVisible(true);
    } else if (this.canActToday) {
      this.actionText.setText('✦ Tap a glowing tile to reveal it ✦');
      this.actionText.setStyle({ color: '#d4a017' });
      this.countdownText.setText('');
      this.dailyGameBtn.setVisible(false);
    } else {
      this.actionText.setText('Today\'s exploration complete.');
      this.actionText.setStyle({ color: '#888899' });
      this.dailyGameBtn.setVisible(false);
      this.startCountdown();
    }
  }

  private startCountdown(): void {
    if (this.countdownTimer) return;
    this.countdownTimer = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.canActToday) {
          this.countdownText.setText('');
          return;
        }
        const now = new Date();
        const midnight = new Date();
        midnight.setUTCHours(24, 0, 0, 0);
        const diff = midnight.getTime() - now.getTime();
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        this.countdownText.setText(`Next action in ${h}h ${m}m ${s}s (UTC reset)`);
      },
    });
  }

  // ─── Info card ───────────────────────────────────────────────────────────────

  private buildInfoCard(width: number, height: number): void {
    this.infoCardBg = this.add.rectangle(0, 0, 260, 130, 0x0a0a1e, 0.92)
      .setStrokeStyle(1, 0xd4a017, 0.8);
    this.infoTerrainText = this.add.text(0, -42, '', {
      fontFamily: '"Georgia", serif',
      fontSize: '15px',
      color: '#d4a017',
    }).setOrigin(0.5);
    this.infoFoundByText = this.add.text(0, -14, '', {
      fontFamily: '"Georgia", serif',
      fontSize: '12px',
      color: '#aaaacc',
    }).setOrigin(0.5);
    this.infoArtifactText = this.add.text(0, 14, '', {
      fontFamily: '"Georgia", serif',
      fontSize: '12px',
      color: '#ffe066',
    }).setOrigin(0.5);

    // Close hint
    const closeHint = this.add.text(0, 46, 'tap to dismiss', {
      fontFamily: '"Georgia", serif',
      fontSize: '10px',
      color: '#555577',
    }).setOrigin(0.5);

    this.infoCard = this.add.container(width / 2, height - 100, [
      this.infoCardBg,
      this.infoTerrainText,
      this.infoFoundByText,
      this.infoArtifactText,
      closeHint,
    ]);
    this.infoCard.setVisible(false);
    this.infoCard.setDepth(100);
  }

  private showInfoCard(info: {
    x: number; y: number; terrain: TerrainType;
    revealedBy: string; revealedAt: number; artifactId?: string;
  }): void {
    const label = TERRAIN_LABELS[info.terrain] ?? info.terrain;
    const date = new Date(info.revealedAt).toLocaleDateString();

    this.infoTerrainText.setText(label);
    this.infoTerrainText.setStyle({
      color: `#${TERRAIN_COLORS[info.terrain]?.toString(16).padStart(6, '0') ?? 'ffffff'}`,
    });
    this.infoFoundByText.setText(`Discovered by u/${info.revealedBy}\n${date} · (${info.x}, ${info.y})`);
    this.infoArtifactText.setText(info.artifactId ? `🏺 Artifact found here!` : '');

    this.infoCard.setVisible(true);
    this.infoCardVisible = true;

    this.infoCard.setScale(0.8);
    this.tweens.add({
      targets: this.infoCard,
      scaleX: 1, scaleY: 1,
      duration: 200,
      ease: 'Back.Out',
    });
  }

  private hideInfoCard(): void {
    this.tweens.add({
      targets: this.infoCard,
      scaleX: 0.8, scaleY: 0.8,
      alpha: 0,
      duration: 150,
      ease: 'Power1',
      onComplete: () => {
        this.infoCard.setVisible(false);
        this.infoCard.setAlpha(1).setScale(1);
        this.infoCardVisible = false;
      },
    });
  }

  // ─── Artifact banner ─────────────────────────────────────────────────────────

  private buildArtifactBanner(width: number, height: number): void {
    const bg = this.add.rectangle(0, 0, width - 40, 180, 0x1a0a2e, 0.95)
      .setStrokeStyle(3, 0xd4a017, 1);
      
    // Glowing aura
    const glow = this.add.circle(0, -10, 50, 0xd4a017, 0.3);
    this.tweens.add({ targets: glow, alpha: 0.1, scale: 1.2, yoyo: true, repeat: -1, duration: 1000 });

    const titleTxt = this.add.text(0, -65, '✨ ARTIFACT DISCOVERED ✨', {
      fontFamily: '"Georgia", serif',
      fontSize: '18px',
      color: '#d4a017',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const icon = this.add.text(0, -15, '🏺', { fontSize: '48px' }).setOrigin(0.5);
    // Bouncing icon
    this.tweens.add({ targets: icon, y: -25, yoyo: true, repeat: -1, duration: 600, ease: 'Sine.inOut' });

    const subtitleTxt = this.add.text(0, 35, '', {
      fontFamily: '"Georgia", serif',
      fontSize: '15px',
      color: '#ffffff',
    }).setOrigin(0.5);
    
    const loreTxt = this.add.text(0, 65, 'Added to your collection!\nCheck Reddit to claim!', {
      fontFamily: '"Inter", sans-serif',
      fontSize: '12px',
      color: '#aaaaaa',
      align: 'center'
    }).setOrigin(0.5);

    this.artifactBanner = this.add.container(width / 2, height / 2, [bg, glow, titleTxt, icon, subtitleTxt, loreTxt]);
    this.artifactBanner.setVisible(false);
    this.artifactBanner.setDepth(200);

    // Store reference to subtitle text for updates
    this.artifactBanner.setData('subtitle', subtitleTxt);
    this.artifactBanner.setData('baseY', height / 2);
  }

  private showArtifactBanner(artifactId: string): void {
    const label = artifactId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const subtitleTxt = this.artifactBanner.getData('subtitle') as Phaser.GameObjects.Text;
    subtitleTxt.setText(`${label}`);

    const targetY = this.artifactBanner.getData('baseY') as number;
    this.artifactBanner.setVisible(true).setAlpha(0).setY(targetY + 30).setScale(0.8);
    
    this.tweens.add({
      targets: this.artifactBanner,
      alpha: 1, 
      y: targetY,
      scaleX: 1,
      scaleY: 1,
      duration: 600,
      ease: 'Back.Out',
      onComplete: () => {
        this.time.delayedCall(4000, () => {
          this.tweens.add({
            targets: this.artifactBanner,
            alpha: 0, 
            scaleX: 0.9,
            scaleY: 0.9,
            duration: 400,
            onComplete: () => this.artifactBanner.setVisible(false),
          });
        });
      },
    });
  }

  // ─── Toast ───────────────────────────────────────────────────────────────────

  private buildToast(width: number, height: number): void {
    this.toastBg = this.add.rectangle(width / 2, height - 40, 380, 40, 0x220000, 0.9)
      .setStrokeStyle(1, 0xaa2222);
    this.toastText = this.add.text(width / 2, height - 40, '', {
      fontFamily: '"Georgia", serif',
      fontSize: '13px',
      color: '#ffaaaa',
    }).setOrigin(0.5);
    this.toastBg.setVisible(false);
    this.toastText.setVisible(false);
    this.toastBg.setDepth(300);
    this.toastText.setDepth(301);
  }

  private showToast(msg: string, _color: number): void {
    this.toastText.setText(msg);
    this.toastBg.setVisible(true);
    this.toastText.setVisible(true);
    this.toastBg.setAlpha(0);
    this.toastText.setAlpha(0);

    this.tweens.add({
      targets: [this.toastBg, this.toastText],
      alpha: 1, duration: 200,
      onComplete: () => {
        this.time.delayedCall(2800, () => {
          this.tweens.add({
            targets: [this.toastBg, this.toastText],
            alpha: 0, duration: 300,
            onComplete: () => {
              this.toastBg.setVisible(false);
              this.toastText.setVisible(false);
            },
          });
        });
      },
    });
  }

  // ─── Responsive reposition ───────────────────────────────────────────────────

  private repositionUI(width: number, height: number): void {
    this.topBar.setSize(width, 48);
    this.titleText.setPosition(16, 14);
    this.usernameText.setX(width - 16);
    this.actionText.setX(width / 2);
    this.countdownText.setX(width / 2);
    this.infoCard.setX(width / 2).setY(height - 100);
    this.artifactBanner.setX(width / 2);
    this.toastBg.setX(width / 2).setY(height - 40);
    this.toastText.setX(width / 2).setY(height - 40);
    this.dailyGameBtn.setX(width / 2);
    this.progBtn.setX(width - 70).setY(height - 40);
    if (this.communityGoalBanner) this.communityGoalBanner.setX(width / 2);
    const bannerBg = this.artifactBanner.getData('bg') as Phaser.GameObjects.Rectangle;
    if (bannerBg) bannerBg.setSize(width - 40, 72);
  }
}
