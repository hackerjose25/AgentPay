import type { DAppConnector as DAppConnectorType } from "@hashgraph/hedera-wallet-connect";
import type { HederaBrowserWalletAdapter, WalletConnectionOptions } from "./agentpay";
import { createHederaWalletPaymentSignature } from "./hedera-wallet-payment";

interface HashPackAdapterOptions {
  projectId: string;
  origin?: string;
}

function usableProjectId(value: string): boolean {
  return Boolean(value && value.length >= 16 && !/replace|your[_-]?project/i.test(value));
}

function isHashPackPeer(name: string): boolean {
  return name.toLowerCase().includes("hashpack");
}

export class HashPackWalletAdapter implements HederaBrowserWalletAdapter {
  private connectorPromise: Promise<DAppConnectorType> | undefined;
  private accountId: string | undefined;

  constructor(private readonly options: HashPackAdapterOptions) {}

  private async connector(): Promise<DAppConnectorType> {
    if (!usableProjectId(this.options.projectId.trim())) {
      throw new Error("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is missing or invalid.");
    }
    this.connectorPromise ??= (async () => {
      const {
        DAppConnector,
        HederaChainId,
        HederaJsonRpcMethod,
        HederaSessionEvent
      } = await import("@hashgraph/hedera-wallet-connect");
      const { LedgerId } = await import("@hiero-ledger/sdk");
      const origin = this.options.origin || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
      const connector = new DAppConnector(
        {
          name: "AegisPay",
          description: "Approve AegisPay invoice-extraction payments on Hedera Testnet",
          url: origin,
          icons: []
        },
        LedgerId.TESTNET,
        this.options.projectId.trim(),
        [HederaJsonRpcMethod.SignTransaction],
        [HederaSessionEvent.AccountsChanged, HederaSessionEvent.ChainChanged],
        [HederaChainId.Testnet],
        "error"
      );
      await connector.init({ logger: "error" });
      if (!connector.walletConnectClient) throw new Error("WalletConnect could not initialize.");
      return connector;
    })();
    return this.connectorPromise;
  }

  private hashPackTestnetSigner(connector: DAppConnectorType) {
    return connector.signers.find((candidate) => {
      if (candidate.getLedgerId().toString() !== "testnet") return false;
      const session = connector.walletConnectClient?.session.get(candidate.topic);
      return Boolean(session && isHashPackPeer(session.peer.metadata.name));
    });
  }

  async connect(options: WalletConnectionOptions = {}): Promise<{ accountId: string }> {
    const connector = await this.connector();
    let signer = this.hashPackTestnetSigner(connector);
    if (!signer) {
      const session = await connector.connect((uri) => options.onPairingUri?.(uri));
      if (!isHashPackPeer(session.peer.metadata.name)) {
        await connector.disconnect(session.topic);
        throw new Error("This QR connection accepts HashPack only.");
      }
      signer = this.hashPackTestnetSigner(connector);
    }
    if (!signer) throw new Error("HashPack did not provide a Hedera Testnet account.");
    this.accountId = signer.getAccountId().toString();
    return { accountId: this.accountId };
  }

  async createPaymentSignature(paymentRequired: unknown): Promise<string> {
    if (!this.accountId) throw new Error("Connect HashPack before approving a payment.");
    const connector = await this.connector();
    const signer = this.hashPackTestnetSigner(connector);
    if (!signer || signer.getAccountId().toString() !== this.accountId) {
      this.accountId = undefined;
      throw new Error("The HashPack session changed. Reconnect the payer account.");
    }
    return createHederaWalletPaymentSignature(
      paymentRequired,
      this.accountId,
      (transaction) => signer.signTransaction(transaction)
    );
  }

  async disconnect(): Promise<void> {
    if (!this.connectorPromise) return;
    const connector = await this.connectorPromise;
    if (connector.walletConnectClient?.session.getAll().length || connector.walletConnectClient?.core.pairing.getPairings().length) {
      await connector.disconnectAll();
    }
    this.accountId = undefined;
  }
}

export function installHashPackWallet(options: HashPackAdapterOptions): HederaBrowserWalletAdapter {
  const adapter = new HashPackWalletAdapter(options);
  if (typeof window !== "undefined") {
    window.agentPayWallet = adapter;
  }
  return adapter;
}
