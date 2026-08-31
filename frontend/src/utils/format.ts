export function roleLabel(role: string): string {
  const map: Record<string, string> = {
    GOVERNMENT_ADMIN: 'Government Admin',
    WAREHOUSE_MANAGER: 'Warehouse Manager',
    CAMP_MANAGER: 'Camp Manager',
    NGO_COORDINATOR: 'NGO Coordinator',
    TRANSPORT_OFFICER: 'Transport Officer',
  }
  return map[role] ?? role
}

export function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

export function formatDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString()
}

export function shortId(id?: string): string {
  if (!id) return '—'
  return id.slice(0, 8)
}
