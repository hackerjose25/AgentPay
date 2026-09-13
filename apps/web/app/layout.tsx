import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentPay — Autonomous AI Service Router",
  description: "Autonomous AI service router — discover the best service, prove why it was chosen, and pay for it autonomously. ENSv2 discovers, readiness verifies, AI decides, Hedera settles, x402 unlocks.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="home" data-anim-duration="500" data-anim-delay="500">
        {children}
      </body>
    </html>
  );
}