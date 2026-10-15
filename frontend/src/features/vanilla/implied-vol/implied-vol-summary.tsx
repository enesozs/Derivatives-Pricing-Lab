import { AlertTriangleIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import type { ImpliedVolResponse } from '@/lib/api'
import { fixed, scientific } from '@/lib/format'
import { cn } from '@/lib/utils'

interface ImpliedVolSummaryProps {
  price: number
  data: ImpliedVolResponse | undefined
  stale: boolean
}

/** Where the observed price sits between the no-arbitrage bounds. */
function BoundsBar({ price, lower, upper }: { price: number; lower: number; upper: number }) {
  const position = (price - lower) / (upper - lower)
  const inside = position >= 0 && position < 1
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">No-arbitrage range for the price</span>
        <span
          className={cn(
            'font-medium',
            inside ? 'text-success-foreground' : 'text-destructive-foreground',
          )}
        >
          {inside ? 'Inside' : 'Outside'}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-muted">
        <div
          aria-hidden="true"
          className={cn(
            'absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card',
            inside ? 'bg-primary' : 'bg-destructive',
          )}
          style={{ left: `${Math.min(Math.max(position, 0), 1) * 100}%` }}
        />
      </div>
      <div className="flex justify-between text-muted-foreground text-xs tabular-nums">
        <span>{fixed(lower, 2)} · zero vol</span>
        <span>{fixed(upper, 2)} · infinite vol</span>
      </div>
    </div>
  )
}

export function ImpliedVolSummary({ price, data, stale }: ImpliedVolSummaryProps) {
  const iv = data?.implied_vol
  return (
    <Card className={cn('transition-opacity', stale && 'opacity-60')}>
      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-8">
        <div>
          <p className="text-muted-foreground text-sm">Implied volatility</p>
          <p className="mt-1 font-semibold text-5xl tracking-tight">
            {iv == null ? '—' : `${fixed(iv * 100, 2)}%`}
          </p>
          <p className="mt-1.5 text-muted-foreground text-xs">
            {data
              ? iv == null
                ? `No solution with ${data.engine_label}`
                : `${data.engine_label} · ${data.iterations} Brent iterations · residual ${scientific(data.residual)}`
              : 'Solving…'}
          </p>
        </div>
        <div className="flex flex-col justify-center gap-4">
          {data && <BoundsBar price={price} lower={data.price_lower} upper={data.price_upper} />}
          {data?.message && (
            <Alert variant="warning">
              <AlertTriangleIcon />
              <AlertTitle>No implied volatility for this price</AlertTitle>
              <AlertDescription>{data.message}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </Card>
  )
}
