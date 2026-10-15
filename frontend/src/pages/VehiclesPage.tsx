import { useEffect, useState } from 'react'
import EntityList, { type FormField } from '../components/EntityList'
import type { Organization, Vehicle } from '../api/types'
import { api } from '../api/client'

export default function VehiclesPage() {
  const [orgs, setOrgs] = useState<Organization[]>([])

  useEffect(() => {
    api
      .get<Organization[]>('/organizations')
      .then(setOrgs)
      .catch(() => {})
  }, [])

  const fields: FormField[] = [
    {
      name: 'organizationId',
      label: 'Organization',
      type: 'select',
      options: orgs.map((o) => ({ value: o.id, label: o.name })),
      required: true,
    },
    { name: 'registrationNumber', label: 'Registration number', required: true },
    { name: 'driverName', label: 'Vehicle Incharge / Driver Name', required: true },
    { name: 'driverId', label: 'Driver ID / Incharge ID', required: true },
    { name: 'vehicleType', label: 'Vehicle type' },
    { name: 'capacityKg', label: 'Capacity (kg)', type: 'number' },
  ]

  return (
    <EntityList<Vehicle>
      title="Vehicles"
      basePath="/vehicles"
      fields={fields}
      emptyCreate={{ active: true }}
      columns={[
        { header: 'Registration', render: (v) => <strong>{v.registrationNumber}</strong> },
        { header: 'Incharge (Driver)', render: (v) => v.driverName || '—' },
        { header: 'Driver ID', render: (v) => (v.driverId ? <code>{v.driverId}</code> : '—') },
        { header: 'Type', render: (v) => v.vehicleType || '—' },
        { header: 'Capacity', render: (v) => (v.capacityKg ? `${v.capacityKg} kg` : '—') },
        { header: 'Organization', render: (v) => orgs.find((o) => o.id === v.organizationId)?.name ?? '—' },
        { header: 'Active', render: (v) => (v.active ? <span className="pill ok">Active</span> : <span className="pill">Inactive</span>) },
      ]}
      keyFn={(v) => v.id}
    />
  )
}
