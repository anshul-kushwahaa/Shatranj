// CONSTANTS
const initialBoard = [
  ['♜','♞','♝','♛','♚','♝','♞','♜'],
  ['♟','♟','♟','♟','♟','♟','♟','♟'],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['♙','♙','♙','♙','♙','♙','♙','♙'],
  ['♖','♘','♗','♕','♔','♗','♘','♖']
];

const PIECE_VALUES = {
  '♙':1,'♟':1,'♘':3,'♞':3,'♗':3,'♝':3,
  '♖':5,'♜':5,'♕':9,'♛':9,'♔':0,'♚':0
};

const whitePieces = ['♙','♖','♘','♗','♕','♔'];
const blackPieces = ['♟','♜','♞','♝','♛','♚'];

// STATE

let gameBoard = [];
let selectedSquare = null;
let currentTurn = 'white';
let gameMode = '';
let botDifficulty = '';
let capturedByWhite = [];
let capturedByBlack = [];
let moveHistory = [];
let boardHistory = [];
let enPassantTarget = null;
let castlingRights = {};
let lastMove = null;
let flipped = false;
let soundEnabled = true;
let gameOver = false;
let whiteTime = 600;
let blackTime = 600;
let timerInterval = null;

// AUDIO

let audioCtx = null;

function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playSound(type) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudio();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t = ctx.currentTime;
    if (type === 'move')     { osc.frequency.value = 440; gain.gain.setValueAtTime(0.2, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1); osc.start(); osc.stop(t + 0.1); }
    if (type === 'capture')  { osc.frequency.value = 220; gain.gain.setValueAtTime(0.4, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2); osc.start(); osc.stop(t + 0.2); }
    if (type === 'check')    { osc.frequency.value = 660; gain.gain.setValueAtTime(0.3, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3); osc.start(); osc.stop(t + 0.3); }
    if (type === 'gameover') { osc.frequency.value = 180; gain.gain.setValueAtTime(0.5, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6); osc.start(); osc.stop(t + 0.6); }
  } catch(e) {}
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  document.getElementById('sound-btn').textContent = soundEnabled ? '🔊' : '🔇';
}

// SCREENS

function showHome() {
  clearInterval(timerInterval);
  document.getElementById('home-screen').classList.remove('hidden');
  document.getElementById('difficulty-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.add('hidden');
  document.getElementById('gameover-screen').classList.add('hidden');
}

function showDifficulty() {
  document.getElementById('home-screen').classList.add('hidden');
  document.getElementById('difficulty-screen').classList.remove('hidden');
}

function startGame(mode, difficulty) {
  gameMode = mode;
  botDifficulty = difficulty || '';
  currentTurn = 'white';
  selectedSquare = null;
  gameOver = false;
  capturedByWhite = [];
  capturedByBlack = [];
  moveHistory = [];
  boardHistory = [];
  enPassantTarget = null;
  castlingRights = { whiteKing: true, whiteQueen: true, blackKing: true, blackQueen: true };
  lastMove = null;
  flipped = false;
  whiteTime = 600;
  blackTime = 600;
  clearInterval(timerInterval);

  document.getElementById('home-screen').classList.add('hidden');
  document.getElementById('difficulty-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.remove('hidden');
  document.getElementById('gameover-screen').classList.add('hidden');
  document.getElementById('move-list').innerHTML = '';
  document.getElementById('black-captured').textContent = '—';
  document.getElementById('white-captured').textContent = '—';
  document.getElementById('material-score').textContent = 'Equal';

  gameBoard = initialBoard.map(r => [...r]);
  createBoard();
  updateStatus();
  startTimer();
}

// TIMER

function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (gameOver) { clearInterval(timerInterval); return; }
    if (currentTurn === 'white') whiteTime--;
    else blackTime--;
    updateTimerDisplay();
    if (whiteTime <= 0) { clearInterval(timerInterval); showGameOver('Black wins on time!'); }
    if (blackTime <= 0) { clearInterval(timerInterval); showGameOver('White wins on time!'); }
  }, 1000);
}

function formatTime(s) {
  return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
}

function updateTimerDisplay() {
  const wt = document.getElementById('white-timer');
  const bt = document.getElementById('black-timer');
  wt.textContent = formatTime(whiteTime);
  bt.textContent = formatTime(blackTime);
  wt.className = 'timer' + (currentTurn === 'white' ? ' active-timer' : '');
  bt.className = 'timer' + (currentTurn === 'black' ? ' active-timer' : '');
}

