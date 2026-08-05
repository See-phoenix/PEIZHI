import type { Metadata } from "next";
import { Orbitron, Noto_Sans_SC, JetBrains_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { PageAtmosphere } from "@/components/fx/page-atmosphere";
import "./globals.css";

const display = Orbitron({
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
  title: "PEIZHI 配智 · 二次元装机台",
  description: "国内装机推荐 + 云服务器选型 · 霓虹交互 · 有效价匹配",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="relative overflow-x-hidden font-[family-name:var(--font-body)]">
        <PageAtmosphere />
        <div className="relative z-10">
          <SiteHeader />
          {children}
        </div>
      </body>
    </html>
  );
}
