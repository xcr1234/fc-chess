(() => {
  'use strict';
  const {isRed, initialBoard, basicMove, movesFor, threatensKing, waitingSeconds, formatStep, StepClock} = FCChessPreview;
  const clock = new StepClock();
  let draft = null, generation = 0;
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
  const C = { navy: '#193b57', green: '#3defa0', cyan: '#28eff0', purple: '#6840fa', pink: '#f5a4cf', paper: '#bbc6c8', line: '#352599', red: '#f33d43', blue: '#2818a0', white: '#fff9e9', black: '#071415' };
  const names = ['困难', '快速模式', '自定义模式'];
  const subnames = ['经典老头 · 原味等待', '经典老头 · 快速思考', '修改己方初始棋子'];
  const glyphs = { r: '車', n: '馬', e: '象', a: '士', k: '將', c: '包', p: '卒', R: '俥', N: '傌', E: '相', A: '仕', K: '帥', C: '炮', P: '兵' };
  const choices = ['R', 'N', 'C', 'E', 'A', 'P'];
  const gridX = 56, gridY = 48, step = 16;
  const state = { scene: 'menu', menu: 0, mode: 0, board: [], initial: [], cursor: {x: 0, y: 6}, zone: 'board', sideIndex: 0, selected: null, turn: 'red', history: [], reply: null, modal: null, palette: null, message: '请选择模式', resultIndex: 0, moves: 0, inputMethod: 'pointer' };
  state.audio={music:10167,volume:100,sfx:true};state.musicCategory=0;state.musicPage=0;
  const musicById=new Map(FCChessMusicCatalog.map(([id,name,seconds,category])=>[id,{id,name,seconds,category}]));
  const recommended=[10167,10029,10161];
  const musicName=id=>musicById.get(id)?.name||'無BGM';
  function musicRows() {
    const rows=FCChessMusicCatalog.map(([id])=>musicById.get(id)).filter(r=>state.musicCategory===0||r.category===state.musicCategory-1);
    const priority=id=>{const i=recommended.indexOf(id);return i<0?recommended.length:i;};
    return rows.sort((a,b)=>priority(a.id)-priority(b.id));
  }
  function settingsAction(name) {
    if(name==='SettingsButton'&&!state.modal&&!state.palette&&['menu','game','result-review'].includes(state.scene)){
      state.settingsReturnScene=state.scene;state.settingsOpenedAt=performance.now();clock.stop(state.settingsOpenedAt);state.scene='audio-settings';return;
    }
    if(state.scene==='audio-settings'){
      if(name==='SettingsBack'){
        state.scene=state.settingsReturnScene||'menu';state.settingsReturnScene=null;
        if(state.scene==='game'){if(state.reply)state.reply.due+=performance.now()-state.settingsOpenedAt;clock.update(performance.now());clock.side=state.turn;}
      }
      else if(name==='MusicButton'){state.musicPage=0;state.musicCategory=0;state.scene='music-select';}
      else if(name==='VolumeDown')state.audio.volume=Math.max(0,state.audio.volume-10);
      else if(name==='VolumeUp')state.audio.volume=Math.min(100,state.audio.volume+10);
      else if(name==='SfxToggle'){state.audio.sfx=!state.audio.sfx;if(!state.audio.sfx)for(const voice of moveVoices.values())voice.pause();}
    }else if(state.scene==='music-select'){
      const id=Number(name.match(/^PickMusic_(\d+)$/)?.[1]),category=Number(name.match(/^MusicCategory_(\d)$/)?.[1]);
      if(name==='MusicBack')state.scene='audio-settings';
      else if(name==='MusicOff'){state.audio.music=0;state.scene='audio-settings';}
      else if(musicById.has(id)){state.audio.music=id;state.scene='audio-settings';}
      else if(Number.isInteger(category)&&category>=0&&category<=4){state.musicCategory=category;state.musicPage=0;}
      else if(name==='MusicNext')state.musicPage=Math.min(Math.ceil(musicRows().length/5)-1,state.musicPage+1);
      else if(name==='MusicPrevious')state.musicPage=Math.max(0,state.musicPage-1);
    }
  }
  const moveVoices=new Map();
  function playEffect(id){
    if(!state.audio.sfx||typeof Audio==='undefined')return;
    if(!moveVoices.has(id))moveVoices.set(id,new Audio(`https://oss.070077.xyz/audio/${id}.mp3`));
    const voice=moveVoices.get(id);
    voice.currentTime=0;voice.play()?.catch(()=>{});
  }
  function playMoveSound(checking){playEffect(checking?50888:50882);}
  function announce(message) { state.message = message; live.textContent = message; }
  function resetGame(board = initialBoard(), mode = state.menu) {
    generation++; clock.reset(performance.now());
    Object.assign(state, { scene: 'game', mode, board: board.slice(), initial: board.slice(), cursor: {x: 0, y: 6}, zone: 'board', sideIndex: 0, selected: null, turn: 'red', history: [], reply: null, modal: null, palette: null, moves: 0 });
    announce('紅方走棋');
  }
  function enterEdit() {
    generation++; clock.reset(performance.now()); clock.stop(performance.now());
    Object.assign(state, {scene: 'edit', mode: 2, board: (draft || initialBoard()).slice(), cursor: {x: 0, y: 6}, zone: 'board', sideIndex: 0, selected: null, turn: 'red', reply: null, history: [], moves: 0, modal: null, palette: null});
    announce('點擊己方棋子，修改棋種');
  }
  function toMenu() {
    if (state.scene === 'edit') draft = state.board.slice();
    generation++; clock.stop(performance.now());
    Object.assign(state, {scene: 'menu', selected: null, reply: null, modal: null, palette: null, zone: 'board'});
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
  function focusRect(x, y, width, height) {
    ctx.strokeStyle = '#ffeda3'; ctx.lineWidth = .7; ctx.strokeRect(x, y, width, height);
  }
  function menuScreen() {
    ctx.fillStyle = C.purple; ctx.fillRect(0, 0, 256, 224);
    box(57, 10, 142, 33, '#d60059', C.pink); text('中國象棋', 128, 14, '#fff2c5', 25, 'center');
    const rows = [58, 109, 160];
    rows.forEach((y, i) => {
      ctx.fillStyle = '#140948'; ctx.fillRect(34, y + 5, 35, 35); head(29, y, 35);
      text(names[i], 81, y + 3, C.white, 15); text(subnames[i], 81, y + 24, '#e2d0ff', 8);
      if (state.inputMethod === 'keyboard' && state.menu === i) focusRect(24, y - 4, 215, 44);
    });
    text('點擊模式，開始對局', 100, 207, C.white, 8, 'center');
    box(197,198,50,22,'#00482f');text('設定',222,204,C.green,8,'center');
  }
  function settingsRegions(){
    const list=[];const add=(id,label,x,y,w,h)=>region(list,id,x-w/2,224-y-h/2,w,h,label,()=>settingsAction(id));
    if(state.scene==='audio-settings'){
      add('MusicButton',musicName(state.audio.music),164,156,120,24);
      add('VolumeDown','－',116,118,24,24);add('VolumeUp','＋',212,118,24,24);
      add('SfxToggle',state.audio.sfx?'開啟':'關閉',164,80,120,24);add('SettingsBack','返回',128,32,88,24);
    }else{
      add('MusicBack','返回',226,207,42,20);
      ['全部','探索','戰鬥','任務','其他'].forEach((name,i)=>add('MusicCategory_'+i,(state.musicCategory===i?'·':'')+name,34+i*47,182,44,20));
      add('MusicOff','無BGM',128,157,232,22);
      musicRows().slice(state.musicPage*5,state.musicPage*5+5).forEach((r,i)=>add('PickMusic_'+r.id,(state.audio.music===r.id?'已選 · ':'')+(recommended.includes(r.id)?'推薦 · ':'')+r.name,128,132-i*24,232,21));
      add('MusicPrevious','上一頁',48,14,68,20);add('MusicNext','下一頁',208,14,68,20);
    }
    return list;
  }
  function settingsScreen(){
    ctx.fillStyle=C.navy;ctx.fillRect(0,0,256,224);
    if(state.scene==='audio-settings'){
      text('聲音設定',128,18,C.white,16,'center');text('背景音樂',32,63.5,C.cyan,9);
      text('BGM音量',32,101.5,C.cyan,9);text(state.audio.volume+'%',164,100.5,C.white,11,'center');text('遊戲音效',32,139.5,C.cyan,9);
    }else{
      text('選擇背景音樂',113,10,C.white,13,'center');
      text((state.musicPage+1)+' / '+Math.ceil(musicRows().length/5),128,205,C.cyan,9,'center');
    }
    for(const r of settingsRegions()){box(r.x,r.y,r.w,r.h,'#00482f');text(r.label,r.x+r.w/2,r.y+(r.h-8)/2,C.green,8,'center');}
  }
  function boardScreen(now) {
    ctx.fillStyle = C.navy; ctx.fillRect(0, 0, 256, 224);
    if(state.scene!=='edit'){box(204,192.5,47,17,'#00482f');text('設定',227.5,197,C.green,8,'center');}
    if (state.scene === 'edit') text('自定義棋子', 128, 9, C.cyan, 10, 'center');
    text('黑方', 8, 42); text('電腦', 8, 56); text('1 級', 8, 72); text(state.scene === 'edit' ? '00:00' : formatStep(clock.black), 5, 94, C.cyan, 8);
    text('紅方', 8, 138); text('人腦', 8, 152); text('9 級', 8, 168); text(state.scene === 'edit' ? '00:00' : formatStep(clock.red), 5, 190, C.cyan, 8);
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
    const buttons = state.scene === 'edit' ? ['全部改車', '恢復初始', '開始對局', '返回'] : ['悔棋', '認輸', '返回標題界面'];
    buttons.forEach((label, i) => {
      const y = 122 + i * 21;
      box(204, y, 47, 17, state.zone === 'panel' && state.sideIndex === i ? '#067347' : '#00482f', C.green);
      text(label, 227, y + 4,state.scene==='result-review'&&i===1?'#78909a':C.green, state.scene!=='edit'&&i===2?7:8, 'center');
    });
    if (state.inputMethod === 'keyboard' && !state.modal && !state.palette) {
      if (state.zone !== 'panel') { ctx.strokeStyle = '#ffeda3'; ctx.lineWidth = .7; ctx.strokeRect(gridX + state.cursor.x * step - 8, gridY + state.cursor.y * step - 8, 16, 16); }
    }
    text(state.message, 128, 210, C.cyan, 8, 'center');
  }
  function paletteScreen() {
    box(37, 67, 182, 98, C.navy, C.cyan); text('改成哪種棋子？', 128, 77, C.cyan, 11, 'center');
    choices.forEach((piece, i) => {
      const x = 86 + (i % 3) * 45, y = 105 + Math.floor(i / 3) * 28;
      text(glyphs[piece], x, y, C.white, 15, 'center'); if (state.inputMethod === 'keyboard' && i === state.palette.choice) focusRect(x - 21, y - 6, 43, 27);
    });
  }
  function modalScreen() {
    const m = state.modal; box(29, 77, 198, 72, C.navy, C.cyan);
    text(m.type === 'undo' ? '要悔棋嗎？' : m.type === 'resign' ? '要認輸嗎？' : m.type === 'menu' ? '返回標題界面？' : '重新配置開局？', 128, 88, C.white, 12, 'center');
    if (m.type === 'menu') text('返回後無法恢復當前對局', 128, 105, C.cyan, 8, 'center');
    else if (m.type === 'custom') text('將結束當前演示局', 128, 105, C.cyan, 9, 'center');
    text('是', 92, 127, C.green, 10, 'center'); text('否', 164, 127, C.green, 10, 'center'); if (state.inputMethod === 'keyboard') focusRect(m.choice === 0 ? 62 : 134, 119, 60, 23);
  }
  function resultScreen() {
    box(42, 70, 172, 116, C.navy, C.cyan); text(state.resultTitle, 128, 80, C.white, 16, 'center');
    text(state.resultReason, 128, 101, C.cyan, 8, 'center');
    text('再來一局', 128, 116, C.green, 11, 'center'); text('返回標題界面', 128, 139, C.green, 11, 'center');text('返回棋盤',128,162,C.green,11,'center'); if (state.inputMethod === 'keyboard') focusRect(80, 109 + state.resultIndex * 23, 96, 23);
  }
  function finish(title, reason, outcome) {
    generation++; clock.stop(performance.now());
    Object.assign(state, {reply: null, selected: null, scene: 'result', resultIndex: 0, modal: null, resultTitle: title, resultReason: reason});
    announce(`${title}，${reason}`);
    if(outcome)playEffect(outcome==='win'?50228:50265);
  }
  function beginTurn(side) {
    state.turn = side; clock.start(side, performance.now());
    if (!movesFor(state.board, side, state.mode === 2).length) {
      const other = side === 'red' ? 'black' : 'red';
      if (!movesFor(state.board, other, state.mode === 2).length) { finish('本局無法繼續', '雙方暫無可走棋'); return; }
      state.turn = other; clock.start(other, performance.now());
      announce(`${side === 'red' ? '紅方' : '黑方'}無可走棋，本次跳過`);
    }
    if (state.turn === 'black') planReply();
    else announce('紅方走棋');
  }
  function commitMove(from, to) {
    clock.update(performance.now());
    const capturedKing = state.board[to]?.toLowerCase() === 'k', side = state.turn;
    state.board[to] = state.board[from]; state.board[from] = null; state.selected = null; state.moves++;
    playMoveSound(!capturedKing && threatensKing(state.board,side,state.mode===2));
    if (capturedKing) { finish(side === 'red' ? '您獲勝了' : '您落敗了', side === 'red' ? '吃掉黑將' : '紅帥被吃',side==='red'?'win':'lose'); return; }
    beginTurn(side === 'red' ? 'black' : 'red');
  }
  function planReply() {
    // One-ply demonstration choice, shared by all modes; not the production AI.
    const candidates = movesFor(state.board, 'black', state.mode === 2);
    const values = {k: 100000, r: 900, n: 400, c: 450, e: 200, a: 200, p: 100};
    let tactical = 0;
    for (const m of candidates) {
      const target = state.board[m.to], copy = state.board.slice();
      copy[m.to] = copy[m.from]; copy[m.from] = null;
      if (target || threatensKing(copy, 'black', state.mode === 2)) tactical++;
      m.score = (target ? values[target.toLowerCase()] : 0) + (m.from === 19 && m.to === 22 ? 20 : 0) + (state.board[m.from] === 'p' && m.to > m.from ? 10 : 0);
    }
    candidates.sort((a, b) => b.score - a.score || a.from - b.from || a.to - b.to);
    const seconds = waitingSeconds({count: candidates.length, tactical}, state.mode);
    state.reply = {move: candidates[0], due: performance.now() + seconds * 1000, generation};
    announce('老頭正在思考');
    if (seconds === 0 && !state.modal) demoReply();
  }
  function playSquare() {
    if(state.scene!=='game')return;
    if (state.turn !== 'red') { announce('老頭正在思考'); return; }
    const i = state.cursor.y * 9 + state.cursor.x, p = state.board[i];
    if (state.selected === null) {
      if (isRed(p)) { state.selected = i; announce('點擊目標落子，再點棋子取消'); } else announce('請選擇己方棋子');
      return;
    }
    if (i === state.selected) { state.selected = null; announce('已取消選子'); return; }
    if (isRed(p)) { state.selected = i; return; }
    if (!basicMove(state.board, state.selected, i, state.mode === 2)) { announce('這步不能走'); return; }
    state.history.push({board: state.board.slice(), moves: state.moves, blackTime: clock.black});
    commitMove(state.selected, i);
  }
  function demoReply() {
    const reply = state.reply; state.reply = null;
    if (!reply || reply.generation !== generation || state.scene !== 'game' || state.turn !== 'black') return;
    const m = reply.move;
    if (m && basicMove(state.board, m.from, m.to, state.mode === 2)) commitMove(m.from, m.to);
  }
  function panelAction() {
    clock.update(performance.now());
    if(state.scene==='result-review'&&state.sideIndex===1)return;
    if (state.scene === 'edit') {
      if (state.sideIndex === 0) { state.board = state.board.map(p => isRed(p) && p !== 'K' ? 'R' : p); announce('己方：1 帥 + 15 車'); }
      if (state.sideIndex === 1) { state.board = initialBoard(); announce('已恢復初始棋子'); }
      if (state.sideIndex === 2) { draft = state.board.slice(); resetGame(state.board, 2); }
      if (state.sideIndex === 3) toMenu();
      return;
    }
    if (state.sideIndex === 0) {
      if (!state.history.length) { announce('尚無棋步可悔'); return; }
      state.modal = {type: 'undo', choice: 1};
    } else state.modal = {type: state.sideIndex === 1 ? 'resign' : 'menu', choice: 1};
  }
  function undoMove() {
    const last = state.history.pop();
    if (!last) return;
    state.board = last.board.slice(); state.moves = last.moves; state.turn = 'red'; state.reply = null;state.scene='game';state.resultTitle=null;state.resultReason=null; generation++; clock.undo(last.blackTime, performance.now()); state.selected = null; announce('已悔棋，紅方走棋');
  }
  function input(key) {
    clock.update(performance.now());
    if(state.scene==='audio-settings'||state.scene==='music-select'){if(key==='cancel')settingsAction(state.scene==='music-select'?'MusicBack':'SettingsBack');return;}
    const direction = ['up', 'down', 'left', 'right'].includes(key);
    if (state.scene === 'menu') {
      if (key === 'up' || key === 'down') { state.menu = (state.menu + (key === 'up' ? 2 : 1)) % 3; announce(names[state.menu]); }
      if (key === 'ok' || key === 'start') { if (state.menu === 2) enterEdit(); else resetGame(); }
      return;
    }
    if (state.scene === 'result') {
      if (direction) state.resultIndex = (state.resultIndex + (key==='up'||key==='left'?2:1))%3;
      if (key === 'ok' || key === 'start') { if (state.resultIndex === 0) resetGame(state.initial, state.mode); else if(state.resultIndex===1)toMenu();else{state.scene='result-review';state.selected=null;state.zone='board';announce('本局已結束，悔棋後可繼續');} }
      if (key === 'cancel') toMenu();
      return;
    }
    if (state.modal) {
      if (direction) state.modal.choice = 1 - state.modal.choice;
      if (key === 'cancel') state.modal = null;
      if (key === 'ok') {
        const m = state.modal; state.modal = null;
        if (m.choice === 0) {
          if (m.type === 'undo') undoMove();
          else if (m.type === 'custom') enterEdit();
          else if (m.type === 'menu') toMenu();
          else finish('您落敗了', '主動認輸','lose');
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
    if (key === 'cancel') { if (state.zone === 'panel') state.zone = 'board'; state.selected = null; announce(state.scene === 'result-review'?'本局已結束，悔棋後可繼續':state.scene === 'edit' ? '點擊己方棋子，修改棋種' : (state.turn === 'red' ? '紅方走棋' : '老頭正在思考')); return; }
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
      region(list,'SettingsButton',197,198,50,22,'設定',()=>settingsAction('SettingsButton'));
    } else if(state.scene==='audio-settings'||state.scene==='music-select'){
      list.push(...settingsRegions());
    } else if (state.modal) {
      ['是', '否'].forEach((label, i) => region(list, `dialog-${i}`, 62 + i * 72, 119, 60, 23, label, () => { state.modal.choice = i; input('ok'); }));
    } else if (state.palette) {
      choices.forEach((piece, i) => region(list, `piece-${i}`, 64 + (i % 3) * 45, 99 + Math.floor(i / 3) * 28, 43, 27, `改为${glyphs[piece]}`, () => { state.palette.choice = i; input('ok'); }));
    } else if (state.scene === 'result') {
      ['再来一局', '返回标题界面','返回棋盘'].forEach((label, i) => region(list, `result-${i}`, 80, 109 + i * 23, 96, 23, label, () => { state.resultIndex = i; input('ok'); }));
    } else {
      const labels = state.scene === 'edit' ? ['全部改车', '恢复初始', '开始对局', '返回'] : ['悔棋', '认输', '返回标题界面'];
      labels.forEach((label, i) => region(list, `panel-${i}`, 203, 121 + i * 21, 49, 19, label, () => { state.zone = 'panel'; state.sideIndex = i; panelAction(); }));
      if(state.scene!=='edit')region(list,'SettingsButton',204,192.5,47,17,'設定',()=>settingsAction('SettingsButton'));
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
  function frame(now) {
    clock.update(now);
    if (state.scene === 'game' && !state.modal && state.reply && now >= state.reply.due) demoReply();
    resizeCanvas();
    ctx.setTransform(canvas.width / 256, 0, 0, canvas.height / 224, 0, 0);
    ctx.imageSmoothingEnabled = false;
    if(state.scene==='audio-settings'||state.scene==='music-select')settingsScreen();
    else if (state.scene === 'menu') menuScreen();
    else { boardScreen(now); if (state.palette) paletteScreen(); if (state.modal) modalScreen(); if (state.scene === 'result') resultScreen(); }
    updateHotspots();
    const description = `FC 中国象棋，${state.scene === 'menu' ? '选择模式：' + names[state.menu] : (state.scene === 'edit' ? '自定义编辑' : names[state.mode])}，${state.message}，右侧${state.turn === 'black' ? '黑方' : '红方'} ${String(state.moves).padStart(3, '0')}手，紅方步時${formatStep(clock.red)}，黑方步時${formatStep(clock.black)}，光标 ${state.cursor.x + 1} 路 ${state.cursor.y + 1} 行，${state.selected === null ? '未选棋子' : '已选中' + glyphs[state.board[state.selected]]}，己方${state.board.filter(isRed).length}子、${state.board.filter(p => p === 'R').length}车。点击棋子选择，再点击目标落子，再点一次取消。`;
    if (canvas.getAttribute('aria-label') !== description) canvas.setAttribute('aria-label', description);
    requestAnimationFrame(frame);
  }
  canvas.focus({preventScroll: true}); requestAnimationFrame(frame);
})();
