import { useEffect, useState, type FormEvent } from 'react'
import { api, ApiError } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { Loading, ErrorBanner, PageHeader } from '../components/Page'
import { formatDate, shortId, statusLabel } from '../utils/format'
import { blockchain, classifyError } from '../blockchain/contract'
import type {
  Facility,
  ReliefItem,
  RequestItem,
  SupplyRequest,
  SupplyRequestStatus,
  User,
} from '../api/types'

interface ItemRow {
  reliefItemId: string
  itemName: string
  requestedQty: string
}

interface FlowAction {
  label: string
  path: string
  from: SupplyRequestStatus[]
  roles: string[]
  confirm?: string
}

/** Progress steps shown while a blockchain action runs. */
type ActionStep = 'confirm' | 'submitted' | 'verifying' | 'done' | 'failed'

interface PendingAction {
  requestId: string
  label: string
  step: ActionStep
  txHash?: string
  message?: string
  failedKind?: 'rejected' | 'verification' | 'wallet' | 'other'
}

const FLOW: FlowAction[] = [
  { label: 'Approve', path: 'approve', from: ['CREATED'], roles: ['GOVERNMENT_ADMIN'] },
  { label: 'Accept', path: 'accept', from: ['APPROVED'], roles: ['WAREHOUSE_MANAGER', 'GOVERNMENT_ADMIN'] },
  { label: 'Dispatch', path: 'dispatch', from: ['ACCEPTED'], roles: ['TRANSPORT_OFFICER', 'GOVERNMENT_ADMIN'] },
  { label: 'In Transit', path: 'in-transit', from: ['DISPATCHED'], roles: ['TRANSPORT_OFFICER', 'GOVERNMENT_ADMIN'] },
  { label: 'Arrived', path: 'arrived', from: ['IN_TRANSIT'], roles: ['TRANSPORT_OFFICER', 'GOVERNMENT_ADMIN'] },
  { label: 'Receive', path: 'receive', from: ['ARRIVED'], roles: ['CAMP_MANAGER', 'GOVERNMENT_ADMIN'] },
  { label: 'Complete', path: 'complete', from: ['RECEIVED'], roles: ['CAMP_MANAGER', 'GOVERNMENT_ADMIN'] },
  { label: 'Reject', path: 'reject', from: ['CREATED', 'APPROVED'], roles: ['GOVERNMENT_ADMIN', 'WAREHOUSE_MANAGER'], confirm: 'Reject this request?' },
]

function StepLine({ ok, children }: { ok: boolean; children: string }) {
  return (
    <li className={ok ? 'act-step ok' : 'act-step'}>
      <span>{ok ? '✓' : '…'}</span>
      {children}
    </li>
  )
}

