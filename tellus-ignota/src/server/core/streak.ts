import { redis } from '@devvit/web/server';

export interface StreakData {
  currentStreak: number;
  lastActionDate: string;
  freezes: number;
}

export function getStreakMilestone(streak: number): string | null {
  if (streak >= 1000) return "Eternal Observer";
  if (streak >= 500) return "Mythic Wayfarer";
  if (streak >= 365) return "Legendary Cartographer";
  if (streak >= 300) return "Master Navigator";
  if (streak >= 250) return "Veteran Scout";
  if (streak >= 200) return "Trailblazer";
  if (streak >= 150) return "Pathfinder";
  if (streak >= 100) return "Dedicated Explorer";
  if (streak >= 50) return "Journey Initiated";
  return null;
}

export async function getStreakData(username: string): Promise<StreakData> {
  const data = await redis.get(`streakData:${username}`);
  if (data) {
    return JSON.parse(data) as StreakData;
  }
  // Default values for new players
  return {
    currentStreak: 0,
    lastActionDate: '',
    freezes: 2 // Start with 2 freezes
  };
}

export async function processStreak(username: string, today: string): Promise<StreakData> {
  const data = await getStreakData(username);

  if (data.lastActionDate === today) {
    // Already acted today, streak doesn't change
    return data;
  }

  if (data.lastActionDate === '') {
    // First time playing ever
    data.currentStreak = 1;
  } else {
    const lastDate = new Date(data.lastActionDate);
    const todayDate = new Date(today);
    
    // Calculate difference in days (ignoring time component, which is stripped by slice(0,10))
    const diffTime = todayDate.getTime() - lastDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // Acted yesterday -> increment streak
      data.currentStreak += 1;
    } else if (diffDays > 1) {
      // Missed one or more days
      const daysMissed = diffDays - 1;
      
      if (data.freezes >= daysMissed) {
        // Has enough freezes to cover the missed days
        data.freezes -= daysMissed;
        data.currentStreak += 1;
      } else {
        // Not enough freezes -> streak resets
        // Since they acted today, they start at streak 1
        data.currentStreak = 1;
        // Keep their remaining freezes, or maybe reset them?
        // Let's keep whatever freezes they had.
      }
    }
  }

  // Freeze regeneration: Every 5-day streak milestone, gain 1 freeze, capped at 2
  if (data.currentStreak > 1 && data.currentStreak % 5 === 0) {
    if (data.freezes < 2) {
      data.freezes += 1;
    }
  }

  data.lastActionDate = today;
  await redis.set(`streakData:${username}`, JSON.stringify(data));

  return data;
}
