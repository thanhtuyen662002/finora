"use client";

import React, { useState } from 'react';
import Link from 'next/link';
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
  ArrowLeft,
  Loader2,
  AlertCircle,
  MailCheck,
} from 'lucide-react';
import { requestPasswordReset } from '@/lib/auth';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const { error } = await requestPasswordReset(email);

      if (error) {
        setErrorMessage(error.message);
        setIsLoading(false);
        return;
      }

      setIsSubmitted(true);
      setIsLoading(false);
    } catch {
      setErrorMessage('Không thể gửi yêu cầu khôi phục mật khẩu. Vui lòng thử lại.');
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-muted/30">
        <div className="w-full max-w-md space-y-6">
          <Card className="shadow-lg border-border text-center">
            <CardHeader className="space-y-3 pb-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                <MailCheck className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl">Đã gửi liên kết khôi phục</CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                Chúng tôi đã gửi hướng dẫn đặt lại mật khẩu đến địa chỉ{' '}
                <strong className="text-foreground">{email}</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Vui lòng kiểm tra hộp thư (bao gồm cả thư mục Spam nếu cần) và nhấp vào liên kết để thiết lập mật khẩu mới.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/login">
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  Quay lại Đăng nhập
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
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold text-xl shadow-md">
            F
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Finora
          </h1>
          <p className="text-sm text-muted-foreground">
            Khôi phục quyền truy cập vào tài khoản Finora của bạn.
          </p>
        </div>

        <Card className="shadow-lg border-border">
          <CardHeader className="pb-3 text-center">
            <CardTitle className="text-lg">Quên mật khẩu?</CardTitle>
            <CardDescription>
              Nhập email đăng ký tài khoản để nhận liên kết khôi phục mật khẩu.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {errorMessage && (
              <div className="p-3 text-xs bg-destructive/10 text-destructive border border-destructive/20 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email tài khoản</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ten@vidu.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={isLoading}
                />
              </div>

              <Button
                type="submit"
                className="w-full font-semibold"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Đang gửi yêu cầu...
                  </>
                ) : (
                  'Gửi liên kết khôi phục'
                )}
              </Button>
            </form>

            <div className="pt-2 text-center text-xs text-muted-foreground">
              <Link
                href="/login"
                className="inline-flex items-center text-muted-foreground hover:text-foreground font-medium"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Quay lại trang Đăng nhập
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
