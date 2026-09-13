'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useWallet } from '@/context/WalletContext';

export default function Navbar() {
  const { isConnected, displayAddress, balance, openModal, openAccountModal } = useWallet();

  useEffect(() => {
    let lastY = 0;
    const onScroll = () => {
      const y = window.scrollY;
      document.body.classList.toggle('scroll-min', y > 100);
      document.body.classList.toggle('scroll-down', y > lastY && y > 300);
      lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className="navbar">
      <div className="nav-inner">
      <a href="#" className="brand">
        <img src="/logo.png" alt="AegisPay Logo" className="brand-logo-img" />
        <span className="brand-text">AegisPay</span>
      </a>

      <div className="nav-actions">
        <div className="open-contact">
          <a href="https://github.com/hackerjose25/AgentPay.git" target="_blank" rel="noopener noreferrer">GitHub</a>
        </div>

        <Link href="/dashboard" className="nav-console-btn">  
          <span>Console</span>
        </Link>

        {isConnected ? (
          <button className="nav-wallet-btn connected" onClick={openAccountModal}>
            <span className="wallet-dot"></span>
            <span className="wallet-balance">{balance} Ħ</span>
            <span className="wallet-pill-addr">{displayAddress}</span>
          </button>
        ) : (
          <button className="nav-wallet-btn" onClick={openModal}>
            <span className="wallet-dot"></span>
            <span className="wallet-text-full">Connect Wallet</span>
            <span className="wallet-text-short">Connect</span>
          </button>
        )}
      </div>

      <button className="toggler" id="toggler"></button>
      </div>
    </nav>
  );
}
