"use client";

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ShieldCheck,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  MailCheck,
} from 'lucide-react';
import { signUpWithEmail, signInWithGoogle } from '@/lib/auth';

function SignUpForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccessConfirmationRequired, setIsSuccessConfirmationRequired] =
    useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password.length < 8) {
      setErrorMessage('Mật khẩu phải có tối thiểu 8 ký tự.');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await signUpWithEmail(
        email,
        password,
        displayName
      );

      if (error) {
        setErrorMessage(error.message);
        setIsLoading(false);
        return;
      }

      if (data?.session) {
        // Direct session established (e.g. email confirmation off) -> onboarding
        router.push('/onboarding');
        router.refresh();
      } else if (data?.user) {
        // Confirmation email dispatched
        setIsSuccessConfirmationRequired(true);
        setIsLoading(false);
      }
    } catch {
      setErrorMessage('Đã xảy ra sự cố trong quá trình đăng ký. Vui lòng thử lại.');
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setIsGoogleLoading(true);

    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setErrorMessage(error.message);
        setIsGoogleLoading(false);
      }
    } catch {
      setErrorMessage('Không thể khởi tạo đăng nhập Google. Vui lòng thử lại sau.');
      setIsGoogleLoading(false);
    }
  };

  if (isSuccessConfirmationRequired) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-muted/30">
        <div className="w-full max-w-md space-y-6">
          <Card className="shadow-lg border-border text-center">
            <CardHeader className="space-y-3 pb-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                <MailCheck className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl">Kiểm tra hộp thư của bạn</CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                Chúng tôi đã gửi một liên kết xác thực đến địa chỉ{' '}
                <strong className="text-foreground">{email}</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Vui lòng nhấp vào liên kết trong email để kích hoạt tài khoản Finora, sau đó quay lại đăng nhập.
              </p>
              <Button asChild className="w-full font-semibold">
                <Link href="/login">
                  Đi đến trang Đăng nhập
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-muted/30">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold text-xl shadow-md">
            F
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Finora
          </h1>
          <p className="text-sm text-muted-foreground">
            Tạo tài khoản tài chính cá nhân an toàn & riêng tư.
          </p>
        </div>

        {/* Register Card */}
        <Card className="shadow-lg border-border">
          <CardHeader className="pb-3 text-center">
            <CardTitle className="text-lg">Tạo tài khoản mới</CardTitle>
            <CardDescription>
              Bắt đầu làm chủ dòng tiền và tài sản của bạn ngay hôm nay.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {errorMessage && (
              <div className="p-3 text-xs bg-destructive/10 text-destructive border border-destructive/20 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSignUp} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="displayName">Họ và tên</Label>
                <Input
                  id="displayName"
                  placeholder="Nguyễn Văn A"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  disabled={isLoading || isGoogleLoading}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ten@vidu.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={isLoading || isGoogleLoading}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Mật khẩu</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Tối thiểu 8 ký tự"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  disabled={isLoading || isGoogleLoading}
                />
              </div>

              <Button
                type="submit"
                className="w-full mt-2 font-semibold"
                disabled={isLoading || isGoogleLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Đang tạo tài khoản...
                  </>
                ) : (
                  <>
                    Đăng ký tài khoản
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </>
                )}
              </Button>
            </form>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Hoặc
                </span>
              </div>
            </div>

            {/* Google OAuth button */}
            <Button
              variant="outline"
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading || isGoogleLoading}
              className="w-full flex items-center justify-center space-x-2"
            >
              {isGoogleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    fill="#EA4335"
                  />
                </svg>
              )}
              <span>Tiếp tục với Google</span>
            </Button>

            <div className="pt-2 text-center text-xs text-muted-foreground">
              Đã có tài khoản?{' '}
              <Link
                href="/login"
                className="text-primary hover:underline font-semibold"
              >
                Đăng nhập
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Security badge */}
        <div className="flex items-center justify-center space-x-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>Dữ liệu được cô lập bảo mật & không thương mại hóa</span>
        </div>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-muted/30">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SignUpForm />
    </Suspense>
  );
}
