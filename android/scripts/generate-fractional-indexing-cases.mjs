// Gera app/src/test/resources/fractional-indexing-cases.txt com a fractional-indexing do backend.
// Rodar de dentro de android/: node scripts/generate-fractional-indexing-cases.mjs > app/src/test/resources/fractional-indexing-cases.txt
const { generateKeyBetween, generateNKeysBetween } = await import(new URL('../../backend/node_modules/fractional-indexing/src/index.js', import.meta.url).href);
let seed = 42;
const rand = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
const cases = [];
const add = (a, b) => cases.push([a, b, generateKeyBetween(a, b)]);
// Lista real: 91 chaves da carga, e inserções aleatórias entre vizinhas.
let keys = generateNKeysBetween(null, null, 91);
for (let i = 0; i < 400; i++) {
  const op = rand(4);
  if (op === 0) { add(null, keys[0]); keys.unshift(cases.at(-1)[2]); }
  else if (op === 1) { add(keys.at(-1), null); keys.push(cases.at(-1)[2]); }
  else { const j = rand(keys.length - 1); add(keys[j], keys[j + 1]); keys.splice(j + 1, 0, cases.at(-1)[2]); }
}
// Sempre no mesmo lugar, para chaves compridas, e nas pontas, para mudar a parte inteira.
let lo = 'a0', hi = 'a1';
for (let i = 0; i < 60; i++) { add(lo, hi); hi = cases.at(-1)[2]; }
let top = 'a0';
for (let i = 0; i < 80; i++) { add(top, null); top = cases.at(-1)[2]; }
let bottom = 'a0';
for (let i = 0; i < 80; i++) { add(null, bottom); bottom = cases.at(-1)[2]; }
add('a1', 'a0'); add(null, null);
const n = generateNKeysBetween(null, null, 91);
const nMid = generateNKeysBetween('a0', 'a1', 25);
const lines = cases.map(([a, b, r]) => `${a ?? '-'} ${b ?? '-'} ${r}`);
console.log(lines.join('\n'));
console.log('#N - - 91 ' + n.join(','));
console.log('#N a0 a1 25 ' + nMid.join(','));
