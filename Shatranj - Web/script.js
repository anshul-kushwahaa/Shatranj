// ── Constants ──────────────────────────────
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

const PIECE_VALUES = { '♙':1,'♟':1,'♘':3,'♞':3,'♗':3,'♝':3,'♖':5,'♜':5,'♕':9,'♛':9,'♔':0,'♚':0 };
const whitePieces = ['♙','♖','♘','♗','♕','♔'];
const blackPieces = ['♟','♜','♞','♝','♛','♚'];
const SAN_LETTER = { '♔':'K','♚':'K','♕':'Q','♛':'Q','♖':'R','♜':'R','♗':'B','♝':'B','♘':'N','♞':'N','♙':'','♟':'' };

// Opening book (coordinate key format fr,fc,tr,tc)
const OPENINGS = {
  '6,4,4,4':        "King's Pawn",
  '6,4,4,4|6,3,4,3':"Queen's Gambit",
  '6,4,4,4|1,4,3,4':"Open Game",
  '6,4,4,4|1,2,3,2':"Sicilian Defense",
  '6,4,4,4|1,5,2,5':"French Defense",
  '6,4,4,4|1,2,2,2':"Caro-Kann Defense",
  '6,3,4,3':        "Queen's Pawn",
  '6,3,4,3|1,3,3,3':"Queen's Gambit Accepted",
  '6,3,4,3|1,6,2,5':"Indian Defense",
  '6,2,4,2':        "English Opening",
  '7,6,5,5':        "Réti Opening",
  '6,4,4,4|1,4,3,4|7,6,5,5':"King's Knight",
  '6,4,4,4|1,4,3,4|7,6,5,5|0,1,2,2|7,5,5,2':"Italian Game",
  '6,4,4,4|1,4,3,4|7,6,5,5|0,1,2,2|7,5,4,1':"Ruy Lopez",
  '6,4,4,4|1,2,3,2|7,6,5,5|0,1,2,2':"Sicilian — Open",
};

// ── State ──────────────────────────────────
let gameBoard=[], selectedSquare=null, currentTurn='white';
let gameMode='', botDifficulty='';
let capturedByWhite=[], capturedByBlack=[], moveHistory=[], boardHistory=[];
let enPassantTarget=null, castlingRights={}, lastMove=null;
let flipped=false, soundEnabled=true, gameOver=false;
let whiteTime=0, blackTime=0, timerInterval=null, noTimer=false, increment=0;
let halfMoveClock=0;
let rightClickStart=null;
let arrows=[], highlightedSquares=[];
let premove=null;
let autoQueen=false;
let moveCoords=[];
let historyIndex=-1;
let pendingMode='', pendingDifficulty='';
let gameStats={ white:0, black:0, draws:0 };
let boardSnapshots=[];
let pendingSAN=null, positionCounts={};
let startMinutes=0, startIncrement=0;

// ── Audio ──────────────────────────────────
let audioCtx=null;
function getAudio(){ if(!audioCtx) audioCtx=new(window.AudioContext||window.webkitAudioContext)(); return audioCtx; }
function playSound(type){
  if(!soundEnabled) return;
  try{
    const ctx=getAudio(), osc=ctx.createOscillator(), gain=ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    const t=ctx.currentTime;
    const c={move:[440,0.2,0.1],capture:[220,0.4,0.2],check:[660,0.3,0.3],gameover:[180,0.5,0.6],castle:[520,0.3,0.15]}[type]||[440,0.2,0.1];
    osc.frequency.value=c[0]; gain.gain.setValueAtTime(c[1],t); gain.gain.exponentialRampToValueAtTime(0.001,t+c[2]);
    osc.start(); osc.stop(t+c[2]);
  }catch(e){}
}
function toggleSound(){ soundEnabled=!soundEnabled; document.getElementById('sound-btn').textContent=soundEnabled?'🔊':'🔇'; localStorage.setItem('chess-sound',soundEnabled?'1':'0'); }

// ── Themes ─────────────────────────────────
function setTheme(name){
  document.body.className=`theme-${name}`;
  document.querySelectorAll('.theme-btn').forEach(b=>b.classList.remove('active'));
  document.querySelector(`[onclick="setTheme('${name}')"]`).classList.add('active');
  localStorage.setItem('chess-theme',name);
}

// ── Screens ────────────────────────────────
function show(id){ document.getElementById(id).classList.remove('hidden'); }
function hide(id){ document.getElementById(id).classList.add('hidden'); }

function showHome(){
  clearInterval(timerInterval);
  show('home-screen'); hide('difficulty-screen'); hide('game-screen');
  hide('gameover-screen'); hide('timecontrol-screen');
  updateScoreBar();
}
function showDifficulty(){ hide('home-screen'); show('difficulty-screen'); }
function showTimeControl(mode,difficulty){
  pendingMode=mode; pendingDifficulty=difficulty||'';
  hide('home-screen'); hide('difficulty-screen'); show('timecontrol-screen');
}
function goBack(){ hide('timecontrol-screen'); pendingMode==='bot'?show('difficulty-screen'):show('home-screen'); }

function startWithTime(minutes, inc){
  startMinutes=minutes; startIncrement=inc||0;
  noTimer=minutes===0; increment=inc||0;
  whiteTime=blackTime=minutes*60;
  startGame(pendingMode,pendingDifficulty);
}
function rematch(){
  noTimer=startMinutes===0; increment=startIncrement;
  whiteTime=blackTime=startMinutes*60;
  startGame(gameMode,botDifficulty);
}

function startGame(mode,difficulty){
  gameMode=mode; botDifficulty=difficulty||'';
  currentTurn='white'; selectedSquare=null; gameOver=false;
  capturedByWhite=[]; capturedByBlack=[]; moveHistory=[]; boardHistory=[]; moveCoords=[];
  boardSnapshots=[]; historyIndex=-1; pendingSAN=null; positionCounts={};
  enPassantTarget=null; halfMoveClock=0;
  castlingRights={ whiteKing:true, whiteQueen:true, blackKing:true, blackQueen:true };
  lastMove=null; flipped=false; arrows=[]; highlightedSquares=[]; premove=null;
  clearInterval(timerInterval);

  hide('home-screen'); hide('difficulty-screen'); hide('timecontrol-screen');
  show('game-screen'); hide('gameover-screen');
  hide('draw-dialog'); hide('promotion-modal');

  document.getElementById('move-list').innerHTML='';
  document.getElementById('black-captured').textContent='—';
  document.getElementById('white-captured').textContent='—';
  document.getElementById('material-score').textContent='Equal';
  document.getElementById('bot-thinking').classList.add('hidden');
  document.getElementById('opening-name').textContent='';
  document.getElementById('nav-hint').classList.add('hidden');
  document.getElementById('mode-info').textContent=mode==='bot'?`🤖 Bot (${difficulty})`:'👥 vs Friend';

  gameBoard=initialBoard.map(r=>[...r]);
  boardSnapshots.push(gameBoard.map(r=>[...r]));
  positionCounts[positionKey()]=1;
  createBoard();
  updateStatus();
  updateTimerDisplay();
  updateEvalBar();
  if(!noTimer) startTimer();
}

