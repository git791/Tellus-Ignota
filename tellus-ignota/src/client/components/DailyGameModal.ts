export class DailyGameModal {
  private overlay: HTMLElement;
  private title: HTMLElement;
  private question: HTMLElement;
  private optionsContainer: HTMLElement;
  private input: HTMLInputElement;
  private submitBtn: HTMLButtonElement;
  private errorText: HTMLElement;
  private currentAnswer: string = '';

  public onSuccess?: () => void;

  constructor() {
    this.overlay = document.getElementById('daily-game-overlay') as HTMLElement;
    this.title = document.getElementById('dg-title') as HTMLElement;
    this.question = document.getElementById('dg-question') as HTMLElement;
    this.optionsContainer = document.getElementById('dg-options') as HTMLElement;
    this.input = document.getElementById('dg-input') as HTMLInputElement;
    this.submitBtn = document.getElementById('dg-submit') as HTMLButtonElement;
    this.errorText = document.getElementById('dg-error') as HTMLElement;

    this.submitBtn.addEventListener('click', () => this.submit());
  }

  public async show() {
    this.overlay.style.display = 'flex';
    this.errorText.style.display = 'none';
    this.question.innerText = 'Loading today\'s challenge...';
    this.input.style.display = 'none';
    this.optionsContainer.innerHTML = '';
    this.submitBtn.style.display = 'none';

    try {
      const res = await fetch('/api/daily-game');
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      const game = data.game;
      this.title.innerText = `Daily Challenge: ${game.type}`;
      this.question.innerText = game.question;

      if (game.options && game.options.length > 0) {
        this.input.style.display = 'none';
        this.submitBtn.style.display = 'none';
        game.options.forEach((opt: string) => {
          const btn = document.createElement('button');
          btn.className = 'option-btn';
          btn.innerText = opt;
          btn.onclick = () => {
            this.currentAnswer = opt;
            this.submit();
          };
          this.optionsContainer.appendChild(btn);
        });
      } else if (game.type === 'Reaction' || game.type === 'Memory') {
        // Mock special client-side games by just having a "Complete" button for now
        this.submitBtn.innerText = "Complete Challenge (Mock)";
        this.submitBtn.style.display = 'inline-block';
        this.currentAnswer = 'success';
      } else {
        this.input.style.display = 'inline-block';
        this.input.value = '';
        this.submitBtn.innerText = 'Submit';
        this.submitBtn.style.display = 'inline-block';
      }
    } catch (err) {
      this.question.innerText = 'Failed to load challenge.';
    }
  }

  public hide() {
    this.overlay.style.display = 'none';
  }

  private async submit() {
    const answer = this.input.style.display !== 'none' ? this.input.value : this.currentAnswer;
    
    if (!answer) {
      this.showError('Please provide an answer.');
      return;
    }

    try {
      this.submitBtn.disabled = true;
      const res = await fetch('/api/daily-game/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer })
      });
      const data = await res.json();

      if (data.ok && data.correct) {
        this.hide();
        if (this.onSuccess) this.onSuccess();
      } else {
        this.showError(data.error || 'Incorrect. Try again!');
      }
    } catch (err) {
      this.showError('Submission failed.');
    } finally {
      this.submitBtn.disabled = false;
    }
  }

  private showError(msg: string) {
    this.errorText.innerText = msg;
    this.errorText.style.display = 'block';
  }
}
