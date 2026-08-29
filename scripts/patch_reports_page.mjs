import fs from 'fs';
let content = fs.readFileSync('src/app/reports/page.tsx', 'utf-8');

content = content.replace(
  "  const summary = data.summary;\n\n  return (",
  "  const summary = data.summary;\n  const displayCurrency = currency === 'BASE' ? data.baseCurrency : currency;\n\n  return ("
);

content = content.replace(/\{currency\}/g, '{displayCurrency}');
content = content.replace(/currency={currency}/g, 'currency={displayCurrency}');
content = content.replace(/formatExactMoney\(([^,]+),\s*currency\)/g, 'formatExactMoney($1, displayCurrency)');

fs.writeFileSync('src/app/reports/page.tsx', content);