// ── Timer ──────────────────────────────────
function startTimer(){
  clearInterval(timerInterval);
  timerInterval=setInterval(()=>{
    if(gameOver){ clearInterval(timerInterval); return; }
    if(historyIndex!==-1) return; // paused during review
    if(currentTurn==='white') whiteTime--; else blackTime--;
    updateTimerDisplay();
    if(whiteTime<=0){ clearInterval(timerInterval); endGame('Black wins on time!','black'); }
    if(blackTime<=0){ clearInterval(timerInterval); endGame('White wins on time!','white'); }
  },1000);
}
function formatTime(s){ return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`; }
function updateTimerDisplay(){
  const wt=document.getElementById('white-timer'), bt=document.getElementById('black-timer');
  if(noTimer){ wt.textContent=bt.textContent='∞'; }
  else{ wt.textContent=formatTime(whiteTime); bt.textContent=formatTime(blackTime); }
  wt.className='timer'+(currentTurn==='white'?' active-timer':'')+(!noTimer&&whiteTime<=20?' low-time':'');
  bt.className='timer'+(currentTurn==='black'?' active-timer':'')+(!noTimer&&blackTime<=20?' low-time':'');
}

// ── Board ──────────────────────────────────
function getSquareEl(row,col){ return document.querySelector(`[data-row="${row}"][data-col="${col}"]`); }

function createBoard(){
  const board=document.getElementById('board');
  board.innerHTML='';
  for(let r=0;r<8;r++){
    for(let c=0;c<8;c++){
      const dr=flipped?7-r:r, dc=flipped?7-c:c;
      const sq=document.createElement('div');
      sq.classList.add('square',(r+c)%2===0?'light':'dark');
      sq.dataset.row=dr; sq.dataset.col=dc;

      if(c===0){ const s=document.createElement('span'); s.className='coord-rank'; s.textContent=flipped?r+1:8-r; sq.appendChild(s); }
      if(r===7){ const s=document.createElement('span'); s.className='coord-file'; s.textContent=String.fromCharCode(97+dc); sq.appendChild(s); }

      const piece=gameBoard[dr][dc];
      const pel=document.createElement('span');
      pel.className='piece'; pel.textContent=piece;
      if(isWhite(piece)) pel.classList.add('white-piece');
      else if(isBlack(piece)) pel.classList.add('black-piece');
      sq.appendChild(pel);

      sq.addEventListener('pointerdown',onPointerDown);
      sq.addEventListener('contextmenu',e=>e.preventDefault());
      board.appendChild(sq);
    }
  }
  updateTimerDisplay();
  highlightCheck();
  drawArrows();
}

function renderBoard(){
  document.querySelectorAll('.square').forEach(sq=>{
    const row=parseInt(sq.dataset.row), col=parseInt(sq.dataset.col);
    const piece=gameBoard[row][col];
    const pel=sq.querySelector('.piece');
    if(pel){ pel.textContent=piece; pel.className='piece'; if(isWhite(piece)) pel.classList.add('white-piece'); else if(isBlack(piece)) pel.classList.add('black-piece'); }
    sq.classList.remove('selected','legal-move','last-move','occupied','drag-over','sq-highlight','review-sq','premove-sq','premove-option');
    if(lastMove&&((row===lastMove.fromRow&&col===lastMove.fromCol)||(row===lastMove.toRow&&col===lastMove.toCol))) sq.classList.add('last-move');
    if(highlightedSquares.some(h=>h[0]===row&&h[1]===col)) sq.classList.add('sq-highlight');
    if(premove&&((row===premove.fr&&col===premove.fc)||(row===premove.tr&&col===premove.tc))) sq.classList.add('premove-sq');
  });
  highlightCheck();
  drawArrows();
}

function highlightCheck(){
  document.querySelectorAll('.in-check').forEach(s=>s.classList.remove('in-check'));
  if(isInCheck(currentTurn)){
    const k=findKing(currentTurn);
    if(k){ const sq=getSquareEl(k[0],k[1]); if(sq) sq.classList.add('in-check'); }
  }
}

// ── Pointer input: hold-to-drag, click-to-move, right-click arrows ──
let holdState=null;

function squareFrom(x,y){ const el=document.elementFromPoint(x,y); return el?el.closest('.square'):null; }

function onPointerDown(e){
  const sq=e.currentTarget;
  const row=parseInt(sq.dataset.row), col=parseInt(sq.dataset.col);

  if(e.button===2){ rightClickStart=[row,col]; e.preventDefault(); return; }
  if(e.button!==0) return;
  e.preventDefault();   // stop the browser from native-dragging the piece glyph

  if(historyIndex!==-1){ exitReview(); return; }
  if(gameOver) return;

  // Any left action clears drawn arrows / square highlights
  if(arrows.length||highlightedSquares.length){ arrows=[]; highlightedSquares=[]; }

  const premoveCtx=(gameMode==='bot'&&currentTurn==='black');   // human queues a move during bot's turn
  const piece=gameBoard[row][col];

  // Complete a selected piece onto one of its targets (click-to-move / click-to-premove)
  if(selectedSquare){
    const [sr,sc]=selectedSquare;
    const targets=premoveCtx?premoveTargets(sr,sc):getLegalMoves(sr,sc);
    if(!(sr===row&&sc===col)&&targets.some(([r,c])=>r===row&&c===col)){
      if(premoveCtx) setPremove(sr,sc,row,col); else movePiece(sr,sc,row,col);
      return;
    }
  }

  const mine=piece&&(premoveCtx?isWhite(piece):isCurrentPlayer(piece));
  if(mine){
    selectedSquare=[row,col];
    premove=null;
    highlightMoves(row,col,premoveCtx);
    startHold(e,row,col,piece);
  }else{
    selectedSquare=null; premove=null; renderBoard();
  }
}

function startHold(e,row,col,piece){
  const sq=getSquareEl(row,col), pel=sq.querySelector('.piece'), rect=sq.getBoundingClientRect();
  const fly=document.createElement('span');
  fly.textContent=piece;
  fly.className='holding-piece piece '+(isWhite(piece)?'white-piece':'black-piece');
  fly.style.width=rect.width+'px'; fly.style.height=rect.height+'px';
  document.body.appendChild(fly);
  document.body.classList.add('holding');
  holdState={fr:row,fc:col,piece,el:fly,moved:false,sx:e.clientX,sy:e.clientY};
  moveHold(e.clientX,e.clientY);
  if(pel) pel.style.visibility='hidden';
}

function moveHold(x,y){
  if(!holdState) return;
  const el=holdState.el, w=el.offsetWidth||50, h=el.offsetHeight||50;
  el.style.left=(x-w/2)+'px'; el.style.top=(y-h/2)+'px';
}

function onPointerMove(e){
  if(!holdState) return;
  if(Math.abs(e.clientX-holdState.sx)>4||Math.abs(e.clientY-holdState.sy)>4) holdState.moved=true;
  moveHold(e.clientX,e.clientY);
  document.querySelectorAll('.square.drag-over').forEach(s=>s.classList.remove('drag-over'));
  const t=squareFrom(e.clientX,e.clientY);
  if(t){
    const r=parseInt(t.dataset.row),c=parseInt(t.dataset.col);
    if(getLegalMoves(holdState.fr,holdState.fc).some(([mr,mc])=>mr===r&&mc===c)) t.classList.add('drag-over');
  }
}

function releaseHold(){
  const hs=holdState; holdState=null;
  document.body.classList.remove('holding');
  document.querySelectorAll('.square.drag-over').forEach(s=>s.classList.remove('drag-over'));
  if(hs&&hs.el&&hs.el.parentNode) hs.el.parentNode.removeChild(hs.el);
  if(hs){ const srcSq=getSquareEl(hs.fr,hs.fc), srcPel=srcSq&&srcSq.querySelector('.piece'); if(srcPel) srcPel.style.visibility=''; }
  return hs;
}

function onPointerUp(e){
  if(e.button===2){ finishRightClick(e); return; }
  if(!holdState) return;
  const hs=releaseHold();
  const premoveCtx=(gameMode==='bot'&&currentTurn==='black');
  const t=squareFrom(e.clientX,e.clientY);
  if(t){
    const r=parseInt(t.dataset.row),c=parseInt(t.dataset.col);
    const targets=premoveCtx?premoveTargets(hs.fr,hs.fc):getLegalMoves(hs.fr,hs.fc);
    if(targets.some(([mr,mc])=>mr===r&&mc===c)){
      if(premoveCtx){ setPremove(hs.fr,hs.fc,r,c); return; }
      movePiece(hs.fr,hs.fc,r,c,false,true);   // dropped by hand → no fly animation
      return;
    }
  }
  if(hs.moved){ selectedSquare=null; renderBoard(); }  // dragged off → deselect; a click keeps it selected
}

// ── Pre-move (queue a reply during the bot's turn) ──
function premoveTargets(row,col){
  const p=gameBoard[row][col];
  if(p==='♙'||p==='♟'){
    const dir=p==='♙'?-1:1, start=p==='♙'?6:1, moves=[];
    if(inBounds(row+dir,col)&&isEmpty(row+dir,col)){ moves.push([row+dir,col]); if(row===start&&isEmpty(row+2*dir,col)) moves.push([row+2*dir,col]); }
    for(const dc of [-1,1]) if(inBounds(row+dir,col+dc)) moves.push([row+dir,col+dc]); // diagonals always (a capture may open up)
    return moves;
  }
  return getRaw(row,col);
}
function setPremove(fr,fc,tr,tc){
  premove={fr,fc,tr,tc};
  selectedSquare=null;
  renderBoard();
}

function onPointerCancel(){ if(holdState) releaseHold(); }

function finishRightClick(e){
  if(!rightClickStart) return;
  const t=squareFrom(e.clientX,e.clientY);
  if(t){
    const r=parseInt(t.dataset.row),c=parseInt(t.dataset.col),[sr,sc]=rightClickStart;
    if(sr===r&&sc===c){
      const idx=highlightedSquares.findIndex(h=>h[0]===r&&h[1]===c);
      if(idx>=0) highlightedSquares.splice(idx,1); else highlightedSquares.push([r,c]);
      renderBoard();
    }else{
      const idx=arrows.findIndex(a=>a.from[0]===sr&&a.from[1]===sc&&a.to[0]===r&&a.to[1]===c);
      if(idx>=0) arrows.splice(idx,1); else arrows.push({from:[sr,sc],to:[r,c]});
      drawArrows();
    }
  }
  rightClickStart=null;
}

document.addEventListener('pointermove',onPointerMove);
document.addEventListener('pointerup',onPointerUp);
document.addEventListener('pointercancel',onPointerCancel);

function drawArrows(){
  const svg=document.getElementById('arrow-svg');
  if(!svg) return;
  svg.innerHTML='';
  const firstSq=document.querySelector('.square');
  const sqSize=firstSq?firstSq.getBoundingClientRect().width:50;
  arrows.forEach(arr=>{
    const [fr,fc]=arr.from,[tr,tc]=arr.to;
    const fromSq=getSquareEl(fr,fc),toSq=getSquareEl(tr,tc);
    if(!fromSq||!toSq) return;
    // Get position in grid
    const getBoardPos=(sq)=>{
      const ri=parseInt(sq.dataset.row),ci=parseInt(sq.dataset.col);
      // Find display row/col
      let dr,dc;
      document.querySelectorAll('.square').forEach((s,i)=>{
        if(parseInt(s.dataset.row)===ri&&parseInt(s.dataset.col)===ci){ dr=Math.floor(i/8); dc=i%8; }
      });
      return [dr,dc];
    };
    const [fdr,fdc]=getBoardPos(fromSq),[tdr,tdc]=getBoardPos(toSq);
    const fx=fdc*sqSize+sqSize/2, fy=fdr*sqSize+sqSize/2;
    const tx=tdc*sqSize+sqSize/2, ty=tdr*sqSize+sqSize/2;
    const angle=Math.atan2(ty-fy,tx-fx);
    const shorten=sqSize*0.28;
    const sx=fx+Math.cos(angle)*shorten, sy=fy+Math.sin(angle)*shorten;
    const ex=tx-Math.cos(angle)*shorten, ey=ty-Math.sin(angle)*shorten;
    const hw=sqSize*0.18;
    const hx1=ex-hw*Math.cos(angle-Math.PI/6),hy1=ey-hw*Math.sin(angle-Math.PI/6);
    const hx2=ex-hw*Math.cos(angle+Math.PI/6),hy2=ey-hw*Math.sin(angle+Math.PI/6);
    const g=document.createElementNS('http://www.w3.org/2000/svg','g');
    g.setAttribute('opacity','0.85');
    const line=document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1',sx);line.setAttribute('y1',sy);line.setAttribute('x2',ex);line.setAttribute('y2',ey);
    line.setAttribute('stroke','#f6a600');line.setAttribute('stroke-width',sqSize*0.12);line.setAttribute('stroke-linecap','round');
    const head=document.createElementNS('http://www.w3.org/2000/svg','polygon');
    head.setAttribute('points',`${ex},${ey} ${hx1},${hy1} ${hx2},${hy2}`);
    head.setAttribute('fill','#f6a600');
    g.appendChild(line); g.appendChild(head); svg.appendChild(g);
  });
}

// ── Piece animation ────────────────────────
function animatePiece(fromRow,fromCol,toRow,toCol,piece,callback){
  const fromSq=getSquareEl(fromRow,fromCol), toSq=getSquareEl(toRow,toCol);
  if(!fromSq||!toSq){ callback(); return; }
  const fr=fromSq.getBoundingClientRect(), tr=toSq.getBoundingClientRect();
  const pel=fromSq.querySelector('.piece');
  const flying=document.createElement('span');
  flying.textContent=piece;
  flying.className='flying-piece piece '+(isWhite(piece)?'white-piece':'black-piece');
  flying.style.left=fr.left+'px'; flying.style.top=fr.top+'px';
  flying.style.width=fr.width+'px'; flying.style.height=fr.height+'px';
  flying.style.fontSize=getComputedStyle(fromSq).fontSize;
  document.body.appendChild(flying);
  if(pel) pel.style.visibility='hidden';
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      flying.style.left=tr.left+'px'; flying.style.top=tr.top+'px';
      setTimeout(()=>{
        document.body.removeChild(flying);
        if(pel) pel.style.visibility='';
        callback();
      },130);
    });
  });
}

// ── Helpers ────────────────────────────────
function isWhite(p){ return whitePieces.includes(p); }
function isBlack(p){ return blackPieces.includes(p); }
function isCurrentPlayer(p){ return currentTurn==='white'?isWhite(p):isBlack(p); }
function isEnemy(p,t){ return !!t&&((isWhite(p)&&isBlack(t))||(isBlack(p)&&isWhite(t))); }
function isEmpty(r,c){ return gameBoard[r][c]===''; }
function inBounds(r,c){ return r>=0&&r<8&&c>=0&&c<8; }

// ── Opening detection ──────────────────────
function updateOpening(){
  const key=moveCoords.slice(0,6).map(m=>`${m[0]},${m[1]},${m[2]},${m[3]}`).join('|');
  let found='';
  // Match longest prefix
  for(let len=moveCoords.length;len>0;len--){
    const k=moveCoords.slice(0,len).map(m=>`${m[0]},${m[1]},${m[2]},${m[3]}`).join('|');
    if(OPENINGS[k]){ found=OPENINGS[k]; break; }
  }
  document.getElementById('opening-name').textContent=found;
}

// ── Move generation ────────────────────────
function getLegalMoves(row,col){
  const p=gameBoard[row][col];
  let moves=getRaw(row,col);
  if(p==='♔'||p==='♚') moves=[...moves,...getCastlingMoves()];
  if(p==='♙'||p==='♟') moves=[...moves,...getEnPassantMoves(row,col)];
  return moves.filter(([r,c])=>!leavesInCheck(row,col,r,c));
}
function getRaw(row,col){
  const p=gameBoard[row][col];
  if(p==='♙') return pawnMoves(row,col,'white');
  if(p==='♟') return pawnMoves(row,col,'black');
  if(p==='♖'||p==='♜') return slideMoves(row,col,[[-1,0],[1,0],[0,-1],[0,1]]);
  if(p==='♘'||p==='♞') return jumpMoves(row,col,[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]);
  if(p==='♗'||p==='♝') return slideMoves(row,col,[[-1,-1],[-1,1],[1,-1],[1,1]]);
  if(p==='♕'||p==='♛') return slideMoves(row,col,[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]);
  if(p==='♔'||p==='♚') return jumpMoves(row,col,[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]);
  return [];
}
function pawnMoves(row,col,color){
  const moves=[],dir=color==='white'?-1:1,start=color==='white'?6:1,p=gameBoard[row][col];
  if(inBounds(row+dir,col)&&isEmpty(row+dir,col)){ moves.push([row+dir,col]); if(row===start&&isEmpty(row+2*dir,col)) moves.push([row+2*dir,col]); }
  for(const dc of[-1,1]) if(inBounds(row+dir,col+dc)&&isEnemy(p,gameBoard[row+dir][col+dc])) moves.push([row+dir,col+dc]);
  return moves;
}
function slideMoves(row,col,dirs){
  const moves=[],p=gameBoard[row][col];
  for(const[dr,dc]of dirs){ let r=row+dr,c=col+dc; while(inBounds(r,c)){ if(isEmpty(r,c)) moves.push([r,c]); else{if(isEnemy(p,gameBoard[r][c])) moves.push([r,c]);break;} r+=dr;c+=dc; } }
  return moves;
}
function jumpMoves(row,col,jumps){
  const p=gameBoard[row][col];
  return jumps.map(([dr,dc])=>[row+dr,col+dc]).filter(([r,c])=>inBounds(r,c)&&(isEmpty(r,c)||isEnemy(p,gameBoard[r][c])));
}
function getEnPassantMoves(row,col){
  if(!enPassantTarget) return [];
  const p=gameBoard[row][col],dir=isWhite(p)?-1:1,[er,ec]=enPassantTarget;
  return(row+dir===er&&Math.abs(col-ec)===1)?[[er,ec]]:[];
}
function getCastlingMoves(){
  const moves=[],color=currentTurn,row=color==='white'?7:0;
  const king=color==='white'?'♔':'♚',enemy=color==='white'?'black':'white';
  if(gameBoard[row][4]!==king||isAttacked(row,4,enemy)) return moves;
  if((color==='white'?castlingRights.whiteKing:castlingRights.blackKing)) if(isEmpty(row,5)&&isEmpty(row,6)&&!isAttacked(row,5,enemy)&&!isAttacked(row,6,enemy)) moves.push([row,6]);
  if((color==='white'?castlingRights.whiteQueen:castlingRights.blackQueen)) if(isEmpty(row,3)&&isEmpty(row,2)&&isEmpty(row,1)&&!isAttacked(row,3,enemy)&&!isAttacked(row,2,enemy)) moves.push([row,2]);
  return moves;
}

// ── Check detection ────────────────────────
function findKing(color){ const k=color==='white'?'♔':'♚'; for(let r=0;r<8;r++) for(let c=0;c<8;c++) if(gameBoard[r][c]===k) return[r,c]; return null; }
function isAttacked(row,col,byColor){
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    const p=gameBoard[r][c]; if(!p) continue;
    if(byColor==='white'&&!isWhite(p)) continue;
    if(byColor==='black'&&!isBlack(p)) continue;
    if(getRaw(r,c).some(([mr,mc])=>mr===row&&mc===col)) return true;
  } return false;
}
function isInCheck(color){ const k=findKing(color); return k?isAttacked(k[0],k[1],color==='white'?'black':'white'):false; }
function leavesInCheck(fr,fc,tr,tc){
  const sf=gameBoard[fr][fc],st=gameBoard[tr][tc];
  gameBoard[tr][tc]=sf;gameBoard[fr][fc]='';
  const r=isInCheck(currentTurn);
  gameBoard[fr][fc]=sf;gameBoard[tr][tc]=st;return r;
}
function noLegalMoves(color){
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    const p=gameBoard[r][c];if(!p)continue;
    if(color==='white'&&!isWhite(p))continue;
    if(color==='black'&&!isBlack(p))continue;
    if(getLegalMoves(r,c).length>0)return false;
  }return true;
}
function insufficientMaterial(){
  const pieces=[];
  for(let r=0;r<8;r++) for(let c=0;c<8;c++) if(gameBoard[r][c]) pieces.push(gameBoard[r][c]);
  if(pieces.length===2)return true;
  if(pieces.length===3&&pieces.some(p=>'♘♞♗♝'.includes(p)))return true;
  return false;
}

// ── Highlight legal moves ──────────────────
function highlightMoves(row,col,premoveCtx){
  renderBoard();
  const moves=premoveCtx?premoveTargets(row,col):getLegalMoves(row,col);
  const dotClass=premoveCtx?'premove-option':'legal-move';
  document.querySelectorAll('.square').forEach(sq=>{
    const r=parseInt(sq.dataset.row),c=parseInt(sq.dataset.col);
    if(r===row&&c===col) sq.classList.add('selected');
    if(moves.some(([mr,mc])=>mr===r&&mc===c)){ sq.classList.add(dotClass); if(gameBoard[r][c]) sq.classList.add('occupied'); }
  });
}

// ── Move execution ─────────────────────────
function movePiece(fromRow,fromCol,toRow,toCol,autoPromote=false,skipAnim=false){
  const piece=gameBoard[fromRow][fromCol],captured=gameBoard[toRow][toCol];
  let epCapture=false,castle=false;

  boardHistory.push({ board:gameBoard.map(r=>[...r]),capturedByWhite:[...capturedByWhite],capturedByBlack:[...capturedByBlack],enPassantTarget,castlingRights:{...castlingRights},currentTurn,lastMove,moveHistory:[...moveHistory],moveCoords:[...moveCoords],halfMoveClock,positionCounts:{...positionCounts} });

  if((piece==='♙'||piece==='♟')&&enPassantTarget&&toRow===enPassantTarget[0]&&toCol===enPassantTarget[1]&&!captured){
    const cap=gameBoard[fromRow][toCol];gameBoard[fromRow][toCol]='';
    if(currentTurn==='white')capturedByWhite.push(cap);else capturedByBlack.push(cap);
    epCapture=true;
  }
  if(piece==='♙'&&fromRow===6&&toRow===4)enPassantTarget=[5,toCol];
  else if(piece==='♟'&&fromRow===1&&toRow===3)enPassantTarget=[2,toCol];
  else enPassantTarget=null;

  if(piece==='♔'&&fromCol===4){
    if(toCol===6){gameBoard[7][5]='♖';gameBoard[7][7]='';castle=true;}
    if(toCol===2){gameBoard[7][3]='♖';gameBoard[7][0]='';castle=true;}
    castlingRights.whiteKing=castlingRights.whiteQueen=false;
  }
  if(piece==='♚'&&fromCol===4){
    if(toCol===6){gameBoard[0][5]='♜';gameBoard[0][7]='';castle=true;}
    if(toCol===2){gameBoard[0][3]='♜';gameBoard[0][0]='';castle=true;}
    castlingRights.blackKing=castlingRights.blackQueen=false;
  }
  if(piece==='♖'){if(fromRow===7&&fromCol===0)castlingRights.whiteQueen=false;if(fromRow===7&&fromCol===7)castlingRights.whiteKing=false;}
  if(piece==='♜'){if(fromRow===0&&fromCol===0)castlingRights.blackQueen=false;if(fromRow===0&&fromCol===7)castlingRights.blackKing=false;}

  if(captured&&!epCapture){ if(currentTurn==='white')capturedByWhite.push(captured);else capturedByBlack.push(captured); }
  halfMoveClock=(captured||epCapture||piece==='♙'||piece==='♟')?0:halfMoveClock+1;
  moveCoords.push([fromRow,fromCol,toRow,toCol]);

  // Build move-notation context while the board is still in its pre-move state
  pendingSAN={ fr:fromRow,fc:fromCol,tr:toRow,tc:toCol,piece,cap:!!(captured||epCapture),castle,disamb:'' };
  if(piece!=='♙'&&piece!=='♟'&&!castle) pendingSAN.disamb=disambiguation(fromRow,fromCol,toRow,toCol,piece);

  gameBoard[toRow][toCol]=piece;gameBoard[fromRow][fromCol]='';

  // Add increment
  if(!noTimer&&increment>0){ if(currentTurn==='white')whiteTime+=increment;else blackTime+=increment; }

  // Promotion
  if(piece==='♙'&&toRow===0){if(autoPromote||autoQueen){gameBoard[toRow][toCol]='♕';}else{showPromotion(toRow,toCol,'white',fromRow,fromCol);return;}}
  if(piece==='♟'&&toRow===7){if(autoPromote||autoQueen){gameBoard[toRow][toCol]='♛';}else{showPromotion(toRow,toCol,'black',fromRow,fromCol);return;}}

  // Animate then finish (skip the fly when the piece was dragged there by hand)
  const done=()=>{
    boardSnapshots.push(gameBoard.map(r=>[...r]));
    finishMove(fromRow,fromCol,toRow,toCol,!!(captured||epCapture),castle);
  };
  if(skipAnim) done();
  else animatePiece(fromRow,fromCol,toRow,toCol,piece,done);
}

function finishMove(fr,fc,tr,tc,wasCapture,wasCastle){
  lastMove={fromRow:fr,fromCol:fc,toRow:tr,toCol:tc};
  let san=assembleSAN();
  playSound(wasCapture?'capture':wasCastle?'castle':'move');
  selectedSquare=null;arrows=[];
  currentTurn=currentTurn==='white'?'black':'white';
  if(isInCheck(currentTurn)) san+=noLegalMoves(currentTurn)?'#':'+';
  moveHistory.push(san);
  const key=positionKey(); positionCounts[key]=(positionCounts[key]||0)+1;
  renderBoard();updateCaptured();updateMoveHistory();updateMaterial();updateOpening();updateEvalBar();updateStatus();updateTimerDisplay();
  if(gameMode==='bot'&&currentTurn==='black'&&!gameOver){
    show('bot-thinking'); setTimeout(botMove,400);
  }
  else if(gameMode==='bot'&&currentTurn==='white'&&premove&&!gameOver){
    const pm=premove; premove=null;
    setTimeout(()=>{
      if(gameOver) return;
      if(getLegalMoves(pm.fr,pm.fc).some(([r,c])=>r===pm.tr&&c===pm.tc))
        movePiece(pm.fr,pm.fc,pm.tr,pm.tc,false,true);
      else renderBoard();   // pre-move no longer legal → just clear the highlight
    },220);
  }
}

// ── Algebraic notation (SAN) ───────────────
function assembleSAN(){
  const p=pendingSAN; if(!p) return '?';
  if(p.castle) return p.tc===6?'O-O':'O-O-O';
  const cols='abcdefgh', dest=cols[p.tc]+(8-p.tr), isPawn=(p.piece==='♙'||p.piece==='♟');
  if(isPawn){
    let s=(p.cap?cols[p.fc]+'x':'')+dest;
    if(p.tr===0||p.tr===7) s+='='+SAN_LETTER[gameBoard[p.tr][p.tc]];
    return s;
  }
  return SAN_LETTER[p.piece]+p.disamb+(p.cap?'x':'')+dest;
}
function disambiguation(fr,fc,tr,tc,piece){
  const cols='abcdefgh', others=[];
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
    if(r===fr&&c===fc)continue;
    if(gameBoard[r][c]!==piece)continue;
    if(getLegalMoves(r,c).some(([mr,mc])=>mr===tr&&mc===tc)) others.push([r,c]);
  }
  if(!others.length)return '';
  if(!others.some(([r,c])=>c===fc))return cols[fc];
  if(!others.some(([r,c])=>r===fr))return ''+(8-fr);
  return cols[fc]+(8-fr);
}

// ── Position key (threefold repetition) ────
function positionKey(){
  let s=gameBoard.map(r=>r.map(c=>c||'.').join('')).join('/');
  s+=' '+currentTurn[0];
  s+=' '+(castlingRights.whiteKing?'K':'')+(castlingRights.whiteQueen?'Q':'')+(castlingRights.blackKing?'k':'')+(castlingRights.blackQueen?'q':'');
  s+=' '+(enPassantTarget?enPassantTarget.join(','):'-');
  return s;
}

// ── Promotion ──────────────────────────────
function showPromotion(row,col,color,fromRow,fromCol){
  const pieces=color==='white'?['♕','♖','♗','♘']:['♛','♜','♝','♞'];
  const modal=document.getElementById('promotion-modal'),choices=document.getElementById('promotion-choices');
  choices.innerHTML='';
  pieces.forEach(p=>{
    const btn=document.createElement('button');btn.textContent=p;
    btn.classList.add(color==='white'?'white-piece':'black-piece');
    btn.onclick=()=>{ gameBoard[row][col]=p;modal.classList.add('hidden');boardSnapshots.push(gameBoard.map(r=>[...r]));finishMove(fromRow,fromCol,row,col,false,false); };
    choices.appendChild(btn);
  });
  modal.classList.remove('hidden');
}

// ── Undo ───────────────────────────────────
function undoMove(){
  if(boardHistory.length===0)return;
  exitReview();
  const count=gameMode==='bot'&&boardHistory.length>=2?2:1;
  for(let i=0;i<count;i++){
    if(!boardHistory.length)break;
    const prev=boardHistory.pop();
    gameBoard=prev.board;capturedByWhite=prev.capturedByWhite;capturedByBlack=prev.capturedByBlack;
    enPassantTarget=prev.enPassantTarget;castlingRights=prev.castlingRights;
    currentTurn=prev.currentTurn;lastMove=prev.lastMove;moveHistory=prev.moveHistory;
    moveCoords=prev.moveCoords;halfMoveClock=prev.halfMoveClock;positionCounts=prev.positionCounts;
    boardSnapshots.pop();
  }
  gameOver=false;selectedSquare=null;arrows=[];premove=null;
  renderBoard();updateStatus();updateCaptured();updateMoveHistory();updateMaterial();updateOpening();updateEvalBar();updateTimerDisplay();
  hide('bot-thinking');
}

// ── History navigation (keyboard) ──────────
function enterReview(){
  historyIndex=boardSnapshots.length-1;
  show('nav-hint');
  renderReview();
}
function exitReview(){
  historyIndex=-1;hide('nav-hint');
  gameBoard=boardSnapshots[boardSnapshots.length-1].map(r=>[...r]);
  renderBoard();updateMoveHistory();updateEvalBar();
}
function renderReview(){
  if(historyIndex<0||historyIndex>=boardSnapshots.length)return;
  const snap=boardSnapshots[historyIndex];
  gameBoard=snap.map(r=>[...r]);
  renderBoard();updateEvalBar();
  document.querySelectorAll('#move-list li').forEach((li,i)=>{
    li.classList.toggle('active-move',i===historyIndex-1);
  });
}
function stepBack(){
  if(historyIndex===-1) enterReview();
  else if(historyIndex>0){ historyIndex--; renderReview(); }
}
function stepForward(){
  if(historyIndex===-1) return;
  if(historyIndex<boardSnapshots.length-1){ historyIndex++; renderReview(); }
  else exitReview();
}
function navPrev(){ stepBack(); }
function navNext(){ stepForward(); }
function navFirst(){ if(boardSnapshots.length){ historyIndex=0; show('nav-hint'); renderReview(); } }
function navLast(){ if(historyIndex!==-1) exitReview(); }
document.addEventListener('keydown',e=>{
  if(document.getElementById('game-screen').classList.contains('hidden'))return;
  if(e.key==='ArrowLeft') stepBack();
  if(e.key==='ArrowRight') stepForward();
  if(e.key==='Escape'&&historyIndex!==-1) exitReview();
});

// ── Move list click to navigate ────────────
function goToMove(idx){
  historyIndex=idx+1;show('nav-hint');renderReview();
}

// ── Flip & resign ──────────────────────────
function flipBoard(){ flipped=!flipped;selectedSquare=null;arrows=[];createBoard();renderBoard(); }
function resign(){ const w=currentTurn==='white'?'Black':'White'; endGame(`${w} wins — opponent resigned`,w.toLowerCase()); }

// ── Draw offer ─────────────────────────────
function offerDraw(){
  if(gameMode==='bot'){
    // Bot accepts if losing
    const score=evaluate();
    if((currentTurn==='white'&&score<-200)||(currentTurn==='black'&&score>200)) endGame("Draw — agreed",'draw');
    else{ document.getElementById('status').textContent="Bot declines the draw!"; }
  } else {
    show('draw-dialog');
  }
}
function acceptDraw(){ hide('draw-dialog'); endGame("Draw — agreed",'draw'); }
function declineDraw(){ hide('draw-dialog'); }

// ── Auto-queen toggle ──────────────────────
function toggleAutoQueen(){ autoQueen=document.getElementById('auto-queen').checked; }

// ── Copy PGN ──────────────────────────────
function copyPGN(){
  const date=new Date().toISOString().slice(0,10);
  const pgn=`[Date "${date}"]\n[White "White"]\n[Black "${gameMode==='bot'?`Bot (${botDifficulty})`:'Black'}"]\n\n`
    +moveHistory.map((m,i)=>i%2===0?`${Math.floor(i/2)+1}. ${m}`:m).join(' ');
  navigator.clipboard.writeText(pgn).then(()=>{
    const btn=document.querySelector('.tiny-btn');
    const orig=btn.textContent;btn.textContent='✓ Copied!';
    setTimeout(()=>btn.textContent=orig,1500);
  }).catch(()=>alert(pgn));
}

// ── Status & Game over ─────────────────────
function updateStatus(){
  const status=document.getElementById('status');
  const stuck=noLegalMoves(currentTurn);
  if(stuck&&isInCheck(currentTurn)){ playSound('gameover');endGame(`${currentTurn==='white'?'Black':'White'} wins by Checkmate!`,currentTurn==='white'?'black':'white');status.textContent='Checkmate!';return; }
  if(stuck){ playSound('gameover');endGame("Stalemate — It's a draw!",'draw');status.textContent='Stalemate!';return; }
  if(halfMoveClock>=100){ playSound('gameover');endGame("Draw — 50-move rule",'draw');return; }
  if(positionCounts[positionKey()]>=3){ playSound('gameover');endGame("Draw — Threefold repetition",'draw');return; }
  if(insufficientMaterial()){ playSound('gameover');endGame("Draw — Insufficient material",'draw');return; }
  if(isInCheck(currentTurn)){ playSound('check');status.textContent=`${currentTurn==='white'?'White':'Black'} is in Check!`;return; }
  status.textContent=`${currentTurn==='white'?'White':'Black'}'s turn`;
}

