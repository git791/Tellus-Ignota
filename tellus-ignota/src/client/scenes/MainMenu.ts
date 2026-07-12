import { Scene, GameObjects } from 'phaser';

export class MainMenu extends Scene {
  background: GameObjects.Image | null = null;
  title: GameObjects.Text | null = null;
  subtitle: GameObjects.Text | null = null;
  startBtn: GameObjects.Text | null = null;
  fog1: GameObjects.Rectangle | null = null;
  quote: GameObjects.Text | null = null;

  constructor() {
    super('MainMenu');
  }

  init(): void {
    this.background = null;
    this.title = null;
    this.subtitle = null;
    this.startBtn = null;
    this.fog1 = null;
    this.quote = null;
  }

  create() {
    this.refreshLayout();
    this.scale.on('resize', () => this.refreshLayout());

    // Entrance animation
    this.cameras.main.fadeIn(800, 0, 0, 0);

    // Start on click/tap
    this.input.once('pointerdown', () => {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('MapScene');
        this.scene.launch('UIScene');
      });
    });
  }

  private refreshLayout(): void {
    const { width, height } = this.scale;
    this.cameras.resize(width, height);

    // Background
    if (!this.background) {
      this.background = this.add.image(0, 0, 'background').setOrigin(0.5);
    }
    const safeBgWidth = this.background.width || 1024;
    const safeBgHeight = this.background.height || 768;
    const bgScale = Math.max(width / safeBgWidth, height / safeBgHeight);
    this.background.setPosition(width / 2, height / 2).setScale(bgScale);

    // Dark fog overlay for readability
    if (!this.fog1) {
      this.fog1 = this.add.rectangle(0, 0, width, height, 0x000011, 0.70).setOrigin(0);
    } else {
      this.fog1.setDisplaySize(width, height);
    }

    // Title
    if (!this.title) {
      this.title = this.add
        .text(0, 0, 'TELLUS IGNOTA', {
          fontFamily: '"Georgia", "Palatino", serif',
          fontSize: '52px',
          color: '#d4a017',
          stroke: '#000000',
          strokeThickness: 6,
          align: 'center',
          shadow: {
            offsetX: 0,
            offsetY: 0,
            color: '#d4a017',
            blur: 20,
            fill: true,
          },
        })
        .setOrigin(0.5);
    }
    // Update font size dynamically based on width
    const titleSize = Math.min(52, Math.max(32, Math.floor(width * 0.1)));
    this.title.setFontSize(`${titleSize}px`);
    this.title.setPosition(width / 2, height * 0.32);

    // Subtitle
    if (!this.subtitle) {
      this.subtitle = this.add
        .text(0, 0, 'A community-owned map — one tile at a time, forever.', {
          fontFamily: '"Georgia", serif',
          fontSize: '18px',
          color: '#aaaacc',
          align: 'center',
          stroke: '#000000',
          strokeThickness: 3,
          wordWrap: { width: width - 40, useAdvancedWrap: true }
        })
        .setOrigin(0.5);
    } else {
      this.subtitle.setStyle({ wordWrap: { width: width - 40, useAdvancedWrap: true } });
    }
    this.subtitle.setPosition(width / 2, height * 0.44);

    // Flavor quote
    if (!this.quote) {
      this.quote = this.add
        .text(0, 0,
          '"She left the map half-drawn.\n The fog took the rest."',
          {
            fontFamily: '"Georgia", serif',
            fontSize: '15px',
            color: '#887799',
            align: 'center',
            fontStyle: 'italic',
            wordWrap: { width: width - 40, useAdvancedWrap: true }
          })
        .setOrigin(0.5);
    } else {
      this.quote.setStyle({ wordWrap: { width: width - 40, useAdvancedWrap: true } });
    }
    this.quote.setPosition(width / 2, height * 0.58);

    // Start button
    if (!this.startBtn) {
      this.startBtn = this.add
        .text(0, 0, '[ Tap anywhere to begin exploring ]', {
          fontFamily: '"Georgia", serif',
          fontSize: '20px',
          color: '#ffd700',
          stroke: '#000000',
          strokeThickness: 5,
          align: 'center',
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      // Pulse animation
      this.tweens.add({
        targets: this.startBtn,
        alpha: 0.3,
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    this.startBtn.setPosition(width / 2, height * 0.75);
  }
}
