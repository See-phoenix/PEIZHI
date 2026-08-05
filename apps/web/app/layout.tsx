import type { Metadata } from "next";
import { Syne, Noto_Sans_SC, JetBrains_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const display = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700", "800"],
});

const body = Noto_Sans_SC({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "PEIZHI 配智 · 装机与云主机选型",
  description: "国内装机推荐 + 云服务器/VPS 选型 · 有效价匹配 · 用户纠价权威库",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="relative font-[family-name:var(--font-body)]">
        <SiteHeader />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
