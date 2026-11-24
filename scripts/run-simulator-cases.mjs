import { readGameScript } from './game-save-script.mjs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage } from '@napi-rs/canvas';
const root = fileURLToPath(new URL('../', import.meta.url));
const read = async path => JSON.parse(await readFile(new URL('../' + path, import.meta.url), 'utf8'));
const client = new Client({ name: 'fc-chess-regression', version: '1.0.0' });
const report = { runtime: 'simulator', sourceSHA256: '', workerTimeoutMs: 30000, results: [] };
const layouts = process.argv.includes('--layouts');
const matrix = process.argv.includes('--matrix');
const outputArg=process.argv.indexOf('--output');
const output=outputArg>=0?process.argv[outputArg+1]:(matrix?'lua-step6-matrix.json':layouts?'lua-layout-results.json':'lua-step5-regression.json');
let handle;
async function call(name, args) {
  const r = await client.callTool({ name, arguments: args }, undefined, { timeout: 120000 });
  if (r.isError) throw new Error(JSON.stringify(r.content));
  return r.structuredContent ?? JSON.parse(r.content.find(c => c.type === 'text').text);
}
try {
  const source = await readFile(new URL('../dist/main.lua', import.meta.url), 'utf8');
  report.sourceSHA256 = createHash('sha256').update(source).digest('hex');
  for (const path of ['fc-chess.save.json', 'tests/fc-chess.test.save.json']) {
    const save = await read(path);
    if (readGameScript(save) !== source || save.assets.scripts[0].path !== 'dist/main.lua') throw new Error('Stale script: ' + path);
  }
  // Long simulated clock cases render hundreds of frames. Use the simulator's
  // supported per-worker deadline rather than changing their input or asserts.
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [root + 'node_modules/beyond-simulator-mcp/dist/index.js', '--workspace', root], cwd: root, env: { QXQY_PLAY_TIMEOUT_MS: '30000' } }));
  ({ handle } = await call('qxqy_project_open', { path: 'tests/fc-chess.test.save.json' }));
  await call('qxqy_studio_play', { handle, action: 'start', args: { canvasId: 'pc-16-9' } });
  for (const row of layouts || matrix ? [] : (await read('tests/plan.json')).cases) {
    const test = await read('tests/' + row.file);
    const result = await call('qxqy_studio_play', { handle, action: 'runCase', args: { ...row.args, case: test } });
    // A misspelled runCase argument can silently execute an empty case. Reject it.
    if (result.name !== test.name || result.results.length === 0) throw new Error('Empty/wrong case: ' + row.case);
    report.results.push(result);
    console.log(`${result.passed ? 'PASS' : 'FAIL'} ${row.case} (${result.results.length} assertions)`);
    if (!result.passed) process.exitCode = 1;
  }
  if (layouts) {
    // Use the production save: no diagnostic controls in visual evidence.
    await call('qxqy_studio_play', { handle, action: 'stop' });
    ({ handle } = await call('qxqy_project_open', { path: 'fc-chess.save.json' }));
    for (const canvasId of ['pc-16-9','pc-21-9','mobile-16-9','mobile-19.5-9','mobile-4-3']) {
      await call('qxqy_studio_play', { handle, action: 'start', args: { canvasId } });
      const test = { format: 'qxqy-autotest', version: 1, name: 'layout-' + canvasId, dt: .1,
        events: [{ t: .1, source: 'user', kind: 'click', payload: { name: 'ModeFast' } }],
        asserts: [{ kind: 'control', at: .2, name: 'TurnText', field: 'text', equals: '红方' }] };
      const result = await call('qxqy_studio_play', { handle, action: 'runCase', args: { canvasId, case: test } });
      if (!result.passed || result.results.length !== 1) throw new Error('Layout smoke failed: ' + canvasId);
      const screenshot = await client.callTool({ name: 'qxqy_studio_play_screenshot', arguments: { handle } });
      if (screenshot.isError) throw new Error('Screenshot failed: ' + canvasId);
      const img = await loadImage(Buffer.from(screenshot.content.find(c => c.type === 'image').data, 'base64'));
      const scale = Math.min(img.width / 256, img.height / 224), w = Math.round(256 * scale), h = Math.round(224 * scale);
      const canvas = createCanvas(w, h);
      canvas.getContext('2d').drawImage(img, (img.width-w)/2, (img.height-h)/2, w,h,0,0,w,h);
      const path = 'records/screenshots/lua-' + canvasId + '.png';
      await writeFile(new URL('../' + path, import.meta.url), canvas.toBuffer('image/png'));
      report.results.push({ canvasId, passed: result.passed, screenshot: path, width: w, height: h, logs: result.snapshot.logs });
      console.log('PASS layout ' + canvasId);
    }
  }
  if (matrix) {
    await call('qxqy_studio_play', {handle,action:'stop'});
    ({handle}=await call('qxqy_project_open',{path:'fc-chess.save.json'}));
    const authoring=await call('qxqy_studio_get',{handle});
    report.authoring={migrationWarnings:authoring.migrationWarnings,controlGuidChanges:authoring.controlGuidChanges,
      scripts:authoring.scripts.map(({path,mounted,controlName})=>({path,mounted,controlName})),luaBytes:Buffer.byteLength(source)};
    const scenes=[
      ['menu',[], 'ModeCustomTitle','自定义模式'],
      ['edit',['ModeCustom'],'EditTitle','自定义棋子'],
      ['palette',['ModeCustom','Square_0_6'],'PaletteTitle','改成哪种棋子？'],
      ['board',['ModeFast'],'TurnText','红方'],
      ['confirm',['ModeFast','ModeButton'],'ConfirmTitle','返回标题界面？'],
      ['result',['ModeFast','ResignButton','ConfirmYes'],'ResultTitle','您落败了']
    ];
    const sheet=createCanvas(256*6,224*5),ctx=sheet.getContext('2d');
    for (const [row,canvasId] of ['pc-16-9','pc-21-9','mobile-16-9','mobile-19.5-9','mobile-4-3'].entries()) {
      for (const [col,[scene,names,name,equals]] of scenes.entries()) {
        await call('qxqy_studio_play',{handle,action:'start',args:{canvasId}});
        const test={format:'qxqy-autotest',version:1,name:`${canvasId}-${scene}`,dt:.1,
          events:names.map((name,i)=>({t:(i+1)*.1,source:'user',kind:'click',payload:{name}})),
          asserts:[{kind:'control',at:(names.length+1)*.1,name,field:'text',equals}]};
        const result=await call('qxqy_studio_play',{handle,action:'runCase',args:{canvasId,case:test}});
        if (!result.passed || result.results.length!==1) throw new Error('Matrix assertion failed: '+test.name);
        const raw=await client.callTool({name:'qxqy_studio_play_screenshot',arguments:{handle}});
        if(raw.isError)throw new Error('Matrix screenshot failed: '+test.name);
        const img=await loadImage(Buffer.from(raw.content.find(c=>c.type==='image').data,'base64'));
        const scale=Math.min(img.width/256,img.height/224),w=Math.round(256*scale),h=Math.round(224*scale);
        const cropped=createCanvas(w,h);cropped.getContext('2d').drawImage(img,(img.width-w)/2,(img.height-h)/2,w,h,0,0,w,h);
        const path=`records/screenshots/step6-${canvasId}-${scene}.png`;
        await writeFile(new URL('../'+path,import.meta.url),cropped.toBuffer('image/png'));
        ctx.drawImage(cropped,col*256,row*224,256,224);
        const snap=result.snapshot;
        const view=await call('qxqy_studio_play',{handle,action:'get',args:{view:true}});
        if(view.mountError || view.logs.some(l=>l.level==='error'))throw new Error('Runtime error: '+test.name);
        report.results.push({canvasId,scene,passed:true,screenshot:path,width:w,height:h,mountError:snap.mountError,logs:snap.logs,
          renderedNodes:view.scene?.count,images:view.scene?.nodes?.filter(n=>n.kind==='image').length,
          assetWarnings:raw.structuredContent?.assetWarnings??null});
        console.log('PASS matrix '+test.name);
      }
      const size={'pc-16-9':[1600,900],'pc-21-9':[2100,900],'mobile-16-9':[1280,720],'mobile-19.5-9':[1560,720],'mobile-4-3':[1280,960]}[canvasId];
      const z=Math.min(size[0]/256,size[1]/224),left=(size[0]-256*z)/2,bottom=(size[1]-224*z)/2;
      const point=(t,x,y)=>({t,source:'user',kind:'pointer',payload:{type:'click',x:left+x*z,y:bottom+y*z}});
      const check=(at,name,equals)=>({kind:'control',at,name,field:'text',equals});
      // Native pointer coordinates use a bottom-left origin. Test the far
      // right edge of the pawn hit box, then modal blocking and undo.
      const test={format:'qxqy-autotest',version:1,name:'pointer-'+canvasId,dt:.05,
        events:[point(.1,131.5,148),point(.2,191.5,80),point(.3,191.5,96),point(.4,227.5,72.5),point(.5,56,80),point(.6,164,88),point(.7,227.5,93.5),point(.8,92,88)],
        asserts:[check(.35,'MoveCount','001手'),check(.45,'ConfirmTitle','要认输吗？'),check(.55,'MoveCount','001手'),check(.9,'MoveCount','000手'),check(.9,'TurnText','红方')]};
      const result=await call('qxqy_studio_play',{handle,action:'runCase',args:{canvasId,case:test}});
      report.results.push({canvasId,kind:'pointer',case:test,...result});
      if(!result.passed || result.results.length!==5)throw new Error('Pointer smoke failed: '+canvasId);
      console.log('PASS pointer '+canvasId);
    }
    await writeFile(new URL('../records/screenshots/step6-matrix.png',import.meta.url),sheet.toBuffer('image/png'));
  }
} catch (error) { report.error = error.message; console.error(error); process.exitCode = 1; }
finally {
  if (handle) await call('qxqy_studio_play', { handle, action: 'stop' }).catch(() => {});
  await client.close();
  await writeFile(new URL('../records/'+output, import.meta.url), JSON.stringify(report, null, 2) + '\n');
}
