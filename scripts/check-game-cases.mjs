import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
// Load only the locked dependency's pure normalization/validation section.
// Do not import its CLI, initialize a project, start a worker, or call runCase.
const pkg=JSON.parse(await readFile(new URL('../node_modules/beyond-simulator-mcp/package.json',import.meta.url),'utf8'));
assert.equal(pkg.version,'0.4.1','Review the pure parser extraction when upgrading the simulator');
const source=await readFile(new URL('../node_modules/beyond-simulator-mcp/dist/index.js',import.meta.url),'utf8');
const start=source.indexOf('var sr="qxqy-autotest";');
const end=source.indexOf('function qa(',start);
assert.ok(start>=0 && end>start && end-start<15000,'Locked parser location changed');
const context=vm.createContext({});
vm.runInContext(source.slice(start,end)+';globalThis.normalizeCase=Ii;',context,{timeout:1000});
const plan=JSON.parse(await readFile(new URL('../tests/plan.json',import.meta.url),'utf8'));
const names=new Set();
for(const entry of plan.cases){
 assert.ok(!names.has(entry.case),`Duplicate ${entry.case}`);names.add(entry.case);
 assert.ok(['pc-16-9','mobile-16-9'].includes(entry.args.canvasId));
 const data=JSON.parse(await readFile(new URL('../tests/'+entry.file,import.meta.url),'utf8'));
 assert.equal(data.format,'qxqy-autotest');assert.equal(data.version,1);assert.equal(data.name,entry.case);
 assert.ok(data.asserts.length>0);
 // Name-based control assertions may omit id; the locked parser supplies ''.
 // Retain the strict comparison for every other field, including unknown keys.
 const canonical={...data,asserts:data.asserts.map(item=>item.kind==='control'&&!Object.hasOwn(item,'id')?{...item,id:''}:item)};
 assert.deepEqual(JSON.parse(JSON.stringify(context.normalizeCase(data))),canonical,`${entry.case}: ignored or noncanonical fields`);
 for(const item of [...data.events,...data.asserts])assert.ok((item.t??item.at??0)>=0);
 if(entry.fixture)assert.equal(data.events[0].payload.name,'TestSetup_'+entry.case);
}
for(const id of ['boot','first-success','first-fail','restart','mobile-smoke'])assert.ok(names.has(id),`Missing P0 ${id}`);
console.log(`${names.size} cases accepted by beyond-simulator-mcp@${pkg.version} pure parser; no game cases executed`);
