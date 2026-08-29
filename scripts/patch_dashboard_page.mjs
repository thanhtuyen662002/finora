import fs from 'fs';
let content = fs.readFileSync('src/app/dashboard/page.tsx', 'utf-8');

content = content.replace(
  "  const effectiveCurrency =\n    activeCurrency && data.availableCurrencies.includes(activeCurrency)\n      ? activeCurrency\n      : data.defaultCurrency || data.availableCurrencies[0] || 'VND';",
  "  const effectiveCurrency =\n    activeCurrency && data.availableCurrencies.includes(activeCurrency)\n      ? activeCurrency\n      : data.defaultCurrency || data.availableCurrencies[0] || 'VND';\n  const displayCurrency = effectiveCurrency === 'BASE' ? data.baseCurrency : effectiveCurrency;"
);

content = content.replace(/formatExactMoney\(([^,]+),\s*effectiveCurrency(.*)\)/g, 'formatExactMoney($1, displayCurrency$2)');
content = content.replace(/\{effectiveCurrency === 'BASE' \? data.baseCurrency : effectiveCurrency\}/g, '{displayCurrency}');
content = content.replace(/currency=\{effectiveCurrency\}/g, 'currency={displayCurrency}');
content = content.replace(/tài khoản \$\{effectiveCurrency\}/g, 'tài khoản ${displayCurrency}');
content = content.replace(/>\n\s*\{effectiveCurrency\}\n\s*<\/span>/g, '>\n                    {displayCurrency}\n                  </span>');
content = content.replace(/\(\{effectiveCurrency\}\)\./g, '({displayCurrency}).');

fs.writeFileSync('src/app/dashboard/page.tsx', content);
