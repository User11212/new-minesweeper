
import { Cell, DifficultySettings, HintResponse } from '../types';

export const createEmptyBoard = (settings: DifficultySettings): Cell[][] => {
  const board: Cell[][] = [];
  for (let r = 0; r < settings.rows; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < settings.cols; c++) {
      row.push({
        row: r,
        col: c,
        isMine: false,
        isRevealed: false,
        isFlagged: false,
        neighborCount: 0,
      });
    }
    board.push(row);
  }
  return board;
};

export const initializeGame = (settings: DifficultySettings, firstClickRow: number, firstClickCol: number): Cell[][] => {
  const board = createEmptyBoard(settings);
  let minesPlaced = 0;

  while (minesPlaced < settings.mines) {
    const r = Math.floor(Math.random() * settings.rows);
    const c = Math.floor(Math.random() * settings.cols);

    const isFirstClickZone = Math.abs(r - firstClickRow) <= 1 && Math.abs(c - firstClickCol) <= 1;

    if (!board[r][c].isMine && !isFirstClickZone) {
      board[r][c].isMine = true;
      minesPlaced++;
    }
  }

  for (let r = 0; r < settings.rows; r++) {
    for (let c = 0; c < settings.cols; c++) {
      if (!board[r][c].isMine) {
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < settings.rows && nc >= 0 && nc < settings.cols && board[nr][nc].isMine) {
              count++;
            }
          }
        }
        board[r][c].neighborCount = count;
      }
    }
  }

  return board;
};

export const revealCell = (board: Cell[][], r: number, c: number): Cell[][] => {
  const newBoard = board.map(row => row.map(cell => ({ ...cell })));
  const rows = newBoard.length;
  const cols = newBoard[0].length;

  const stack: [number, number][] = [[r, c]];

  while (stack.length > 0) {
    const [currR, currC] = stack.pop()!;
    const cell = newBoard[currR][currC];

    if (cell.isRevealed || cell.isFlagged) continue;

    cell.isRevealed = true;

    if (cell.neighborCount === 0 && !cell.isMine) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = currR + dr;
          const nc = currC + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !newBoard[nr][nc].isRevealed) {
            stack.push([nr, nc]);
          }
        }
      }
    }
  }

  return newBoard;
};

export const getNeighbors = (board: Cell[][], r: number, c: number): Cell[] => {
  const neighbors: Cell[] = [];
  const rows = board.length;
  const cols = board[0].length;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        neighbors.push(board[nr][nc]);
      }
    }
  }
  return neighbors;
};

export const chordReveal = (board: Cell[][], r: number, c: number): { updatedBoard: Cell[][], hitMine: boolean } => {
  const cell = board[r][c];
  if (!cell.isRevealed || cell.neighborCount === 0) return { updatedBoard: board, hitMine: false };

  const neighbors = getNeighbors(board, r, c);
  const flagCount = neighbors.filter(n => n.isFlagged).length;

  if (flagCount === cell.neighborCount) {
    let currentBoard = board;
    let mineHitAt: [number, number] | null = null;

    for (const n of neighbors) {
      if (!n.isRevealed && !n.isFlagged) {
        if (n.isMine) {
          mineHitAt = [n.row, n.col];
          break;
        } else {
          currentBoard = revealCell(currentBoard, n.row, n.col);
        }
      }
    }

    if (mineHitAt) {
      return { updatedBoard: currentBoard, hitMine: true };
    }
    return { updatedBoard: currentBoard, hitMine: false };
  }

  return { updatedBoard: board, hitMine: false };
};

export const checkWin = (board: Cell[][], settings: DifficultySettings): boolean => {
  let revealedCount = 0;
  for (let r = 0; r < settings.rows; r++) {
    for (let c = 0; c < settings.cols; c++) {
      if (board[r][c].isRevealed) revealedCount++;
    }
  }
  return revealedCount === (settings.rows * settings.cols - settings.mines);
};

export const getAlgorithmicHint = (board: Cell[][]): HintResponse | null => {
  const rows = board.length;
  const cols = board[0].length;

  // 1. Basic Single-Cell Logic
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = board[r][c];
      if (!cell.isRevealed || cell.neighborCount === 0) continue;

      const neighbors = getNeighbors(board, r, c);
      const hidden = neighbors.filter(n => !n.isRevealed && !n.isFlagged);
      const flagged = neighbors.filter(n => n.isFlagged);

      // If (hidden + flagged) == number, all hidden are mines
      if (hidden.length > 0 && (hidden.length + flagged.length) === cell.neighborCount) {
        return {
          row: hidden[0].row,
          col: hidden[0].col,
          action: 'flag',
          reason: `Logic: Cell (${r},${c}) is a ${cell.neighborCount}. It has ${flagged.length} flags and ${hidden.length} hidden neighbors, which exactly satisfies the count. Thus, this must be a mine.`
        };
      }

      // If flagged == number, all hidden are safe
      if (hidden.length > 0 && flagged.length === cell.neighborCount) {
        return {
          row: hidden[0].row,
          col: hidden[0].col,
          action: 'reveal',
          reason: `Logic: Cell (${r},${c}) is a ${cell.neighborCount}. It already has ${flagged.length} flags around it, so all other adjacent hidden cells are safe.`
        };
      }
    }
  }

  // 2. Random guess fallback (if no logic found)
  const allHidden = board.flat().filter(c => !c.isRevealed && !c.isFlagged);
  if (allHidden.length > 0) {
    const random = allHidden[Math.floor(Math.random() * allHidden.length)];
    return {
      row: random.row,
      col: random.col,
      action: 'reveal',
      reason: "No certain logic found. This is a best-effort guess."
    };
  }

  return null;
};
