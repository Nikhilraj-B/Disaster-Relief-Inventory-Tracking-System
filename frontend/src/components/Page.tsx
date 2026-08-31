import type { ReactNode } from 'react'

export function Loading({ text = 'Loading...' }: { text?: string }) {
  return <p className="muted">{text}</p>
}

export function ErrorBanner({ message }: { message: string }) {
  return <div className="error-banner">{message}</div>
}

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="page-header">
      <h2>{title}</h2>
      {action}
    </div>
  )
}