// BOARD RENDERING

function createBoard() {
  const board = document.getElementById('board');
  board.innerHTML = '';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const dr = flipped ? 7 - r : r;
      const dc = flipped ? 7 - c : c;
      const sq = document.createElement('div');
      sq.classList.add('square', (r + c) % 2 === 0 ? 'light' : 'dark');
      sq.dataset.row = dr;
      sq.dataset.col = dc;

      if (c === 0) {
        const rank = document.createElement('span');
        rank.classList.add('coord-rank');
        rank.textContent = flipped ? r + 1 : 8 - r;
        sq.appendChild(rank);
      }
      if (r === 7) {
        const file = document.createElement('span');
        file.classList.add('coord-file');
        file.textContent = String.fromCharCode(97 + dc);
        sq.appendChild(file);
      }

      const pieceEl = document.createElement('span');
      pieceEl.classList.add('piece');
      const piece = gameBoard[dr][dc];
      pieceEl.textContent = piece;
      if (isWhite(piece)) pieceEl.classList.add('white-piece');
      else if (isBlack(piece)) pieceEl.classList.add('black-piece');
      sq.appendChild(pieceEl);

      sq.addEventListener('click', onSquareClick);
      board.appendChild(sq);
    }
  }
  updateTimerDisplay();
}

function renderBoard() {
  document.querySelectorAll('.square').forEach(sq => {
    const row = parseInt(sq.dataset.row);
    const col = parseInt(sq.dataset.col);
    const piece = gameBoard[row][col];
    const pieceEl = sq.querySelector('.piece');
    if (pieceEl) {
      pieceEl.textContent = piece;
      pieceEl.className = 'piece';
      if (isWhite(piece)) pieceEl.classList.add('white-piece');
      else if (isBlack(piece)) pieceEl.classList.add('black-piece');
    }
    sq.classList.remove('selected', 'legal-move', 'last-move');
    if (lastMove) {
      if ((row === lastMove.fromRow && col === lastMove.fromCol) ||
          (row === lastMove.toRow   && col === lastMove.toCol))
        sq.classList.add('last-move');
    }
  });
}

// HELPERS

function isWhite(p) { return whitePieces.includes(p); }
function isBlack(p) { return blackPieces.includes(p); }
function isCurrentPlayer(p) { return currentTurn === 'white' ? isWhite(p) : isBlack(p); }
function isEnemy(p, t) { return !!t && ((isWhite(p) && isBlack(t)) || (isBlack(p) && isWhite(t))); }
function isEmpty(r, c) { return gameBoard[r][c] === ''; }
function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

// MOVE GENERATION

function getLegalMoves(row, col) {
  const piece = gameBoard[row][col];
  let moves = getRaw(row, col);
  if (piece === '♔' || piece === '♚') moves = [...moves, ...getCastlingMoves()];
  if (piece === '♙' || piece === '♟') moves = [...moves, ...getEnPassantMoves(row, col)];
  return moves.filter(([r, c]) => !leavesInCheck(row, col, r, c));
}

function getRaw(row, col) {
  const p = gameBoard[row][col];
  if (p === '♙') return getPawnMoves(row, col, 'white');
  if (p === '♟') return getPawnMoves(row, col, 'black');
  if (p === '♖' || p === '♜') return rookMoves(row, col);
  if (p === '♘' || p === '♞') return knightMoves(row, col);
  if (p === '♗' || p === '♝') return bishopMoves(row, col);
  if (p === '♕' || p === '♛') return [...rookMoves(row,col),...bishopMoves(row,col)];
  if (p === '♔' || p === '♚') return kingMoves(row, col);
  return [];
}

function getPawnMoves(row, col, color) {
  const moves = [], dir = color === 'white' ? -1 : 1, start = color === 'white' ? 6 : 1;
  const p = gameBoard[row][col];
  if (inBounds(row+dir, col) && isEmpty(row+dir, col)) {
    moves.push([row+dir, col]);
    if (row === start && isEmpty(row+2*dir, col)) moves.push([row+2*dir, col]);
  }
  for (const dc of [-1, 1])
    if (inBounds(row+dir, col+dc) && isEnemy(p, gameBoard[row+dir][col+dc]))
      moves.push([row+dir, col+dc]);
  return moves;
}

