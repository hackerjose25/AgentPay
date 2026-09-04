import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/context/WalletContext";
import WalletModal from "@/components/WalletModal";

export const metadata: Metadata = {
  title: "AgentPay — Autonomous AI Agent Marketplace",
  description: "Autonomous AI agent marketplace with x402 pay-per-inference on Hedera.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="home" data-anim-duration="500" data-anim-delay="500">
        <WalletProvider>
          {children}
          <WalletModal />
        </WalletProvider>
      </body>
    </html>
  );
}
