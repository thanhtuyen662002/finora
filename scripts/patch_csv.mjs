import fs from 'fs';
let content = fs.readFileSync('src/features/reports/engine.ts', 'utf-8');

content = content.replace(
  "    'Ghi chú',\n  ];\n  const rows = transactions\n    .filter((tx) => (tx.currency_code || '').toUpperCase() === normCurrency)",
  "    'Ghi chú',\n  ];\n  if (normCurrency === 'BASE') {\n    headers.push('Số tiền gốc', 'Đơn vị gốc', 'Tỷ giá', 'Nhà cung cấp', 'Ngày áp dụng tỷ giá');\n  }\n  const rows = transactions\n    .filter((tx) => (tx.currency_code || '').toUpperCase() === normCurrency)"
);

content = content.replace(
  "      const typeLabel = tx.type === 'INCOME' ? 'Thu nhập' : 'Chi tiêu';",
  "      const txAny = tx as any;\n      const typeLabel = tx.type === 'INCOME' ? 'Thu nhập' : 'Chi tiêu';"
);

content = content.replace(
  "        escapeCell(tx.currency_code),\n        escapeCell(status),\n        escapeCell(tx.note),\n      ].join(',');",
  "        escapeCell(tx.currency_code),\n        escapeCell(status),\n        escapeCell(tx.note),\n      ];\n      if (normCurrency === 'BASE') {\n        baseRow.push(escapeCell(txAny._fx_original_amount ? toExactDecimal(txAny._fx_original_amount) : ''), escapeCell(txAny._fx_original_currency), escapeCell(txAny._fx_rate), escapeCell(txAny._fx_provider), escapeCell(txAny._fx_effective_date));\n      }\n      return baseRow.join(',');"
);

content = content.replace(
  "      return [\n        escapeCell(tx.occurred_on),",
  "      const baseRow = [\n        escapeCell(tx.occurred_on),"
);

fs.writeFileSync('src/features/reports/engine.ts', content);
