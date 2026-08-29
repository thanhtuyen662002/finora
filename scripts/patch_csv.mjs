import fs from 'fs';
const file = 'src/features/reports/engine.ts';
let content = fs.readFileSync(file, 'utf-8');

const oldHeaders = `  const headers = [
    'Ngày',
    'Loại',
    'Danh mục',
    'Tài khoản',
    'Đối tác/Cửa hàng',
    'Số tiền',
    'Đơn vị tiền tệ',
    'Trạng thái',
    'Ghi chú',
  ];`;

const newHeaders = `  const headers = [
    'Ngày',
    'Loại',
    'Danh mục',
    'Tài khoản',
    'Đối tác/Cửa hàng',
    'Số tiền',
    'Đơn vị tiền tệ',
    'Trạng thái',
    'Ghi chú',
  ];
  if (normCurrency === 'BASE') {
    headers.push('Số tiền gốc', 'Tiền tệ gốc', 'Tỷ giá', 'Nguồn FX', 'Ngày tỷ giá');
  }`;

content = content.replace(oldHeaders, newHeaders);

// Also fix txAny._fx_* to txAny.fx_* since we changed it in BaseConvertedTransaction
content = content.replace(/_fx_original_amount/g, 'fx_original_amount');
content = content.replace(/_fx_original_currency/g, 'fx_original_currency');
content = content.replace(/_fx_rate/g, 'fx_rate');
content = content.replace(/_fx_provider/g, 'fx_provider');
content = content.replace(/_fx_effective_date/g, 'fx_effective_date');

fs.writeFileSync(file, content);
