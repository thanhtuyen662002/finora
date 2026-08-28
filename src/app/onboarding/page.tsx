"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CurrencyCode } from '@/types/finance';
import {
  Check,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Wallet,
  Building2,
  Smartphone,
  Globe,
  TrendingUp,
  ShieldCheck,
  Target,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getCurrentUserSettings,
  updateCurrentUserSettings,
  updateCurrentProfile,
} from '@/lib/auth';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const totalSteps = 5;
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State collected during onboarding
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>('VND');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([
    'bank-vcb',
    'cash',
    'momo',
  ]);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([
    'spending',
    'emergency',
  ]);

  useEffect(() => {
    let isMounted = true;
    async function loadInitial() {
      try {
        const { data: settings } = await getCurrentUserSettings();
        if (settings?.base_currency && isMounted) {
          setBaseCurrency(settings.base_currency as CurrencyCode);
        }
      } catch (err) {
        console.debug('Failed to load initial settings in onboarding', err);
      }
    }
    loadInitial();
    return () => {
      isMounted = false;
    };
  }, []);

  const currencies: { code: CurrencyCode; name: string; symbol: string }[] = [
    { code: 'VND', name: 'Việt Nam Đồng', symbol: '₫' },
    { code: 'USD', name: 'Đô la Mỹ (USD)', symbol: '$' },
    { code: 'EUR', name: 'Đồng Euro', symbol: '€' },
    { code: 'JPY', name: 'Yên Nhật', symbol: '¥' },
    { code: 'CNY', name: 'Nhân dân tệ', symbol: '¥' },
    { code: 'KRW', name: 'Won Hàn Quốc', symbol: '₩' },
  ];

  const initialAccountOptions = [
    {
      id: 'cash',
      name: 'Tiền mặt trong ví',
      type: 'Tiền mặt (VND)',
      icon: Wallet,
      desc: 'Quản lý chi tiêu tiền mặt hằng ngày',
    },
    {
      id: 'bank-vcb',
      name: 'Ngân hàng (Vietcombank / MB / Techcombank)',
      type: 'Tài khoản ngân hàng',
      icon: Building2,
      desc: 'Nhận lương & thanh toán hóa đơn chính',
    },
    {
      id: 'momo',
      name: 'Ví điện tử (MoMo / ZaloPay / ShopeePay)',
      type: 'Ví điện tử',
      icon: Smartphone,
      desc: 'Mua sắm trực tuyến & ăn uống',
    },
    {
      id: 'foreign',
      name: 'Tài khoản ngoại tệ (PayPal / Wise / USD)',
      type: 'Ngoại tệ (USD/EUR)',
      icon: Globe,
      desc: 'Nhận thu nhập YouTube, Freelance quốc tế',
    },
  ];

  const goalOptions = [
    {
      id: 'spending',
      title: 'Kiểm soát chi tiêu hàng tháng',
      desc: 'Biết rõ tiền đi đâu và hạn chế chi tiêu vượt mức',
      icon: Target,
    },
    {
      id: 'emergency',
      title: 'Xây dựng quỹ khẩn cấp 3-6 tháng',
      desc: 'Bảo vệ tài chính trước các tình huống bất ngờ',
      icon: ShieldCheck,
    },
    {
      id: 'youtube',
      title: 'Theo dõi đa nguồn thu (YouTube, Freelance)',
      desc: 'Phân rã thu nhập ngoại tệ và quy đổi tức thời',
      icon: Sparkles,
    },
    {
      id: 'networth',
      title: 'Gia tăng tài sản ròng (Net Worth)',
      desc: 'Hiểu rõ tổng tài sản và nợ để lập kế hoạch tự do tài chính',
      icon: TrendingUp,
    },
  ];

  const toggleAccount = (id: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const toggleGoal = (id: string) => {
    setSelectedGoals((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const handleNext = async () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      setIsSubmitting(true);
      try {
        // Persist base currency and onboarding status
        await updateCurrentUserSettings({ base_currency: baseCurrency });
        await updateCurrentProfile({ onboarding_completed: true });
      } catch (err) {
        console.debug('Failed to save onboarding settings', err);
      } finally {
        router.push('/dashboard');
        router.refresh();
      }
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-muted/20">
      <div className="w-full max-w-xl space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground font-medium">
            <span>Khởi tạo Finora</span>
            <span>
              Bước {step} / {totalSteps}
            </span>
          </div>
          <Progress
            value={(step / totalSteps) * 100}
            className="h-1.5"
            indicatorClassName="bg-slate-900 dark:bg-slate-100"
          />
        </div>

        <Card className="shadow-lg border-border">
          {/* Step 1: Welcome */}
          {step === 1 && (
            <>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold text-2xl shadow-md">
                  F
                </div>
                <CardTitle className="text-2xl font-bold">Chào mừng đến với Finora</CardTitle>
                <CardDescription className="text-base max-w-md mx-auto pt-1">
                  Hệ điều hành tài chính cá nhân được thiết kế riêng tư, đơn giản, minh bạch và hỗ trợ đa tiền tệ.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="p-3.5 rounded-xl border bg-muted/30 space-y-1">
                    <div className="flex items-center space-x-2 font-semibold text-foreground">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      <span>An toàn & Riêng tư</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Không chia sẻ dữ liệu cho bên thứ ba, dữ liệu cô lập với RLS.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl border bg-muted/30 space-y-1">
                    <div className="flex items-center space-x-2 font-semibold text-foreground">
                      <Globe className="h-4 w-4 text-blue-600" />
                      <span>Đa tiền tệ thông minh</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Theo dõi song song VND, USD (YouTube/Freelance) và quy đổi chính xác.
                    </p>
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {/* Step 2: Base Currency */}
          {step === 2 && (
            <>
              <CardHeader>
                <CardTitle className="text-xl">Chọn đơn vị tiền tệ gốc</CardTitle>
                <CardDescription>
                  Đây là đồng tiền quy chuẩn cho báo cáo tổng tài sản và dòng tiền của bạn.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {currencies.map((curr) => {
                  const isSelected = baseCurrency === curr.code;
                  return (
                    <div
                      key={curr.code}
                      onClick={() => setBaseCurrency(curr.code)}
                      className={cn(
                        'flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all',
                        isSelected
                          ? 'border-slate-900 dark:border-slate-100 bg-slate-900/5 dark:bg-slate-100/5 font-semibold'
                          : 'border-border hover:bg-muted/30'
                      )}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-foreground font-mono font-bold">
                          {curr.symbol}
                        </span>
                        <div>
                          <p className="text-sm text-foreground">{curr.name}</p>
                          <p className="text-xs text-muted-foreground">{curr.code}</p>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="h-5 w-5 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center">
                          <Check className="h-3.5 w-3.5 stroke-[3]" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </>
          )}

          {/* Step 3: First Accounts */}
          {step === 3 && (
            <>
              <CardHeader>
                <CardTitle className="text-xl">Chọn các ví & tài khoản ban đầu</CardTitle>
                <CardDescription>
                  Bạn có thể thêm số dư và tài khoản chi tiết hơn bất kỳ lúc nào.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {initialAccountOptions.map((acc) => {
                  const isSelected = selectedAccounts.includes(acc.id);
                  const Icon = acc.icon;
                  return (
                    <div
                      key={acc.id}
                      onClick={() => toggleAccount(acc.id)}
                      className={cn(
                        'flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all',
                        isSelected
                          ? 'border-slate-900 dark:border-slate-100 bg-slate-900/5 dark:bg-slate-100/5'
                          : 'border-border hover:bg-muted/30'
                      )}
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="truncate">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {acc.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{acc.desc}</p>
                        </div>
                      </div>
                      <div
                        className={cn(
                          'h-5 w-5 rounded-full border flex items-center justify-center shrink-0 ml-2',
                          isSelected
                            ? 'bg-slate-900 dark:bg-slate-100 border-transparent text-white dark:text-slate-900'
                            : 'border-muted-foreground/40'
                        )}
                      >
                        {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </>
          )}

          {/* Step 4: Financial Goals */}
          {step === 4 && (
            <>
              <CardHeader>
                <CardTitle className="text-xl">Mục tiêu tài chính ưu tiên</CardTitle>
                <CardDescription>
                  Finora sẽ tùy chỉnh các biểu đồ và chỉ số phù hợp nhất với bạn.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {goalOptions.map((g) => {
                  const isSelected = selectedGoals.includes(g.id);
                  const Icon = g.icon;
                  return (
                    <div
                      key={g.id}
                      onClick={() => toggleGoal(g.id)}
                      className={cn(
                        'flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all',
                        isSelected
                          ? 'border-slate-900 dark:border-slate-100 bg-slate-900/5 dark:bg-slate-100/5'
                          : 'border-border hover:bg-muted/30'
                      )}
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="truncate">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {g.title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{g.desc}</p>
                        </div>
                      </div>
                      <div
                        className={cn(
                          'h-5 w-5 rounded-full border flex items-center justify-center shrink-0 ml-2',
                          isSelected
                            ? 'bg-slate-900 dark:bg-slate-100 border-transparent text-white dark:text-slate-900'
                            : 'border-muted-foreground/40'
                        )}
                      >
                        {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </>
          )}

          {/* Step 5: Ready */}
          {step === 5 && (
            <>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                  <Check className="h-7 w-7 stroke-[3]" />
                </div>
                <CardTitle className="text-2xl font-bold">Mọi thứ đã sẵn sàng!</CardTitle>
                <CardDescription className="text-base max-w-md mx-auto pt-1">
                  Không gian tài chính cá nhân của bạn đã được thiết lập với tiền tệ gốc{' '}
                  <strong className="text-foreground">{baseCurrency}</strong> và các tài khoản ban đầu.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-3">
                <div className="p-4 rounded-xl border bg-muted/40 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tiền tệ chính:</span>
                    <span className="font-semibold">{baseCurrency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tài khoản ban đầu:</span>
                    <span className="font-semibold">{selectedAccounts.length} tài khoản</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mục tiêu theo dõi:</span>
                    <span className="font-semibold">{selectedGoals.length} mục tiêu</span>
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {/* Card Footer Navigation */}
          <CardFooter className="flex justify-between pt-4 border-t">
            {step > 1 ? (
              <Button variant="outline" onClick={handleBack} size="sm" disabled={isSubmitting}>
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Quay lại
              </Button>
            ) : (
              <div />
            )}

            <Button onClick={handleNext} size="sm" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Đang khởi tạo...
                </>
              ) : step === totalSteps ? (
                <>
                  Vào bảng điều khiển
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </>
              ) : (
                <>
                  Tiếp tục
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
