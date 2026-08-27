import { MockBudget } from '@/types/finance';

export const MOCK_BUDGETS: MockBudget[] = [
  {
    id: 'bgt-1',
    categoryId: 'cat-food',
    categoryName: 'Ăn uống & Cà phê',
    categoryIcon: 'Utensils',
    categoryColor: '#f97316',
    limit: 5000000,
    spent: 3200000,
    currency: 'VND',
    period: '08/2026',
  },
  {
    id: 'bgt-2',
    categoryId: 'cat-transport',
    categoryName: 'Di chuyển & Xăng xe',
    categoryIcon: 'Car',
    categoryColor: '#0ea5e9',
    limit: 2000000,
    spent: 1450000,
    currency: 'VND',
    period: '08/2026',
  },
  {
    id: 'bgt-3',
    categoryId: 'cat-shopping',
    categoryName: 'Mua sắm cá nhân',
    categoryIcon: 'ShoppingBag',
    categoryColor: '#8b5cf6',
    limit: 3000000,
    spent: 2850000, // Near budget warning (95%)
    currency: 'VND',
    period: '08/2026',
  },
  {
    id: 'bgt-4',
    categoryId: 'cat-entertainment',
    categoryName: 'Giải trí & Phim ảnh',
    categoryIcon: 'Film',
    categoryColor: '#ec4899',
    limit: 2000000,
    spent: 2150000, // Over budget (107.5%)
    currency: 'VND',
    period: '08/2026',
  },
  {
    id: 'bgt-5',
    categoryId: 'cat-bills',
    categoryName: 'Hóa đơn & Nhà cửa',
    categoryIcon: 'Home',
    categoryColor: '#ef4444',
    limit: 6000000,
    spent: 3850000,
    currency: 'VND',
    period: '08/2026',
  },
  {
    id: 'bgt-6',
    categoryId: 'cat-other-exp',
    categoryName: 'Dự phòng & Khác',
    categoryIcon: 'MoreHorizontal',
    categoryColor: '#64748b',
    limit: 2000000,
    spent: 700000,
    currency: 'VND',
    period: '08/2026',
  },
];

export const TOTAL_BUDGET_LIMIT_VND = MOCK_BUDGETS.reduce((sum, b) => sum + b.limit, 0);
export const TOTAL_BUDGET_SPENT_VND = MOCK_BUDGETS.reduce((sum, b) => sum + b.spent, 0);
export const TOTAL_BUDGET_REMAINING_VND = TOTAL_BUDGET_LIMIT_VND - TOTAL_BUDGET_SPENT_VND;
