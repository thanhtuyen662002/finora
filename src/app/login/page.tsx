"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ShieldCheck, Lock, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('demo@finora.me');
  const [password, setPassword] = useState('••••••••');
  const [isLoading, setIsLoading] = useState(false);

  const handleMockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      router.push('/dashboard');
    }, 400);
  };

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
            Hệ điều hành tài chính cá nhân an toàn & riêng tư.
          </p>
        </div>

        {/* Login / Register Card */}
        <Card className="shadow-lg border-border">
          <CardHeader className="pb-3 text-center">
            <CardTitle className="text-lg">Chào mừng bạn quay lại</CardTitle>
            <CardDescription>
              Đăng nhập để quản lý dòng tiền và mục tiêu của bạn.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="login">Đăng nhập</TabsTrigger>
                <TabsTrigger value="register">Tạo tài khoản</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleMockSubmit} className="space-y-3.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="ten@vidu.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="password">Mật khẩu</Label>
                      <button
                        type="button"
                        onClick={() => alert('Chức năng demo: Mật khẩu mặc định')}
                        className="text-xs text-muted-foreground hover:underline"
                      >
                        Quên mật khẩu?
                      </button>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full mt-2" disabled={isLoading}>
                    {isLoading ? 'Đang vào...' : 'Tiếp tục'}
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleMockSubmit} className="space-y-3.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-name">Họ và tên</Label>
                    <Input id="reg-name" placeholder="Nguyễn Văn A" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-email">Email</Label>
                    <Input id="reg-email" type="email" placeholder="ten@vidu.com" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-pass">Mật khẩu</Label>
                    <Input id="reg-pass" type="password" placeholder="Tối thiểu 8 ký tự" required />
                  </div>

                  <Button type="submit" className="w-full mt-2" disabled={isLoading}>
                    Tạo tài khoản mới
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

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

            {/* Google OAuth visual mock */}
            <Button
              variant="outline"
              type="button"
              onClick={() => router.push('/dashboard')}
              className="w-full flex items-center justify-center space-x-2"
            >
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
              <span>Tiếp tục với Google</span>
            </Button>

            <div className="pt-2">
              <Link
                href="/onboarding"
                className="text-xs text-center block text-primary hover:underline font-medium"
              >
                Chưa quen với Finora? Xem luồng khởi tạo (Onboarding) →
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
