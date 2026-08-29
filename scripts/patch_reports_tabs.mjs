import fs from 'fs';
let content = fs.readFileSync('src/app/reports/page.tsx', 'utf-8');
content = content.replace(
  "              >\n                {c}\n              </button>",
  "              >\n                {c === 'BASE' ? `Tổng hợp (${data.baseCurrency})` : c}\n              </button>"
);
fs.writeFileSync('src/app/reports/page.tsx', content);