function endGame(msg,winner){
  if(gameOver)return;
  gameOver=true;clearInterval(timerInterval);
  if(winner==='white')gameStats.white++;else if(winner==='black')gameStats.black++;else gameStats.draws++;
  localStorage.setItem('chess-stats',JSON.stringify(gameStats));
  if(winner!=='draw')launchConfetti();
  setTimeout(()=>{
    hide('game-screen');show('gameover-screen');
    document.getElementById('gameover-text').textContent=msg;
    document.getElementById('gameover-icon').textContent=winner==='draw'?'🤝':'🏆';
    document.getElementById('gameover-score').textContent=`White: ${gameStats.white} | Draws: ${gameStats.draws} | Black: ${gameStats.black}`;
  },700);
}

// ── Sidebar ────────────────────────────────
function updateCaptured(){
  document.getElementById('white-captured').textContent=capturedByWhite.join(' ')||'—';
  document.getElementById('black-captured').textContent=capturedByBlack.join(' ')||'—';
}
function updateMoveHistory(){
  const list=document.getElementById('move-list');
  list.innerHTML='';
  moveHistory.forEach((m,i)=>{
    const li=document.createElement('li');li.textContent=m;
    li.onclick=()=>goToMove(i);
    if(historyIndex!==-1&&i===historyIndex-1)li.classList.add('active-move');
    list.appendChild(li);
  });
  list.scrollTop=list.scrollHeight;
}
function updateMaterial(){
  let w=0,b=0;
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=gameBoard[r][c];if(isWhite(p))w+=PIECE_VALUES[p]||0;else if(isBlack(p))b+=PIECE_VALUES[p]||0;}
  const diff=w-b;
  document.getElementById('material-score').textContent=diff>0?`White +${diff}`:diff<0?`Black +${Math.abs(diff)}`:'Equal';
}
function updateScoreBar(){
  document.getElementById('score-white').textContent=gameStats.white;
  document.getElementById('score-black').textContent=gameStats.black;
  document.getElementById('score-draws').textContent=gameStats.draws;
}
function updateEvalBar(){
  const fill=document.getElementById('eval-fill'), num=document.getElementById('eval-num');
  if(!fill)return;
  const score=evaluate();                       // centipawns, + = White better
  const pct=50+50*Math.tanh(score/500);
  // CSS decides whether this drives height (desktop) or width (mobile)
  fill.style.setProperty('--pct',Math.max(3,Math.min(97,pct))+'%');
  const pawns=score/100;
  num.textContent=(pawns>0?'+':'')+pawns.toFixed(1);
}

