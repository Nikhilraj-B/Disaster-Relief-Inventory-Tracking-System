import { ethers } from 'ethers'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { exit } from 'node:process'

const ABIText = readFileSync(new URL('../../frontend/src/blockchain/DisasterReliefAudit.json', import.meta.url), 'utf8')
const ABI = JSON.parse(ABIText).abi

const RPC = 'http://127.0.0.1:8545'
const CONTRACT = '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707'
const API = 'http://127.0.0.1:8081/api'

// Deterministic Hardhat role accounts (granted contract roles). Same as the
// wallets the seeded users have linked, i.e. exactly what MetaMask signs with.
const ROLES = {
  ADMIN: { signerIndex: 1, email: 'admin@disasterrelief.gov', password: 'Admin1234!' },
  CAMP: { signerIndex: 2, email: 'camp@disasterrelief.gov', password: 'Camp1234!' },
  WAREHOUSE: { signerIndex: 3, email: 'warehouse@disasterrelief.gov', password: 'Warehouse1234!' },
  TRANSPORT: { signerIndex: 4, email: 'transport@disasterrelief.gov', password: 'Transport1234!' },
}

function bytes32FromUuid(uuid) {
  const hex = uuid.replace(/-/g, '')
  return '0x' + hex + '0'.repeat(64 - hex.length)
}

const provider = new ethers.JsonRpcProvider(RPC)
const contract = new ethers.Contract(CONTRACT, ABI, provider)

let reqId
const results = []

async function sign(name, args, role) {
  const signer = await provider.getSigner(role.signerIndex)
  const c = contract.connect(signer)
  const tx = await c[name](...args)
  const receipt = await tx.wait(1)
  const from = receipt.from ?? signer.address
  const out = { txHash: receipt.hash, from }
  console.log(`  [sign] ${name}(${args.map((a) => a.slice(0, 14) + '...').join(', ')}) => ${receipt.hash}`)
  return out
}

async function apiCall(method, path, body, token) {
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { json = text }
  return { status: res.status, json }
}

async function login(role) {
  const { status, json } = await apiCall('POST', '/auth/login', {
    email: role.email,
    password: role.password,
  })
  if (status !== 200) throw new Error(`login ${role.email} -> HTTP ${status}`)
  return json.token
}

async function expect(label, result, okStatus, check) {
  const pass = result.status === okStatus && (!check || check(result.json))
  results.push({ label, pass, status: result.status })
  console.log(`  ${pass ? 'PASS' : 'FAIL'} ${label} (HTTP ${result.status})`)
  if (!pass) console.log('       body:', JSON.stringify(result.json))
  return pass
}

function makeUuid() { return randomUUID() }

let adminTok, campTok, whTok, transportTok
let campUserId, whUserId, transportUserId

// ---------- entity seeding ----------
async function seedEntities() {
  console.log('\n== Seed org / facilities / relief item (as ADMIN) ==')
  adminTok = await login(ROLES.ADMIN)
  campTok = await login(ROLES.CAMP)
  whTok = await login(ROLES.WAREHOUSE)
  transportTok = await login(ROLES.TRANSPORT)

  // fetch user ids
  const { json: users } = await apiCall('GET', '/users', null, adminTok)
  campUserId = users.find((u) => u.email === ROLES.CAMP.email).id
  whUserId = users.find((u) => u.email === ROLES.WAREHOUSE.email).id
  transportUserId = users.find((u) => u.email === ROLES.TRANSPORT.email).id

  // org (backend assigns ids; capture returned id)
  let r = await apiCall('POST', '/organizations', {
    name: 'National Disaster Management Authority', type: 'GOVT', contactInfo: 'ops@ndma.local',
  }, adminTok)
  await expect(`org create`, r, 200, (j) => j && j.type === 'GOVT')
  const orgId = r.json?.id ?? makeUuid()

  // camp facility
  r = await apiCall('POST', '/facilities', {
    organizationId: orgId, name: 'Hillside Relief Camp', type: 'CAMP',
    location: 'Region 7', managerUserId: campUserId, population: 480, maxCapacity: 600,
  }, adminTok)
  await expect(`camp facility create`, r, 200, (j) => j && j.type === 'CAMP')
  const campFacId = r.json?.id ?? makeUuid()

  // warehouse facility
  r = await apiCall('POST', '/facilities', {
    organizationId: orgId, name: 'Central Distribution Warehouse', type: 'WAREHOUSE',
    location: 'Capital District', managerUserId: whUserId, capacitySqm: 1200,
  }, adminTok)
  await expect(`warehouse facility create`, r, 200, (j) => j && j.type === 'WAREHOUSE')
  const whFacId = r.json?.id ?? makeUuid()

  // relief item
  r = await apiCall('POST', '/relief-items', {
    name: 'Drinking Water', category: 'WATER', unit: 'bottles', description: '500ml bottled water',
  }, adminTok)
  await expect(`relief item create`, r, 200, (j) => j && j.category === 'WATER')
  const itemId = r.json?.id ?? makeUuid()

  const warehouseWallet = '0x90F79bf6EB2c4f870365E785982E1f101E93b906'
  const transportWallet = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65'
  return { campFacId, whFacId, itemId, warehouseWallet, transportWallet }
}

