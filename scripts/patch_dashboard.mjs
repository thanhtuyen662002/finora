import fs from 'fs';
const file = 'src/app/dashboard/page.tsx';
let content = fs.readFileSync(file, 'utf-8');

// I will just add a notice if BASE is selected but baseValuation or baseHistorical is UNAVAILABLE
const oldHeader = `<PageHeader
          title="Bảng điều khiển"
          description={
            selectedCurrency === 'BASE' && data.autoFxEnabled
              ? \`Tổng hợp tự động quy đổi về \${data.baseCurrency}\`
              : \`Tài sản và dòng tiền theo \${selectedCurrency}\`
          }`;

const newHeader = `<PageHeader
          title="Bảng điều khiển"
          description={
            selectedCurrency === 'BASE' && data.autoFxEnabled
              ? \`Tổng hợp tự động quy đổi về \${data.baseCurrency}\`
              : \`Tài sản và dòng tiền theo \${selectedCurrency}\`
          }
        />
        {selectedCurrency === 'BASE' && (data.baseValuation?.status === 'UNAVAILABLE' || data.baseHistorical?.status === 'UNAVAILABLE') && (
          <div className="bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 p-3 rounded-lg flex items-start gap-2 text-sm border border-amber-200 dark:border-amber-900/50">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Cảnh báo quy đổi ngoại tệ (BASE)</p>
              <p>Một số tỷ giá không khả dụng từ nhà cung cấp. Dữ liệu tổng hợp BASE có thể thiếu sót hoặc không được làm mới.</p>
              {(data.baseValuation?.error || data.baseHistorical?.error) && (
                 <p className="text-xs mt-1 opacity-80">Chi tiết: {data.baseValuation?.error || data.baseHistorical?.error}</p>
              )}
            </div>
            <Button variant="outline" size="sm" className="ml-auto shrink-0 bg-white dark:bg-transparent" onClick={loadData}>
              <RefreshCw className="h-3 w-3 mr-1" /> Thử lại
            </Button>
          </div>
        )}`;

content = content.replace(oldHeader + '\n        />', newHeader);

fs.writeFileSync(file, content);
