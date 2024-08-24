import algosdk from 'algosdk'
import {
  compareAccounts,
  deepMerge,
  flattenTxnGroup,
  formatJsonRpcRequest,
  isSignedTxn,
  isTransaction,
  isTransactionArray
} from 'src/utils'

describe('compareAccounts', () => {
  it('should return true if both account lists have the same wallet accounts', () => {
    const accounts1 = [
      { name: 'Acct 1', address: 'addr1' },
      { name: 'Acct 2', address: 'addr2' }
    ]
    const accounts2 = [
      { name: 'Acct 2', address: 'addr2' },
      { name: 'Acct 1', address: 'addr1' }
    ]

    expect(compareAccounts(accounts1, accounts2)).toBe(true)
  })

  it('should return false if account lists have different wallet accounts', () => {
    const accounts1 = [
      { name: 'Acct 1', address: 'addr1' },
      { name: 'Acct 2', address: 'addr2' }
    ]
    const accounts2 = [
      { name: 'Acct 3', address: 'addr3' },
      { name: 'Acct 1', address: 'addr1' }
    ]

    expect(compareAccounts(accounts1, accounts2)).toBe(false)
  })

  it('should return false if account lists have different sizes', () => {
    const accounts1 = [
      { name: 'Acct 1', address: 'addr1' },
      { name: 'Acct 2', address: 'addr2' }
    ]
    const accounts2 = [{ name: 'Acct 1', address: 'addr1' }]

    expect(compareAccounts(accounts1, accounts2)).toBe(false)
  })
})

describe('isSignedTxn', () => {
  const transaction = new algosdk.Transaction({
    type: algosdk.TransactionType.pay,
    sender: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
    paymentParams: {
      receiver: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
      amount: 847
    },
    suggestedParams: {
      fee: 10,
      minFee: 1000,
      firstValid: 51,
      lastValid: 61,
      genesisID: 'testnet-v1.0'
    }
  })

  const encodedTxn = {
    amt: transaction.payment?.amount,
    fee: transaction.fee,
    fv: transaction.firstValid,
    lv: transaction.lastValid,
    snd: transaction.sender.publicKey,
    type: 'pay',
    gen: transaction.genesisID,
    gh: transaction.genesisHash,
    grp: Buffer.from(new Uint8Array(0))
  }

  const encodedSignedTxn = { txn: encodedTxn, sig: Buffer.from('sig') }

  it('should return true if the object is a signed transaction', () => {
    // @ts-expect-error custom-built txn won't pass type check
    expect(isSignedTxn(encodedSignedTxn)).toBe(true)
  })

  it('should return false if the object is not a signed transaction', () => {
    // @ts-expect-error custom-built txn won't pass type check
    expect(isSignedTxn(encodedTxn)).toBe(false)
  })
})

describe('isTransaction', () => {
  const transaction = new algosdk.Transaction({
    type: algosdk.TransactionType.pay,
    sender: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
    paymentParams: {
      receiver: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
      amount: 847
    },
    suggestedParams: {
      fee: 10,
      minFee: 1000,
      firstValid: 51,
      lastValid: 61,
      genesisID: 'testnet-v1.0'
    }
  })

  const uInt8Array = transaction.toByte()

  it('should return true if the item is a Transaction', () => {
    expect(isTransaction(transaction)).toBe(true)
  })

  it('should return false if the item is a Uint8Array', () => {
    expect(isTransaction(uInt8Array)).toBe(false)
  })

  it('should return false if the item is an object that is not a Transaction', () => {
    expect(isTransaction({})).toBe(false)
  })

  it('should return false if the item is an array of Transactions', () => {
    expect(isTransaction([transaction, transaction])).toBe(false)
  })

  it('should return false if the item is an array of Uint8Arrays', () => {
    expect(isTransaction([uInt8Array, uInt8Array])).toBe(false)
  })
})

describe('isTransactionArray', () => {
  const transaction = new algosdk.Transaction({
    type: algosdk.TransactionType.pay,
    sender: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
    paymentParams: {
      receiver: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
      amount: 847
    },
    suggestedParams: {
      fee: 10,
      minFee: 1000,
      firstValid: 51,
      lastValid: 61,
      genesisID: 'testnet-v1.0'
    }
  })

  const uInt8Array = transaction.toByte()

  it('should return true if the item is an array of transactions', () => {
    expect(isTransactionArray([transaction, transaction])).toBe(true)
  })

  it('should return true if the item is a nested array of transactions', () => {
    expect(isTransactionArray([[transaction, transaction], [transaction]])).toBe(true)
  })

  it('should return false if the item is a single Transaction', () => {
    expect(isTransactionArray(transaction)).toBe(false)
  })

  it('should return false if the item is a single Uint8Array', () => {
    expect(isTransactionArray(uInt8Array)).toBe(false)
  })

  it('should return false if the item is an array of Uint8Arrays', () => {
    expect(isTransactionArray([uInt8Array, uInt8Array])).toBe(false)
  })

  it('should return false if the item is a nested array of Uint8Arrays', () => {
    expect(isTransactionArray([[uInt8Array, uInt8Array], [uInt8Array]])).toBe(false)
  })
})

describe('flattenTxnGroup', () => {
  const transaction1 = new algosdk.Transaction({
    type: algosdk.TransactionType.pay,
    sender: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
    paymentParams: {
      receiver: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
      amount: 847
    },
    suggestedParams: {
      fee: 10,
      minFee: 1000,
      firstValid: 51,
      lastValid: 61,
      genesisID: 'testnet-v1.0'
    }
  })

  const transaction2 = new algosdk.Transaction({
    type: algosdk.TransactionType.pay,
    sender: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
    paymentParams: {
      receiver: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
      amount: 500
    },
    suggestedParams: {
      fee: 15,
      minFee: 1000,
      firstValid: 100,
      lastValid: 200,
      genesisID: 'testnet-v1.0'
    }
  })

  const nestedTxnGroup = [[transaction1, transaction2], [transaction1]]
  const flatTxnGroup = [transaction1, transaction2, transaction1]

  it('should flatten a nested transaction group', () => {
    expect(flattenTxnGroup(nestedTxnGroup)).toEqual(flatTxnGroup)
  })

  it('should return the same array if the transaction group is already flat', () => {
    expect(flattenTxnGroup(flatTxnGroup)).toEqual(flatTxnGroup)
  })

  it('should return the same array if it is not an array of arrays', () => {
    expect(flattenTxnGroup([transaction1, transaction2])).toEqual([transaction1, transaction2])
  })

  it('should handle an empty array', () => {
    expect(flattenTxnGroup([])).toEqual([])
  })
})

describe('deepMerge', () => {
  it('should deeply merge two objects', () => {
    const target = { a: 1, b: { c: 2 } }
    const source = { b: { d: 3 }, e: 4 }
    const expected = { a: 1, b: { c: 2, d: 3 }, e: 4 }

    expect(deepMerge(target, source)).toEqual(expected)
  })

  it('should throw an error if either argument is not an object', () => {
    expect(() => deepMerge(null, {})).toThrow('Target and source must be objects')
    expect(() => deepMerge({}, null)).toThrow('Target and source must be objects')
  })
})

describe('formatJsonRpcRequest', () => {
  it('should format a JSON-RPC request with the given method and params', () => {
    const method = 'algo_signTxn'
    const params = [{ txn: 'base64Txn' }]
    const request = formatJsonRpcRequest(method, params)

    expect(request).toHaveProperty('id')
    expect(request).toHaveProperty('jsonrpc', '2.0')
    expect(request).toHaveProperty('method', method)
    expect(request).toHaveProperty('params', params)
  })
})
