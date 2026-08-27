import {
  MockUserAdmin,
  MockAIModelConfig,
  MockFeatureFlag,
  CurrencyCode,
} from '@/types/finance';

export const MOCK_ADMIN_METRICS = {
  totalUsers: 12,
  activeUsers: 10,
  activeUsers30d: 10,
  totalTransactions: 1248,
  totalVolumeVND: 1845200000,
  aiTokensConsumed: 142580,
  aiRequestsCount: 342,
  aiRequestsToday: 286,
  supportedCurrenciesCount: 6,
  totalSystemVolumeVND: 1845200000,
  averageResponseTimeMs: 420,
};

export const MOCK_ADMIN_USERS = [
  {
    id: 'usr-1',
    name: 'Võ Thanh Tuyền',
    displayName: 'Võ Thanh Tuyền',
    email: 'thanhtuyen66202@gmail.com',
    role: 'ADMIN',
    status: 'ACTIVE',
    baseCurrency: 'VND',
    aiCredentialSource: 'SYSTEM',
    assignedAiKeyStatus: 'SYSTEM_KEY',
    lastActive: '2026-08-27 15:02',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-2',
    name: 'Nguyễn Minh Quân',
    displayName: 'Nguyễn Minh Quân',
    email: 'quan.nguyen@example.com',
    role: 'USER',
    status: 'ACTIVE',
    baseCurrency: 'VND',
    aiCredentialSource: 'ADMIN_ASSIGNED',
    assignedAiKeyStatus: 'ASSIGNED_BY_ADMIN',
    lastActive: '2026-08-27 12:45',
  },
  {
    id: 'usr-3',
    name: 'Trần Hoàng Long',
    displayName: 'Trần Hoàng Long',
    email: 'long.tran@example.com',
    role: 'USER',
    status: 'ACTIVE',
    baseCurrency: 'USD',
    aiCredentialSource: 'PERSONAL',
    assignedAiKeyStatus: 'PERSONAL_KEY',
    lastActive: '2026-08-26 19:15',
  },
  {
    id: 'usr-4',
    name: 'Lê Thu Hà',
    displayName: 'Lê Thu Hà',
    email: 'ha.le@example.com',
    role: 'USER',
    status: 'ACTIVE',
    baseCurrency: 'VND',
    aiCredentialSource: 'SYSTEM',
    assignedAiKeyStatus: 'SYSTEM_KEY',
    lastActive: '2026-08-26 09:30',
  },
  {
    id: 'usr-5',
    name: 'Đặng Quốc Bảo',
    displayName: 'Đặng Quốc Bảo',
    email: 'bao.dang@example.com',
    role: 'USER',
    status: 'INACTIVE',
    baseCurrency: 'EUR',
    aiCredentialSource: 'ADMIN_ASSIGNED',
    assignedAiKeyStatus: 'ASSIGNED_BY_ADMIN',
    lastActive: '2026-08-15 14:10',
  },
];

export const MOCK_AI_CONFIGS: MockAIModelConfig[] = [
  {
    task: 'transaction_parse',
    taskLabel: 'Trích xuất giao dịch từ văn bản tự nhiên',
    configuredModel: 'gemini-2.5-flash',
    provider: 'Google Gemini',
    status: 'READY',
  },
  {
    task: 'categorization',
    taskLabel: 'Tự động phân loại danh mục chi tiêu',
    configuredModel: 'gemini-2.5-flash',
    provider: 'Google Gemini',
    status: 'READY',
  },
  {
    task: 'financial_assistant',
    taskLabel: 'Trợ lý giải thích & phân tích tài chính',
    configuredModel: 'gemini-2.5-pro',
    provider: 'Google Gemini',
    status: 'READY',
  },
  {
    task: 'receipt_vision',
    taskLabel: 'Đọc hóa đơn & biên lai (OCR Vision)',
    configuredModel: 'gemini-2.5-flash',
    provider: 'Google Gemini',
    status: 'MAINTENANCE',
  },
];

export const MOCK_FEATURE_FLAGS: MockFeatureFlag[] = [
  {
    key: 'AI_ASSISTANT',
    title: 'Trợ lý tài chính thông minh (AI Assistant)',
    description: 'Bật giao diện hỏi đáp và phân tích tài chính thông minh.',
    enabled: true,
    category: 'AI',
  },
  {
    key: 'AI_TRANSACTION_PARSE',
    title: 'Nhập giao dịch bằng ngôn ngữ tự nhiên',
    description: 'Cho phép gõ "Ăn trưa 85k tiền mặt" để điền sẵn biểu mẫu.',
    enabled: true,
    category: 'AI',
  },
  {
    key: 'RECEIPT_OCR',
    title: 'Quét hóa đơn / OCR ảnh biên lai',
    description: 'Trích xuất thông tin giao dịch từ ảnh hóa đơn.',
    enabled: false,
    category: 'AI',
  },
  {
    key: 'MULTI_CURRENCY',
    title: 'Hỗ trợ đa tiền tệ & quy đổi tự động',
    description: 'Hỗ trợ tài khoản và giao dịch USD, EUR, JPY, CNY, KRW.',
    enabled: true,
    category: 'FINANCE',
  },
  {
    key: 'YOUTUBE_INCOME',
    title: 'Phân rã nguồn thu YouTube & AdSense',
    description: 'Theo dõi chi tiết doanh thu theo từng kênh nội dung.',
    enabled: true,
    category: 'FINANCE',
  },
  {
    key: 'INVESTMENT_TRACKING',
    title: 'Theo dõi danh mục đầu tư & cổ phiếu',
    description: 'Tích hợp số dư chứng chỉ quỹ và tài sản đầu tư.',
    enabled: false,
    category: 'FINANCE',
  },
  {
    key: 'FAMILY_WORKSPACE',
    title: 'Không gian tài chính gia đình dùng chung',
    description: 'Chia sẻ sổ thu chi với các thành viên tin cậy.',
    enabled: false,
    category: 'SYSTEM',
  },
];

export const MOCK_FX_RATES = [
  { from: 'USD', to: 'VND', rate: 26200, source: 'Vietcombank (Mô phỏng)', updatedAt: 'Hôm nay 08:30 (Mock)' },
  { from: 'EUR', to: 'VND', rate: 28450, source: 'ECB (Mô phỏng)', updatedAt: 'Hôm nay 08:30 (Mock)' },
  { from: 'JPY', to: 'VND', rate: 176, source: 'Bank of Japan (Mô phỏng)', updatedAt: 'Hôm nay 08:30 (Mock)' },
  { from: 'CNY', to: 'VND', rate: 3680, source: 'PBOC (Mô phỏng)', updatedAt: 'Hôm nay 08:30 (Mock)' },
  { from: 'KRW', to: 'VND', rate: 19.4, source: 'Bank of Korea (Mô phỏng)', updatedAt: 'Hôm nay 08:30 (Mock)' },
];

export const MOCK_SUPPORTED_CURRENCIES: Array<{
  code: CurrencyCode;
  name: string;
  symbol: string;
  exchangeRateToVND: number;
  isDefault?: boolean;
}> = [
  { code: 'VND', name: 'Việt Nam Đồng', symbol: '₫', exchangeRateToVND: 1, isDefault: true },
  { code: 'USD', name: 'US Dollar', symbol: '$', exchangeRateToVND: 26200 },
  { code: 'EUR', name: 'Euro', symbol: '€', exchangeRateToVND: 28400 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', exchangeRateToVND: 175 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', exchangeRateToVND: 3650 },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', exchangeRateToVND: 19.5 },
];
