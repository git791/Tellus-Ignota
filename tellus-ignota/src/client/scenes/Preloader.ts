import { Scene } from 'phaser';
import { generateTerrainTextures, TERRAIN_TEXTURE_KEY } from '../systems/TerrainPainter';

// The cartographer SVG sprite

// Forest object keys we'll load individually from craftpix assets
const FOREST_OBJECTS = [
  'Curved_tree1',
  'Curved_tree2',
  'Willow1',
  'Willow2',
  'White_tree1',
  'Luminous_tree1',
  'Beige_green_mushroom1',
  'White-red_mushroom1',
  'Chanterelles1',
  'Ent_man',
  'Tree_idol_dragon',
  'Living gazebo1',
];

export class Preloader extends Scene {
  constructor() {
    super('Preloader');
  }

  init() {

    const bg = this.add.image(0, 0, 'background').setAlpha(0.4).setOrigin(0.5);
    const outline = this.add.rectangle(0, 0, 468, 32).setStrokeStyle(2, 0xd4a017);
    const bar = this.add.rectangle(0, 0, 4, 28, 0xd4a017).setOrigin(0, 0.5);
    const titleText = this.add.text(0, 0, 'Loading Tellus Ignota...', {
      fontFamily: 'Georgia, serif',
      fontSize: '18px',
      color: '#d4a017',
    }).setOrigin(0.5);

    let currentProgress = 0;

    const updateLayout = () => {
      const { width, height } = this.scale;
      const cx = width / 2;
      const cy = height / 2;
      
      const safeBgWidth = bg.width || 1024;
      const safeBgHeight = bg.height || 768;
      const bgScale = Math.max(width / safeBgWidth, height / safeBgHeight);
      bg.setPosition(cx, cy).setScale(bgScale);
      
      const barMaxWidth = Math.min(460, width * 0.8);
      const outlineWidth = barMaxWidth + 8;

      outline.setPosition(cx, cy).setSize(outlineWidth, 32);
      bar.setPosition(cx - barMaxWidth / 2, cy);
      bar.setSize(4 + barMaxWidth * currentProgress, 28);
      
      titleText.setPosition(cx, cy - 40);
    };

    updateLayout();
    this.scale.on('resize', updateLayout);

    this.load.on('progress', (progress: number) => {
      currentProgress = progress;
      const { width } = this.scale;
      const barMaxWidth = Math.min(460, width * 0.8);
      bar.setSize(4 + barMaxWidth * progress, 28);
    });
  }

  preload() {
    this.load.setPath('../assets');

    // Logo (preserved from template)
    this.load.image('logo', 'logo.png');

    // Cartographer avatar
    this.load.image('cartographer', 'cartographer.svg');

    // Forest decoration objects
    const craftpixBase = '.';
    for (const objName of FOREST_OBJECTS) {
      this.load.image(`forest_${objName}`, `${craftpixBase}/${objName}.png`);
    }

  }

  create() {
    // Generate procedural terrain tile textures (Phaser 4 Graphics → RenderTexture)
    generateTerrainTextures(this);

    // Verify terrain texture was created
    if (!this.textures.exists(TERRAIN_TEXTURE_KEY)) {
      console.error('Preloader: terrain texture generation failed!');
    }

    // (No animations needed for the static cartographer sprite)

    this.scene.start('MainMenu');
  }
}
