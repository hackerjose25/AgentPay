'use client';

import React, { useState } from 'react';
import { useWallet, WalletType } from '@/context/WalletContext';

export default function WalletModal() {
  const {
    isModalOpen,
    closeModal,
    isAccountModalOpen,
    closeAccountModal,
    connect,
    disconnect,
    isConnecting,
    isConnected,
    address,
    displayAddress,
    balance,
    walletType,
    network,
  } = useWallet();

  const [copied, setCopied] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<WalletType | null>(null);

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConnect = async (type: WalletType) => {
    setSelectedWallet(type);
    await connect(type);
    setSelectedWallet(null);
  };

  if (!isModalOpen && !isAccountModalOpen) return null;

  return (
    <div className="wallet-modal-overlay" onClick={() => { closeModal(); closeAccountModal(); }}>
      <div className="wallet-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* ===================== CONNECTION MODAL ===================== */}
        {isModalOpen && !isConnected && (
          <div className="wallet-modal-card">
            <div className="wallet-modal-header">
              <div>
                <div className="wallet-modal-sub">
                  <span className="pulsing-dot"></span>
                  <span>HEDERA TESTNET · 296</span>
                </div>
                <h3 className="wallet-modal-title">Connect Wallet</h3>
              </div>
              <button className="wallet-modal-close" onClick={closeModal} aria-label="Close modal">
                &times;
              </button>
            </div>

            <p className="wallet-modal-desc">
              Connect your Hedera or EVM wallet to fund autonomous agents, sign x402 payments, and verify on-chain receipts.
            </p>

            <div className="wallet-options-list">
              {/* HashPack */}
              <button
                className={`wallet-option-btn ${selectedWallet === 'hashpack' ? 'loading' : ''}`}
                onClick={() => handleConnect('hashpack')}
                disabled={isConnecting}
              >
                <div className="wallet-option-icon hashpack-icon">
                  <svg viewBox="0 0 32 32" fill="none" width="24" height="24">
                    <circle cx="16" cy="16" r="16" fill="#8A42FF" />
                    <path d="M9 16L14 11V21L9 16Z" fill="#FFFFFF" />
                    <path d="M23 16L18 21V11L23 16Z" fill="#FFFFFF" />
                  </svg>
                </div>
                <div className="wallet-option-info">
                  <div className="wallet-option-name">HashPack</div>
                  <div className="wallet-option-sub">Hedera native Web3 wallet</div>
                </div>
                <span className="wallet-option-badge">Popular</span>
              </button>

              {/* Blade Wallet */}
              <button
                className={`wallet-option-btn ${selectedWallet === 'blade' ? 'loading' : ''}`}
                onClick={() => handleConnect('blade')}
                disabled={isConnecting}
              >
                <div className="wallet-option-icon blade-icon">
                  <svg viewBox="0 0 32 32" fill="none" width="24" height="24">
                    <circle cx="16" cy="16" r="16" fill="#1C1C1E" stroke="#00E5FF" strokeWidth="1.5" />
                    <path d="M11 21L21 11M11 11L21 21" stroke="#00E5FF" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="wallet-option-info">
                  <div className="wallet-option-name">Blade Wallet</div>
                  <div className="wallet-option-sub">Enterprise Hedera key management</div>
                </div>
              </button>

              {/* MetaMask / EVM */}
              <button
                className={`wallet-option-btn ${selectedWallet === 'metamask' ? 'loading' : ''}`}
                onClick={() => handleConnect('metamask')}
                disabled={isConnecting}
              >
                <div className="wallet-option-icon metamask-icon">
                  <svg viewBox="0 0 32 32" fill="none" width="24" height="24">
                    <circle cx="16" cy="16" r="16" fill="#F6851B" />
                    <path d="M22 10L16 14.5L10 10L12 17L16 23L20 17L22 10Z" fill="#E2761B" stroke="#FFFFFF" strokeWidth="1" />
                  </svg>
                </div>
                <div className="wallet-option-info">
                  <div className="wallet-option-name">MetaMask / EVM</div>
                  <div className="wallet-option-sub">Hedera JSON-RPC (Chain ID 296)</div>
                </div>
                <span className="wallet-option-badge evm">EVM</span>
              </button>

              {/* Agent Self-Custodial Keypair */}
              <button
                className={`wallet-option-btn agent-btn ${selectedWallet === 'agent' ? 'loading' : ''}`}
                onClick={() => handleConnect('agent')}
                disabled={isConnecting}
              >
                <div className="wallet-option-icon agent-icon">
                  <svg viewBox="0 0 32 32" fill="none" width="24" height="24">
                    <circle cx="16" cy="16" r="16" fill="#0b1b0b" stroke="var(--lime)" strokeWidth="1.5" />
                    <circle cx="16" cy="16" r="5" fill="var(--lime)" />
                    <path d="M16 6V11M16 21V26M6 16H11M21 16H26" stroke="var(--lime)" strokeWidth="1.5" />
                  </svg>
                </div>
                <div className="wallet-option-info">
                  <div className="wallet-option-name">Autonomous Agent Wallet</div>
                  <div className="wallet-option-sub">Dedicated on-chain agent payer wallet</div>
                </div>
                <span className="wallet-option-badge agent">AI Agent</span>
              </button>
            </div>

            <div className="wallet-modal-footer">
              <span>New to Hedera?</span>
              <a href="https://portal.hedera.com/faucet" target="_blank" rel="noopener noreferrer">
                Get free Testnet HBAR &rarr;
              </a>
            </div>
          </div>
        )}

        {/* ===================== ACCOUNT DETAILS MODAL ===================== */}
        {isAccountModalOpen && isConnected && (
          <div className="wallet-modal-card account-card">
            <div className="wallet-modal-header">
              <div className="account-status-wrap">
                <span className="pulsing-dot"></span>
                <span className="account-network-name">{network}</span>
              </div>
              <button className="wallet-modal-close" onClick={closeAccountModal} aria-label="Close modal">
                &times;
              </button>
            </div>

            <div className="account-balance-box">
              <div className="balance-label">Total Balance</div>
              <div className="balance-val">
                <span>{balance}</span>
                <span className="balance-unit">HBAR</span>
              </div>
              <div className="balance-usd">≈ ${(parseFloat(balance || '0') * 0.22).toFixed(2)} USD</div>
            </div>

            <div className="account-details-list">
              <div className="account-detail-item">
                <span className="detail-lbl">Connected As</span>
                <span className="detail-val type-tag">{walletType?.toUpperCase()}</span>
              </div>

              <div className="account-detail-item">
                <span className="detail-lbl">Account Address</span>
                <div className="detail-addr-box">
                  <span className="addr-text">{displayAddress}</span>
                  <button className="copy-btn" onClick={handleCopy}>
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="account-detail-item">
                <span className="detail-lbl">Explorer</span>
                <a
                  href={`https://hashscan.io/testnet/account/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="explorer-link"
                >
                  View on HashScan &rarr;
                </a>
              </div>
            </div>

            <div className="account-actions">
              <button className="btn-disconnect" onClick={disconnect}>
                Disconnect Wallet
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
