import type { ReactNode } from 'react'
import { Card, CardDescription, CardHeader, CardPanel, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ChartCardProps {
  title: string
  description: ReactNode
  action?: ReactNode
  /** Previous render stays visible at reduced opacity while new data loads. */
  stale?: boolean
  children: ReactNode
}

export function ChartCard({ title, description, action, stale, children }: ChartCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base" render={<h2 />}>
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {action}
      </CardHeader>
      <CardPanel className={cn('pt-0 transition-opacity', stale && 'opacity-60')}>
        {children}
      </CardPanel>
    </Card>
  )
}

/** Legend entry: a short line key in the series colour, text in ink (never in the series colour). */
export function LegendKey({
  color,
  label,
  band,
}: {
  color: string
  label: string
  band?: boolean
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground text-xs">
      <span
        aria-hidden="true"
        className={band ? 'h-2.5 w-3 rounded-sm' : 'h-0.5 w-3 rounded-full'}
        style={{ background: color }}
      />
      {label}
    </span>
  )
}
