import { JsonRpcProvider, Contract, Wallet } from 'ethers'
import fs from 'node:fs'

const RPC = 'http://127.0.0.1:8545'
const ADDR = '0x5FbDB2315678afecb367f032d93F642f64180aa3'
const abi = JSON.parse(fs.readFileSync(new URL('./src/blockchain/DisasterReliefAudit.json', import.meta.url), 'utf8')).abi

const KEYS = {
  ADMIN: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  WAREHOUSE: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
  CAMP: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
  TRANSPORT: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
}

function b32(uuid) {
  const hex = uuid.replace(/-/g, '')
  return '0x' + hex + '0'.repeat(64 - hex.length)
}

const provider = new JsonRpcProvider(RPC)

async function call(role, fn, args) {
  const wallet = new Wallet(KEYS[role], provider)
  const c = new Contract(ADDR, abi, wallet)
  const tx = await c[fn](...args)
  const receipt = await tx.wait(1)
  return receipt.hash
}

async function getRequest(uuid) {
  const c = new Contract(ADDR, abi, provider)
  const r = await c.getRequest(b32(uuid))
  return {
    campWallet: r[0], warehouseWallet: r[1], transporterWallet: r[2],
    status: Number(r[3]), updatedAt: String(r[4]),
  }
}

const [, , cmd, arg] = process.argv

switch (cmd) {
  case 'create': {
    // createRequest(requestId, warehouseWallet)
    const [uuid, warehouseWallet] = arg.split(',')
    const hash = await call('CAMP', 'createRequest', [b32(uuid), warehouseWallet])
    console.log(hash)
    break
  }
  case 'approve': {
    const hash = await call('ADMIN', 'approveRequest', [b32(arg)])
    console.log(hash)
    break
  }
  case 'accept': {
    const hash = await call('WAREHOUSE', 'acceptRequest', [b32(arg)])
    console.log(hash)
    break
  }
  case 'assign': {
    const [uuid, transporterWallet] = arg.split(',')
    const hash = await call('WAREHOUSE', 'assignTransporter', [b32(uuid), transporterWallet])
    console.log(hash)
    break
  }
  case 'dispatch': {
    const hash = await call('TRANSPORT', 'dispatchRequest', [b32(arg)])
    console.log(hash)
    break
  }
  case 'inTransit': {
    const hash = await call('TRANSPORT', 'markInTransit', [b32(arg)])
    console.log(hash)
    break
  }
  case 'arrived': {
    const hash = await call('TRANSPORT', 'markArrived', [b32(arg)])
    console.log(hash)
    break
  }
  case 'receive': {
    const hash = await call('CAMP', 'receiveRequest', [b32(arg)])
    console.log(hash)
    break
  }
  case 'complete': {
    const hash = await call('CAMP', 'completeRequest', [b32(arg)])
    console.log(hash)
    break
  }
  case 'get': {
    console.log(JSON.stringify(await getRequest(arg)))
    break
  }
  default:
    console.error('unknown cmd')
    process.exit(1)
}