// ---------- MAIN FLOW (Part 1-9) ----------
async function runHappy() {
  console.log('\n== MAIN FLOW: real blockchain tx -> verified by backend -> IPFS ==')
  const seeded = await seedEntities()

  const id = makeUuid()
  const payloadItems = [{
    reliefItemId: seeded.itemId, itemName: 'Drinking Water', itemCategory: 'WATER', requestedQty: 100,
  }]

  // CREATE (CAMP signs createRequest(bytes32, warehouseWallet))
  const create = await sign('createRequest', [bytes32FromUuid(id), seeded.warehouseWallet], ROLES.CAMP)
  let r = await apiCall('POST', '/supply-requests', {
    id, campId: seeded.campFacId, warehouseId: seeded.whFacId, items: payloadItems, txHashCreate: create.txHash,
  }, campTok)
  let pass = await expect('1. CREATE -> CREATED', r, 200, (j) => j && j.status === 'CREATED' && j.txHashes?.CREATE === create.txHash)

  // APPROVE (ADMIN signs approveRequest)
  const approve = await sign('approveRequest', [bytes32FromUuid(id)], ROLES.ADMIN)
  r = await apiCall('POST', `/supply-requests/${id}/approve`, { txHash: approve.txHash }, adminTok)
  pass = await expect('2. APPROVE -> APPROVED', r, 200, (j) => j && j.status === 'APPROVED' && j.txHashes?.APPROVED === approve.txHash)

  // ACCEPT + ASSIGN (WAREHOUSE signs both)
  const accept = await sign('acceptRequest', [bytes32FromUuid(id)], ROLES.WAREHOUSE)
  const assign = await sign('assignTransporter', [bytes32FromUuid(id), seeded.transportWallet], ROLES.WAREHOUSE)
  r = await apiCall('POST', `/supply-requests/${id}/accept`, {
    txHash: accept.txHash, txHashAssign: assign.txHash, transporterWallet: seeded.transportWallet,
  }, whTok)
  pass = await expect('3. ACCEPT(+assign) -> ACCEPTED', r, 200, (j) =>
    j && j.status === 'ACCEPTED' && j.txHashes?.ACCEPTED === accept.txHash && j.txHashes?.ASSIGN_TRANSPORTER === assign.txHash)

  // DISPATCH / IN_TRANSIT / ARRIVED (TRANSPORT signs)
  let tx = await sign('dispatchRequest', [bytes32FromUuid(id)], ROLES.TRANSPORT)
  r = await apiCall('POST', `/supply-requests/${id}/dispatch`, { txHash: tx.txHash }, transportTok)
  pass = await expect('4. DISPATCH -> DISPATCHED', r, 200, (j) => j && j.status === 'DISPATCHED' && j.txHashes?.DISPATCHED === tx.txHash)

  tx = await sign('markInTransit', [bytes32FromUuid(id)], ROLES.TRANSPORT)
  r = await apiCall('POST', `/supply-requests/${id}/in-transit`, { txHash: tx.txHash }, transportTok)
  pass = await expect('5. IN TRANSIT -> IN_TRANSIT', r, 200, (j) => j && j.status === 'IN_TRANSIT' && j.txHashes?.IN_TRANSIT === tx.txHash)

  tx = await sign('markArrived', [bytes32FromUuid(id)], ROLES.TRANSPORT)
  r = await apiCall('POST', `/supply-requests/${id}/arrived`, { txHash: tx.txHash }, transportTok)
  pass = await expect('6. ARRIVED -> ARRIVED', r, 200, (j) => j && j.status === 'ARRIVED' && j.txHashes?.ARRIVED === tx.txHash)

  // RECEIVE / COMPLETE (CAMP signs)
  tx = await sign('receiveRequest', [bytes32FromUuid(id)], ROLES.CAMP)
  r = await apiCall('POST', `/supply-requests/${id}/receive`, { txHash: tx.txHash }, campTok)
  pass = await expect('7. RECEIVE -> RECEIVED', r, 200, (j) => j && j.status === 'RECEIVED' && j.txHashes?.RECEIVED === tx.txHash)

  tx = await sign('completeRequest', [bytes32FromUuid(id)], ROLES.CAMP)
  r = await apiCall('POST', `/supply-requests/${id}/complete`, { txHash: tx.txHash }, campTok)
  pass = await expect('8. COMPLETE -> COMPLETED', r, 200, (j) => j && j.status === 'COMPLETED' && j.txHashes?.COMPLETED === tx.txHash)

  // Final state check via backend (reads from IPFS)
  r = await apiCall('GET', `/supply-requests/${id}`, null, adminTok)
  pass = await expect('9. final IPFS read: COMPLETED + all txHashes', r, 200, (j) => {
    if (!j || j.status !== 'COMPLETED' || !j.cid) return false
    const keys = ['CREATE', 'APPROVED', 'ACCEPTED', 'ASSIGN_TRANSPORTER', 'DISPATCHED', 'IN_TRANSIT', 'ARRIVED', 'RECEIVED', 'COMPLETED']
    return keys.every((k) => typeof j.txHashes?.[k] === 'string' && j.txHashes[k].startsWith('0x') && j.txHashes[k].length === 66)
  })
  console.log('   final cid:', r.json?.cid)
  reqId = id
  return pass
}

