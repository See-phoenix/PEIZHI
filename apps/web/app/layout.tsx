import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PEIZHI 装机配智",
  description: "国内装机推荐 · 多通道比价 · 用户纠价权威库",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
