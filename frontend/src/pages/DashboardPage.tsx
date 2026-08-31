import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { Loading, ErrorBanner, PageHeader } from '../components/Page'
import { statusLabel, roleLabel } from '../utils/format'
import type { Facility, Organization, ReliefItem, SupplyRequest, SupplyRequestStatus } from '../api/types'

interface Counts {
  orgs: number
  facilities: number
  items: number
  requests: number
}

const STATUS_FLOW: SupplyRequestStatus[] = [
  'CREATED', 'APPROVED', 'ACCEPTED', 'DISPATCHED', 'IN_TRANSIT', 'ARRIVED', 'RECEIVED', 'COMPLETED',
]

export default function DashboardPage() {
  const { user } = useAuth()
  const [counts, setCounts] = useState<Counts>({ orgs: 0, facilities: 0, items: 0, requests: 0 })
  const [requests, setRequests] = useState<SupplyRequest[]>([])
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [o, f, i, r] = await Promise.all([
          api.get<Organization[]>('/organizations'),
          api.get<Facility[]>('/facilities'),
          api.get<ReliefItem[]>('/relief-items'),
          api.get<SupplyRequest[]>('/supply-requests'),
        ])
        setOrgs(o)
        setFacilities(f)
        setRequests(r)
        setCounts({ orgs: o.length, facilities: f.length, items: i.length, requests: r.length })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <Loading />
  if (error) return <ErrorBanner message={error} />

  const statusCounts = STATUS_FLOW.map((s) => ({
    status: s,
    count: requests.filter((r) => r.status === s).length,
  }))

  return (
    <div>
      <PageHeader title={`Dashboard`} />
      <p className="muted">
        Signed in as <strong>{user?.fullName}</strong> ({roleLabel(user?.role ?? '')})
      </p>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-value">{counts.orgs}</span>
          <span className="stat-label">Organizations</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{counts.facilities}</span>
          <span className="stat-label">Facilities</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{counts.items}</span>
          <span className="stat-label">Relief Items</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{counts.requests}</span>
          <span className="stat-label">Supply Requests</span>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Requests by status</h3>
          <ul className="status-list">
            {statusCounts.map(({ status, count }) => (
              <li key={status}>
                <span className={status.toLowerCase()}>{statusLabel(status)}</span>
                <span className="badge">{count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h3>Recent facilities</h3>
          <ul className="plain-list">
            {facilities.slice(0, 5).map((f) => (
              <li key={f.id}>
                <strong>{f.name}</strong> <span className="muted">({f.type})</span>
              </li>
            ))}
            {facilities.length === 0 && <li className="muted">None yet</li>}
          </ul>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Organizations</h3>
          <ul className="plain-list">
            {orgs.slice(0, 5).map((o) => (
              <li key={o.id}>
                <strong>{o.name}</strong> <span className="muted">({o.type})</span>
              </li>
            ))}
            {orgs.length === 0 && <li className="muted">None yet</li>}
          </ul>
        </div>

        <div className="card">
          <h3>Recent supply requests</h3>
          <ul className="plain-list">
            {requests.slice(0, 5).map((r) => (
              <li key={r.id}>
                <span className={r.status.toLowerCase()}>{statusLabel(r.status)}</span>
                {r.mlClassification && (
                  <span className={`ml-tag ${r.mlClassification.toLowerCase()}`}>
                    ML: {r.mlClassification} {r.mlConfidence != null ? Math.round(r.mlConfidence * 100) + '%' : ''}
                  </span>
                )}
              </li>
            ))}
            {requests.length === 0 && <li className="muted">None yet</li>}
          </ul>
        </div>
      </div>
    </div>
  )
}
