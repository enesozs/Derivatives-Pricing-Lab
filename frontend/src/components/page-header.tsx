import type { ReactNode } from 'react'

export function PageHeader({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-1">
      <h1 className="font-semibold text-2xl tracking-tight">{title}</h1>
      <p className="max-w-3xl text-muted-foreground text-sm">{children}</p>
    </div>
  )
}
