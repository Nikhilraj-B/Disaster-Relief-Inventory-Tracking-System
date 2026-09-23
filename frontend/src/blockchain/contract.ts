import { BrowserProvider, Contract } from 'ethers'
import type { Result } from 'ethers'
import contractAbi from './DisasterReliefAudit.json'

export const CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3'
export const CHAIN_ID = 31337
export const RPC_URL = 'http://127.0.0.1:8545'

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  on?: (...args: unknown[]) => void
  removeListener?: (...args: unknown[]) => void
}

/** Mirrors EthereumService.bytes32FromUuid: UUID hex left-aligned, zero-padded to 64. */
export function bytes32FromUuid(uuid: string): string {
  const hex = uuid.replace(/-/g, '')
  return '0x' + hex + '0'.repeat(64 - hex.length)
}

export interface SignedTransition {
  txHash: string
  from: string
}

function getWindowEthereum(): EthereumProvider {
  const eth = (window as unknown as { ethereum?: EthereumProvider }).ethereum
  if (!eth) {
    throw new Error('MetaMask is not installed. Install it from https://metamask.io')
  }
  return eth
}

async function getProvider(): Promise<BrowserProvider> {
  return new BrowserProvider(getWindowEthereum() as never)
}

/** Returns the currently connected MetaMask account, or throws a friendly error. */
export async function getSignerAddress(): Promise<string> {
  const provider = await getProvider()
  await provider.send('eth_requestAccounts', [])
  const signer = await provider.getSigner()
  return signer.getAddress()
}

/** Requests MetaMask to switch to chain 31337 (adding the network if unknown). */
export async function ensureNetwork(): Promise<void> {
  const eth = getWindowEthereum()
  try {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x7a69' }] })
  } catch (err) {
    const code = (err as { code?: number }).code
    if (code === 4902) {
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: '0x7a69',
            chainName: 'Hardhat Localhost',
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: [RPC_URL],
          },
        ],
      })
    } else {
      throw new Error(
        `Wrong network. Please switch MetaMask to the Hardhat network (chain ID 31337) at ${RPC_URL}.`,
      )
    }
  }
  const provider = await getProvider()
  const network = await provider.getNetwork()
  if (Number(network.chainId) !== CHAIN_ID) {
    throw new Error(`Wrong network: connected to chain ${network.chainId}, expected 31337 (Hardhat).`)
  }
}

/**
 * Confirms that the MetaMask-connected account matches the logged-in user's
 * registered wallet address (resolved server-side by the backend too). The
 * frontend never claims a wallet on the user's behalf.
 */
export async function assertWalletMatches(expectedWallet: string | undefined): Promise<void> {
  if (!expectedWallet) {
    throw new Error(
      'No Ethereum wallet is linked to your account. Connect MetaMask and save your wallet address when registering.',
    )
  }
  const connected = await getSignerAddress()
  if (connected.toLowerCase() !== expectedWallet.toLowerCase()) {
    throw new Error(
      `Wallet mismatch: MetaMask is connected to ${connected}, but your account is registered with ${expectedWallet}. ` +
        'Switch to the registered account in MetaMask.',
    )
  }
}

/**
 * Classifies a MetaMask / wallet / network error so the caller can give the
 * most accurate message. Returns a result object with a {@code kind} used for
 * branching and a {@code message} suitable for display.
 */
export type BlockchainErrorKind =
  | 'not-installed'
  | 'rejected'
  | 'wrong-network'
  | 'wallet-mismatch'
  | 'reverted'
  | 'not-mined'
  | 'unreachable'
  | 'unknown'

export interface BlockchainErrorInfo {
  kind: BlockchainErrorKind
  message: string
}

