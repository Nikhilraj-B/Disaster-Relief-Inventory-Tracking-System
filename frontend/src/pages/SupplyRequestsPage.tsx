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
  Vehicle,
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
  { label: 'Accept Request', path: 'accept', from: ['CREATED', 'APPROVED'], roles: ['WAREHOUSE_MANAGER', 'ADMIN'] },
  { label: 'Assign Driver & Vehicle', path: 'assign-driver', from: ['ACCEPTED'], roles: ['TRANSPORT_OFFICER', 'ADMIN'] },
  { label: 'Dispatch', path: 'dispatch', from: ['ACCEPTED'], roles: ['TRANSPORT_OFFICER', 'ADMIN'] },
  { label: 'In Transit', path: 'in-transit', from: ['DISPATCHED'], roles: ['TRANSPORT_OFFICER', 'ADMIN'] },
  { label: 'Receive Supplies', path: 'receive', from: ['IN_TRANSIT', 'ARRIVED'], roles: ['CAMP_MANAGER', 'ADMIN'] },
  { label: 'Vehicle Returned (Complete)', path: 'complete', from: ['RECEIVED'], roles: ['TRANSPORT_OFFICER', 'ADMIN'] },
  { label: 'Reject', path: 'reject', from: ['CREATED', 'APPROVED'], roles: ['WAREHOUSE_MANAGER', 'ADMIN'], confirm: 'Reject this request?' },
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
  const [, setUsers] = useState<User[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [adminSelectedCampId, setAdminSelectedCampId] = useState('')
  const [itemRows, setItemRows] = useState<ItemRow[]>([])
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<PendingAction | null>(null)

  // State for warehouse accepting modal (Warehouse Manager / Admin)
  const [acceptModalRequest, setAcceptModalRequest] = useState<SupplyRequest | null>(null)
  const [adminSelectedWarehouseId, setAdminSelectedWarehouseId] = useState('')

  // State for driver assignment modal (Transport Officer / Admin)
  const [assignDriverModalRequest, setAssignDriverModalRequest] = useState<SupplyRequest | null>(null)
  const [selectedVehicleId, setSelectedVehicleId] = useState('')

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
      const [r, f, it, us, v] = await Promise.all([
        api.get<SupplyRequest[]>('/supply-requests'),
        api.get<Facility[]>('/facilities'),
        api.get<ReliefItem[]>('/relief-items'),
        api.get<User[]>('/users'),
        api.get<Vehicle[]>('/vehicles'),
      ])
      setRequests(r)
      setCamps(f.filter((x) => x.type === 'CAMP'))
      setWarehouses(f.filter((x) => x.type === 'WAREHOUSE'))
      setItems(it)
      setUsers(us)
      setVehicles(v)
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

  const myCamp = camps.find((c) => c.id === user?.facilityId || c.managerUserId === user?.userId)
  const myWarehouse = warehouses.find((w) => w.id === user?.facilityId || w.managerUserId === user?.userId)

  const openForm = () => {
    setAdminSelectedCampId('')
    setItemRows([{ reliefItemId: '', itemName: '', requestedQty: '' }])
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

    const effectiveCampId = user?.role === 'CAMP_MANAGER' ? myCamp?.id : adminSelectedCampId
    if (!effectiveCampId) {
      setError(
        user?.role === 'CAMP_MANAGER'
          ? 'You are not assigned to any camp yet. Please contact an admin to assign you to a camp.'
          : 'Please select a camp.'
      )
      return
    }

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
      const id = crypto.randomUUID()
      setPending({ requestId: id, label: 'Create request', step: 'confirm' })

      // Open request created with ZeroAddress on-chain so any warehouse can accept
      const zeroAddress = '0x0000000000000000000000000000000000000000'
      const signed = await blockchain.createRequest(id, zeroAddress, requireActor())

      setPending({ requestId: id, label: 'Create request', step: 'submitted', txHash: signed.txHash })
      setPending({ requestId: id, label: 'Create request', step: 'verifying', txHash: signed.txHash })

      await api.post<SupplyRequest>('/supply-requests', {
        id,
        campId: effectiveCampId,
        warehouseId: null,
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
        prev ? { ...prev, step: 'failed', message: info.message, failedKind: info.failedKind } : prev
      )
    } finally {
      setBusy(false)
    }
  }

  const handleConfirmAccept = async (e: FormEvent) => {
    e.preventDefault()
    if (!acceptModalRequest || busy || pending) return
    setError('')
    setBusy(true)

    const requestId = acceptModalRequest.id
    const targetWarehouse = user?.role === 'ADMIN'
      ? warehouses.find((w) => w.id === adminSelectedWarehouseId)
      : myWarehouse

    if (!targetWarehouse) {
      setError('Please select or verify your warehouse.')
      setBusy(false)
      return
    }

    setPending({ requestId, label: 'Accept request', step: 'confirm' })
    try {
      const accept = await blockchain.acceptRequest(requestId, requireActor())
      setPending({ requestId, label: 'Accept request', step: 'submitted', txHash: accept.txHash })
      setPending({ requestId, label: 'Accept request', step: 'verifying', txHash: accept.txHash })

      await api.post<SupplyRequest>(`/supply-requests/${requestId}/accept`, {
        txHash: accept.txHash,
        warehouseId: targetWarehouse.id,
      })

      setPending((prev) => (prev ? { ...prev, step: 'done' } : prev))
      setAcceptModalRequest(null)
      setAdminSelectedWarehouseId('')
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

  const handleConfirmAssignDriver = async (e: FormEvent) => {
    e.preventDefault()
    if (!assignDriverModalRequest || busy || pending) return
    setError('')
    setBusy(true)

    const requestId = assignDriverModalRequest.id
    const chosenVehicle = vehicles.find((v) => v.id === selectedVehicleId)
    if (!chosenVehicle) {
      setError('Please select an available vehicle and driver.')
      setBusy(false)
      return
    }

    setPending({ requestId, label: 'Assign Driver & Vehicle', step: 'confirm' })
    try {
      const latestUsers = await api.get<User[]>('/users')
      setUsers(latestUsers)

      // Use active transporter wallet
      const transporterWallet = requireActor()

      const assign = await blockchain.assignTransporter(requestId, transporterWallet, requireActor())
      setPending({ requestId, label: 'Assign Driver & Vehicle', step: 'submitted', txHash: assign.txHash })
      setPending({ requestId, label: 'Assign Driver & Vehicle', step: 'verifying', txHash: assign.txHash })

      await api.post<SupplyRequest>(`/supply-requests/${requestId}/assign-driver`, {
        txHashAssign: assign.txHash,
        transporterWallet,
        vehicleId: chosenVehicle.id,
        driverName: chosenVehicle.driverName,
        driverId: chosenVehicle.driverId,
        transporterUserId: user?.userId,
      })

      setPending((prev) => (prev ? { ...prev, step: 'done' } : prev))
      setAssignDriverModalRequest(null)
      setSelectedVehicleId('')
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

  const runAction = async (id: string, action: FlowAction) => {
    if (busy || pending) return

    if (action.path === 'accept') {
      const targetReq = requests.find((r) => r.id === id)
      if (targetReq) {
        setAcceptModalRequest(targetReq)
        setAdminSelectedWarehouseId('')
      }
      return
    }

    if (action.path === 'assign-driver') {
      const targetReq = requests.find((r) => r.id === id)
      if (targetReq) {
        setAssignDriverModalRequest(targetReq)
        setSelectedVehicleId(targetReq.assignedVehicleId ?? '')
      }
      return
    }

    if (action.path === 'dispatch') {
      const targetReq = requests.find((r) => r.id === id)
      if (!targetReq?.assignedVehicleId && !targetReq?.assignedDriverName) {
        setAssignDriverModalRequest(targetReq || null)
        setError('Please assign a vehicle and driver before dispatching.')
        return
      }
    }

    if (action.confirm && !window.confirm(action.confirm)) return
    setError('')
    setBusy(true)
    setPending({ requestId: id, label: action.label, step: 'confirm' })
    try {
      if (action.path === 'reject') {
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

  // Filter vehicles relevant for the assigning modal
  const assignWarehouseId = assignDriverModalRequest?.warehouseId
  const relevantVehiclesForAssign = vehicles.filter(
    (v) => v.active && (!v.warehouseId || !assignWarehouseId || v.warehouseId === assignWarehouseId)
  )

  const ActivePanel = ({ p }: { p: PendingAction }) => (
    <div className={`action-status ${p.step === 'failed' ? 'failed' : p.step === 'done' ? 'done' : ''}`}>
      <h4>{p.label}</h4>
      <ul className="act-steps">
        <StepLine ok={p.step !== 'confirm'}>Confirm in MetaMask</StepLine>
        <StepLine ok={p.step === 'submitted' || p.step === 'verifying' || p.step === 'done'}>
          {p.txHash ? 'Transaction submitted' : 'Waiting for transaction'}
        </StepLine>
        <li className="act-step txhash">
          {p.txHash ? (
            <>
              <span>Tx:</span>
              <code className="cid" title={p.txHash}>
                {p.txHash.slice(0, 18)}...
              </code>
            </>
          ) : (
            <span>Tx: pending…</span>
          )}
        </li>
        <StepLine ok={p.step === 'verifying' || p.step === 'done'}>Backend verifying transaction…</StepLine>
        <li className={`act-step ${p.step === 'done' ? 'ok' : ''} ${p.step === 'failed' ? 'fail' : ''}`}>
          <span>{p.step === 'done' ? '✓' : p.step === 'failed' ? '✗' : '…'}</span>
          {p.step === 'done'
            ? 'Blockchain verified ✓'
            : p.step === 'failed'
              ? p.failedKind === 'rejected'
                ? 'Transaction cancelled in MetaMask.'
                : p.failedKind === 'verification'
                  ? 'Blockchain verification failed ✗ Request state was not changed.'
                  : p.failedKind === 'wallet'
                    ? 'Wallet error. No transaction submitted.'
                    : 'Blockchain error. State not changed.'
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
          (role === 'CAMP_MANAGER' || role === 'ADMIN') && (
            <button className="btn btn-primary" onClick={openForm} disabled={busy || !!pending}>
              + New Request
            </button>
          )
        }
      />
      {error && <ErrorBanner message={error} />}

      {/* Accept Modal (Warehouse Manager / Admin) */}
      {acceptModalRequest && (
        <div className="card form" style={{ border: '2px solid #27ae60', marginBottom: '2rem' }}>
          <h3>Accept Supply Request</h3>
          <p className="muted">
            Request from <strong>{camps.find((c) => c.id === acceptModalRequest.campId)?.name ?? shortId(acceptModalRequest.campId)}</strong>
          </p>

          <form onSubmit={handleConfirmAccept}>
            {user?.role === 'ADMIN' ? (
              <label>
                Accepting Warehouse
                <select
                  value={adminSelectedWarehouseId}
                  onChange={(e) => setAdminSelectedWarehouseId(e.target.value)}
                  required
                >
                  <option value="">Select Warehouse</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#34495e', color: '#fff', borderRadius: '4px' }}>
                <strong>Accepting Warehouse: </strong>
                {myWarehouse ? myWarehouse.name : '⚠️ You are not assigned to a warehouse yet! Contact Admin.'}
              </div>
            )}

            <p className="muted" style={{ fontSize: '0.88rem', margin: '0.75rem 0' }}>
              ℹ️ Once accepted, the request will be assigned to this warehouse. A Transport Officer will assign an available vehicle and driver for dispatch.
            </p>

            <div className="form-actions" style={{ marginTop: '1rem' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy || (user?.role !== 'ADMIN' && !myWarehouse)}
              >
                {busy ? 'Processing on-chain...' : 'Confirm Acceptance (Sign on-chain)'}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setAcceptModalRequest(null)}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Assign Driver & Vehicle Modal (Transport Officer / Admin) */}
      {assignDriverModalRequest && (
        <div className="card form" style={{ border: '2px solid #3498db', marginBottom: '2rem' }}>
          <h3>Assign Driver & Vehicle</h3>
          <p className="muted">
            Request from <strong>{camps.find((c) => c.id === assignDriverModalRequest.campId)?.name ?? shortId(assignDriverModalRequest.campId)}</strong>
            {assignDriverModalRequest.warehouseId && (
              <> • Warehouse: <strong>{warehouses.find((w) => w.id === assignDriverModalRequest.warehouseId)?.name ?? shortId(assignDriverModalRequest.warehouseId)}</strong></>
            )}
          </p>

          <form onSubmit={handleConfirmAssignDriver}>
            <label>
              Select Available Vehicle & Driver
              <select value={selectedVehicleId} onChange={(e) => setSelectedVehicleId(e.target.value)} required>
                <option value="">-- Choose Driver & Vehicle --</option>
                {relevantVehiclesForAssign.map((v) => (
                  <option key={v.id} value={v.id}>
                    Driver: {v.driverName || 'Incharge'} (ID: {v.driverId || 'N/A'}) — Vehicle: {v.registrationNumber} ({v.vehicleType || 'Truck'})
                  </option>
                ))}
              </select>
            </label>
            {relevantVehiclesForAssign.length === 0 && (
              <p className="muted" style={{ color: '#e67e22', fontSize: '0.85rem' }}>
                ⚠️ No active vehicles found. Please register vehicles under this warehouse or transport officer.
              </p>
            )}

            <div className="form-actions" style={{ marginTop: '1rem' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy || !selectedVehicleId}
              >
                {busy ? 'Processing on-chain...' : 'Confirm Driver Assignment (Sign on-chain)'}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setAssignDriverModalRequest(null)}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create Request Form */}
      {showForm && (
        <form className="card form" onSubmit={submit}>
          <h3>Create Supply Request</h3>

          {user?.role === 'CAMP_MANAGER' ? (
            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#34495e', color: '#fff', borderRadius: '4px' }}>
              <strong>Requesting For Camp: </strong>
              {myCamp ? (
                <span>
                  {myCamp.name} {myCamp.location ? `(${myCamp.location})` : ''}
                </span>
              ) : (
                <span style={{ color: '#e74c3c' }}>
                  ⚠️ No Camp Assigned to your account. Contact Admin before requesting.
                </span>
              )}
            </div>
          ) : (
            <label>
              Camp
              <select
                value={adminSelectedCampId}
                onChange={(e) => setAdminSelectedCampId(e.target.value)}
                required
              >
                <option value="">Select camp</option>
                {camps.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <p className="muted" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
            ℹ️ Requests are broadcast to all relief warehouses. Any available warehouse can accept this request and dispatch supplies.
          </p>

          <div className="item-editor">
            <h4>Requested Relief Items</h4>
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
                  <option value="">Select Item</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.category})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  placeholder="Quantity"
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
            <button
              className="btn btn-primary"
              disabled={busy || !!pending || (user?.role === 'CAMP_MANAGER' && !myCamp)}
            >
              {busy ? 'Signing…' : 'Submit Request (Sign on-chain)'}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Requests List */}
      <div className="request-list">
        {requests.map((r) => {
          const availableActions = FLOW.filter(
            (a) => a.from.includes(r.status) && a.roles.includes(role)
          )
          const isPending = pending?.requestId === r.id
          const campObj = camps.find((c) => c.id === r.campId)
          const warehouseObj = warehouses.find((w) => w.id === r.warehouseId)

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

              <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                <p style={{ margin: '0 0 0.25rem 0' }}>
                  <strong>Camp: </strong> {campObj?.name ?? shortId(r.campId)}
                </p>
                <p style={{ margin: 0 }} className="muted">
                  <strong>Warehouse: </strong>
                  {warehouseObj ? (
                    <span className="pill ok" style={{ fontSize: '0.8rem' }}>
                      {warehouseObj.name}
                    </span>
                  ) : (
                    <span className="pill" style={{ fontSize: '0.8rem', background: '#34495e', color: '#fff' }}>
                      Open to Any Warehouse
                    </span>
                  )}
                </p>
              </div>

              {/* Driver & Warehouse Acceptance Details */}
              {r.status !== 'CREATED' && r.status !== 'APPROVED' && (
                <div
                  style={{
                    margin: '0.5rem 0',
                    padding: '0.5rem 0.75rem',
                    background: (r.assignedDriverName || r.assignedVehicleId) ? 'rgba(39, 174, 96, 0.1)' : 'rgba(243, 156, 18, 0.1)',
                    borderRadius: '4px',
                    borderLeft: (r.assignedDriverName || r.assignedVehicleId) ? '3px solid #27ae60' : '3px solid #f39c12',
                    fontSize: '0.85rem',
                  }}
                >
                  {warehouseObj && (
                    <div>
                      <strong>Fulfilling Warehouse: </strong> {warehouseObj.name}
                    </div>
                  )}
                  {r.assignedDriverName ? (
                    <div>
                      <strong>Vehicle Incharge / Driver: </strong> {r.assignedDriverName} (ID: {r.assignedDriverId || '—'})
                    </div>
                  ) : (
                    <div style={{ color: '#d35400', fontStyle: 'italic' }}>
                      ⏳ Awaiting Vehicle & Driver Assignment by Transport Officer
                    </div>
                  )}
                  {r.assignedVehicleId && (
                    <div>
                      <strong>Vehicle: </strong>{' '}
                      {vehicles.find((v) => v.id === r.assignedVehicleId)?.registrationNumber || shortId(r.assignedVehicleId)}
                    </div>
                  )}
                </div>
              )}

              <ul className="plain-list" style={{ marginTop: '0.5rem' }}>
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
