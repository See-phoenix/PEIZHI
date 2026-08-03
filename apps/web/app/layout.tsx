import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "PEIZHI 配智",
  description: "国内装机推荐 + 云服务器/VPS 选型 · 多通道比价 · 用户纠价权威库",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <header className="topnav">
          <div className="topnav-inner">
            <Link href="/" className="brand">
              PEIZHI 配智
            </Link>
            <nav>
              <Link href="/">装机配置</Link>
              <Link href="/servers">服务器选型</Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
