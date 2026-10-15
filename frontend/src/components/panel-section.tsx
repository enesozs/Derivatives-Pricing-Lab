import type { ReactNode } from 'react'

/** A titled group of controls inside a parameter panel card. */
export function PanelSection({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-4 px-5 py-5">
      <header>
        <h2 className="font-semibold text-sm">{title}</h2>
        {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
      </header>
      {children}
    </section>
  )
}
