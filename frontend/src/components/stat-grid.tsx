import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5 bg-card p-3.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-semibold text-lg tracking-tight tabular-nums">{value}</span>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  )
}

/** Hairline-separated tiles; pass the column classes for the breakpoints you need. */
export function StatGrid({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('grid gap-px overflow-hidden rounded-xl border bg-border', className)}>
      {children}
    </div>
  )
}
