import { MockCashFlowMonth, MockIncomeSource } from '@/types/finance';

export const MOCK_CASH_FLOW: MockCashFlowMonth[] = [
  { month: 'Th03', income: 48500000, expense: 22100000, savings: 26400000 },
  { month: 'Th04', income: 51200000, expense: 24800000, savings: 26400000 },
  { month: 'Th05', income: 54000000, expense: 23500000, savings: 30500000 },
  { month: 'Th06', income: 52800000, expense: 26100000, savings: 26700000 },
  { month: 'Th07', income: 56900000, expense: 24900000, savings: 32000000 },
  { month: 'Th08', income: 58300000, expense: 25450000, savings: 32850000 },
];
export const MOCK_CASH_FLOW_6M = MOCK_CASH_FLOW;

export const MOCK_DASHBOARD_METRICS = {
  netWorthVND: 315450000,
  monthlyIncomeVND: 42500000,
  monthlyExpenseVND: 18250000,
  monthlySavingsVND: 24250000,
  savingRatePercent: 57,
  netWorthGrowthPercent: 4.2,
};

export const MOCK_MONTHLY_SUMMARY = {
  month: 'Tháng 08/2026',
  incomeVND: 58300000,
  expenseVND: 25450000,
  savingsVND: 32850000,
  savingsRatePercent: 56.3,
  netWorthVND: 486320000,
  netWorthGrowthPercent: 7.2,
};

export const MOCK_EXPENSE_BY_CATEGORY = [
  { category: 'Ăn uống & Cà phê', amountVND: 6450000, percentage: 25.3, color: '#f97316' },
  { category: 'Hóa đơn & Nhà cửa', amountVND: 7100000, percentage: 27.9, color: '#ef4444' },
  { category: 'Mua sắm cá nhân', amountVND: 4200000, percentage: 16.5, color: '#8b5cf6' },
  { category: 'Di chuyển', amountVND: 2650000, percentage: 10.4, color: '#0ea5e9' },
  { category: 'Giải trí & Đăng ký', amountVND: 2450000, percentage: 9.6, color: '#ec4899' },
  { category: 'Sức khỏe & Khác', amountVND: 2600000, percentage: 10.3, color: '#10b981' },
];
export const MOCK_CATEGORY_EXPENSES = MOCK_EXPENSE_BY_CATEGORY;

export const MOCK_INCOME_SOURCES: MockIncomeSource[] = [
  {
    id: 'inc-sal',
    name: 'Lương chính thức (FinTech JSC)',
    type: 'SALARY',
    totalBaseAmountVND: 25000000,
    currency: 'VND',
    originalAmount: 25000000,
  },
  {
    id: 'inc-yt',
    name: 'YouTube & Content Creation',
    type: 'YOUTUBE',
    totalBaseAmountVND: 44278000, // (1270 + 420) * 26200 = 1690 * 26200
    currency: 'USD',
    originalAmount: 1690,
    subSources: [
      {
        id: 'inc-yt-a',
        name: 'Kênh Công Nghệ (Channel A)',
        amount: 1270,
        currency: 'USD',
        baseAmountVND: 33274000,
      },
      {
        id: 'inc-yt-b',
        name: 'Kênh Tài Chính Cá Nhân (Channel B)',
        amount: 420,
        currency: 'USD',
        baseAmountVND: 11004000,
      },
    ],
  },
  {
    id: 'inc-free',
    name: 'Dự án Freelance UI/UX',
    type: 'FREELANCE',
    totalBaseAmountVND: 8500000,
    currency: 'VND',
    originalAmount: 8500000,
  },
  {
    id: 'inc-inv',
    name: 'Cổ tức & Lãi tiết kiệm',
    type: 'INVESTMENT',
    totalBaseAmountVND: 2500000,
    currency: 'VND',
    originalAmount: 2500000,
  },
];
