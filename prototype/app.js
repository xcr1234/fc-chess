(() => {
  'use strict';
  const canvas = document.querySelector('#screen');
  const ctx = canvas.getContext('2d');
  const live = document.querySelector('#status');
  const hotspots = document.querySelector('#hotspots');
  let screenActions = new Map(), hotspotSignature = '';
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect(), ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * ratio)), height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  }
  new ResizeObserver(resizeCanvas).observe(canvas);
  window.addEventListener('resize', resizeCanvas);
  const portrait = new Image(); portrait.src = 'assets/original-opponents.jpg';
  const reference = new Image(); reference.src = 'assets/original-screen.png';
  const finger = document.createElement('canvas'); finger.width = finger.height = 16;
  let fingerReady = false;
  reference.onload = () => {
    try {
    const f = finger.getContext('2d'); f.drawImage(reference, 216, 192, 16, 16, 0, 0, 16, 16);
    const pixels = f.getImageData(0, 0, 16, 16), background = Array.from(pixels.data.slice(0, 3));
    for (let i = 0; i < pixels.data.length; i += 4) if (background.every((v, c) => Math.abs(v - pixels.data[i + c]) < 6)) pixels.data[i + 3] = 0;
    f.putImageData(pixels, 0, 0); fingerReady = true;
    } catch { fingerReady = false; } // file:// may restrict pixel reads; keep the drawn fallback hand.
  };
  const C = { navy: '#193b57', green: '#3defa0', cyan: '#28eff0', purple: '#6840fa', pink: '#f5a4cf', paper: '#bbc6c8', line: '#352599', red: '#f33d43', blue: '#2818a0', white: '#fff9e9', black: '#071415' };
  const names = ['困难', '快速模式', '自定义模式'];
  const subnames = ['经典老头 · 原味等待', '经典老头 · 快速思考', '修改己方初始棋子'];
  const glyphs = { r: '車', n: '馬', e: '象', a: '士', k: '將', c: '砲', p: '卒', R: '俥', N: '傌', E: '相', A: '仕', K: '帥', C: '炮', P: '兵' };
  const choices = ['R', 'N', 'C', 'E', 'A', 'P'];
  const gridX = 56, gridY = 48, step = 16;
  const state = { scene: 'menu', menu: 0, mode: 0, board: [], initial: [], cursor: {x: 0, y: 6}, zone: 'board', sideIndex: 0, selected: null, turn: 'red', history: [], pending: 0, modal: null, palette: null, message: '请选择模式', resultIndex: 0, moves: 0, inputMethod: 'pointer' };
  function announce(message) { state.message = message; live.textContent = message; }
  function initialBoard() {
    const board = Array(90).fill(null);
    'rneakaenr'.split('').forEach((p, x) => { board[x] = p; board[81 + x] = p.toUpperCase(); });
    board[19] = board[25] = 'c'; board[64] = board[70] = 'C';
    [0, 2, 4, 6, 8].forEach(x => { board[27 + x] = 'p'; board[54 + x] = 'P'; });
    return board;
  }
  function isRed(piece) { return !!piece && piece === piece.toUpperCase(); }
  function resetGame(board = initialBoard(), mode = state.menu) {
    Object.assign(state, { scene: 'game', mode, board: board.slice(), initial: board.slice(), cursor: {x: 0, y: 6}, zone: 'board', sideIndex: 0, selected: null, turn: 'red', history: [], pending: 0, modal: null, palette: null, moves: 0 });
    announce('紅方走棋');
  }
  function enterEdit() {
    Object.assign(state, {scene: 'edit', mode: 2, board: initialBoard(), cursor: {x: 0, y: 6}, zone: 'board', sideIndex: 0, selected: null, turn: 'red', pending: 0, history: [], moves: 0, modal: null, palette: null});
    announce('點擊己方棋子，修改棋種');
  }
  function toMenu() {
    Object.assign(state, {scene: 'menu', selected: null, pending: 0, modal: null, palette: null, zone: 'board'});
    announce('請選擇模式');
  }
  function text(value, x, y, color = C.green, size = 9, align = 'left') {
    ctx.fillStyle = color; ctx.font = `${size}px "SimSun", "Songti SC", serif`; ctx.textAlign = align; ctx.textBaseline = 'top'; ctx.fillText(value, x, y);
  }
  function box(x, y, w, h, fill, line = C.green) {
    ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
  }
  function head(x, y, size = 32) {
    ctx.fillStyle = C.pink; ctx.fillRect(x, y, size, size);
    if (portrait.complete && portrait.naturalWidth) {
      // Display the difficult opponent area of the unmodified reference sheet.
      ctx.drawImage(portrait, 56, 230, 79, 80, x, y, size, size);
    } else { text('老', x + size / 2, y + 8, C.black, 18, 'center'); }
  }
  function hand(x, y) {
    if (fingerReady) {
      ctx.drawImage(finger, Math.round(x), Math.round(y));
    } else {
      ctx.fillStyle = '#f8b18e'; ctx.fillRect(x + 3, y, 3, 9); ctx.fillRect(x + 3, y + 5, 9, 7); ctx.fillStyle = C.black; ctx.strokeRect(x + 3.5, y + .5, 3, 8);
    }
  }
  function menuScreen() {
    ctx.fillStyle = C.purple; ctx.fillRect(0, 0, 256, 224);
    box(57, 10, 142, 33, '#d60059', C.pink); text('中國象棋', 128, 14, '#fff2c5', 25, 'center');
    const rows = [58, 109, 160];
    rows.forEach((y, i) => {
      ctx.fillStyle = '#140948'; ctx.fillRect(34, y + 5, 35, 35); head(29, y, 35);
      text(names[i], 81, y + 3, C.white, 15); text(subnames[i], 81, y + 24, '#e2d0ff', 8);
      if (state.menu === i) hand(64, y + 9);
    });
    text('點擊模式，開始對局', 128, 207, C.white, 8, 'center');
  }
  function boardScreen(now) {
    ctx.fillStyle = C.navy; ctx.fillRect(0, 0, 256, 224);
    text(state.scene === 'edit' ? '自定義棋子' : '第 1-1 關', 128, 9, C.cyan, 10, 'center');
    text('黑方', 8, 42); text('電腦', 8, 56); text('1 級', 8, 72); text('03:00', 5, 94, C.cyan, 8);
    text('紅方', 8, 138); text('人腦', 8, 152); text('9 級', 8, 168); text('03:00', 5, 190, C.cyan, 8);
    text(state.turn === 'black' ? '黑方' : '紅方', 226, 18, C.green, 10, 'center');
    text(`${String(state.moves).padStart(3, '0')}手`, 226, 36, C.green, 8, 'center');
    head(210, 56, 32);
    box(48, 40, 144, 160, C.paper, '#f2f2c5');
    ctx.strokeStyle = C.line; ctx.lineWidth = 1;
    for (let y = 0; y < 10; y++) {
      ctx.beginPath(); ctx.moveTo(gridX + .5, gridY + y * step + .5); ctx.lineTo(gridX + 128.5, gridY + y * step + .5); ctx.stroke();
    }
    for (let x = 0; x < 9; x++) {
      ctx.beginPath(); ctx.moveTo(gridX + x * step + .5, gridY + .5); ctx.lineTo(gridX + x * step + .5, gridY + (x === 0 || x === 8 ? 144.5 : 64.5));
      if (x !== 0 && x !== 8) { ctx.moveTo(gridX + x * step + .5, gridY + 80.5); ctx.lineTo(gridX + x * step + .5, gridY + 144.5); } ctx.stroke();
    }
    [0, 7].forEach(y => {
      ctx.beginPath(); ctx.moveTo(gridX + 48.5, gridY + y * step + .5); ctx.lineTo(gridX + 80.5, gridY + (y + 2) * step + .5); ctx.moveTo(gridX + 80.5, gridY + y * step + .5); ctx.lineTo(gridX + 48.5, gridY + (y + 2) * step + .5); ctx.stroke();
    });
    text('楚河', 73, 116, C.line, 11); text('漢界', 137, 116, C.line, 11);
    state.board.forEach((p, i) => {
      if (!p) return;
      const x = gridX + (i % 9) * step, y = gridY + Math.floor(i / 9) * step;
      ctx.beginPath(); ctx.arc(x, y, 7.5, 0, Math.PI * 2); ctx.fillStyle = '#fffdef'; ctx.fill(); ctx.strokeStyle = isRed(p) ? C.red : C.blue; ctx.stroke();
      text(glyphs[p], x, y - 5, isRed(p) ? C.red : C.blue, 10, 'center');
      if (i === state.selected) {
        ctx.strokeStyle = '#fff29a'; ctx.lineWidth = 1; ctx.strokeRect(x - 8, y - 8, 16, 16);
        ctx.strokeStyle = '#685419'; ctx.lineWidth = .5; ctx.strokeRect(x - 8.5, y - 8.5, 17, 17);
      }
    });
    const buttons = state.scene === 'edit' ? ['全部改車', '恢復初始', '開始對局', '返回'] : ['悔棋', '認輸', '模式選擇'];
    buttons.forEach((label, i) => {
      const y = 122 + i * 21;
      box(204, y, 47, 17, state.zone === 'panel' && state.sideIndex === i ? '#067347' : '#00482f', C.green);
      text(label, 227, y + 4, C.green, 8, 'center');
    });
    if (state.inputMethod === 'keyboard' && !state.modal && !state.palette) {
      if (state.zone === 'panel') hand(194, 124 + state.sideIndex * 21);
      else { ctx.strokeStyle = '#ffeda3'; ctx.lineWidth = .7; ctx.strokeRect(gridX + state.cursor.x * step - 8, gridY + state.cursor.y * step - 8, 16, 16); }
    }
    text(state.message, 128, 210, C.cyan, 8, 'center');
  }
  function paletteScreen() {
    box(37, 67, 182, 98, C.navy, C.cyan); text('改成哪種棋子？', 128, 77, C.cyan, 11, 'center');
    choices.forEach((piece, i) => {
      const x = 86 + (i % 3) * 45, y = 105 + Math.floor(i / 3) * 28;
      text(glyphs[piece], x, y, C.white, 15, 'center'); if (i === state.palette.choice) hand(x - 19, y + 1);
    });
  }
  function modalScreen() {
    const m = state.modal; box(29, 77, 198, 72, C.navy, C.cyan);
    text(m.type === 'resign' ? '要認輸嗎？' : m.type === 'menu' ? '返回模式選擇？' : '重新配置開局？', 128, 88, C.white, 12, 'center');
    if (m.type !== 'resign') text('將結束當前演示局', 128, 105, C.cyan, 9, 'center');
    text('是', 92, 127, C.green, 10, 'center'); text('否', 164, 127, C.green, 10, 'center'); hand(m.choice === 0 ? 73 : 145, 125);
  }
  function resultScreen() {
    box(42, 70, 172, 93, C.navy, C.cyan); text('您認輸了', 128, 82, C.white, 16, 'center');
    text('再來一局', 128, 116, C.green, 11, 'center'); text('模式選擇', 128, 139, C.green, 11, 'center'); hand(86, state.resultIndex === 0 ? 114 : 137);
  }
  // Preview geometry only: no self-check, repetition, checkmate or chess engine.
  function basicMove(board, from, to) {
    const p = board[from], target = board[to];
    if (!p || from === to || (target && isRed(p) === isRed(target)) || (target && target.toLowerCase() === 'k')) return false;
    const x = from % 9, y = Math.floor(from / 9), tx = to % 9, ty = Math.floor(to / 9), dx = tx - x, dy = ty - y, ax = Math.abs(dx), ay = Math.abs(dy), red = isRed(p);
    const palace = tx >= 3 && tx <= 5 && (red ? ty >= 7 : ty <= 2);
    if (p.toLowerCase() === 'p') return (dx === 0 && dy === (red ? -1 : 1)) || (ax === 1 && dy === 0 && (red ? y <= 4 : y >= 5));
    if (p.toLowerCase() === 'k') return palace && ax + ay === 1;
    if (p.toLowerCase() === 'a') return palace && ax === 1 && ay === 1;
    if (p.toLowerCase() === 'e') return ax === 2 && ay === 2 && (red ? ty >= 5 : ty <= 4) && !board[(y + dy / 2) * 9 + x + dx / 2];
    if (p.toLowerCase() === 'n') return ax === 2 && ay === 1 ? !board[y * 9 + x + Math.sign(dx)] : ax === 1 && ay === 2 && !board[(y + Math.sign(dy)) * 9 + x];
    if (dx && dy) return false;
    let count = 0; const stride = dx ? Math.sign(dx) : 9 * Math.sign(dy);
    for (let i = from + stride; i !== to; i += stride) if (board[i]) count++;
    return p.toLowerCase() === 'r' ? count === 0 : count === (target ? 1 : 0);
  }
  function playSquare() {
    if (state.turn !== 'red') { announce('老頭正在思考'); return; }
    const i = state.cursor.y * 9 + state.cursor.x, p = state.board[i];
    if (state.selected === null) {
      if (isRed(p)) { state.selected = i; announce('點擊目標落子，再點棋子取消'); } else announce('請選擇己方棋子');
      return;
    }
    if (i === state.selected) { state.selected = null; announce('已取消選子'); return; }
    if (isRed(p)) { state.selected = i; return; }
    if (!basicMove(state.board, state.selected, i)) { announce('這步不能走'); return; }
    state.history.push({board: state.board.slice(), moves: state.moves});
    state.board[i] = state.board[state.selected]; state.board[state.selected] = null; state.selected = null; state.moves++;
    state.turn = 'black'; state.pending = state.mode === 1 ? 700 : 12000; announce('老頭正在思考');
  }
  function demoReply() {
    let from = 19, to = 22;
    if (!(state.board[from] === 'c' && basicMove(state.board, from, to))) {
      from = -1;
      for (let y = 3; y < 9 && from < 0; y++) for (let x = 0; x < 9 && from < 0; x++) {
        const i = y * 9 + x; if (state.board[i] === 'p' && basicMove(state.board, i, i + 9)) { from = i; to = i + 9; }
      }
    }
    if (from >= 0) { state.board[to] = state.board[from]; state.board[from] = null; state.moves++; }
    state.pending = 0; state.turn = 'red'; announce('紅方走棋');
  }
  function panelAction() {
    if (state.scene === 'edit') {
      if (state.sideIndex === 0) { state.board = state.board.map(p => isRed(p) && p !== 'K' ? 'R' : p); announce('己方：1 帥 + 15 車'); }
      if (state.sideIndex === 1) { state.board = initialBoard(); announce('已恢復初始棋子'); }
      if (state.sideIndex === 2) resetGame(state.board, 2);
      if (state.sideIndex === 3) toMenu();
      return;
    }
    if (state.sideIndex === 0) {
      const last = state.history.pop();
      if (!last) { announce('尚無棋步可悔'); return; }
      state.board = last.board.slice(); state.moves = last.moves; state.turn = 'red'; state.pending = 0; state.selected = null; announce('已悔棋，紅方走棋');
    } else state.modal = {type: state.sideIndex === 1 ? 'resign' : 'menu', choice: 1};
  }
  function input(key) {
    const direction = ['up', 'down', 'left', 'right'].includes(key);
    if (state.scene === 'menu') {
      if (key === 'up' || key === 'down') { state.menu = (state.menu + (key === 'up' ? 2 : 1)) % 3; announce(names[state.menu]); }
      if (key === 'ok' || key === 'start') { if (state.menu === 2) enterEdit(); else resetGame(); }
      return;
    }
    if (state.scene === 'result') {
      if (direction) state.resultIndex = 1 - state.resultIndex;
      if (key === 'ok' || key === 'start') { if (state.resultIndex === 0) resetGame(state.initial, state.mode); else toMenu(); }
      if (key === 'cancel') toMenu();
      return;
    }
    if (state.modal) {
      if (direction) state.modal.choice = 1 - state.modal.choice;
      if (key === 'cancel') state.modal = null;
      if (key === 'ok') {
        const m = state.modal; state.modal = null;
        if (m.choice === 0) {
          if (m.type === 'custom') enterEdit();
          else if (m.type === 'menu') toMenu();
          else { state.pending = 0; state.selected = null; state.scene = 'result'; state.resultIndex = 0; announce('您認輸了'); }
        }
      }
      return;
    }
    if (state.palette) {
      if (direction) {
        let index = state.palette.choice;
        if (key === 'left') index = (index + 5) % 6;
        if (key === 'right') index = (index + 1) % 6;
        if (key === 'up' || key === 'down') index = (index + 3) % 6;
        state.palette.choice = index;
      }
      if (key === 'ok') { state.board[state.palette.square] = choices[state.palette.choice]; state.palette = null; announce('已修改棋子'); }
      if (key === 'cancel') state.palette = null;
      return;
    }
    if (key === 'select') { if (state.selected !== null) return; state.zone = state.zone === 'board' ? 'panel' : 'board'; return; }
    if (key === 'cancel') { if (state.zone === 'panel') state.zone = 'board'; state.selected = null; announce(state.scene === 'edit' ? '點擊己方棋子，修改棋種' : (state.turn === 'red' ? '紅方走棋' : '老頭正在思考')); return; }
    if (direction) {
      if (state.zone === 'panel') {
        const count = state.scene === 'edit' ? 4 : 3;
        if (key === 'up') state.sideIndex = (state.sideIndex + count - 1) % count;
        if (key === 'down') state.sideIndex = (state.sideIndex + 1) % count;
        if (key === 'left') { state.zone = 'board'; state.cursor.x = 8; }
      } else {
        if (key === 'right' && state.cursor.x === 8 && state.selected === null) { state.zone = 'panel'; state.sideIndex = 0; }
        else { state.cursor.x = Math.max(0, Math.min(8, state.cursor.x + (key === 'left' ? -1 : key === 'right' ? 1 : 0))); state.cursor.y = Math.max(0, Math.min(9, state.cursor.y + (key === 'up' ? -1 : key === 'down' ? 1 : 0))); }
      }
    }
    if (key === 'ok') {
      if (state.zone === 'panel') { panelAction(); return; }
      if (state.scene === 'edit') {
        const square = state.cursor.y * 9 + state.cursor.x, p = state.board[square];
        if (p === 'K') announce('帥保留，不能修改');
        else if (isRed(p)) state.palette = {square, choice: Math.max(0, choices.indexOf(p))};
        else announce('只能修改己方棋子');
      } else playSquare();
    }
  }
  const mapping = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', z: 'ok', Z: 'ok', x: 'cancel', X: 'cancel', Escape: 'cancel', Enter: 'start', Shift: 'select' };
  window.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target.closest?.('button') && ['Enter', ' '].includes(event.key)) return;
    const key = mapping[event.key]; if (!key) return; event.preventDefault();
    if (event.repeat && !['up', 'down', 'left', 'right'].includes(key)) return;
    state.inputMethod = 'keyboard';
    input(key);
  });
  function region(list, id, x, y, w, h, label, run) { list.push({id, x, y, w, h, label, run}); }
  function updateHotspots() {
    const list = [];
    if (state.scene === 'menu') {
      [58, 109, 160].forEach((y, i) => region(list, `mode-${i}`, 24, y - 4, 215, 44, names[i], () => { state.menu = i; input('ok'); }));
    } else if (state.modal) {
      ['是', '否'].forEach((label, i) => region(list, `dialog-${i}`, 62 + i * 72, 119, 60, 23, label, () => { state.modal.choice = i; input('ok'); }));
    } else if (state.palette) {
      choices.forEach((piece, i) => region(list, `piece-${i}`, 64 + (i % 3) * 45, 99 + Math.floor(i / 3) * 28, 43, 27, `改为${glyphs[piece]}`, () => { state.palette.choice = i; input('ok'); }));
    } else if (state.scene === 'result') {
      ['再来一局', '模式选择'].forEach((label, i) => region(list, `result-${i}`, 80, 109 + i * 23, 96, 23, label, () => { state.resultIndex = i; input('ok'); }));
    } else {
      const labels = state.scene === 'edit' ? ['全部改车', '恢复初始', '开始对局', '返回'] : ['悔棋', '认输', '模式选择'];
      labels.forEach((label, i) => region(list, `panel-${i}`, 203, 121 + i * 21, 49, 19, label, () => { state.zone = 'panel'; state.sideIndex = i; panelAction(); }));
    }
    screenActions = new Map(list.map(r => [r.id, r.run]));
    const signature = JSON.stringify(list.map(({run, ...r}) => r));
    if (signature !== hotspotSignature) {
      hotspotSignature = signature;
      hotspots.replaceChildren(...list.map(r => {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'hotspot'; button.textContent = r.label; button.setAttribute('aria-label', r.label);
        Object.assign(button.style, {left: `${r.x / 256 * 100}%`, top: `${r.y / 224 * 100}%`, width: `${r.w / 256 * 100}%`, height: `${r.h / 224 * 100}%`});
        button.addEventListener('click', () => { state.inputMethod = 'pointer'; screenActions.get(r.id)?.(); });
        return button;
      }));
    }
  }
  canvas.addEventListener('click', event => {
    if (event.button !== 0 || state.modal || state.palette || !['game', 'edit'].includes(state.scene)) return;
    const rect = canvas.getBoundingClientRect(), x = (event.clientX - rect.left) / rect.width * 256, y = (event.clientY - rect.top) / rect.height * 224;
    const column = Math.round((x - gridX) / step), row = Math.round((y - gridY) / step);
    if (x < 48 || x >= 192 || y < 40 || y >= 200 || column < 0 || column > 8 || row < 0 || row > 9) return;
    state.inputMethod = 'pointer'; state.zone = 'board'; state.cursor = {x: column, y: row};
    canvas.focus({preventScroll: true}); input('ok');
  });
  let previous = performance.now();
  function frame(now) {
    const dt = Math.max(0, now - previous); previous = now;
    if (state.scene === 'game' && !state.modal && state.pending > 0) { state.pending -= dt; if (state.pending <= 0) demoReply(); }
    resizeCanvas();
    ctx.setTransform(canvas.width / 256, 0, 0, canvas.height / 224, 0, 0);
    ctx.imageSmoothingEnabled = false;
    if (state.scene === 'menu') menuScreen();
    else { boardScreen(now); if (state.palette) paletteScreen(); if (state.modal) modalScreen(); if (state.scene === 'result') resultScreen(); }
    updateHotspots();
    const description = `FC 中国象棋，${state.scene === 'menu' ? '选择模式：' + names[state.menu] : (state.scene === 'edit' ? '自定义编辑' : names[state.mode])}，${state.message}，右侧${state.turn === 'black' ? '黑方' : '红方'} ${String(state.moves).padStart(3, '0')}手，光标 ${state.cursor.x + 1} 路 ${state.cursor.y + 1} 行，${state.selected === null ? '未选棋子' : '已选中' + glyphs[state.board[state.selected]]}，己方${state.board.filter(isRed).length}子、${state.board.filter(p => p === 'R').length}车。点击棋子选择，再点击目标落子，再点一次取消。`;
    if (canvas.getAttribute('aria-label') !== description) canvas.setAttribute('aria-label', description);
    requestAnimationFrame(frame);
  }
  canvas.focus({preventScroll: true}); requestAnimationFrame(frame);
})();
