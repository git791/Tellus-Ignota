import { redis, reddit, context } from '@devvit/web/server';

export type GameType = 'Anagram' | 'Riddle' | 'Pattern' | 'Trivia' | 'Math';

export interface DailyGame {
  id: string;
  date: string;
  type: GameType;
  question: string;
  answer: string;
  options?: string[]; // For multiple choice or pattern
}

const GAME_TYPES: GameType[] = [
  'Anagram', 'Riddle', 'Pattern', 'Trivia', 'Math'
];

/**
 * Ensures a daily game is generated for today. Returns the game.
 * Uses lazy generation: the first request of the day generates it for everyone.
 */
export async function getOrGenerateDailyGame(): Promise<DailyGame> {
  const today = new Date().toISOString().slice(0, 10);
  const key = `daily_game:${today}`;
  
  const existing = await redis.get(key);
  if (existing) {
    return JSON.parse(existing) as DailyGame;
  }
  
  // Need to generate one
  const typeIndex = Math.floor(Math.random() * GAME_TYPES.length);
  const type = GAME_TYPES[typeIndex] as GameType;
  
  let question = '';
  let answer = '';
  let options: string[] | undefined = undefined;

  // Static fallback generator for now
  switch (type) {
    case 'Anagram':
      const words = ['FOREST', 'CARTOGRAPHER', 'ARTIFACT', 'MOUNTAIN', 'DESERT'];
      const word = words[Math.floor(Math.random() * words.length)] ?? 'FOREST';
      answer = word;
      question = word.split('').sort(() => Math.random() - 0.5).join('');
      break;
    case 'Trivia':
      question = "What is the study of maps and map-making called?";
      answer = "cartography";
      break;
    case 'Math':
      const a = Math.floor(Math.random() * 20) + 10;
      const b = Math.floor(Math.random() * 20) + 10;
      question = `What is ${a} + ${b}?`;
      answer = (a + b).toString();
      break;

    case 'Riddle':
    case 'Daily Riddles':
      const riddles = [
        { q: "I have cities but no houses, mountains but no trees. What am I?", a: "map" },
        { q: "I speak without a mouth and hear without ears.", a: "echo" }
      ];
      const r = riddles[Math.floor(Math.random() * riddles.length)]!;
      question = r.q;
      answer = r.a;
      break;
    case 'Pattern':
      question = "🌲🌲⛰️🌲🌲⛰️🌲🌲?";
      answer = "⛰️";
      options = ["🌲", "⛰️", "🌊", "🏜️"];
      break;
  }

  const newGame: DailyGame = {
    id: `game_${Date.now()}`,
    date: today,
    type,
    question,
    answer,
    options
  };

  await redis.set(key, JSON.stringify(newGame));
  return newGame;
}

/**
 * Validates the user's answer.
 */
export function validateAnswer(game: DailyGame, userResponse: string): boolean {
  if (game.type === 'Math') {
    return userResponse.trim() === game.answer;
  }
  return userResponse.trim().toLowerCase() === game.answer.trim().toLowerCase();
}
