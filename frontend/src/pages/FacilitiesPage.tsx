import { useEffect, useState } from 'react'
import EntityList, { type FormField } from '../components/EntityList'
import { formatDate } from '../utils/format'
import type { Facility, Organization } from '../api/types'
import { api } from '../api/client'

export default function FacilitiesPage() {
  const [orgs, setOrgs] = useState<Organization[]>([])

  useEffect(() => {
    api
      .get<Organization[]>('/organizations')
      .then(setOrgs)
      .catch(() => {})
  }, [])

  const fields: FormField[] = [
    { name: 'name', label: 'Name', required: true },
    {
      name: 'type',
      label: 'Type',
      type: 'select',
      options: [
        { value: 'WAREHOUSE', label: 'Warehouse' },
        { value: 'CAMP', label: 'Camp' },
      ],
      required: true,
    },
    {
      name: 'organizationId',
      label: 'Organization',
      type: 'select',
      options: orgs.map((o) => ({ value: o.id, label: o.name })),
      required: true,
    },
    { name: 'location', label: 'Location' },
    { name: 'population', label: 'Population', type: 'number' },
    { name: 'maxCapacity', label: 'Max capacity', type: 'number' },
    { name: 'capacitySqm', label: 'Capacity (sqm)', type: 'number' },
  ]

  return (
    <EntityList<Facility>
      title="Facilities"
      basePath="/facilities"
      fields={fields}
      emptyCreate={{ type: 'CAMP' }}
      columns={[
        { header: 'Name', render: (f) => <strong>{f.name}</strong> },
        { header: 'Type', render: (f) => <span className={`pill ${f.type.toLowerCase()}`}>{f.type}</span> },
        { header: 'Location', render: (f) => f.location || '—' },
        {
          header: 'Details',
          render: (f) =>
            f.type === 'CAMP'
              ? `Pop ${f.population ?? 0} / cap ${f.maxCapacity ?? 0}`
              : `Capacity ${f.capacitySqm ?? 0} sqm`,
        },
        { header: 'Created', render: (f) => formatDate(f.createdAt) },
      ]}
      keyFn={(f) => f.id}
    />
  )
}
