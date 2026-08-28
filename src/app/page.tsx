import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  CheckCircle2,
  ShieldCheck,
  LayoutDashboard,
  WalletCards,
  ReceiptText,
  Target,
  PieChart,
  Repeat,
  SlidersHorizontal,
  ArrowRight,
  Sparkles,
  Globe,
  Lock,
} from 'lucide-react';

export default function HomePage() {
  const showcasePages = [
    {
      href: '/dashboard',
      title: 'Bảng điều khiển (Dashboard)',
      desc: 'Tài sản ròng, dòng tiền 6 tháng, tỷ lệ tiết kiệm và phân bổ tài sản.',
      icon: LayoutDashboard,
      highlight: true,
    },
    {
      href: '/accounts',
      title: 'Tài khoản & Ví',
      desc: 'Ngân hàng (VCB, MB), Ví MoMo, quỹ Tiền mặt và Ví ngoại tệ USD.',
      icon: WalletCards,
    },
    {
      href: '/transactions',
      title: 'Sổ giao dịch',
      desc: 'Lịch sử thu chi, chuyển khoản nội bộ và quy đổi tỷ giá lịch sử.',
      icon: ReceiptText,
    },
    {
      href: '/budgets',
      title: 'Ngân sách chi tiêu',
      desc: 'Định mức tháng, cảnh báo ngưỡng vượt chi tiêu và tiến độ.',
      icon: Target,
    },
    {
      href: '/goals',
      title: 'Mục tiêu tài chính',
      desc: 'Quỹ khẩn cấp, mua sắm lớn và tốc độ tích lũy hàng tháng.',
      icon: Sparkles,
    },
    {
      href: '/recurring',
      title: 'Định kỳ & Hóa đơn',
      desc: 'Hóa đơn Netflix, Spotify, Internet, Gym và lương định kỳ.',
      icon: Repeat,
    },
    {
      href: '/reports',
      title: 'Báo cáo & Phân tích',
      desc: 'Cơ cấu chi tiêu danh mục và phân rã thu nhập YouTube đa kênh (USD/VND).',
      icon: PieChart,
    },
    {
      href: '/admin',
      title: 'Quản trị hệ thống (Admin)',
      desc: 'Cấu hình Gemini model, Feature Flags và tỷ giá ngoại tệ FX.',
      icon: SlidersHorizontal,
    },
  ];

  return (
    <main
      id="finora-foundation-container"
      className="flex-1 flex flex-col justify-center items-center px-4 py-8 sm:py-12 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full space-y-8"
    >
      {/* Top Header Section */}
      <div id="finora-header-section" className="text-center space-y-3 max-w-2xl mx-auto">
        <div className="flex items-center justify-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 flex items-center justify-center font-bold text-lg shadow-sm">
            F
          </div>
          <span className="text-3xl font-bold tracking-tight text-foreground">
            Finora
          </span>
          <Badge
            id="foundation-status-badge"
            variant="default"
            className="gap-1 px-2.5 py-0.5 text-xs font-semibold uppercase font-mono"
          >
            Phase 2: Auth + RLS
          </Badge>
        </div>
        <p className="text-base text-muted-foreground leading-relaxed">
          Hệ điều hành tài chính cá nhân riêng tư, đa tiền tệ (VND / USD), phân rã thu nhập YouTube và bảo mật theo kiến trúc Supabase RLS.
        </p>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Button asChild size="default" className="shadow-xs font-semibold">
            <Link href="/dashboard">
              Truy cập Bảng điều khiển
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="default">
            <Link href="/onboarding">Luồng Onboarding</Link>
          </Button>
          <Button asChild variant="ghost" size="default">
            <Link href="/login">Đăng nhập</Link>
          </Button>
        </div>
      </div>

      {/* Pages Showcase Grid */}
      <div className="w-full space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Các màn hình chức năng (Mock UI Foundation)
          </h2>
          <span className="text-xs text-muted-foreground font-medium">
            8 màn hình tương tác đầy đủ
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {showcasePages.map((page) => {
            const Icon = page.icon;
            return (
              <Link
                key={page.href}
                href={page.href}
                className="group block"
              >
                <Card
                  className={`h-full transition-all duration-200 hover:shadow-md hover:border-slate-400/50 ${
                    page.highlight
                      ? 'border-slate-900/40 bg-slate-900/5 dark:bg-slate-100/5'
                      : 'bg-card'
                  }`}
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <Icon className="h-4 w-4" />
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <CardTitle className="text-sm font-semibold text-foreground pt-2">
                      {page.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <CardDescription className="text-xs line-clamp-2">
                      {page.desc}
                    </CardDescription>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Architectural & Invariant Assurance */}
      <Card className="w-full border-border bg-muted/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Cam kết kiến trúc & Bất biến tài chính (Financial Invariants)
            </CardTitle>
            <span className="text-[11px] font-mono text-muted-foreground">
              AGENTS.md Compliance
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-muted-foreground">
            <div className="p-2.5 rounded-lg border bg-card space-y-1">
              <span className="font-semibold text-foreground block">
                1. Cô lập dữ liệu (User Isolation)
              </span>
              <p>
                Mọi truy vấn tài chính bảo đảm cách ly qua RLS. Không để lộ khóa dịch vụ hay số dư chéo.
              </p>
            </div>
            <div className="p-2.5 rounded-lg border bg-card space-y-1">
              <span className="font-semibold text-foreground block">
                2. Trung hòa chuyển khoản & Tỷ giá lịch sử
              </span>
              <p>
                Chuyển khoản không làm đổi tài sản ròng. Tỷ giá giao dịch cũ được bảo toàn bất biến.
              </p>
            </div>
            <div className="p-2.5 rounded-lg border bg-card space-y-1">
              <span className="font-semibold text-foreground block">
                3. Độc lập AI (AI Independence)
              </span>
              <p>
                Khi Gemini ngoại tuyến, 100% tính năng thu chi, ngân sách, chuyển khoản vẫn hoạt động trơn tru.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
