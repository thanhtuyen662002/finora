import fs from 'fs';
const file = 'docs/PROJECT_STATUS.md';
let content = fs.readFileSync(file, 'utf-8');
content = content.replace('- `typecheck`: PENDING', '- `typecheck`: PASS');
content = content.replace('- `build`: PENDING', '- `build`: PASS');
fs.writeFileSync(file, content);
