import fs from 'fs';
let content = fs.readFileSync('src/features/reports/reports.ts', 'utf-8');
console.log(content.split('\n').filter(l => l.includes('export interface')).join('\n'));
