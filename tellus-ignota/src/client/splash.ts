import { requestExpandedMode, context } from '@devvit/web/client';

const startButton = document.getElementById('start-button') as HTMLButtonElement;

startButton.addEventListener('click', (e) => {
  requestExpandedMode(e, 'game');
});

const welcomeElement = document.getElementById('welcome-message') as HTMLParagraphElement;

function init() {
  if (context.username) {
    welcomeElement.textContent = `Welcome back, Cartographer ${context.username}. The fog awaits.`;
  }
}

init();
