import EntityList, { type FormField } from '../components/EntityList'
import { formatDate } from '../utils/format'
import type { Organization } from '../api/types'

const FIELDS: FormField[] = [
  { name: 'name', label: 'Name', required: true },
  {
    name: 'type',
    label: 'Type',
    type: 'select',
    options: [
      { value: 'GOVT', label: 'Government' },
      { value: 'NGO', label: 'NGO' },
    ],
    required: true,
  },
  { name: 'contactInfo', label: 'Contact info' },
]

export default function OrganizationsPage() {
  return (
    <EntityList<Organization>
      title="Organizations"
      basePath="/organizations"
      fields={FIELDS}
      emptyCreate={{ type: 'NGO' }}
      columns={[
        { header: 'Name', render: (o) => <strong>{o.name}</strong> },
        { header: 'Type', render: (o) => <span className={`pill ${o.type.toLowerCase()}`}>{o.type}</span> },
        { header: 'Contact', render: (o) => o.contactInfo || '—' },
        { header: 'CID', render: (o) => (o.cid ? <code className="cid">{o.cid.slice(0, 14)}...</code> : '—') },
        { header: 'Created', render: (o) => formatDate(o.createdAt) },
      ]}
      keyFn={(o) => o.id}
    />
  )
}
