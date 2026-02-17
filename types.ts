
export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD'
}

export type DifficultySettings = {
  rows: number;
  cols: number;
  mines: number;
}

export const DIFFICULTIES: Record<Difficulty, DifficultySettings> = {
  [Difficulty.EASY]: { rows: 9, cols: 9, mines: 10 },
  [Difficulty.MEDIUM]: { rows: 16, cols: 16, mines: 40 },
  [Difficulty.HARD]: { rows: 16, cols: 30, mines: 99 }
};

export type CellValue = number | 'M'; // M for Mine

export interface Cell {
  row: number;
  col: number;
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  neighborCount: number;
  exploded?: boolean; // New property to track which mine killed the player
}

export type GameStatus = 'idle' | 'playing' | 'won' | 'lost' | 'hit_mine';

export interface Score {
  difficulty: Difficulty;
  time: number;
  date: string;
}

export interface HintResponse {
  row: number;
  col: number;
  action: 'reveal' | 'flag';
  reason: string;
}