// ── Confetti ───────────────────────────────
function launchConfetti(){
  const canvas=document.getElementById('confetti-canvas');
  canvas.width=window.innerWidth;canvas.height=window.innerHeight;canvas.style.display='block';
  const ctx=canvas.getContext('2d');
  const colors=['#e2b96f','#f0d9b5','#7fc97f','#4a9eff','#e74c3c','#fff','#a29bfe'];
  const p=Array.from({length:180},()=>({x:Math.random()*canvas.width,y:Math.random()*canvas.height-canvas.height,r:Math.random()*6+2,d:Math.random()*3+1.5,color:colors[Math.floor(Math.random()*colors.length)],tilt:Math.random()*10-10,ts:Math.random()*0.1+0.05,rot:Math.random()*Math.PI*2}));
  let f=0;
  function draw(){ctx.clearRect(0,0,canvas.width,canvas.height);p.forEach(q=>{ctx.save();ctx.translate(q.x,q.y);ctx.rotate(q.rot);ctx.fillStyle=q.color;ctx.fillRect(-q.r/2,-q.r/2,q.r,q.r*2);ctx.restore();q.y+=q.d;q.tilt+=q.ts;q.x+=Math.sin(q.tilt)*1.5;q.rot+=0.05;});f++;if(f<240)requestAnimationFrame(draw);else{ctx.clearRect(0,0,canvas.width,canvas.height);canvas.style.display='none';}}
  draw();
}

