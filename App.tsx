
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Difficulty, DIFFICULTIES, Cell, GameStatus, Score, HintResponse } from './types';
import { createEmptyBoard, initializeGame, revealCell, checkWin, getAlgorithmicHint, chordReveal } from './utils/gameLogic';
import { 
  Trophy, 
  Flag, 
  Bomb, 
  RotateCcw, 
  Clock, 
  Lightbulb, 
  ChevronUp,
  Settings,
  XCircle,
  CheckCircle2,
  MousePointer2,
  Heart,
  Zap
} from 'lucide-react';

const App: React.FC = () => {
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.EASY);
  const [board, setBoard] = useState<Cell[][]>([]);
  const [gameStatus, setGameStatus] = useState<GameStatus>('idle');
  const [timer, setTimer] = useState(0);
  const [flagsUsed, setFlagsUsed] = useState(0);
  const [scores, setScores] = useState<Score[]>([]);
  const [isScoresOpen, setIsScoresOpen] = useState(false);
  const [hint, setHint] = useState<HintResponse | null>(null);
  const [hintHighlight, setHintHighlight] = useState<{ r: number, c: number } | null>(null);
  const [isFlagMode, setIsFlagMode] = useState(false);
  const [lives, setLives] = useState(3);
  const [pendingMine, setPendingMine] = useState<{ r: number, c: number } | null>(null);

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const savedScores = localStorage.getItem('minesweeper_scores');
    if (savedScores) {
      setScores(JSON.parse(savedScores));
    }
    resetGame(Difficulty.EASY);
  }, []);

  const resetGame = useCallback((diff: Difficulty = difficulty) => {
    setDifficulty(diff);
    setBoard(createEmptyBoard(DIFFICULTIES[diff]));
    setGameStatus('idle');
    setTimer(0);
    setFlagsUsed(0);
    setHint(null);
    setHintHighlight(null);
    setIsFlagMode(false);
    setLives(3);
    setPendingMine(null);
    if (timerRef.current) window.clearInterval(timerRef.current);
  }, [difficulty]);

  useEffect(() => {
    if (gameStatus === 'playing') {
      timerRef.current = window.setInterval(() => {
        setTimer(t => t + 1);
      }, 1000);
    } else {
      if (timerRef.current) window.clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [gameStatus]);

  const toggleFlag = (r: number, c: number) => {
    if (['won', 'lost', 'hit_mine'].includes(gameStatus) || board[r][c].isRevealed) return;

    const newBoard = board.map(row => 
      row.map(cell => 
        cell.row === r && cell.col === c 
          ? { ...cell, isFlagged: !cell.isFlagged } 
          : cell
      )
    );
    
    setFlagsUsed(prev => board[r][c].isFlagged ? prev - 1 : prev + 1);
    setBoard(newBoard);
  };

  const handleHitMine = (r: number, c: number) => {
    const newLives = lives - 1;
    setLives(newLives);
    
    // Mark the mine as exploded
    const updatedBoard = board.map(row => row.map(cell => 
      cell.row === r && cell.col === c ? { ...cell, isRevealed: true, exploded: true } : cell
    ));
    setBoard(updatedBoard);

    if (newLives > 0) {
      setGameStatus('hit_mine');
      setPendingMine({ r, c });
    } else {
      // Reveal all mines on final death
      const revealedBoard = updatedBoard.map(row => 
        row.map(cell => ({ ...cell, isRevealed: cell.isMine ? true : cell.isRevealed }))
      );
      setBoard(revealedBoard);
      setGameStatus('lost');
    }
  };

  const handleCellClick = (r: number, c: number) => {
    if (['won', 'lost', 'hit_mine'].includes(gameStatus)) return;

    // Chording logic: if clicking a revealed number
    if (board[r][c].isRevealed && !board[r][c].isMine) {
      const { updatedBoard, hitMine } = chordReveal(board, r, c);
      setBoard(updatedBoard);
      if (hitMine) {
        // Find which mine was hit during chording
        // Actually, chordReveal needs to tell us WHICH mine. Let's simplify and just find one.
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < board.length && nc >= 0 && nc < board[0].length) {
              if (board[nr][nc].isMine && !board[nr][nc].isFlagged && !board[nr][nc].isRevealed) {
                handleHitMine(nr, nc);
                return;
              }
            }
          }
        }
      }
      if (checkWin(updatedBoard, DIFFICULTIES[difficulty])) {
        setGameStatus('won');
        saveScore(timer);
      }
      return;
    }

    if (isFlagMode) {
      toggleFlag(r, c);
      return;
    }

    if (board[r][c].isFlagged) return;

    let currentBoard = board;
    if (gameStatus === 'idle') {
      currentBoard = initializeGame(DIFFICULTIES[difficulty], r, c);
      setGameStatus('playing');
    }

    if (currentBoard[r][c].isMine) {
      handleHitMine(r, c);
      return;
    }

    const newBoard = revealCell(currentBoard, r, c);
    setBoard(newBoard);

    if (checkWin(newBoard, DIFFICULTIES[difficulty])) {
      setGameStatus('won');
      saveScore(timer);
    }
    
    if (hintHighlight && hintHighlight.r === r && hintHighlight.c === c) {
      setHint(null);
      setHintHighlight(null);
    }
  };

  const handleContinue = () => {
    setGameStatus('playing');
    setPendingMine(null);
  };

  const handleRightClick = (e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault();
    toggleFlag(r, c);
  };

  const saveScore = (time: number) => {
    const newScore: Score = { difficulty, time, date: new Date().toLocaleDateString() };
    const updatedScores = [...scores, newScore].sort((a, b) => a.time - b.time).slice(0, 10);
    setScores(updatedScores);
    localStorage.setItem('minesweeper_scores', JSON.stringify(updatedScores));
  };

  const handleHint = () => {
    if (gameStatus !== 'playing') return;
    const suggestion = getAlgorithmicHint(board);
    if (suggestion) {
      setHint(suggestion);
      setHintHighlight({ r: suggestion.row, c: suggestion.col });
      setTimeout(() => setHintHighlight(null), 5000);
    }
  };

  const settings = DIFFICULTIES[difficulty];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-900 overflow-auto">
      <div className="max-w-4xl w-full flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-500 p-3 rounded-xl">
              <Bomb className="text-white w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Minesweeper Pro</h1>
              <p className="text-slate-400 text-sm">Classic Gameplay • Automated Logic • 3 Lives</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {(Object.keys(DIFFICULTIES) as Difficulty[]).map((diff) => (
              <button
                key={diff}
                onClick={() => resetGame(diff)}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  difficulty === diff 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' 
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {diff}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Bar */}
        <div className="flex flex-wrap justify-center gap-4 text-white">
          {/* LIVES COUNTER */}
          <div className="flex items-center gap-3 bg-slate-800 px-6 py-3 rounded-xl border border-slate-700 min-w-[140px]">
            <div className="flex gap-1">
              {[...Array(3)].map((_, i) => (
                <Heart key={i} className={`w-5 h-5 ${i < lives ? 'text-rose-500 fill-current' : 'text-slate-600'}`} />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 bg-slate-800 px-6 py-3 rounded-xl border border-slate-700 min-w-[140px]">
            <Flag className="text-rose-500 w-5 h-5" />
            <span className="mono text-xl font-bold">{Math.max(0, settings.mines - flagsUsed)}</span>
          </div>
          
          <div className="flex items-center gap-3 bg-slate-800 px-6 py-3 rounded-xl border border-slate-700 min-w-[140px]">
            <Clock className="text-emerald-500 w-5 h-5" />
            <span className="mono text-xl font-bold">{timer}s</span>
          </div>

          <button 
            onClick={() => setIsFlagMode(!isFlagMode)}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl border transition-all font-bold min-w-[160px] ${
              isFlagMode 
              ? 'bg-rose-600 border-rose-500 text-white shadow-lg shadow-rose-500/30' 
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {isFlagMode ? <Flag className="w-5 h-5 fill-current" /> : <MousePointer2 className="w-5 h-5" />}
            {isFlagMode ? "FLAG MODE ON" : "REVEAL MODE"}
          </button>

          <button onClick={() => resetGame()} className="flex items-center gap-2 bg-slate-800 px-6 py-3 rounded-xl border border-slate-700 hover:bg-slate-700/80 transition-all text-indigo-400 font-semibold">
            <RotateCcw className="w-5 h-5" />
            RESET
          </button>
          
          <button onClick={() => setIsScoresOpen(!isScoresOpen)} className="flex items-center gap-2 bg-slate-800 px-6 py-3 rounded-xl border border-slate-700 hover:bg-slate-700/80 transition-all text-amber-400 font-semibold">
            <Trophy className="w-5 h-5" />
            SCORES
          </button>
        </div>

        {/* Game Area */}
        <div className="relative group mx-auto">
          {/* Overlays */}
          {gameStatus === 'won' && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-emerald-500/20 backdrop-blur-sm rounded-xl">
              <div className="bg-slate-900 p-8 rounded-2xl border-2 border-emerald-500 shadow-2xl text-center transform scale-110">
                <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Victory!</h2>
                <p className="text-slate-400 mt-2">Cleared in {timer} seconds</p>
                <button onClick={() => resetGame()} className="mt-6 bg-emerald-600 text-white px-8 py-2 rounded-lg font-bold hover:bg-emerald-500 transition-colors">
                  PLAY AGAIN
                </button>
              </div>
            </div>
          )}

          {gameStatus === 'hit_mine' && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-rose-500/20 backdrop-blur-sm rounded-xl">
              <div className="bg-slate-900 p-8 rounded-2xl border-2 border-rose-500 shadow-2xl text-center max-w-sm">
                <Zap className="w-16 h-16 text-rose-500 mx-auto mb-4 animate-pulse" />
                <h2 className="text-3xl font-black text-white uppercase">Boom!</h2>
                <p className="text-slate-400 mt-2 italic">You hit a mine, but you have {lives} {lives === 1 ? 'life' : 'lives'} left.</p>
                <div className="flex gap-4 mt-6">
                  <button onClick={handleContinue} className="flex-1 bg-indigo-600 text-white px-4 py-3 rounded-lg font-bold hover:bg-indigo-500 transition-colors">
                    CONTINUE
                  </button>
                  <button onClick={() => resetGame()} className="flex-1 bg-slate-700 text-white px-4 py-3 rounded-lg font-bold hover:bg-slate-600 transition-colors">
                    RESTART
                  </button>
                </div>
              </div>
            </div>
          )}

          {gameStatus === 'lost' && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-rose-500/20 backdrop-blur-sm rounded-xl">
              <div className="bg-slate-900 p-8 rounded-2xl border-2 border-rose-500 shadow-2xl text-center">
                <XCircle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
                <h2 className="text-3xl font-black text-white">GAME OVER</h2>
                <p className="text-slate-400 mt-2 italic">Sorry, you lost. No lives remaining.</p>
                <button onClick={() => resetGame()} className="mt-6 bg-rose-600 text-white px-8 py-2 rounded-lg font-bold hover:bg-rose-500 transition-colors w-full">
                  RESTART GAME
                </button>
              </div>
            </div>
          )}

          {/* Grid */}
          <div 
            className="bg-slate-800 p-3 rounded-xl shadow-2xl border border-slate-700 select-none overflow-auto max-h-[70vh] max-w-full"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${settings.cols}, minmax(32px, 1fr))`,
              gap: '2px',
              width: 'fit-content'
            }}
          >
            {board.map((row, r) => 
              row.map((cell, c) => (
                <div
                  key={`${r}-${c}`}
                  onClick={() => handleCellClick(r, c)}
                  onContextMenu={(e) => handleRightClick(e, r, c)}
                  className={`
                    w-8 h-8 md:w-10 md:h-10 flex items-center justify-center text-lg font-bold cursor-pointer rounded-sm
                    transition-all duration-150 relative
                    ${cell.isRevealed 
                      ? cell.exploded ? 'bg-rose-900 shadow-inner' : 'bg-slate-700/50 text-slate-200' 
                      : 'bg-slate-600 hover:bg-slate-500 shadow-[inset_0_2px_4px_rgba(255,255,255,0.1)] active:scale-95'}
                    ${hintHighlight?.r === r && hintHighlight?.c === c ? 'ring-4 ring-amber-400 ring-inset z-[5]' : ''}
                  `}
                >
                  {cell.isRevealed ? (
                    cell.isMine ? (
                      <Bomb className={`w-6 h-6 ${cell.exploded ? 'text-white' : 'text-rose-500'}`} />
                    ) : cell.neighborCount > 0 ? (
                      <span className={getNumberColor(cell.neighborCount)}>
                        {cell.neighborCount}
                      </span>
                    ) : null
                  ) : cell.isFlagged ? (
                    <Flag className="w-5 h-5 text-rose-500 fill-current" />
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Algorithmic Hint Panel */}
        <div className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="bg-amber-500/10 p-2 rounded-lg">
                <Lightbulb className="text-amber-500 w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Smart Hint System</h3>
            </div>
            <button
              onClick={handleHint}
              disabled={gameStatus !== 'playing'}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all ${
                gameStatus !== 'playing'
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-amber-600 text-white hover:bg-amber-500 shadow-lg shadow-amber-500/20'
              }`}
            >
              GET HINT
            </button>
          </div>
          
          {hint ? (
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
              <div className="flex items-start gap-4">
                <div className={`p-2 rounded-lg ${hint.action === 'reveal' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                   <span className="font-black text-sm uppercase tracking-widest">{hint.action}</span>
                </div>
                <div>
                  <p className="text-slate-200 font-semibold">Row {hint.row}, Col {hint.col}</p>
                  <p className="text-slate-400 text-sm mt-1">{hint.reason}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-slate-500 text-sm italic">Stuck? The local solver can find the next logical move.</p>
          )}
        </div>

        {/* Scores */}
        {isScoresOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-800 w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                <div className="flex items-center gap-2">
                  <Trophy className="text-amber-500 w-6 h-6" />
                  <h3 className="text-xl font-bold text-white">High Scores</h3>
                </div>
                <button onClick={() => setIsScoresOpen(false)} className="text-slate-400 hover:text-white">
                   <ChevronUp className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 max-h-96 overflow-auto">
                {scores.length > 0 ? (
                  <div className="space-y-3">
                    {scores.map((s, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-700">
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500 font-bold">#{idx + 1}</span>
                          <div>
                            <p className="text-white font-semibold text-sm">{s.difficulty}</p>
                            <p className="text-slate-500 text-xs">{s.date}</p>
                          </div>
                        </div>
                        <span className="text-amber-400 font-bold mono text-lg">{s.time}s</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-slate-500 py-8">No records yet.</p>
                )}
                <button onClick={() => setIsScoresOpen(false)} className="w-full mt-6 py-3 bg-slate-700 text-white rounded-xl font-bold hover:bg-slate-600">
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-8 text-slate-500 text-xs flex gap-6 opacity-60">
        <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> CLICK NUMBER TO CHORD</span>
        <span className="flex items-center gap-1"><Settings className="w-3 h-3" /> LEFT-CLICK TO REVEAL</span>
        <span className="flex items-center gap-1"><Flag className="w-3 h-3" /> RIGHT-CLICK TO FLAG</span>
      </div>
    </div>
  );
};

const getNumberColor = (num: number): string => {
  const colors: Record<number, string> = {
    1: 'text-blue-400', 2: 'text-emerald-400', 3: 'text-rose-400', 4: 'text-violet-400',
    5: 'text-amber-400', 6: 'text-cyan-400', 7: 'text-pink-400', 8: 'text-slate-300',
  };
  return colors[num] || 'text-white';
};

export default App;
