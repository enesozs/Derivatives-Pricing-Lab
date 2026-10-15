import { Card } from '@/components/ui/card'
import type { HedgeResponse } from '@/lib/api'
import { fixed, signed } from '@/lib/format'
import { cn } from '@/lib/utils'

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5 bg-card p-3.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-semibold text-lg tracking-tight">{value}</span>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  )
}

export function HedgingSummary({
  data,
  stale,
}: {
  data: HedgeResponse | undefined
  stale: boolean
}) {
  return (
    <Card className={cn('transition-opacity', stale && 'opacity-60')}>
      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-8">
        <div>
          <p className="text-muted-foreground text-sm">Hedging error (std of P&L)</p>
          <p className="mt-1 font-semibold text-5xl tracking-tight">
            {data ? fixed(data.hedged.std, 3) : '—'}
          </p>
          <p className="mt-1.5 text-muted-foreground text-xs">
            {data
              ? `Theory (Derman–Kamal): ${fixed(data.approx_std, 3)} · unhedged: ${fixed(data.unhedged.std, 2)}`
              : 'Simulating…'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-px self-start overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
          <Stat
            label="Mean hedged P&L"
            value={data ? signed(data.hedged.mean, 3) : '—'}
            hint="≈ 0 if volatilities match"
          />
          <Stat
            label="5% – 95% range"
            value={data ? `${fixed(data.hedged.p05, 2)} … ${fixed(data.hedged.p95, 2)}` : '—'}
            hint="Hedged P&L"
          />
          <Stat
            label="Trading costs"
            value={data ? fixed(data.mean_cost, 3) : '—'}
            hint="Average per path"
          />
          <Stat
            label="Premium"
            value={data ? fixed(data.premium, 3) : '—'}
            hint="At the hedger's volatility"
          />
        </div>
      </div>
    </Card>
  )
}
