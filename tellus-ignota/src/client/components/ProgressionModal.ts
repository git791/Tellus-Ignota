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
  
  private closeBtn: HTMLElement;

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
    
    this.closeBtn = document.getElementById('prog-close') as HTMLElement;

    // Events
    this.tabLeaderboard.addEventListener('click', () => this.switchTab('leaderboard'));
    this.tabProfile.addEventListener('click', () => this.switchTab('profile'));
    this.closeBtn.addEventListener('click', () => this.hide());
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
    
    if (prof.artifacts.length === 0) {
      this.profArtifacts.innerText = 'No artifacts found yet. Keep exploring!';
    } else {
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
    }
  }
}
