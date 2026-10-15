import { useEffect, useState } from 'react'
import { PageHeader } from '../components/Page'
import { formatDate } from '../utils/format'
import type { Facility, User } from '../api/types'
import { api } from '../api/client'

export default function FacilitiesPage() {
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  // Form State
  const [facName, setFacName] = useState('')
  const [facType, setFacType] = useState('CAMP')
  const [orgName, setOrgName] = useState('')
  const [orgType, setOrgType] = useState('GOVT')
  const [managerId, setManagerId] = useState('')
  const [location, setLocation] = useState('')
  const [population, setPopulation] = useState('')
  const [maxCapacity, setMaxCapacity] = useState('')
  const [capacitySqm, setCapacitySqm] = useState('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const loadData = async () => {
    try {
      const [f, u] = await Promise.all([
        api.get<Facility[]>('/facilities'),
        api.get<User[]>('/users').catch(() => [] as User[])
      ])
      setFacilities(f)
      setUsers(u)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleFetchLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation(`${position.coords.latitude}, ${position.coords.longitude}`)
      },
      () => {
        alert('Unable to retrieve your location')
      }
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)

    try {
      // 1. Create Organization inline
      const org = await api.post<{ id: string }>('/organizations', {
        name: orgName,
        type: orgType,
        contactInfo: ''
      })

      // 2. Create Facility
      await api.post('/facilities', {
        name: facName,
        type: facType,
        organizationId: org.id,
        managerUserId: managerId || null,
        location,
        population: facType === 'CAMP' ? Number(population) : null,
        maxCapacity: facType === 'CAMP' ? Number(maxCapacity) : null,
        capacitySqm: facType === 'WAREHOUSE' ? Number(capacitySqm) : null,
      })

      // Reset form
      setFacName('')
      setOrgName('')
      setLocation('')
      setPopulation('')
      setMaxCapacity('')
      setCapacitySqm('')
      
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create facility')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div>Loading...</div>

  return (
    <div>
      <PageHeader title="Facilities (Camps & Warehouses)" />
      
      <div className="grid-2">
        <div className="card">
          <h3>Create New Facility</h3>
          {error && <p className="error-text">{error}</p>}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* Facility Details */}
            <div>
              <label>Facility Name</label>
              <input type="text" required value={facName} onChange={e => setFacName(e.target.value)} />
            </div>

            <div>
              <label>Facility Type</label>
              <select value={facType} onChange={e => setFacType(e.target.value)}>
                <option value="CAMP">Relief Camp</option>
                <option value="WAREHOUSE">Warehouse</option>
              </select>
            </div>

            {/* Organization Details (Combined) */}
            <div style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}>
              <h4>Organization Details</h4>
              <div style={{ marginTop: '0.5rem' }}>
                <label>Organization Name</label>
                <input type="text" required value={orgName} onChange={e => setOrgName(e.target.value)} />
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                <label>Organization Type</label>
                <select value={orgType} onChange={e => setOrgType(e.target.value)}>
                  <option value="GOVT">Government</option>
                  <option value="NGO">NGO</option>
                </select>
              </div>
            </div>

            <div>
              <label>Manager (User)</label>
              <select value={managerId} onChange={e => setManagerId(e.target.value)}>
                <option value="">-- None --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.fullName} ({u.role})</option>
                ))}
              </select>
            </div>

            <div>
              <label>Location</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="text" style={{ flex: 1 }} required value={location} onChange={e => setLocation(e.target.value)} />
                <button type="button" className="btn btn-outline" onClick={handleFetchLocation}>📍 Get Location</button>
              </div>
            </div>

            {/* Conditional Fields based on Type */}
            {facType === 'CAMP' && (
              <>
                <div>
                  <label>Current Population</label>
                  <input type="number" required value={population} onChange={e => setPopulation(e.target.value)} />
                </div>
                <div>
                  <label>Max Capacity (People)</label>
                  <input type="number" required value={maxCapacity} onChange={e => setMaxCapacity(e.target.value)} />
                </div>
              </>
            )}

            {facType === 'WAREHOUSE' && (
              <div>
                <label>Capacity (Square Meters)</label>
                <input type="number" required value={capacitySqm} onChange={e => setCapacitySqm(e.target.value)} />
              </div>
            )}

            <button type="submit" disabled={busy}>
              {busy ? 'Creating...' : 'Create Facility & Organization'}
            </button>
          </form>
        </div>

        <div>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Details</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {facilities.map(f => (
                  <tr key={f.id}>
                    <td><strong>{f.name}</strong></td>
                    <td><span className={`pill ${f.type.toLowerCase()}`}>{f.type}</span></td>
                    <td>{f.location || '—'}</td>
                    <td>
                      {f.type === 'CAMP'
                        ? `Pop ${f.population ?? 0} / cap ${f.maxCapacity ?? 0}`
                        : `Capacity ${f.capacitySqm ?? 0} sqm`}
                    </td>
                    <td>{formatDate(f.createdAt)}</td>
                  </tr>
                ))}
                {facilities.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>No facilities found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
