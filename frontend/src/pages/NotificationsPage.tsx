import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { Loading, ErrorBanner, PageHeader } from '../components/Page'
import { formatDate } from '../utils/format'
import type { Notification } from '../api/types'

export default function NotificationsPage() {
  const { user } = useAuth()
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const all = await api.get<Notification[]>('/notifications')
        setNotifs(user ? all.filter((n) => n.userId === user.userId) : all)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load notifications')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  if (loading) return <Loading />
  if (error) return <ErrorBanner message={error} />

  return (
    <div>
      <PageHeader title="Notifications" />
      <ul className="notif-list">
        {notifs.map((n) => (
          <li key={n.id} className={`notif ${n.read ? '' : 'unread'}`}>
            <span className="notif-dot" />
            <div>
              <p>{n.message}</p>
              <span className="muted">{formatDate(n.createdAt)}</span>
            </div>
          </li>
        ))}
        {notifs.length === 0 && <p className="empty-state">No notifications.</p>}
      </ul>
    </div>
  )
}
