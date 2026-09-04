'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type WalletType = 'hashpack' | 'blade' | 'metamask' | 'agent';

export interface WalletContextType {
  isConnected: boolean;
  isConnecting: boolean;
  address: string | null;
  displayAddress: string;
  walletType: WalletType | null;
  balance: string;
  network: string;
  chainId: number;
  isModalOpen: boolean;
  isAccountModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  openAccountModal: () => void;
  closeAccountModal: () => void;
  connect: (type: WalletType) => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

// Hedera Testnet EVM Parameters
const HEDERA_TESTNET_PARAMS = {
  chainId: '0x128', // 296 in hex
  chainName: 'Hedera Testnet',
  nativeCurrency: {
    name: 'HBAR',
    symbol: 'HBAR',
    decimals: 18,
  },
  rpcUrls: ['https://testnet.hashio.io/api'],
  blockExplorerUrls: ['https://hashscan.io/testnet'],
};

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<WalletType | null>(null);
  const [balance, setBalance] = useState<string>('0.00');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  // Load saved connection state on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('agentpay_wallet');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.address && data.walletType) {
          setAddress(data.address);
          setWalletType(data.walletType);
          setBalance(data.balance || '128.50');
          setIsConnected(true);
        }
      }
    } catch {
      // ignore parsing error
    }
  }, []);

  const openModal = useCallback(() => setIsModalOpen(true), []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);
  const openAccountModal = useCallback(() => setIsAccountModalOpen(true), []);
  const closeAccountModal = useCallback(() => setIsAccountModalOpen(false), []);

  const connect = useCallback(async (type: WalletType) => {
    setIsConnecting(true);

    try {
      if (type === 'metamask') {
        if (typeof window !== 'undefined' && (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum) {
          const eth = (window as unknown as { ethereum: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
          
          try {
            const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
            if (accounts && accounts.length > 0) {
              const userAddr = accounts[0];
              
              // Attempt to switch to Hedera Testnet (Chain ID 296 / 0x128)
              try {
                await eth.request({
                  method: 'wallet_switchEthereumChain',
                  params: [{ chainId: HEDERA_TESTNET_PARAMS.chainId }],
                });
              } catch (switchError: unknown) {
                // If chain is not added, add it
                if ((switchError as { code?: number })?.code === 4902) {
                  try {
                    await eth.request({
                      method: 'wallet_addEthereumChain',
                      params: [HEDERA_TESTNET_PARAMS],
                    });
                  } catch {
                    // Ignore chain add rejection
                  }
                }
              }

              setAddress(userAddr);
              setWalletType('metamask');
              setBalance('84.20');
              setIsConnected(true);
              setIsModalOpen(false);

              localStorage.setItem('agentpay_wallet', JSON.stringify({
                address: userAddr,
                walletType: 'metamask',
                balance: '84.20',
              }));
              return;
            }
          } catch {
            // User rejected or fallback
          }
        }
      }

      // Native Hedera wallet simulation / fallback (HashPack, Blade, Agent)
      await new Promise((resolve) => setTimeout(resolve, 600));

      let mockAddr = '';
      let mockBal = '150.00';

      if (type === 'hashpack') {
        mockAddr = '0.0.4829103';
        mockBal = '245.50';
      } else if (type === 'blade') {
        mockAddr = '0.0.3912048';
        mockBal = '188.00';
      } else if (type === 'agent') {
        mockAddr = '0.0.5902184';
        mockBal = '500.00';
      } else {
        mockAddr = '0x71C2d38E91A84358a98C12b184201889812A';
        mockBal = '84.20';
      }

      setAddress(mockAddr);
      setWalletType(type);
      setBalance(mockBal);
      setIsConnected(true);
      setIsModalOpen(false);

      localStorage.setItem('agentpay_wallet', JSON.stringify({
        address: mockAddr,
        walletType: type,
        balance: mockBal,
      }));
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setIsConnected(false);
    setAddress(null);
    setWalletType(null);
    setBalance('0.00');
    setIsAccountModalOpen(false);
    try {
      localStorage.removeItem('agentpay_wallet');
    } catch {
      // ignore
    }
  }, []);

  const displayAddress = address
    ? address.startsWith('0x')
      ? `${address.slice(0, 6)}...${address.slice(-4)}`
      : address
    : '';

  return (
    <WalletContext.Provider
      value={{
        isConnected,
        isConnecting,
        address,
        displayAddress,
        walletType,
        balance,
        network: 'Hedera Testnet',
        chainId: 296,
        isModalOpen,
        isAccountModalOpen,
        openModal,
        closeModal,
        openAccountModal,
        closeAccountModal,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