function getEnPassantMoves(row, col) {
  if (!enPassantTarget) return [];
  const p = gameBoard[row][col], dir = isWhite(p) ? -1 : 1;
  const [er, ec] = enPassantTarget;
  return (row+dir === er && Math.abs(col-ec) === 1) ? [[er, ec]] : [];
}

function getCastlingMoves() {
  const moves = [], color = currentTurn;
  const row = color === 'white' ? 7 : 0;
  const king = color === 'white' ? '♔' : '♚';
  const enemy = color === 'white' ? 'black' : 'white';
  if (gameBoard[row][4] !== king || isAttacked(row, 4, enemy)) return moves;
  if ((color === 'white' ? castlingRights.whiteKing : castlingRights.blackKing))
    if (isEmpty(row,5) && isEmpty(row,6) && !isAttacked(row,5,enemy) && !isAttacked(row,6,enemy))
      moves.push([row, 6]);
  if ((color === 'white' ? castlingRights.whiteQueen : castlingRights.blackQueen))
    if (isEmpty(row,3) && isEmpty(row,2) && isEmpty(row,1) && !isAttacked(row,3,enemy) && !isAttacked(row,2,enemy))
      moves.push([row, 2]);
  return moves;
}

function rookMoves(row, col) {
  const moves = [], p = gameBoard[row][col];
  for (const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
    let r = row+dr, c = col+dc;
    while (inBounds(r,c)) {
      if (isEmpty(r,c)) moves.push([r,c]);
      else { if (isEnemy(p, gameBoard[r][c])) moves.push([r,c]); break; }
      r+=dr; c+=dc;
    }
  }
  return moves;
}

function knightMoves(row, col) {
  const p = gameBoard[row][col];
  return [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]
    .map(([dr,dc]) => [row+dr, col+dc])
    .filter(([r,c]) => inBounds(r,c) && (isEmpty(r,c) || isEnemy(p, gameBoard[r][c])));
}

function bishopMoves(row, col) {
  const moves = [], p = gameBoard[row][col];
  for (const [dr,dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
    let r = row+dr, c = col+dc;
    while (inBounds(r,c)) {
      if (isEmpty(r,c)) moves.push([r,c]);
      else { if (isEnemy(p, gameBoard[r][c])) moves.push([r,c]); break; }
      r+=dr; c+=dc;
    }
  }
  return moves;
}

function kingMoves(row, col) {
  const p = gameBoard[row][col];
  return [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]
    .map(([dr,dc]) => [row+dr, col+dc])
    .filter(([r,c]) => inBounds(r,c) && (isEmpty(r,c) || isEnemy(p, gameBoard[r][c])));
}

// CHECK DETECTION

function findKing(color) {
  const k = color === 'white' ? '♔' : '♚';
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (gameBoard[r][c] === k) return [r, c];
  return null;
}

function isAttacked(row, col, byColor) {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = gameBoard[r][c];
      if (!p) continue;
      if (byColor === 'white' && !isWhite(p)) continue;
      if (byColor === 'black' && !isBlack(p)) continue;
      if (getRaw(r, c).some(([mr,mc]) => mr === row && mc === col)) return true;
    }
  return false;
}

function isInCheck(color) {
  const k = findKing(color);
  return k ? isAttacked(k[0], k[1], color === 'white' ? 'black' : 'white') : false;
}

function leavesInCheck(fr, fc, tr, tc) {
  const sf = gameBoard[fr][fc], st = gameBoard[tr][tc];
  gameBoard[tr][tc] = sf; gameBoard[fr][fc] = '';
  const inCheck = isInCheck(currentTurn);
  gameBoard[fr][fc] = sf; gameBoard[tr][tc] = st;
  return inCheck;
}

function noLegalMoves(color) {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = gameBoard[r][c];
      if (!p) continue;
      if (color === 'white' && !isWhite(p)) continue;
      if (color === 'black' && !isBlack(p)) continue;
      if (getLegalMoves(r, c).length > 0) return false;
    }
  return true;
}

// CLICK HANDLING

