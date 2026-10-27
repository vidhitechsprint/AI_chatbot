import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SupportDesk | Customer Support",
  description: "AI-ready customer support operations for your team.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