export default function SupplyRequestsPage() {
  const { user, token } = useAuth()
  const [requests, setRequests] = useState<SupplyRequest[]>([])
  const [camps, setCamps] = useState<Facility[]>([])
  const [warehouses, setWarehouses] = useState<Facility[]>([])
  const [items, setItems] = useState<ReliefItem[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [campId, setCampId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [itemRows, setItemRows] = useState<ItemRow[]>([])
  const [transportId, setTransportId] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<PendingAction | null>(null)

  const walletOf = (u: User | undefined): string | undefined => u?.walletAddress
  const requireActor = (): string => {
    if (!user?.walletAddress) {
      throw new Error(
        'No Ethereum wallet is linked to your account. Connect MetaMask and save your wallet address when registering.',
      )
    }
    return user.walletAddress
  }

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [r, f, it, us] = await Promise.all([
        api.get<SupplyRequest[]>('/supply-requests'),
        api.get<Facility[]>('/facilities'),
        api.get<ReliefItem[]>('/relief-items'),
        api.get<User[]>('/users'),
      ])
      setRequests(r)
      setCamps(f.filter((x) => x.type === 'CAMP'))
      setWarehouses(f.filter((x) => x.type === 'WAREHOUSE'))
      setItems(it)
      setUsers(us)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requests')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const openForm = () => {
    setCampId('')
    setWarehouseId('')
    setItemRows([{ reliefItemId: '', itemName: '', requestedQty: '' }])
    setTransportId('')
    setShowForm(true)
  }

  const updateItemRow = (idx: number, patch: Partial<ItemRow>) => {
    setItemRows((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  const addItemRow = () => {
    setItemRows((rows) => [...rows, { reliefItemId: '', itemName: '', requestedQty: '' }])
  }

  const removeItemRow = (idx: number) => {
    setItemRows((rows) => rows.filter((_, i) => i !== idx))
  }

  const errorInfo = (err: unknown): { message: string; failedKind: PendingAction['failedKind'] } => {
    if (err instanceof ApiError) {
      if (err.status === 400) {
        return {
          failedKind: 'verification',
          message: `Blockchain verification failed: ${err.message}. The request state was not changed.`,
        }
      }
      return { failedKind: 'other', message: `Backend error (HTTP ${err.status}): ${err.message}` }
    }
    if (err instanceof Error && err.message === 'Failed to fetch') {
      return {
        failedKind: 'other',
        message: 'Could not reach the backend server. Make sure it is running on port 8081.',
      }
    }
    const info = classifyError(err)
    if (info.kind === 'rejected') {
      return {
        failedKind: 'rejected',
        message:
          'Transaction cancelled in MetaMask. No blockchain transaction was submitted and the request was not changed.',
      }
    }
    if (info.kind === 'not-installed') {
      return { failedKind: 'wallet', message: 'MetaMask is not installed. Please install MetaMask to continue.' }
    }
    if (info.kind === 'reverted' || info.kind === 'not-mined') {
      return { failedKind: 'verification', message: `${info.message}. The request state was not changed.` }
    }
    if (info.kind === 'wrong-network' || info.kind === 'wallet-mismatch' || info.kind === 'unreachable') {
      return { failedKind: 'wallet', message: info.message }
    }
    return { failedKind: 'other', message: `Blockchain error (${info.message}).` }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || pending) return
    setError('')
    setBusy(true)
    const validRows = itemRows.filter((r) => r.reliefItemId && r.requestedQty)
    const itemsPayload: RequestItem[] = validRows.map((r) => {
      const item = items.find((i) => i.id === r.reliefItemId)
      return {
        reliefItemId: r.reliefItemId,
        itemName: item?.name ?? r.itemName ?? '',
        itemCategory: item?.category ?? 'OTHER',
        requestedQty: Number(r.requestedQty),
      }
    })
    try {
      const warehouse = warehouses.find((w) => w.id === warehouseId)
      const warehouseManager = users.find((u) => u.id === warehouse?.managerUserId)
      const warehouseWallet = walletOf(warehouseManager)
      if (!warehouseWallet) {
        throw new Error('The warehouse manager has no linked Ethereum wallet; link one first.')
      }

      const id = crypto.randomUUID()
      setPending({ requestId: id, label: 'Create request', step: 'confirm' })
      const signed = await blockchain.createRequest(id, warehouseWallet, requireActor())
      setPending({ requestId: id, label: 'Create request', step: 'submitted', txHash: signed.txHash })
      setPending({ requestId: id, label: 'Create request', step: 'verifying', txHash: signed.txHash })
      await api.post<SupplyRequest>('/supply-requests', {
        id,
        campId,
        warehouseId,
        items: itemsPayload,
        txHashCreate: signed.txHash,
      })
      setPending({ requestId: id, label: 'Create request', step: 'done', txHash: signed.txHash })
      setShowForm(false)
      await load()
      setPending(null)
    } catch (err) {
      const info = errorInfo(err)
      setError(info.message)
      setPending((prev) =>
        prev ? { ...prev, step: 'failed', message: info.message, failedKind: info.failedKind } : prev,
      )
    } finally {
      setBusy(false)
    }
  }

  const runAction = async (id: string, action: FlowAction) => {
    if (busy || pending) return
    if (action.confirm && !window.confirm(action.confirm)) return
    setError('')
    setBusy(true)
    setPending({ requestId: id, label: action.label, step: 'confirm' })
    try {
      if (action.path === 'accept') {
        let transporterWallet: string | undefined
        if (transportId) {
          transporterWallet = walletOf(users.find((u) => u.id === transportId))
        } else {
          transporterWallet = users.find((u) => u.role === 'TRANSPORT_OFFICER')?.walletAddress
        }
        if (!transporterWallet) {
          throw new Error('Select a transport officer with a linked wallet to assign.')
        }
        const accept = await blockchain.acceptRequest(id, requireActor())
        setPending({ requestId: id, label: action.label, step: 'submitted', txHash: accept.txHash })
        const assign = await blockchain.assignTransporter(id, transporterWallet, requireActor())
        setPending({ requestId: id, label: action.label, step: 'submitted', txHash: assign.txHash })
        setPending({ requestId: id, label: action.label, step: 'verifying', txHash: assign.txHash })
        await api.post<SupplyRequest>(`/supply-requests/${id}/accept`, {
          txHash: accept.txHash,
          txHashAssign: assign.txHash,
          transporterWallet,
        })
      } else if (action.path === 'reject') {
        const fn =
          requests.find((r) => r.id === id)?.status === 'APPROVED'
            ? blockchain.rejectApprovedRequest
            : blockchain.rejectRequest
        const signed = await fn(id, requireActor())
        setPending({ requestId: id, label: action.label, step: 'submitted', txHash: signed.txHash })
        setPending({ requestId: id, label: action.label, step: 'verifying', txHash: signed.txHash })
        await api.post<SupplyRequest>(`/supply-requests/${id}/reject`, {
          txHash: signed.txHash,
          approverUserId: user?.userId,
          comments: 'Rejected via blockchain-verified flow',
        })
      } else {
        const signers: Record<string, (requestUuid: string, actor: string) => Promise<{ txHash: string }>> = {
          approve: blockchain.approveRequest,
          dispatch: blockchain.dispatchRequest,
          'in-transit': blockchain.markInTransit,
          arrived: blockchain.markArrived,
          receive: blockchain.receiveRequest,
          complete: blockchain.completeRequest,
        }
        const signer = signers[action.path]
        if (!signer) throw new Error(`Unsupported action: ${action.path}`)
        const signed = await signer(id, requireActor())
        setPending({ requestId: id, label: action.label, step: 'submitted', txHash: signed.txHash })
        setPending({ requestId: id, label: action.label, step: 'verifying', txHash: signed.txHash })
        await api.post<SupplyRequest>(`/supply-requests/${id}/${action.path}`, { txHash: signed.txHash })
      }
      setPending((prev) => (prev ? { ...prev, step: 'done' } : prev))
      await load()
      setPending(null)
    } catch (err) {
      const info = errorInfo(err)
      setError(info.message)
      setPending((p) => (p ? { ...p, step: 'failed', message: info.message, failedKind: info.failedKind } : p))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loading />

  const role = user?.role ?? ''

  const ActivePanel = ({ p }: { p: PendingAction }) => (
    <div className={`action-status ${p.step === 'failed' ? 'failed' : p.step === 'done' ? 'done' : ''}`}>
      <h4>{p.label}</h4>
      <ul className="act-steps">
        <StepLine ok={p.step !== 'confirm'}>{p.step === 'confirm' ? 'Confirm in MetaMask' : 'Confirm in MetaMask'}</StepLine>
        <StepLine ok={p.step === 'submitted' || p.step === 'verifying' || p.step === 'done'}>
          {p.step === 'confirm' ? 'Confirm in MetaMask' : p.txHash ? `Transaction submitted` : 'Transaction submitted'}
        </StepLine>
        <li className="act-step txhash">
          {p.txHash ? (
            <>
              <span>Tx:</span>
              <code className="cid" title={p.txHash}>{p.txHash.slice(0, 18)}...</code>
            </>
          ) : (
            <span>Tx: pending…</span>
          )}
        </li>
        <StepLine ok={p.step === 'verifying' || p.step === 'done'}>
          {p.step === 'verifying' || p.step === 'done' ? 'Backend verifying transaction…' : 'Backend verifying transaction…'}
        </StepLine>
        <li className={`act-step ${p.step === 'done' ? 'ok' : ''} ${p.step === 'failed' ? 'fail' : ''}`}>
          <span>{p.step === 'done' ? '✓' : p.step === 'failed' ? '✗' : '…'}</span>
          {p.step === 'done'
            ? 'Blockchain verified ✓'
            : p.step === 'failed'
              ? p.failedKind === 'rejected'
                ? 'Transaction cancelled in MetaMask. No blockchain transaction was submitted.'
                : p.failedKind === 'verification'
                  ? 'Blockchain verification failed ✗ Request state was not changed.'
                  : p.failedKind === 'wallet'
                    ? 'Wallet or network error. No blockchain transaction was submitted.'
                    : 'Blockchain error. Request state was not changed.'
              : 'Waiting for confirmation…'}
        </li>
      </ul>
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Supply Requests"
        action={
          (role === 'CAMP_MANAGER' || role === 'GOVERNMENT_ADMIN') && (
            <button className="btn btn-primary" onClick={openForm} disabled={busy || !!pending}>
              + New Request
            </button>
          )
        }
      />
      {error && <ErrorBanner message={error} />}

      {showForm && (
        <form className="card form" onSubmit={submit}>
          <h3>Create supply request</h3>
          <div className="form-grid">
            <label>
              Camp
              <select value={campId} onChange={(e) => setCampId(e.target.value)} required>
                <option value="">Select camp</option>
                {camps.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Warehouse
              <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
                <option value="">Select warehouse</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Transport officer (assigned on accept)
              <select value={transportId} onChange={(e) => setTransportId(e.target.value)}>
                <option value="">Auto-select first transport officer</option>
                {users.filter((u) => u.role === 'TRANSPORT_OFFICER').map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                    {u.walletAddress ? '' : ' (no wallet)'}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="item-editor">
            <h4>Items</h4>
            {itemRows.map((row, idx) => (
              <div key={idx} className="item-row">
                <select
                  value={row.reliefItemId}
                  onChange={(e) => {
                    const item = items.find((i) => i.id === e.target.value)
                    updateItemRow(idx, { reliefItemId: e.target.value, itemName: item?.name ?? '' })
                  }}
                  required
                >
                  <option value="">Item</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Qty"
                  value={row.requestedQty}
                  onChange={(e) => updateItemRow(idx, { requestedQty: e.target.value })}
                  required
                />
                <button type="button" className="btn btn-outline btn-sm" onClick={() => removeItemRow(idx)}>
                  Remove
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-outline btn-sm" onClick={addItemRow}>
              + Add item
            </button>
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" disabled={busy || !!pending}>
              {busy ? 'Signing…' : 'Create (sign on-chain)'}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="request-list">
        {requests.map((r) => {
          const availableActions = FLOW.filter(
            (a) => a.from.includes(r.status) && a.roles.includes(role),
          )
          const isPending = pending?.requestId === r.id
          return (
            <div key={r.id} className={`card request-card status-${r.status.toLowerCase()}`}>
              <div className="request-head">
                <div>
                  <span className={`pill status ${r.status.toLowerCase()}`}>{statusLabel(r.status)}</span>
                  {r.mlClassification && (
                    <span className={`ml-tag ${r.mlClassification.toLowerCase()}`}>
                      ML: {r.mlClassification}
                      {r.mlConfidence != null ? ` (${Math.round(r.mlConfidence * 100)}%)` : ''}
                    </span>
                  )}
                </div>
                <code className="cid">{shortId(r.id)}</code>
              </div>
              <p className="muted">
                Camp {camps.find((c) => c.id === r.campId)?.name ?? shortId(r.campId)} → Warehouse{' '}
                {warehouses.find((w) => w.id === r.warehouseId)?.name ?? shortId(r.warehouseId)}
              </p>
              <ul className="plain-list">
                {r.items.map((it) => (
                  <li key={it.reliefItemId}>
                    {it.itemName || it.reliefItemId.slice(0, 8)} — {it.requestedQty}
                  </li>
                ))}
              </ul>
              <div className="request-meta">
                <span className="muted">{formatDate(r.updatedAt)}</span>
                {r.txHashCreate && (
                  <code className="cid" title={r.txHashCreate}>
                    tx {r.txHashCreate.slice(0, 12)}...
                  </code>
                )}
              </div>
              {isPending && pending && <ActivePanel p={pending} />}
              {availableActions.length > 0 && (
                <div className="request-actions">
                  {availableActions.map((a) => (
                    <button
                      key={a.path}
                      className="btn btn-sm btn-primary"
                      disabled={busy || !!pending}
                      onClick={() => runAction(r.id, a)}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {requests.length === 0 && <p className="empty-state">No supply requests yet.</p>}
      </div>
    </div>
  )
}
