import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { Loading, ErrorBanner, PageHeader } from '../components/Page'
import { formatDate, shortId } from '../utils/format'
import type { Shipment, SupplyRequest, Vehicle } from '../api/types'

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [requests, setRequests] = useState<SupplyRequest[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [s, r, v] = await Promise.all([
          api.get<Shipment[]>('/shipments'),
          api.get<SupplyRequest[]>('/supply-requests'),
          api.get<Vehicle[]>('/vehicles'),
        ])
        setShipments(s)
        setRequests(r)
        setVehicles(v)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load shipments')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <Loading />
  if (error) return <ErrorBanner message={error} />

  return (
    <div>
      <PageHeader title="Shipments" />
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Supply request</th>
              <th>Vehicle</th>
              <th>Dispatched</th>
              <th>Arrived</th>
              <th>TX hash</th>
            </tr>
          </thead>
          <tbody>
            {shipments.map((s) => {
              const req = requests.find((r) => r.id === s.supplyRequestId)
              const vehicle = vehicles.find((v) => v.id === s.vehicleId)
              return (
                <tr key={s.id}>
                  <td>
                    <code className="cid">{shortId(s.id)}</code>
                  </td>
                  <td>
                    {req ? `${statusLabel(req.status)} (${shortId(req.id)})` : shortId(s.supplyRequestId)}
                  </td>
                  <td>{vehicle?.registrationNumber ?? '—'}</td>
                  <td>{formatDate(s.dispatchTime)}</td>
                  <td>{formatDate(s.arrivalTime)}</td>
                  <td>
                    {s.txHashDispatch ? <code className="cid">{s.txHashDispatch.slice(0, 14)}...</code> : '—'}
                  </td>
                </tr>
              )
            })}
            {shipments.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-state">
                  No shipments yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function statusLabel(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