function onSquareClick(e) {
  if (gameOver) return;
  if (gameMode === 'bot' && currentTurn === 'black') return;
  const row = parseInt(e.currentTarget.dataset.row);
  const col = parseInt(e.currentTarget.dataset.col);
  const piece = gameBoard[row][col];

  if (selectedSquare) {
    const [sr, sc] = selectedSquare;
    if (getLegalMoves(sr, sc).some(([r,c]) => r === row && c === col)) {
      movePiece(sr, sc, row, col);
      return;
    }
  }

  if (piece && isCurrentPlayer(piece)) {
    selectedSquare = [row, col];
    highlightMoves(row, col);
  } else {
    selectedSquare = null;
    renderBoard();
  }
}

function highlightMoves(row, col) {
  renderBoard();
  document.querySelectorAll('.square').forEach(sq => {
    const r = parseInt(sq.dataset.row), c = parseInt(sq.dataset.col);
    if (r === row && c === col) sq.classList.add('selected');
  });
  getLegalMoves(row, col).forEach(([r, c]) => {
    document.querySelectorAll('.square').forEach(sq => {
      if (parseInt(sq.dataset.row) === r && parseInt(sq.dataset.col) === c)
        sq.classList.add('legal-move');
    });
  });
}

// MOVE EXECUTION

function movePiece(fromRow, fromCol, toRow, toCol, autoPromote = false) {
  const piece = gameBoard[fromRow][fromCol];
  const captured = gameBoard[toRow][toCol];
  let epCapture = false, castle = false;

  boardHistory.push({
    board: gameBoard.map(r => [...r]),
    capturedByWhite: [...capturedByWhite],
    capturedByBlack: [...capturedByBlack],
    enPassantTarget, castlingRights: {...castlingRights},
    currentTurn, lastMove, moveHistory: [...moveHistory]
  });

  // En passant capture
  if ((piece === '♙' || piece === '♟') && enPassantTarget &&
      toRow === enPassantTarget[0] && toCol === enPassantTarget[1] && !captured) {
    const epPiece = gameBoard[fromRow][toCol];
    gameBoard[fromRow][toCol] = '';
    if (currentTurn === 'white') capturedByWhite.push(epPiece);
    else capturedByBlack.push(epPiece);
    epCapture = true;
  }

  // Update en passant target
  if (piece === '♙' && fromRow === 6 && toRow === 4) enPassantTarget = [5, toCol];
  else if (piece === '♟' && fromRow === 1 && toRow === 3) enPassantTarget = [2, toCol];
  else enPassantTarget = null;

  // Castling move rook
  if (piece === '♔' && fromCol === 4) {
    if (toCol === 6) { gameBoard[7][5] = '♖'; gameBoard[7][7] = ''; castle = true; }
    if (toCol === 2) { gameBoard[7][3] = '♖'; gameBoard[7][0] = ''; castle = true; }
    castlingRights.whiteKing = castlingRights.whiteQueen = false;
  }
  if (piece === '♚' && fromCol === 4) {
    if (toCol === 6) { gameBoard[0][5] = '♜'; gameBoard[0][7] = ''; castle = true; }
    if (toCol === 2) { gameBoard[0][3] = '♜'; gameBoard[0][0] = ''; castle = true; }
    castlingRights.blackKing = castlingRights.blackQueen = false;
  }
  if (piece === '♖') {
    if (fromRow === 7 && fromCol === 0) castlingRights.whiteQueen = false;
    if (fromRow === 7 && fromCol === 7) castlingRights.whiteKing = false;
  }
  if (piece === '♜') {
    if (fromRow === 0 && fromCol === 0) castlingRights.blackQueen = false;
    if (fromRow === 0 && fromCol === 7) castlingRights.blackKing = false;
  }

  // Regular capture
  if (captured && !epCapture) {
    if (currentTurn === 'white') capturedByWhite.push(captured);
    else capturedByBlack.push(captured);
  }

  gameBoard[toRow][toCol] = piece;
  gameBoard[fromRow][fromCol] = '';

  // Pawn promotion
  if (piece === '♙' && toRow === 0) {
    if (autoPromote) { gameBoard[toRow][toCol] = '♕'; }
    else { showPromotion(toRow, toCol, 'white'); return; }
  }
  if (piece === '♟' && toRow === 7) {
    if (autoPromote) { gameBoard[toRow][toCol] = '♛'; }
    else { showPromotion(toRow, toCol, 'black'); return; }
  }

  finishMove(fromRow, fromCol, toRow, toCol, captured || epCapture, castle);
}

