import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finora — Personal Finance OS",
  description:
    "A private-first, multi-currency personal finance web application designed to help you understand what you own, where your money goes, and track your financial growth.",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col antialiased selection:bg-slate-200 dark:selection:bg-slate-800">
        {children}
      </body>
    </html>
  );
}
