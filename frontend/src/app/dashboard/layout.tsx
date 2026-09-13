'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWallet } from '@/context/WalletContext';
import './dashboard.css';

const navItems = [
  { href: '/dashboard', label: 'Agent Console', icon: '🤖', exact: true },
  { href: '/dashboard/discovery', label: 'Provider Discovery', icon: '🌐' },
  { href: '/dashboard/intelligence', label: 'Provider Intelligence', icon: '📊' },
  { href: '/dashboard/payment', label: 'Payment Trace', icon: '💸' },
  { href: '/dashboard/result', label: 'Execution Result', icon: '🧾' },
];

const pageTitles: Record<string, string> = {
  '/dashboard': 'Agent Console',
  '/dashboard/discovery': 'Provider Discovery',
  '/dashboard/intelligence': 'Provider Intelligence',
  '/dashboard/payment': 'Payment Trace',
  '/dashboard/result': 'Execution Result',
};

const pageVideos: Record<string, string> = {
  '/dashboard': '/videos/sidebar-bg.mp4',
  '/dashboard/discovery': '/videos/footer.mp4',
  '/dashboard/intelligence': '/videos/footer.mp4',
  '/dashboard/payment': '/videos/footer.mp4',
  '/dashboard/result': '/videos/footer.mp4',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isConnected, displayAddress, balance, openModal, openAccountModal } = useWallet();

  const title = pageTitles[pathname] ?? 'Agent Console';
  const mainVideo = pageVideos[pathname] ?? '/videos/sidebar-bg.mp4';

  return (
    <div className="dash-shell">
      {/* Sidebar */}
      <aside className="dash-sidebar">
        <video
          className="dash-sidebar-video"
          src="/videos/sidebar-bg.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          tabIndex={-1}
        />
        <div className="dash-sidebar-overlay" aria-hidden="true" />
        <Link href="/" className="dash-brand">
          <svg viewBox="0 0 48 48" fill="none">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M23.8588 4.80005L40.8 14.4V33.8824L23.8588 43.2001L7.20001 33.8824V14.4L23.8588 4.80005ZM12.847 17.7883L23.8587 11.2942L34.8705 17.7883L29.7882 20.8942L23.8587 17.2236L18.494 20.8942V33.8825L12.847 30.4942V17.7883Z"
              fill="currentColor"
            />
          </svg>
          <span>AgentPay</span>
        </Link>

        <nav className="dash-nav">
          <p className="dash-nav-label">ROUTER</p>
          {navItems.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`dash-nav-link ${active ? 'active' : ''}`}
              >
                <span className="dash-nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="dash-sidebar-foot">
          <div className="dash-flow-mini">
            <span>ENSv2</span>→<span>Policy</span>→<span>AI</span>→<span>Hedera</span>→<span>x402</span>
          </div>
          <a
            href="https://github.com/hackerjose25/AgentPay.git"
            target="_blank"
            rel="noopener noreferrer"
            className="dash-gh"
          >
            GitHub ↗
          </a>
        </div>
      </aside>

      {/* Main */}
      <div className="dash-main">
        <video
          className="dash-main-video"
          src={mainVideo}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          tabIndex={-1}
        />
        <div className="dash-main-overlay" aria-hidden="true" />
        <header className="dash-topbar">
          <h1 className="dash-title">{title}</h1>
          <div className="dash-topbar-right">
            <span className="dash-network">
              <span className="dash-dot"></span>
              Hedera Testnet · 296
            </span>
            {isConnected ? (
              <button className="dash-wallet connected" onClick={openAccountModal}>
                <span className="dash-wallet-bal">{balance} Ħ</span>
                <span className="dash-wallet-addr">{displayAddress}</span>
              </button>
            ) : (
              <button className="dash-wallet" onClick={openModal}>
                Connect Wallet
              </button>
            )}
          </div>
        </header>

        <main className="dash-content">{children}</main>
      </div>
    </div>
  );
}