export function classifyError(err: unknown): BlockchainErrorInfo {
  const e = err as { code?: unknown; message?: string; shortMessage?: string }
  const msg = (e?.shortMessage || e?.message || '').toLowerCase()
  const code = e?.code

  if (msg.includes('is not installed')) {
    return {
      kind: 'not-installed',
      message: 'MetaMask is not installed. Please install MetaMask to continue.',
    }
  }
  if (code === 4001 || msg.includes('user rejected') || msg.includes('denied transaction')) {
    return {
      kind: 'rejected',
      message:
        'Transaction cancelled in MetaMask. No blockchain transaction was submitted and the request was not changed.',
    }
  }
  if (code === 4902 || msg.includes('unrecognized chain') || msg.includes('wrong network')) {
    return {
      kind: 'wrong-network',
      message:
        'Wrong network: MetaMask must be on the local Hardhat network (chain ID 31337) at ' + RPC_URL + '.',
    }
  }
  if (msg.includes('wallet mismatch') || msg.includes('registered wallet') || msg.includes('connected wallet')) {
    return {
      kind: 'wallet-mismatch',
      message:
        'Connected MetaMask wallet does not match your registered wallet. Switch to the registered account in MetaMask.',
    }
  }
  if (msg.includes('revert') || msg.includes('call_exception')) {
    return {
      kind: 'reverted',
      message:
        'The blockchain transaction was submitted but reverted on-chain (likely unauthorized actor or invalid state) and the request state was not changed.',
    }
  }
  if (code === -32603 && msg.includes('execution reverted')) {
    return {
      kind: 'reverted',
      message:
        'The blockchain transaction was submitted but reverted on-chain. Check that you have the correct role for this action.',
    }
  }
  if (msg.includes('not mined') || msg.includes('replacement') || msg.includes('already known')) {
    return {
      kind: 'not-mined',
      message: 'The blockchain transaction was submitted but could not be confirmed as mined.',
    }
  }
  if (msg.includes('network') || msg.includes('hardhat') || code === -32002) {
    return {
      kind: 'unreachable',
      message: 'Cannot reach the Hardhat network. Make sure the local node is running at ' + RPC_URL + '.',
    }
  }
  if (e instanceof Error) {
    return {
      kind: 'unknown',
      message: e.message || 'An unknown blockchain error occurred.',
    }
  }
  return { kind: 'unknown', message: 'An unknown blockchain error occurred.' }
}

/** Convenience wrapper returning only the display message. */
export function friendlyError(err: unknown): string {
  return classifyError(err).message
}

async function sign(
  name: string,
  args: unknown[],
  expectedActorWallet: string | undefined,
): Promise<SignedTransition> {
  await ensureNetwork()
  await assertWalletMatches(expectedActorWallet)

  const provider = await getProvider()
  const signer = await provider.getSigner()
  const contract = new Contract(CONTRACT_ADDRESS, contractAbi.abi, signer)

  const tx = await contract[name](...args)
  const receipt = await tx.wait(1)
  const from = (receipt as { from?: unknown }).from as unknown as string
  return { txHash: receipt.hash, from } as SignedTransition
}

export const blockchain = {
  createRequest: (requestUuid: string, warehouseWallet: string, actor: string) =>
    sign('createRequest', [bytes32FromUuid(requestUuid), warehouseWallet], actor),
  approveRequest: (requestUuid: string, actor: string) =>
    sign('approveRequest', [bytes32FromUuid(requestUuid)], actor),
  acceptRequest: (requestUuid: string, actor: string) =>
    sign('acceptRequest', [bytes32FromUuid(requestUuid)], actor),
  assignTransporter: (requestUuid: string, transporterWallet: string, actor: string) =>
    sign('assignTransporter', [bytes32FromUuid(requestUuid), transporterWallet], actor),
  dispatchRequest: (requestUuid: string, actor: string) =>
    sign('dispatchRequest', [bytes32FromUuid(requestUuid)], actor),
  markInTransit: (requestUuid: string, actor: string) =>
    sign('markInTransit', [bytes32FromUuid(requestUuid)], actor),
  markArrived: (requestUuid: string, actor: string) =>
    sign('markArrived', [bytes32FromUuid(requestUuid)], actor),
  receiveRequest: (requestUuid: string, actor: string) =>
    sign('receiveRequest', [bytes32FromUuid(requestUuid)], actor),
  completeRequest: (requestUuid: string, actor: string) =>
    sign('completeRequest', [bytes32FromUuid(requestUuid)], actor),
  rejectRequest: (requestUuid: string, actor: string) =>
    sign('rejectRequest', [bytes32FromUuid(requestUuid)], actor),
  rejectApprovedRequest: (requestUuid: string, actor: string) =>
    sign('rejectApprovedRequest', [bytes32FromUuid(requestUuid)], actor),
  getRequest: (requestUuid: string) => {
    return getProvider().then(async (provider) => {
      const c = new Contract(CONTRACT_ADDRESS, contractAbi.abi, provider)
      const r: Result = await c.getRequest(bytes32FromUuid(requestUuid))
      return {
        campWallet: String(r[0]),
        warehouseWallet: String(r[1]),
        transporterWallet: String(r[2]),
        status: Number(r[3]),
        updatedAt: String(r[4]),
      }
    })
  },
}
