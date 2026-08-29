import fs from 'fs';
const file = 'tests/phase8-math.test.ts';
let content = fs.readFileSync(file, 'utf-8');

content = content.replace('function assertEq(a, b)', 'function assertEq(a: any, b: any)');
content = content.replace('function assertThrows(fn)', 'function assertThrows(fn: any)');
content = content.replace('if (e.message', 'if ((e as any).message');

fs.writeFileSync(file, content);