// ── Bot ────────────────────────────────────
const PST={
  '♙':[[0,0,0,0,0,0,0,0],[50,50,50,50,50,50,50,50],[10,10,20,30,30,20,10,10],[5,5,10,25,25,10,5,5],[0,0,0,20,20,0,0,0],[5,-5,-10,0,0,-10,-5,5],[5,10,10,-20,-20,10,10,5],[0,0,0,0,0,0,0,0]],
  '♘':[[-50,-40,-30,-30,-30,-30,-40,-50],[-40,-20,0,0,0,0,-20,-40],[-30,0,10,15,15,10,0,-30],[-30,5,15,20,20,15,5,-30],[-30,0,15,20,20,15,0,-30],[-30,5,10,15,15,10,5,-30],[-40,-20,0,5,5,0,-20,-40],[-50,-40,-30,-30,-30,-30,-40,-50]]
};
function evaluate(){
  let score=0;
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
    const p=gameBoard[r][c];if(!p)continue;
    const val=(PIECE_VALUES[p]||0)*100;
    let bonus=0;
    if(p==='♙')bonus=PST['♙'][r][c];if(p==='♟')bonus=-PST['♙'][7-r][c];
    if(p==='♘')bonus=PST['♘'][r][c];if(p==='♞')bonus=-PST['♘'][7-r][c];
    score+=isWhite(p)?val+bonus:-(val+bonus);
  }
  return score;
}
function allMoves(color){
  const moves=[];
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
    const p=gameBoard[r][c];if(!p)continue;
    if(color==='white'&&!isWhite(p))continue;
    if(color==='black'&&!isBlack(p))continue;
    getLegalMoves(r,c).forEach(([tr,tc])=>moves.push([r,c,tr,tc]));
  }
  return moves;
}
function minimax(depth,alpha,beta,maximizing){
  if(depth===0)return evaluate();
  const color=maximizing?'white':'black',moves=allMoves(color);
  if(!moves.length)return isInCheck(color)?(maximizing?-99999:99999):0;
  if(maximizing){
    let best=-Infinity;
    for(const[fr,fc,tr,tc]of moves){const s=gameBoard[tr][tc];gameBoard[tr][tc]=gameBoard[fr][fc];gameBoard[fr][fc]='';best=Math.max(best,minimax(depth-1,alpha,beta,false));gameBoard[fr][fc]=gameBoard[tr][tc];gameBoard[tr][tc]=s;alpha=Math.max(alpha,best);if(beta<=alpha)break;}
    return best;
  }else{
    let best=Infinity;
    for(const[fr,fc,tr,tc]of moves){const s=gameBoard[tr][tc];gameBoard[tr][tc]=gameBoard[fr][fc];gameBoard[fr][fc]='';best=Math.min(best,minimax(depth-1,alpha,beta,true));gameBoard[fr][fc]=gameBoard[tr][tc];gameBoard[tr][tc]=s;beta=Math.min(beta,best);if(beta<=alpha)break;}
    return best;
  }
}
function findBestMove(color,depth){
  const moves=allMoves(color); if(!moves.length) return null;
  const maxing=(color==='white');
  let best=null, bestScore=maxing?-Infinity:Infinity;
  for(const[fr,fc,tr,tc]of moves){
    const s=gameBoard[tr][tc]; gameBoard[tr][tc]=gameBoard[fr][fc]; gameBoard[fr][fc]='';
    const score=minimax(depth-1,-Infinity,Infinity,!maxing);
    gameBoard[fr][fc]=gameBoard[tr][tc]; gameBoard[tr][tc]=s;
    if(maxing?score>bestScore:score<bestScore){ bestScore=score; best=[fr,fc,tr,tc]; }
  }
  return best;
}
function botMove(){
  if(gameOver)return;
  const depth=botDifficulty==='easy'?1:botDifficulty==='medium'?2:3;
  const bestMove=findBestMove('black',depth);
  hide('bot-thinking');
  if(bestMove)movePiece(bestMove[0],bestMove[1],bestMove[2],bestMove[3],true);
}

// ── Hint (suggests your best move) ─────────
function showHint(){
  if(gameOver||historyIndex!==-1)return;
  const color=gameMode==='bot'?'white':currentTurn;
  if(gameMode==='bot'&&currentTurn!=='white')return;
  const best=findBestMove(color,2);
  if(best){ arrows=[{from:[best[0],best[1]],to:[best[2],best[3]]}]; drawArrows(); }
}

// ── Init ───────────────────────────────────
(function(){
  const saved=localStorage.getItem('chess-stats');
  if(saved)gameStats=JSON.parse(saved);
  const theme=localStorage.getItem('chess-theme')||'classic';
  setTheme(theme);updateScoreBar();
  if(localStorage.getItem('chess-sound')==='0'){ soundEnabled=false; document.getElementById('sound-btn').textContent='🔇'; }
})();
