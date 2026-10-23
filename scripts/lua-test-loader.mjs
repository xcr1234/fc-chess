import fs from 'node:fs';
// Discover static project dependencies, just like the shipping bundler. Individual
// diagnostic scripts may transform module source without losing new dependencies.
export function preloadModules(roots, transform = (_name, source) => source) {
  const modules = new Map();
  function visit(name) {
    if (modules.has(name)) return;
    const source = transform(name, fs.readFileSync('src/' + name.replaceAll('.', '/') + '.lua', 'utf8'));
    modules.set(name, source);
    for (const match of source.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) visit(match[1]);
  }
  roots.forEach(visit);
  return [...modules].map(([name, source]) => `package.preload[${JSON.stringify(name)}]=function()\n${source}\nend`).join('\n');
}