function finishMove(fr, fc, tr, tc, wasCapture, wasCastle) {
  lastMove = { fromRow: fr, fromCol: fc, toRow: tr, toCol: tc };
  const cols = 'abcdefgh';
  const piece = gameBoard[tr][tc];
  const notation = wasCastle
    ? (tc === 6 ? 'O-O' : 'O-O-O')
    : `${piece}${cols[fc]}${8-fr}→${cols[tc]}${8-tr}${wasCapture ? '×' : ''}`;
  moveHistory.push(notation);

  playSound(wasCapture ? 'capture' : 'move');

  selectedSquare = null;
  currentTurn = currentTurn === 'white' ? 'black' : 'white';
  renderBoard();
  updateCaptured();
  updateMoveHistory();
  updateMaterial();
  updateStatus();
  updateTimerDisplay();

  if (gameMode === 'bot' && currentTurn === 'black' && !gameOver)
    setTimeout(botMove, 400);
}


// PAWN PROMOTION

function showPromotion(row, col, color) {
  const pieces = color === 'white' ? ['♕','♖','♗','♘'] : ['♛','♜','♝','♞'];
  const modal = document.getElementById('promotion-modal');
  const choices = document.getElementById('promotion-choices');
  choices.innerHTML = '';
  pieces.forEach(p => {
    const btn = document.createElement('button');
    btn.textContent = p;
    btn.classList.add(color === 'white' ? 'white-piece' : 'black-piece');
    btn.onclick = () => {
      gameBoard[row][col] = p;
      modal.classList.add('hidden');
      const prevRow = row + (color === 'white' ? 1 : -1);
      finishMove(prevRow, col, row, col, false, false);
    };
    choices.appendChild(btn);
  });
  modal.classList.remove('hidden');
}


// UNDO

function undoMove() {
  if (boardHistory.length === 0) return;
  const count = gameMode === 'bot' && boardHistory.length >= 2 ? 2 : 1;
  for (let i = 0; i < count; i++) {
    if (boardHistory.length === 0) break;
    const prev = boardHistory.pop();
    gameBoard = prev.board;
    capturedByWhite = prev.capturedByWhite;
    capturedByBlack = prev.capturedByBlack;
    enPassantTarget = prev.enPassantTarget;
    castlingRights = prev.castlingRights;
    currentTurn = prev.currentTurn;
    lastMove = prev.lastMove;
    moveHistory = prev.moveHistory;
  }
  gameOver = false;
  selectedSquare = null;
  renderBoard();
  updateStatus();
  updateCaptured();
  updateMoveHistory();
  updateMaterial();
  updateTimerDisplay();
}


// FLIP & RESIGN

function flipBoard() {
  flipped = !flipped;
  selectedSquare = null;
  createBoard();
  renderBoard();
}

function resign() {
  const winner = currentTurn === 'white' ? 'Black' : 'White';
  showGameOver(`${winner} wins — opponent resigned`);
}


// STATUS & GAME OVER

function updateStatus() {
  const status = document.getElementById('status');
  const stuck = noLegalMoves(currentTurn);
  if (stuck && isInCheck(currentTurn)) {
    status.textContent = 'Checkmate!';
    playSound('gameover');
    showGameOver(`${currentTurn === 'white' ? 'Black' : 'White'} wins by Checkmate!`);
    return;
  }
  if (stuck) {
    status.textContent = 'Stalemate!';
    playSound('gameover');
    showGameOver("Stalemate — It's a draw!");
    return;
  }
  if (isInCheck(currentTurn)) {
    playSound('check');
    status.textContent = `${currentTurn === 'white' ? 'White' : 'Black'} is in Check!`;
    return;
  }
  status.textContent = `${currentTurn === 'white' ? 'White' : 'Black'}'s turn`;
}

function showGameOver(msg) {
  gameOver = true;
  clearInterval(timerInterval);
  setTimeout(() => {
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('gameover-screen').classList.remove('hidden');
    document.getElementById('gameover-text').textContent = msg;
  }, 600);
}


// SIDEBAR UPDATES

function updateCaptured() {
  document.getElementById('black-captured').textContent = capturedByWhite.join(' ') || '—';
  document.getElementById('white-captured').textContent = capturedByBlack.join(' ') || '—';
}

function updateMoveHistory() {
  const list = document.getElementById('move-list');
  list.innerHTML = '';
  moveHistory.forEach(m => {
    const li = document.createElement('li');
    li.textContent = m;
    list.appendChild(li);
  });
  list.scrollTop = list.scrollHeight;
}

