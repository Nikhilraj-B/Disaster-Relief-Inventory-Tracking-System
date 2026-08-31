import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { Loading, ErrorBanner, PageHeader } from '../components/Page'
import { formatDate } from '../utils/format'
import type { AuditRecord } from '../api/types'

export default function AuditPage() {
  const [records, setRecords] = useState<AuditRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        setRecords(await api.get<AuditRecord[]>('/audit'))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load audit trail')
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
      <PageHeader title="Audit Trail" />
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Entity</th>
              <th>Details</th>
              <th>TX</th>
            </tr>
          </thead>
          <tbody>
            {records.map((a) => (
              <tr key={a.id}>
                <td>{formatDate(a.createdAt)}</td>
                <td>
                  <span className="pill">{a.action}</span>
                </td>
                <td>{a.actorUserId ? a.actorUserId.slice(0, 8) : '—'}</td>
                <td>
                  {a.entityType} {a.entityId ? a.entityId.slice(0, 8) : ''}
                </td>
                <td>{a.details || '—'}</td>
                <td>{a.txHash ? <code className="cid">{a.txHash.slice(0, 14)}...</code> : '—'}</td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-state">
                  No audit records yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
