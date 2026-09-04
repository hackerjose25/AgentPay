'use client';

import { useEffect } from 'react';
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
      <a href="#" className="brand">
        <svg viewBox="0 0 48 48" fill="none">
          <path fillRule="evenodd" clipRule="evenodd" d="M23.8588 4.80005L40.8 14.4V33.8824L23.8588 43.2001L7.20001 33.8824V14.4L23.8588 4.80005ZM12.847 17.7883L23.8587 11.2942L34.8705 17.7883L29.7882 20.8942L23.8587 17.2236L18.494 20.8942V33.8825L12.847 30.4942V17.7883Z" fill="currentColor"/>
        </svg>
        <span className="brand-text">AgentPay</span>
      </a>

      <div className="nav-actions">
        <div className="open-contact">
          <a href="https://github.com/hackerjose25/AgentPay.git" target="_blank" rel="noopener noreferrer">GitHub</a>
        </div>

        {isConnected ? (
          <button className="nav-wallet-btn connected" onClick={openAccountModal}>
            <span className="wallet-dot"></span>
            <span className="wallet-balance">{balance} Ħ</span>
            <span className="wallet-pill-addr">{displayAddress}</span>
          </button>
        ) : (
          <button className="nav-wallet-btn" onClick={openModal}>
            <span className="wallet-dot"></span>
            <span>Connect Wallet</span>
          </button>
        )}
      </div>

      <button className="toggler" id="toggler"></button>
    </nav>
  );
}
