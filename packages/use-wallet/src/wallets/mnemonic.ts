import algosdk from 'algosdk'
import { addWallet, type State } from 'src/store'
import { isSignedTxnObject, normalizeTxnGroup } from 'src/utils'
import { BaseWallet } from './base'
import type { Store } from '@tanstack/store'
import type { WalletAccount, WalletConstructor, WalletId } from './types'

export type MnemonicOptions = {
  persistToStorage?: boolean
}

const icon = `data:image/svg+xml,%3c%3fxml version='1.0' encoding='UTF-8'%3f%3e %3c!-- Generated by Pixelmator Pro 3.2.2 --%3e %3csvg width='409' height='210' viewBox='0 0 409 210' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'%3e%3ctext id='MNEMONIC' xml:space='preserve' x='0' y='129' font-family='Helvetica' font-size='72' fill='black'%3eMNEMONIC%3c/text%3e%3c/svg%3e`

export class MnemonicWallet extends BaseWallet {
  private account: algosdk.Account | null = null
  private options: MnemonicOptions

  protected store: Store<State>

  constructor({
    id,
    store,
    subscribe,
    getAlgodClient,
    options,
    metadata = {}
  }: WalletConstructor<WalletId.MNEMONIC>) {
    super({ id, metadata, getAlgodClient, store, subscribe })

    const { persistToStorage = false } = options || {}
    this.options = { persistToStorage }

    this.store = store
  }

  static defaultMetadata = { name: 'Mnemonic', icon }

  // @todo: Show explicit security warning if persistToStorage is true
  // @todo: Save/load mnemonic from storage if persistToStorage is true
  // @todo: Throw error with link to docs if using mainnet
  private initializeAccount(): algosdk.Account {
    const mnemonic = prompt('Enter 25-word mnemonic passphrase:')
    if (!mnemonic) {
      this.account = null
      throw new Error('No mnemonic provided')
    }
    const account = algosdk.mnemonicToSecretKey(mnemonic)
    this.account = account
    return account
  }

  public connect = async (): Promise<WalletAccount[]> => {
    console.info('[MnemonicWallet] Connecting...')
    try {
      const account = this.initializeAccount()

      const walletAccount = {
        name: 'Mnemonic Account',
        address: account.addr
      }

      addWallet(this.store, {
        walletId: this.id,
        wallet: {
          accounts: [walletAccount],
          activeAccount: walletAccount
        }
      })

      return [walletAccount]
    } catch (error) {
      console.error('[MnemonicWallet] Error connecting:', error)
      throw error
    }
  }

  public disconnect = async (): Promise<void> => {
    console.info('[MnemonicWallet] Disconnecting...')
    try {
      this.account = null
      this.onDisconnect()
    } catch (error: any) {
      console.error(error)
    }
  }

  public resumeSession = async (): Promise<void> => {
    const state = this.store.state
    const walletState = state.wallets[this.id]

    // Don't resume session, disconnect instead
    if (walletState) {
      try {
        this.account = null
        this.onDisconnect()
      } catch (error: any) {
        console.error(error)
      }
    }
  }

  public signTransactions = async (
    txnGroup: algosdk.Transaction[] | algosdk.Transaction[][] | Uint8Array[] | Uint8Array[][],
    indexesToSign?: number[],
    returnGroup = true
  ): Promise<Uint8Array[]> => {
    if (!this.account) {
      throw new Error('[MnemonicWallet] Client not initialized!')
    }
    const txnGroupSigned: Uint8Array[] = []
    const msgpackTxnGroup: Uint8Array[] = normalizeTxnGroup(txnGroup)

    // Decode transactions to access properties
    const decodedObjects = msgpackTxnGroup.map((txn) => {
      return algosdk.decodeObj(txn)
    }) as Array<algosdk.EncodedTransaction | algosdk.EncodedSignedTransaction>

    // Sign transactions and merge back into original group
    decodedObjects.forEach((txnObject, idx) => {
      const isIndexMatch = !indexesToSign || indexesToSign.includes(idx)
      const isSigned = isSignedTxnObject(txnObject)
      const canSign = !isSigned && algosdk.encodeAddress(txnObject.snd) === this.account!.addr
      const shouldSign = isIndexMatch && canSign

      if (shouldSign) {
        const txn = algosdk.Transaction.from_obj_for_encoding(txnObject)
        const signedTxn = txn.signTxn(this.account!.sk)
        txnGroupSigned.push(signedTxn)
      } else if (returnGroup) {
        txnGroupSigned.push(msgpackTxnGroup[idx]!)
      }
    })

    return Promise.resolve(txnGroupSigned)
  }

  public transactionSigner = async (
    txnGroup: algosdk.Transaction[],
    indexesToSign: number[]
  ): Promise<Uint8Array[]> => {
    if (!this.account) {
      throw new Error('[MnemonicWallet] Account not initialized!')
    }

    const signedTxns: Uint8Array[] = []

    for (const index of indexesToSign) {
      const txnToSign = txnGroup[index]
      if (txnToSign) {
        signedTxns.push(txnToSign.signTxn(this.account.sk))
      }
    }

    return Promise.resolve(signedTxns)
  }
}
