import type { ReactNode } from 'react'

interface Column<T> {
  header: string
  render: (row: T) => ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  keyFn: (row: T) => string
}

export default function DataTable<T>({ columns, rows, keyFn }: DataTableProps<T>) {
  if (rows.length === 0) {
    return <p className="empty-state">No records found.</p>
  }
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.header}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={keyFn(row)}>
              {columns.map((c, i) => (
                <td key={i}>{c.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
