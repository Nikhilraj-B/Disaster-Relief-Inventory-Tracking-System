import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { api } from '../api/client'
import { Loading, ErrorBanner, PageHeader } from './Page'

export interface FormField {
  name: string
  label: string
  type?: 'text' | 'number' | 'select' | 'textarea'
  options?: { value: string; label: string }[]
  required?: boolean
  placeholder?: string
}

interface EntityListProps<T> {
  title: string
  basePath: string
  columns: { header: string; render: (row: T) => ReactNode }[]
  keyFn: (row: T) => string
  canCreate?: boolean
  canDelete?: boolean
  fields?: FormField[]
  emptyCreate?: Record<string, unknown>
}

export default function EntityList<T>({
  title,
  basePath,
  columns,
  keyFn,
  canCreate = true,
  canDelete = false,
  fields = [],
  emptyCreate = {},
}: EntityListProps<T>) {
  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Record<string, unknown>>(emptyCreate)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setRows(await api.get<T[]>(basePath))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basePath])

  const openForm = () => {
    setForm({ ...emptyCreate })
    setShowForm(true)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.post<T>(basePath, form)
      setShowForm(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    try {
      await api.delete<void>(`${basePath}/${id}`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const setValue = (name: string, raw: string) => {
    const field = fields.find((f) => f.name === name)
    const isNumber = field?.type === 'number'
    setForm((prev) => ({ ...prev, [name]: isNumber ? Number(raw) : raw }))
  }

  return (
    <div>
      <PageHeader
        title={title}
        action={
          canCreate && (
            <button className="btn btn-primary" onClick={openForm}>
              + New
            </button>
          )
        }
      />
      {error && <ErrorBanner message={error} />}

      {showForm && (
        <form className="card form" onSubmit={submit}>
          <h3>Create {title.toLowerCase().replace(/s$/, '')}</h3>
          {fields.map((field) => (
            <label key={field.name}>
              {field.label}
              {field.type === 'select' ? (
                <select
                  value={(form[field.name] as string) ?? ''}
                  onChange={(e) => setValue(field.name, e.target.value)}
                  required={field.required}
                >
                  <option value="">
                    {field.options && field.options.length === 0
                      ? `No ${field.label.toLowerCase()} available`
                      : `-- Select ${field.label} --`}
                  </option>
                  {field.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type ?? 'text'}
                  value={(form[field.name] as string) ?? ''}
                  onChange={(e) => setValue(field.name, e.target.value)}
                  required={field.required}
                  placeholder={field.placeholder}
                />
              )}
            </label>
          ))}
          <div className="form-actions">
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving...' : 'Save'}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <Loading />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.header}>{c.header}</th>
                ))}
                {canDelete && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={keyFn(row)}>
                  {columns.map((c, i) => (
                    <td key={i}>{c.render(row)}</td>
                  ))}
                  {canDelete && (
                    <td>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(keyFn(row))}>
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length + (canDelete ? 1 : 0)} className="empty-state">
                    No records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
