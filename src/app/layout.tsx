import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finora — Personal Finance OS",
  description:
    "A private-first, multi-currency personal finance web application designed to help you understand what you own, where your money goes, and track your financial growth.",
  icons: {
    icon: "/finora-icon.svg",
    shortcut: "/finora-icon.svg",
    apple: "/finora-icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0f172a",
};

const themeScript = `
(function() {
  try {
    var stored = localStorage.getItem('finora_theme');
    var theme = stored || 'system';
    var isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col antialiased selection:bg-slate-200 dark:selection:bg-slate-800">
        {children}
      </body>
    </html>
  );
}
