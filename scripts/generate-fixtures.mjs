import fs from 'node:fs';
function lua(x){if(x===null)return 'nil';if(typeof x==='string')return JSON.stringify(x);if(typeof x!=='object')return String(x);if(Array.isArray(x))return '{'+x.map(lua).join(',')+'}';return '{'+Object.entries(x).map(([k,v])=>'['+JSON.stringify(k)+']='+lua(v)).join(',')+'}';}
const plan=JSON.parse(fs.readFileSync('tests/plan.json'));fs.writeFileSync('src/testing/fixtures.lua','-- Generated from tests/plan.json by scripts/generate-fixtures.mjs\nreturn '+lua(Object.fromEntries(plan.cases.filter(c=>c.fixture).map(c=>[c.case,c.fixture])))+'\n');