function updateMaterial() {
  let w = 0, b = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = gameBoard[r][c];
      if (isWhite(p)) w += PIECE_VALUES[p] || 0;
      else if (isBlack(p)) b += PIECE_VALUES[p] || 0;
    }
  const diff = w - b;
  const el = document.getElementById('material-score');
  el.textContent = diff > 0 ? `White +${diff}` : diff < 0 ? `Black +${Math.abs(diff)}` : 'Equal';
}


// BOT — MINIMAX + ALPHA-BETA

const PST_PAWN = [
  [0,0,0,0,0,0,0,0],
  [50,50,50,50,50,50,50,50],
  [10,10,20,30,30,20,10,10],
  [5,5,10,25,25,10,5,5],
  [0,0,0,20,20,0,0,0],
  [5,-5,-10,0,0,-10,-5,5],
  [5,10,10,-20,-20,10,10,5],
  [0,0,0,0,0,0,0,0]
];

const PST_KNIGHT = [
  [-50,-40,-30,-30,-30,-30,-40,-50],
  [-40,-20,0,0,0,0,-20,-40],
  [-30,0,10,15,15,10,0,-30],
  [-30,5,15,20,20,15,5,-30],
  [-30,0,15,20,20,15,0,-30],
  [-30,5,10,15,15,10,5,-30],
  [-40,-20,0,5,5,0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-40,-50]
];

function evaluate() {
  let score = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = gameBoard[r][c];
      if (!p) continue;
      const val = (PIECE_VALUES[p] || 0) * 100;
      let bonus = 0;
      if (p === '♙') bonus =  PST_PAWN[r][c];
      if (p === '♟') bonus = -PST_PAWN[7-r][c];
      if (p === '♘') bonus =  PST_KNIGHT[r][c];
      if (p === '♞') bonus = -PST_KNIGHT[7-r][c];
      score += isWhite(p) ? val + bonus : -(val + bonus);
    }
  return score;
}

function allMoves(color) {
  const moves = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = gameBoard[r][c];
      if (!p) continue;
      if (color === 'white' && !isWhite(p)) continue;
      if (color === 'black' && !isBlack(p)) continue;
      getLegalMoves(r, c).forEach(([tr,tc]) => moves.push([r,c,tr,tc]));
    }
  return moves;
}

function minimax(depth, alpha, beta, maximizing) {
  if (depth === 0) return evaluate();
  const color = maximizing ? 'white' : 'black';
  const moves = allMoves(color);
  if (moves.length === 0) return isInCheck(color) ? (maximizing ? -99999 : 99999) : 0;

  if (maximizing) {
    let best = -Infinity;
    for (const [fr,fc,tr,tc] of moves) {
      const s = gameBoard[tr][tc];
      gameBoard[tr][tc] = gameBoard[fr][fc]; gameBoard[fr][fc] = '';
      best = Math.max(best, minimax(depth-1, alpha, beta, false));
      gameBoard[fr][fc] = gameBoard[tr][tc]; gameBoard[tr][tc] = s;
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const [fr,fc,tr,tc] of moves) {
      const s = gameBoard[tr][tc];
      gameBoard[tr][tc] = gameBoard[fr][fc]; gameBoard[fr][fc] = '';
      best = Math.min(best, minimax(depth-1, alpha, beta, true));
      gameBoard[fr][fc] = gameBoard[tr][tc]; gameBoard[tr][tc] = s;
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}

function botMove() {
  if (gameOver) return;
  const moves = allMoves('black');
  if (moves.length === 0) return;

  const depth = botDifficulty === 'easy' ? 1 : botDifficulty === 'medium' ? 2 : 3;
  let bestMove = null, bestScore = Infinity;

  for (const [fr,fc,tr,tc] of moves) {
    const s = gameBoard[tr][tc];
    gameBoard[tr][tc] = gameBoard[fr][fc]; gameBoard[fr][fc] = '';
    const score = minimax(depth-1, -Infinity, Infinity, true);
    gameBoard[fr][fc] = gameBoard[tr][tc]; gameBoard[tr][tc] = s;
    if (score < bestScore) { bestScore = score; bestMove = [fr,fc,tr,tc]; }
  }

  if (bestMove) movePiece(bestMove[0], bestMove[1], bestMove[2], bestMove[3], true);
}
