import EntityList, { type FormField } from '../components/EntityList'
import { formatDate } from '../utils/format'
import type { ReliefItem } from '../api/types'

const FIELDS: FormField[] = [
  { name: 'name', label: 'Name', required: true },
  {
    name: 'category',
    label: 'Category',
    type: 'select',
    options: ['FOOD', 'MEDICINE', 'WATER', 'EQUIPMENT', 'SHELTER', 'CLOTHING', 'OTHER'].map((c) => ({
      value: c,
      label: c,
    })),
    required: true,
  },
  { name: 'unit', label: 'Unit' },
  { name: 'description', label: 'Description', type: 'textarea' },
]

export default function ReliefItemsPage() {
  return (
    <EntityList<ReliefItem>
      title="Relief Items"
      basePath="/relief-items"
      fields={FIELDS}
      emptyCreate={{ category: 'FOOD' }}
      canDelete
      columns={[
        { header: 'Name', render: (i) => <strong>{i.name}</strong> },
        { header: 'Category', render: (i) => <span className={`pill cat-${i.category.toLowerCase()}`}>{i.category}</span> },
        { header: 'Unit', render: (i) => i.unit || '—' },
        { header: 'Description', render: (i) => i.description || '—' },
        { header: 'Created', render: (i) => formatDate(i.createdAt) },
      ]}
      keyFn={(i) => i.id}
    />
  )
}
