import type { LeaderboardEntry, LeaderboardResponse, ProfileResponse } from '../../shared/api';

export class ProgressionModal {
  private overlay: HTMLElement;
  private tabLeaderboard: HTMLElement;
  private tabProfile: HTMLElement;
  private contentLeaderboard: HTMLElement;
  private contentProfile: HTMLElement;
  
  private listLeaderboard: HTMLElement;
  private profName: HTMLElement;
  private profStats: HTMLElement;
  private profArtifacts: HTMLElement;
  private profSkins: HTMLElement;
  
  private closeBtn: HTMLElement;
  
  private activeSkin: number = 0;
  private unlockedSkins: number[] = [0];

  constructor() {
    this.overlay = document.getElementById('progression-overlay') as HTMLElement;
    this.tabLeaderboard = document.getElementById('tab-leaderboard') as HTMLElement;
    this.tabProfile = document.getElementById('tab-profile') as HTMLElement;
    this.contentLeaderboard = document.getElementById('prog-content-leaderboard') as HTMLElement;
    this.contentProfile = document.getElementById('prog-content-profile') as HTMLElement;
    
    this.listLeaderboard = document.getElementById('leaderboard-list') as HTMLElement;
    this.profName = document.getElementById('prof-name') as HTMLElement;
    this.profStats = document.getElementById('prof-stats') as HTMLElement;
    this.profArtifacts = document.getElementById('prof-artifacts') as HTMLElement;
    this.profSkins = document.getElementById('prof-skins') as HTMLElement;
    
    this.closeBtn = document.getElementById('prog-close') as HTMLElement;

    // Events
    this.tabLeaderboard.addEventListener('click', () => this.switchTab('leaderboard'));
    this.tabProfile.addEventListener('click', () => this.switchTab('profile'));
    this.closeBtn.addEventListener('click', () => this.hide());
  }

  public setSkinData(activeSkin: number, unlockedSkins: number[]) {
    this.activeSkin = activeSkin;
    this.unlockedSkins = unlockedSkins;
    this.renderSkins();
  }

  public async show() {
    this.overlay.style.display = 'flex';
    this.switchTab('leaderboard');
    
    // Fetch data in parallel
    this.listLeaderboard.innerHTML = 'Loading...';
    
    try {
      const [lbRes, profRes] = await Promise.all([
        fetch('/api/leaderboard').then(r => r.json() as Promise<LeaderboardResponse>),
        fetch('/api/profile').then(r => r.json() as Promise<ProfileResponse>)
      ]);

      if (lbRes.ok) {
        this.renderLeaderboard(lbRes.entries);
      } else {
        this.listLeaderboard.innerHTML = 'Failed to load leaderboard.';
      }

      if (profRes.ok) {
        this.renderProfile(profRes);
      }
    } catch (e) {
      this.listLeaderboard.innerHTML = 'Error loading data.';
    }
  }

  public hide() {
    this.overlay.style.display = 'none';
  }

  private switchTab(tab: 'leaderboard' | 'profile') {
    if (tab === 'leaderboard') {
      this.tabLeaderboard.classList.add('active');
      this.tabProfile.classList.remove('active');
      this.contentLeaderboard.style.display = 'block';
      this.contentProfile.style.display = 'none';
    } else {
      this.tabLeaderboard.classList.remove('active');
      this.tabProfile.classList.add('active');
      this.contentLeaderboard.style.display = 'none';
      this.contentProfile.style.display = 'block';
    }
  }

  private renderLeaderboard(entries: LeaderboardEntry[]) {
    this.listLeaderboard.innerHTML = '';
    if (entries.length === 0) {
      this.listLeaderboard.innerHTML = 'No explorers have ventured out yet.';
      return;
    }

    entries.forEach(entry => {
      const div = document.createElement('div');
      div.className = 'lb-entry';
      
      const rank = document.createElement('span');
      rank.className = 'lb-rank';
      rank.innerText = `#${entry.rank}`;
      
      const name = document.createElement('span');
      name.className = 'lb-name';
      name.innerText = `u/${entry.username}`;
      
      const score = document.createElement('span');
      score.className = 'lb-score';
      score.innerText = `${entry.score} pts`;
      
      div.appendChild(rank);
      div.appendChild(name);
      div.appendChild(score);
      this.listLeaderboard.appendChild(div);
    });
  }

  private renderProfile(prof: ProfileResponse) {
    if (!prof.ok) return;
    this.profName.innerText = `u/${prof.username}`;
    let streakDisplay = '';
    if (prof.streak > 0) {
      streakDisplay = ` | 🔥 Streak: ${prof.streak} days`;
      if (prof.streakMilestone) {
        streakDisplay += ` (${prof.streakMilestone})`;
      }
    }
    this.profStats.innerText = `Rank: #${prof.rank > 0 ? prof.rank : '--'} | Score: ${prof.score} pts${streakDisplay}`;
    
    if (prof.artifacts && prof.artifacts.length > 0) {
      this.profArtifacts.innerHTML = '';
      prof.artifacts.forEach(aid => {
        const item = document.createElement('div');
        item.style.padding = '4px 0';
        item.style.borderBottom = '1px solid #333';
        let icon = '📜';
        if (aid.includes('stone') || aid.includes('gem')) icon = '💎';
        if (aid.includes('compass') || aid.includes('key')) icon = '🗝️';
        if (aid.includes('map') || aid.includes('chart')) icon = '🗺️';
        item.innerText = `${icon} ${aid.replace(/_/g, ' ').toUpperCase()}`;
        this.profArtifacts.appendChild(item);
      });
    } else {
      this.profArtifacts.innerText = 'No artifacts found yet. Keep exploring!';
    }
  }

  private renderSkins() {
    this.profSkins.innerHTML = '';
    const skins = [
      { id: 0, name: 'Novice (Default)', color: '#ffffff' },
      { id: 1, name: 'Explorer (Bronze)', color: '#cd7f32' },
      { id: 2, name: 'Trailblazer (Silver)', color: '#c0c0c0' },
      { id: 3, name: 'Master (Gold)', color: '#ffd700' },
      { id: 4, name: 'Legend (Amethyst)', color: '#9966cc' },
    ];

    skins.forEach(skin => {
      const isUnlocked = this.unlockedSkins.includes(skin.id);
      const isActive = this.activeSkin === skin.id;

      const btn = document.createElement('button');
      btn.className = 'skin-btn';
      if (!isUnlocked) btn.classList.add('locked');
      if (isActive) btn.classList.add('active-skin');
      
      btn.style.borderLeft = `8px solid ${skin.color}`;
      
      btn.innerHTML = `
        <span class="skin-name">${skin.name}</span>
        <span class="skin-status">${isActive ? 'Equipped' : isUnlocked ? 'Equip' : 'Locked'}</span>
      `;

      if (isUnlocked && !isActive) {
        btn.addEventListener('click', async () => {
          btn.innerHTML = 'Equipping...';
          const res = await fetch('/api/set-skin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skinId: skin.id })
          });
          const data = await res.json();
          if (data.ok) {
            this.activeSkin = skin.id;
            this.renderSkins();
            // Fire an event so MapScene can update immediately without reload
            window.dispatchEvent(new CustomEvent('skin-changed', { detail: skin.id }));
          } else {
            btn.innerHTML = 'Error';
          }
        });
      }
      this.profSkins.appendChild(btn);
    });
  }
}
