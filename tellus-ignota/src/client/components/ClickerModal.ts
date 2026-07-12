import * as Phaser from 'phaser';

export class ClickerModal {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private background!: Phaser.GameObjects.Rectangle;
  
  private titleText!: Phaser.GameObjects.Text;
  private progressBarBg!: Phaser.GameObjects.Rectangle;
  private progressBarFill!: Phaser.GameObjects.Rectangle;
  private progressText!: Phaser.GameObjects.Text;
  private personalText!: Phaser.GameObjects.Text;
  private pickaxeBtn!: Phaser.GameObjects.Text;
  
  private globalClicks = 0;
  private personalClicks = 0;
  private unsyncedClicks = 0;
  private isVisible = false;
  
  public onGoldenAgeTriggered?: () => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.build();
    
    // Setup 5-second sync timer
    this.scene.time.addEvent({
      delay: 5000,
      callback: this.syncClicks,
      callbackScope: this,
      loop: true,
    });
  }

  private build() {
    const { width, height } = this.scene.scale;
    
    this.container = this.scene.add.container(0, 0).setDepth(300).setVisible(false);

    // Dark overlay
    this.background = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0.85).setOrigin(0);
    this.background.setInteractive(); // Block clicks to map
    this.container.add(this.background);

    // Modal Box
    const boxW = Math.min(width * 0.9, 400);
    const boxH = 450;
    const boxX = (width - boxW) / 2;
    const boxY = (height - boxH) / 2;
    
    const box = this.scene.add.rectangle(boxX, boxY, boxW, boxH, 0x111122).setOrigin(0);
    box.setStrokeStyle(2, 0xd4a017);
    this.container.add(box);
    
    // Close Button
    const closeBtn = this.scene.add.text(boxX + boxW - 20, boxY + 20, 'X', {
      fontSize: '20px',
      color: '#aaaaaa',
      fontFamily: 'sans-serif'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.hide());
    this.container.add(closeBtn);

    // Title
    this.titleText = this.scene.add.text(boxX + boxW / 2, boxY + 40, 'GOLDEN AGE EXCAVATION', {
      fontFamily: '"Cinzel", serif',
      fontSize: '20px',
      color: '#d4a017'
    }).setOrigin(0.5);
    this.container.add(this.titleText);

    const descText = this.scene.add.text(boxX + boxW / 2, boxY + 80, 'Pool clicks with the community to\nuncover a massive artifact cache!', {
      fontFamily: '"Georgia", serif',
      fontSize: '14px',
      color: '#cccccc',
      align: 'center'
    }).setOrigin(0.5);
    this.container.add(descText);

    // Progress Bar
    const pbW = boxW * 0.8;
    const pbH = 20;
    const pbX = boxX + boxW / 2 - pbW / 2;
    const pbY = boxY + 130;
    
    this.progressBarBg = this.scene.add.rectangle(pbX, pbY, pbW, pbH, 0x000000).setOrigin(0);
    this.progressBarBg.setStrokeStyle(1, 0x555555);
    this.container.add(this.progressBarBg);
    
    this.progressBarFill = this.scene.add.rectangle(pbX + 2, pbY + 2, 0, pbH - 4, 0xd4a017).setOrigin(0);
    this.container.add(this.progressBarFill);
    
    this.progressText = this.scene.add.text(boxX + boxW / 2, pbY + pbH / 2, '0 / 100,000', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ffffff'
    }).setOrigin(0.5);
    this.container.add(this.progressText);

    // Clicker Button (Emoji Pickaxe for now)
    this.pickaxeBtn = this.scene.add.text(boxX + boxW / 2, boxY + 250, '⛏️', {
      fontSize: '80px',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    
    this.pickaxeBtn.on('pointerdown', () => this.onClick());
    this.container.add(this.pickaxeBtn);

    // Personal Progress
    this.personalText = this.scene.add.text(boxX + boxW / 2, boxY + 360, 'Your Contributions: 0', {
      fontFamily: '"Georgia", serif',
      fontSize: '16px',
      color: '#aaaacc'
    }).setOrigin(0.5);
    this.container.add(this.personalText);

    const minText = this.scene.add.text(boxX + boxW / 2, boxY + 390, '(You need 100 clicks to qualify for loot)', {
      fontFamily: '"Georgia", serif',
      fontSize: '12px',
      color: '#ff6666'
    }).setOrigin(0.5);
    this.container.add(minText);
  }

  private onClick() {
    this.unsyncedClicks++;
    this.personalClicks++;
    this.globalClicks++;
    
    // Animation
    this.scene.tweens.add({
      targets: this.pickaxeBtn,
      scale: 0.8,
      yoyo: true,
      duration: 50,
    });
    
    // Spawn floating number
    const floatText = this.scene.add.text(this.pickaxeBtn.x + (Math.random() * 40 - 20), this.pickaxeBtn.y - 40, '+1', {
      fontSize: '20px',
      color: '#d4a017'
    }).setOrigin(0.5).setDepth(301);
    
    this.scene.tweens.add({
      targets: floatText,
      y: floatText.y - 50,
      alpha: 0,
      duration: 800,
      onComplete: () => floatText.destroy()
    });

    this.updateUI();
  }

  private updateUI() {
    const TARGET = 100000;
    const progress = Math.min(this.globalClicks / TARGET, 1);
    
    const pbW = this.progressBarBg.width - 4;
    this.progressBarFill.width = Math.max(pbW * progress, 0);
    this.progressText.setText(`${this.globalClicks.toLocaleString()} / 100,000`);
    
    this.personalText.setText(`Your Contributions: ${this.personalClicks}`);
    if (this.personalClicks >= 100) {
      this.personalText.setColor('#88ff88');
    }
  }

  public show() {
    this.isVisible = true;
    this.container.setVisible(true);
    // Initial sync
    this.syncClicks();
  }

  public hide() {
    this.isVisible = false;
    this.container.setVisible(false);
    // Force a sync when closing if we have pending clicks
    if (this.unsyncedClicks > 0) {
      this.syncClicks();
    }
  }

  private async syncClicks() {
    if (!this.isVisible && this.unsyncedClicks === 0) return;
    
    const clicksToSend = this.unsyncedClicks;
    this.unsyncedClicks = 0; // Reset early to avoid double-counting while fetching
    
    try {
      const res = await fetch('/api/clicker/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clicks: clicksToSend })
      });
      
      const data = await res.json() as any;
      if (data.ok) {
        this.globalClicks = data.globalClicks;
        this.personalClicks = data.personalClicks;
        this.updateUI();
        
        if (data.goldenAgeTriggered) {
          this.triggerCelebration();
        }
      }
    } catch (e) {
      // Revert unsynced clicks if it failed so we can try again
      this.unsyncedClicks += clicksToSend;
      console.error('Failed to sync clicks', e);
    }
  }

  private triggerCelebration() {
    // Basic pinata celebration effect
    const { width, height } = this.scene.scale;
    
    for (let i = 0; i < 50; i++) {
      const color = Phaser.Utils.Array.GetRandom(['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff']);
      const confetti = this.scene.add.rectangle(width / 2, height / 2, 8, 8, Phaser.Display.Color.HexStringToColor(color).color).setDepth(400);
      
      this.scene.tweens.add({
        targets: confetti,
        x: width / 2 + (Math.random() - 0.5) * 400,
        y: height + 50,
        angle: Math.random() * 360,
        duration: 1000 + Math.random() * 1000,
        ease: 'Cubic.easeOut',
        onComplete: () => confetti.destroy()
      });
    }
    
    this.scene.time.delayedCall(2000, () => {
      this.hide();
      if (this.onGoldenAgeTriggered) {
        this.onGoldenAgeTriggered();
      }
    });
  }
}
