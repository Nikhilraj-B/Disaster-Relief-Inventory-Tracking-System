import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { Loading, ErrorBanner, PageHeader } from '../components/Page'
import { formatDate } from '../utils/format'
import type { Facility, InventoryItem, InventoryTransaction, ReliefItem } from '../api/types'

interface AdjustModalState {
  item: InventoryItem
  mode: 'ADD' | 'REMOVE' | 'SET'
  amount: string
  reason: string
}

export default function InventoryPage() {
  const { user } = useAuth()
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [reliefItems, setReliefItems] = useState<ReliefItem[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)

  // Facility filter for Admin
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('')

  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [newItemReliefId, setNewItemReliefId] = useState('')
  const [newItemQuantity, setNewItemQuantity] = useState('')

  const [adjustModal, setAdjustModal] = useState<AdjustModalState | null>(null)

  const isCampManager = user?.role === 'CAMP_MANAGER'
  const isWarehouseManager = user?.role === 'WAREHOUSE_MANAGER'
  const isAdmin = user?.role === 'ADMIN'

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [f, r, inv, tx] = await Promise.all([
        api.get<Facility[]>('/facilities'),
        api.get<ReliefItem[]>('/relief-items'),
        api.get<InventoryItem[]>('/inventory'),
        api.get<InventoryTransaction[]>('/inventory-transactions').catch(() => []),
      ])
      setFacilities(f)
      setReliefItems(r)
      setInventory(inv)
      setTransactions(tx)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load storage inventory')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const myFacility = facilities.find(
    (f) => f.id === user?.facilityId || f.managerUserId === user?.userId
  )

  const effectiveFacilityId = isCampManager || isWarehouseManager
    ? myFacility?.id
    : selectedFacilityId || (facilities.length > 0 ? facilities[0].id : '')

  const currentFacility = facilities.find((f) => f.id === effectiveFacilityId)

  // Filter inventory items to the effective facility
  const displayedInventory = effectiveFacilityId
    ? inventory.filter((i) => i.facilityId === effectiveFacilityId)
    : inventory

  // Handle Add New Item to Storage
  const handleAddNewItem = async (e: FormEvent) => {
    e.preventDefault()
    if (!effectiveFacilityId || !newItemReliefId || !newItemQuantity) return
    setError('')
    setSuccess('')
    setBusy(true)
    try {
      await api.post<InventoryItem>('/inventory', {
        facilityId: effectiveFacilityId,
        reliefItemId: newItemReliefId,
        quantity: Number(newItemQuantity),
        reservedQuantity: 0,
      })
      setSuccess(`Added relief item to ${currentFacility?.name ?? 'storage'} inventory.`)
      setShowAddModal(false)
      setNewItemReliefId('')
      setNewItemQuantity('')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item to storage.')
    } finally {
      setBusy(false)
    }
  }

  // Handle Adjust (Add or Remove Quantity)
  const handleConfirmAdjust = async (e: FormEvent) => {
    e.preventDefault()
    if (!adjustModal || busy) return
    setError('')
    setSuccess('')
    setBusy(true)

    const deltaNum = Number(adjustModal.amount)
    if (isNaN(deltaNum) || deltaNum <= 0) {
      setError('Please specify a positive amount.')
      setBusy(false)
      return
    }

    try {
      if (adjustModal.mode === 'SET') {
        await api.put(`/inventory/${adjustModal.item.id}`, {
          ...adjustModal.item,
          quantity: deltaNum,
        })
        setSuccess('Quantity updated successfully.')
      } else {
        const delta = adjustModal.mode === 'ADD' ? deltaNum : -deltaNum
        await api.post(`/inventory/${adjustModal.item.id}/adjust`, {
          delta,
          reason: adjustModal.reason || (adjustModal.mode === 'ADD' ? 'Restocked / Inflow' : 'Distributed / Outflow'),
          type: adjustModal.mode === 'ADD' ? 'ADD' : 'SUBTRACT',
        })
        setSuccess(
          adjustModal.mode === 'ADD'
            ? `Successfully added ${deltaNum} to storage.`
            : `Successfully removed ${deltaNum} from storage.`
        )
      }
      setAdjustModal(null)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed.')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteItem = async (id: string, name: string) => {
    if (!window.confirm(`Remove ${name} from storage tracking?`)) return
    setError('')
    setBusy(true)
    try {
      await api.delete(`/inventory/${id}`)
      setSuccess(`Removed ${name} from storage.`)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete inventory item.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loading />

  return (
    <div>
      <PageHeader
        title={
          isCampManager
            ? 'Camp Storage Inventory'
            : isWarehouseManager
              ? 'Warehouse Storage Inventory'
              : 'Relief Inventory'
        }
        action={
          (isCampManager || isWarehouseManager || isAdmin) &&
          effectiveFacilityId && (
            <button
              className="btn btn-primary"
              onClick={() => setShowAddModal(true)}
              disabled={busy}
            >
              + Add Item to Storage
            </button>
          )
        }
      />

      {error && <ErrorBanner message={error} />}
      {success && (
        <div
          className="badge"
          style={{
            backgroundColor: '#27ae60',
            color: '#fff',
            padding: '10px 14px',
            borderRadius: '6px',
            marginBottom: '1rem',
            display: 'inline-block',
          }}
        >
          ✓ {success}
        </div>
      )}

      {/* Facility Header / Selector */}
      {isCampManager || isWarehouseManager ? (
        myFacility ? (
          <div
            className="card"
            style={{
              background: 'linear-gradient(135deg, #1b2838 0%, #2c3e50 100%)',
              color: '#ffffff',
              padding: '16px 20px',
              borderRadius: '8px',
              marginBottom: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.25rem' }}>
                  {myFacility.name}
                </h3>
                <p style={{ margin: '4px 0 0 0', opacity: 0.85, fontSize: '0.9rem' }}>
                  <strong>Type:</strong> {myFacility.type} &nbsp;|&nbsp;{' '}
                  <strong>Location:</strong> {myFacility.location || 'Not specified'}
                  {myFacility.population != null && ` | Population: ${myFacility.population}`}
                  {myFacility.capacitySqm != null && ` | Area: ${myFacility.capacitySqm} sq.m`}
                </p>
              </div>
              <div>
                <span className="pill ok" style={{ fontSize: '0.85rem' }}>
                  Active Storage
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="badge"
            style={{
              backgroundColor: '#e67e22',
              color: '#fff',
              padding: '12px 16px',
              borderRadius: '6px',
              marginBottom: '1.5rem',
              display: 'block',
            }}
          >
            ⚠️ No storage facility is assigned to your account yet. Please contact an Administrator to assign you to a camp or warehouse.
          </div>
        )
      ) : (
        <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <label style={{ margin: 0, fontWeight: 600 }}>Select Storage Facility:</label>
          <select
            value={effectiveFacilityId}
            onChange={(e) => setSelectedFacilityId(e.target.value)}
            style={{ minWidth: '260px' }}
          >
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.type})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Adjust Modal (Add or Remove Quantity) */}
      {adjustModal && (
        <div
          className="card form"
          style={{
            border: adjustModal.mode === 'ADD' ? '2px solid #27ae60' : adjustModal.mode === 'REMOVE' ? '2px solid #e67e22' : '2px solid #2980b9',
            marginBottom: '1.5rem',
            padding: '18px',
          }}
        >
          <h3 style={{ margin: '0 0 0.5rem 0' }}>
            {adjustModal.mode === 'ADD'
              ? `+ Add Quantity: ${reliefItems.find((r) => r.id === adjustModal.item.reliefItemId)?.name ?? 'Item'}`
              : adjustModal.mode === 'REMOVE'
                ? `- Remove Quantity: ${reliefItems.find((r) => r.id === adjustModal.item.reliefItemId)?.name ?? 'Item'}`
                : `Update Quantity: ${reliefItems.find((r) => r.id === adjustModal.item.reliefItemId)?.name ?? 'Item'}`}
          </h3>
          <p className="muted" style={{ margin: '0 0 1rem 0', fontSize: '0.9rem' }}>
            Current In-Storage Quantity: <strong>{adjustModal.item.quantity}</strong>{' '}
            {reliefItems.find((r) => r.id === adjustModal.item.reliefItemId)?.unit ?? 'units'}
          </p>

          <form onSubmit={handleConfirmAdjust}>
            <div className="form-grid">
              <label>
                {adjustModal.mode === 'ADD'
                  ? 'Quantity to Add'
                  : adjustModal.mode === 'REMOVE'
                    ? 'Quantity to Remove'
                    : 'New Exact Quantity'}
                <input
                  type="number"
                  min="0.1"
                  max={adjustModal.mode === 'REMOVE' ? adjustModal.item.quantity : undefined}
                  step="any"
                  required
                  value={adjustModal.amount}
                  onChange={(e) => setAdjustModal({ ...adjustModal, amount: e.target.value })}
                  placeholder="e.g. 25"
                />
              </label>

              <label>
                Reason / Note
                <input
                  type="text"
                  value={adjustModal.reason}
                  onChange={(e) => setAdjustModal({ ...adjustModal, reason: e.target.value })}
                  placeholder={
                    adjustModal.mode === 'ADD'
                      ? 'e.g. Direct donation, Restocked from local depot'
                      : 'e.g. Distributed to displaced families, Damaged'
                  }
                />
              </label>
            </div>

            <div className="form-actions" style={{ marginTop: '1rem' }}>
              <button
                type="submit"
                className={adjustModal.mode === 'ADD' ? 'btn btn-primary' : 'btn btn-danger'}
                disabled={busy}
              >
                {busy
                  ? 'Updating…'
                  : adjustModal.mode === 'ADD'
                    ? 'Confirm Add (+)'
                    : adjustModal.mode === 'REMOVE'
                      ? 'Confirm Remove (-)'
                      : 'Update Quantity'}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setAdjustModal(null)}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add New Item Modal */}
      {showAddModal && (
        <div className="card form" style={{ border: '2px solid #1d6fb8', marginBottom: '1.5rem' }}>
          <h3>Add Relief Item to Storage</h3>
          <p className="muted">
            Adding to <strong>{currentFacility?.name ?? 'Storage'}</strong>
          </p>
          <form onSubmit={handleAddNewItem}>
            <div className="form-grid">
              <label>
                Relief Item
                <select
                  value={newItemReliefId}
                  onChange={(e) => setNewItemReliefId(e.target.value)}
                  required
                >
                  <option value="">-- Select Relief Item --</option>
                  {reliefItems.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.category}) {r.unit ? `[${r.unit}]` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Initial Quantity
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  required
                  value={newItemQuantity}
                  onChange={(e) => setNewItemQuantity(e.target.value)}
                  placeholder="e.g. 50"
                />
              </label>
            </div>

            <div className="form-actions" style={{ marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Adding…' : 'Add to Storage'}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowAddModal(false)}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Storage Inventory Table */}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Relief Item</th>
              <th>Category</th>
              <th>Unit</th>
              <th>Quantity in Storage</th>
              <th>Reserved</th>
              <th>Available</th>
              <th>Last Updated</th>
              <th style={{ textAlign: 'right' }}>Update Operations (Add / Remove)</th>
            </tr>
          </thead>
          <tbody>
            {displayedInventory.map((inv) => {
              const itemDef = reliefItems.find((r) => r.id === inv.reliefItemId)
              const reserved = inv.reservedQuantity ?? 0
              const available = Math.max(0, (inv.quantity ?? 0) - reserved)

              return (
                <tr key={inv.id}>
                  <td>
                    <strong>{itemDef?.name ?? inv.reliefItemId?.slice(0, 8)}</strong>
                    {itemDef?.description && (
                      <div className="muted" style={{ fontSize: '0.8rem' }}>
                        {itemDef.description}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="pill">{itemDef?.category ?? 'OTHER'}</span>
                  </td>
                  <td>{itemDef?.unit ?? '—'}</td>
                  <td>
                    <strong style={{ fontSize: '1.05rem', color: (inv.quantity ?? 0) > 0 ? '#27ae60' : '#e74c3c' }}>
                      {inv.quantity ?? 0}
                    </strong>
                  </td>
                  <td>{reserved > 0 ? reserved : '—'}</td>
                  <td>
                    <span className="badge" style={{ backgroundColor: available > 0 ? '#2e86de' : '#95a5a6' }}>
                      {available}
                    </span>
                  </td>
                  <td>{formatDate(inv.updatedAt)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ backgroundColor: '#27ae60', color: '#fff' }}
                        title="Add quantity to storage"
                        onClick={() =>
                          setAdjustModal({
                            item: inv,
                            mode: 'ADD',
                            amount: '',
                            reason: '',
                          })
                        }
                        disabled={busy}
                      >
                        + Add
                      </button>

                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ backgroundColor: '#e67e22', color: '#fff' }}
                        title="Remove quantity from storage"
                        onClick={() =>
                          setAdjustModal({
                            item: inv,
                            mode: 'REMOVE',
                            amount: '',
                            reason: '',
                          })
                        }
                        disabled={busy || (inv.quantity ?? 0) <= 0}
                      >
                        - Remove
                      </button>

                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        title="Edit exact quantity"
                        onClick={() =>
                          setAdjustModal({
                            item: inv,
                            mode: 'SET',
                            amount: String(inv.quantity ?? 0),
                            reason: 'Manual adjustment',
                          })
                        }
                        disabled={busy}
                      >
                        Edit
                      </button>

                      {isAdmin && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ backgroundColor: '#c0392b', color: '#fff' }}
                          title="Delete tracking record"
                          onClick={() => handleDeleteItem(inv.id, itemDef?.name ?? 'Item')}
                          disabled={busy}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {displayedInventory.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-state" style={{ textAlign: 'center', padding: '2rem' }}>
                  No relief items tracked in this storage yet. Click <strong>+ Add Item to Storage</strong> above to add items.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Storage Activity Log */}
      {transactions.length > 0 && (
        <div className="card" style={{ marginTop: '2rem' }}>
          <h3>Recent Storage Inflow & Outflow Activity</h3>
          <div className="table-wrap">
            <table className="table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Relief Item</th>
                  <th>Action</th>
                  <th>Quantity</th>
                  <th>Note / Reference</th>
                </tr>
              </thead>
              <tbody>
                {transactions
                  .filter((tx) => {
                    const invItem = inventory.find((i) => i.id === tx.inventoryItemId)
                    return !effectiveFacilityId || (invItem && invItem.facilityId === effectiveFacilityId) || tx.facilityId === effectiveFacilityId
                  })
                  .slice(0, 10)
                  .map((tx) => {
                    const invItem = inventory.find((i) => i.id === tx.inventoryItemId)
                    const reliefId = tx.reliefItemId || invItem?.reliefItemId
                    const itemDef = reliefItems.find((r) => r.id === reliefId)
                    const isAdd = tx.transactionType === 'ADD' || tx.type === 'ADD' || tx.type === 'INFLOW'

                    return (
                      <tr key={tx.id}>
                        <td>{formatDate(tx.createdAt)}</td>
                        <td>
                          <strong>{itemDef?.name ?? 'Relief Item'}</strong>
                        </td>
                        <td>
                          <span
                            className="pill"
                            style={{
                              backgroundColor: isAdd ? '#27ae60' : '#e67e22',
                              color: '#fff',
                            }}
                          >
                            {isAdd ? '+ Inflow (Added)' : '- Outflow (Removed)'}
                          </span>
                        </td>
                        <td>
                          <strong>{tx.quantity}</strong> {itemDef?.unit ?? ''}
                        </td>
                        <td className="muted">{tx.referenceType || tx.type || '—'}</td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
