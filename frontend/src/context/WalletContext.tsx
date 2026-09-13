'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { installHashPackWallet, HashPackWalletAdapter } from '@/lib/hashpack-wallet';

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
  pairingUri: string | null;
  openModal: () => void;
  closeModal: () => void;
  openAccountModal: () => void;
  closeAccountModal: () => void;
  connect: (type: WalletType) => Promise<void>;
  disconnect: () => void;
  createPaymentSignature: (paymentRequired: unknown) => Promise<string>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const HEDERA_TESTNET_PARAMS = {
  chainId: '0x128',
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
  const [pairingUri, setPairingUri] = useState<string | null>(null);
  const [adapter, setAdapter] = useState<HashPackWalletAdapter | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('agentpay_wallet');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.address && data.walletType) {
          setAddress(data.address);
          setWalletType(data.walletType);
          setBalance(data.balance || '245.50');
          setIsConnected(true);
        }
      }
    } catch {
      // ignore
    }

    const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
    if (projectId && typeof window !== 'undefined') {
      try {
        const hpAdapter = new HashPackWalletAdapter({ projectId });
        setAdapter(hpAdapter);
        window.agentPayWallet = hpAdapter;
      } catch {
        // ignore setup error if project id is placeholder
      }
    }
  }, []);

  const openModal = useCallback(() => setIsModalOpen(true), []);
  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setPairingUri(null);
  }, []);
  const openAccountModal = useCallback(() => setIsAccountModalOpen(true), []);
  const closeAccountModal = useCallback(() => setIsAccountModalOpen(false), []);

  const connect = useCallback(async (type: WalletType) => {
    setIsConnecting(true);
    setPairingUri(null);

    try {
      if (type === 'hashpack' && adapter) {
        try {
          const res = await adapter.connect({
            onPairingUri: (uri) => setPairingUri(uri),
          });
          setAddress(res.accountId);
          setWalletType('hashpack');
          setBalance('245.50');
          setIsConnected(true);
          setIsModalOpen(false);
          localStorage.setItem('agentpay_wallet', JSON.stringify({
            address: res.accountId,
            walletType: 'hashpack',
            balance: '245.50',
          }));
          return;
        } catch (err: unknown) {
          console.warn("HashPack WalletConnect error, using default testnet account", err);
        }
      }

      if (type === 'metamask') {
        if (typeof window !== 'undefined' && (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum) {
          const eth = (window as unknown as { ethereum: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
          try {
            const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
            if (accounts && accounts.length > 0) {
              const userAddr = accounts[0];
              try {
                await eth.request({
                  method: 'wallet_switchEthereumChain',
                  params: [{ chainId: HEDERA_TESTNET_PARAMS.chainId }],
                });
              } catch (switchError: unknown) {
                if ((switchError as { code?: number })?.code === 4902) {
                  try {
                    await eth.request({
                      method: 'wallet_addEthereumChain',
                      params: [HEDERA_TESTNET_PARAMS],
                    });
                  } catch {
                    // Ignore
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
            // fallback below
          }
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 400));
      let mockAddr = '0.0.5902184';
      let mockBal = '500.00';

      if (type === 'hashpack') {
        mockAddr = '0.0.4829103';
        mockBal = '245.50';
      } else if (type === 'blade') {
        mockAddr = '0.0.3912048';
        mockBal = '188.00';
      } else if (type === 'agent') {
        mockAddr = '0.0.5902184';
        mockBal = '500.00';
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
  }, [adapter]);

  const createPaymentSignature = useCallback(async (paymentRequired: unknown): Promise<string> => {
    if (typeof window !== "undefined" && window.agentPayWallet) {
      try {
        return await window.agentPayWallet.createPaymentSignature(paymentRequired);
      } catch (err: unknown) {
        console.warn("Wallet adapter payment signature failed, generating wallet signature:", err);
      }
    }

    const { createHederaWalletPaymentSignature } = await import('@/lib/hedera-wallet-payment');
    const payer = address || '0.0.5902184';

    return createHederaWalletPaymentSignature(
      paymentRequired,
      payer,
      async (tx) => tx
    );
  }, [address]);

  const disconnect = useCallback(() => {
    setIsConnected(false);
    setAddress(null);
    setWalletType(null);
    setBalance('0.00');
    setIsAccountModalOpen(false);
    setPairingUri(null);
    if (adapter) {
      adapter.disconnect().catch(() => undefined);
    }
    try {
      localStorage.removeItem('agentpay_wallet');
    } catch {
      // ignore
    }
  }, [adapter]);

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
        pairingUri,
        openModal,
        closeModal,
        openAccountModal,
        closeAccountModal,
        connect,
        disconnect,
        createPaymentSignature,
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
