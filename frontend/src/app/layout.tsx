import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/context/WalletContext";
import { RunProvider } from "@/context/RunContext";
import WalletModal from "@/components/WalletModal";

export const metadata: Metadata = {
  title: "AgentPay — Autonomous AI Service Router",
  description: "Autonomous AI service router — discover the best service, prove why it was chosen, and pay for it autonomously. ENSv2 discovers, Policy evaluates, AI decides, Hedera settles, x402 unlocks.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="home" data-anim-duration="500" data-anim-delay="500">
        <WalletProvider>
          <RunProvider>
            {children}
            <WalletModal />
          </RunProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
