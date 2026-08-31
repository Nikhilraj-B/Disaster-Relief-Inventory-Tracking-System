import { useEffect, useState } from 'react'
import EntityList, { type FormField } from '../components/EntityList'
import { formatDate } from '../utils/format'
import type { Facility, InventoryItem, ReliefItem } from '../api/types'
import { api } from '../api/client'

export default function InventoryPage() {
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [items, setItems] = useState<ReliefItem[]>([])

  useEffect(() => {
    Promise.all([api.get<Facility[]>('/facilities'), api.get<ReliefItem[]>('/relief-items')])
      .then(([f, i]) => {
        setFacilities(f)
        setItems(i)
      })
      .catch(() => {})
  }, [])

  const fields: FormField[] = [
    {
      name: 'facilityId',
      label: 'Facility',
      type: 'select',
      options: facilities.map((f) => ({ value: f.id, label: f.name })),
      required: true,
    },
    {
      name: 'reliefItemId',
      label: 'Relief item',
      type: 'select',
      options: items.map((i) => ({ value: i.id, label: i.name })),
      required: true,
    },
    { name: 'quantity', label: 'Quantity', type: 'number', required: true },
  ]

  return (
    <EntityList<InventoryItem>
      title="Inventory"
      basePath="/inventory"
      fields={fields}
      emptyCreate={{ quantity: 0, reservedQuantity: 0 }}
      canDelete
      columns={[
        { header: 'Facility', render: (inv) => facilities.find((f) => f.id === inv.facilityId)?.name ?? inv.facilityId.slice(0, 8) },
        { header: 'Item', render: (inv) => items.find((i) => i.id === inv.reliefItemId)?.name ?? inv.reliefItemId.slice(0, 8) },
        { header: 'Quantity', render: (inv) => inv.quantity },
        { header: 'Reserved', render: (inv) => inv.reservedQuantity },
        { header: 'Updated', render: (inv) => formatDate(inv.updatedAt) },
      ]}
      keyFn={(inv) => inv.id}
    />
  )
}
