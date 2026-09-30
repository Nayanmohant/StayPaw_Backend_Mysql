const fs = require('fs');
const path = require('path');

function walk(dir) {
  const list = [];
  try {
    fs.readdirSync(dir).forEach(f => {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) {
        list.push(...walk(p));
      } else if (f.endsWith('.dart')) {
        list.push(p);
      }
    });
  } catch (e) {}
  return list;
}

const files = walk('d:/flutter projects/staypaw/lib');
const apiCalls = [];

files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  // Match _apiClient.<method>(<any whitespace/newlines>['"]<path>['"]
  const regex = /_apiClient\.(get|post|patch|put|delete)\s*\(\s*['"]([^'"]+)['"]/gs;
  let match;
  while ((match = regex.exec(content)) !== null) {
    // Find line number
    const lineNo = content.substring(0, match.index).split('\n').length;
    apiCalls.push({
      file: path.relative('d:/flutter projects/staypaw/lib', f),
      line: lineNo,
      method: match[1].toUpperCase(),
      endpoint: match[2],
    });
  }
});

console.log(`--- TOTAL FLUTTER API CALLS FOUND: ${apiCalls.length} ---`);
apiCalls.forEach((c, i) => {
  console.log(`${i + 1}. [${c.method}] ${c.endpoint} (${c.file}:${c.line})`);
});