// ---------- NEGATIVE TEST (Part 8-style fake hash) ----------
async function runNegative() {
  console.log('\n== NEGATIVE TEST: fake txHash must be rejected, state unchanged ==')
  const seeded = await seedEntities() // re-login tokens

  const id = makeUuid()
  const create = await sign('createRequest', [bytes32FromUuid(id), seeded.warehouseWallet], ROLES.CAMP)
  let r = await apiCall('POST', '/supply-requests', {
    id, campId: seeded.campFacId, warehouseId: seeded.whFacId,
    items: [{ reliefItemId: seeded.itemId, itemName: 'Drinking Water', itemCategory: 'WATER', requestedQty: 75 }],
    txHashCreate: create.txHash,
  }, campTok)
  await expect('neg: CREATE -> CREATED', r, 200, (j) => j && j.status === 'CREATED')

  // Fake hash - never mined on chain. Must get 400 and IPFS unchanged.
  const fakeHash = '0x' + 'ab'.repeat(32)
  r = await apiCall('POST', `/supply-requests/${id}/approve`, { txHash: fakeHash }, adminTok)
  const negPass = await expect('neg: APPROVE(fake 0xab... ) rejected with 400', r, 400, (j) => j != null)

  r = await apiCall('GET', `/supply-requests/${id}`, null, adminTok)
  await expect('neg: IPFS still CREATED', r, 200, (j) => {
    reqId = id
    return j && j.status === 'CREATED' && !j.txHashes?.APPROVED
  })
  return negPass
}

// ---------- summary ----------
function summary() {
  const failed = results.filter((x) => !x.pass)
  console.log('\n========================')
  console.log(`E2E finished: ${results.length - failed.length}/${results.length} passed`)
  if (failed.length) {
    console.log('FAILED:')
    failed.forEach((f) => console.log('  - ' + f.label))
  }
  console.log('========================')
  exit(failed.length ? 1 : 0)
}

// ---------- run ----------
try {
  await runHappy()
  await runNegative()
} catch (e) {
  console.error('\nE2E error:', e)
  exit(2)
}
summary()