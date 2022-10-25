import type {
  Kmd,
  EncodedSignedTransaction,
  EncodedTransaction,
} from "algosdk";
import BaseWallet from "./base";
import type { InitAlgodClient } from "./base";
import { PROVIDER_ID, NODE_TOKEN, NODE_SERVER, NODE_PORT } from "../constants";
import { providers } from "../providers";
import type { Account, Wallet, WalletProvider } from "../types";
import { TransactionsArray } from "../types";
import {
  KMD_HOST,
  KMD_TOKEN,
  KMD_PORT,
  KMD_WALLET,
  KMD_PASSWORD as _KMD_PASSWORD,
} from "../constants";

type KMDConfig = {
  host: string;
  port: string;
  token: string;
};

const DefaultKMDConfig = {
  host: KMD_HOST,
  token: KMD_TOKEN,
  port: KMD_PORT,
} as KMDConfig;

interface ListWalletResponse {
  id: string;
  name: string;
  driver_name?: string;
  driver_version?: number;
  mnemonic_ux?: boolean;
  supported_txs?: Array<any>;
}

interface InitWalletHandle {
  wallet_handle_token: string;
  message?: string;
  error?: boolean;
}

type InitWallet = {
  client: Kmd;
  id: PROVIDER_ID;
  providers: typeof providers;
};

class KMDWallet extends BaseWallet {
  #client: Kmd;
  walletId: string;
  id: PROVIDER_ID;
  provider: WalletProvider;

  constructor(initAlgodClient: InitAlgodClient, initWallet: InitWallet) {
    super(initAlgodClient);

    this.#client = initWallet.client;
    this.id = initWallet.id;
    this.provider = initWallet.providers[this.id];
    this.walletId = "";
  }

  static async init() {
    const algosdk = (await import("algosdk")).default;
    const initAlgodClient: InitAlgodClient = {
      algosdk,
      token: NODE_TOKEN,
      server: NODE_SERVER,
      port: NODE_PORT,
    };

    // TODO: allow diff config options?
    const kmdConfig: KMDConfig = DefaultKMDConfig;

    const kmdClient = new algosdk.Kmd(
      kmdConfig.token,
      kmdConfig.host,
      kmdConfig.port
    );

    const initWallet: InitWallet = {
      id: PROVIDER_ID.KMD_WALLET,
      client: kmdClient,
      providers: providers,
    };

    return new KMDWallet(initAlgodClient, initWallet);
  }

  async connect(): Promise<Wallet> {
    // TODO: prompt for wallet and password?
    return {
      ...this.provider,
      accounts: await this.listAccounts(
        KMD_WALLET,
        await this.requestPassword()
      ),
    };
  }

  async disconnect() {
    return;
  }

  async reconnect(): Promise<Wallet | null> {
    return {
      ...this.provider,
      accounts: await this.listAccounts(
        KMD_WALLET,
        await this.requestPassword()
      ),
    };
  }

  async requestPassword(): Promise<string> {
    // TODO: store it locally?
    const pw = prompt("gib password");
    return pw ? pw : "";
  }

  async getWalletToken(walletId: string, password: string): Promise<string> {
    const handleResp: InitWalletHandle = await this.#client.initWalletHandle(
      walletId,
      password
    );
    return handleResp.wallet_handle_token;
  }

  async releaseToken(token: string): Promise<void> {
    await this.#client.releaseWalletHandle(token);
  }

  async listWallets(): Promise<Record<string, string>> {
    const walletResponse = await this.#client.listWallets();
    const walletList: Array<ListWalletResponse> = walletResponse["wallets"];
    const walletMap: Record<string, string> = {};
    for (const w of walletList) {
      walletMap[w.name] = w.id;
    }
    return walletMap;
  }

  async listAccounts(
    wallet: string,
    password: string
  ): Promise<Array<Account>> {
    const walletMap = await this.listWallets();

    if (!(wallet in walletMap)) throw Error("No wallet named: " + wallet);

    this.walletId = walletMap[wallet];

    // Get a handle token
    const token = await this.getWalletToken(this.walletId, password);

    // Fetch accounts and format them as lib expects
    const listResponse = await this.#client.listKeys(token);
    const addresses: Array<string> = listResponse["addresses"];
    const mappedAccounts = addresses.map((address: string, index: number) => {
      return {
        name: `KMDWallet ${index + 1}`,
        address,
        providerId: this.provider.id,
      };
    });

    // Release handle token
    this.releaseToken(token);

    return mappedAccounts;
  }

  async signTransactions(activeAddress: string, transactions: Uint8Array[]) {
    // Decode the transactions to access their properties.
    const decodedTxns = transactions.map((txn) => {
      return this.algosdk.decodeObj(txn);
    }) as Array<EncodedTransaction | EncodedSignedTransaction>;

    // Get a handle token
    const pw = await this.requestPassword();
    const token = await this.getWalletToken(this.walletId, pw);

    const signedTxns: Uint8Array[] = [];
    // Sign them with the client.
    const signingPromises: Promise<Uint8Array>[] = [];
    for (const idx in decodedTxns) {
      const dtxn = decodedTxns[idx];

      // push the incoming txn into signed, we'll overwrite it later
      signedTxns.push(transactions[idx]);

      // Its already signed, skip it
      if (!("snd" in dtxn)) continue;
      // Not to be signed by our signer, skip it
      if (!(this.algosdk.encodeAddress(dtxn.snd) === activeAddress)) continue;

      // overwrite with an empty blob
      signedTxns[idx] = new Uint8Array();

      const txn = this.algosdk.Transaction.from_obj_for_encoding(dtxn);
      signingPromises.push(this.#client.signTransaction(token, pw, txn));
    }

    const signingResults = await Promise.all(signingPromises);

    // Restore the newly signed txns in the correct order
    let signedIdx = 0;
    for (const idx in signedTxns) {
      // If its an empty array, infer that it is one of the
      // ones we wanted to have signed and overwrite the empty buff
      if (signedTxns[idx].length === 0) {
        signedTxns[idx] = signingResults[signedIdx];
        signedIdx += 1;
      }
    }

    return signedTxns;
  }

  signEncodedTransactions(
    transactions: TransactionsArray
  ): Promise<Uint8Array[]> {
    throw new Error("Method not implemented.");
  }
}

export default KMDWallet.init().catch((e) => {
  if (typeof window !== "undefined") {
    console.info("error initializing kmd client", e);
    return;
  }
});