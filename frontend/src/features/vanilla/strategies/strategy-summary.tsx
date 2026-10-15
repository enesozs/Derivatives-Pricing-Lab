import { Card } from '@/components/ui/card'
import type { StrategyResponse } from '@/lib/api'
import { fixed, signed } from '@/lib/format'
import { cn } from '@/lib/utils'
import { GreekTiles } from '@/components/greek-tiles'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-medium text-sm tabular-nums">{value}</span>
    </div>
  )
}

const bound = (v: number | null | undefined) => (v === null ? 'Unlimited' : signed(v, 2))

export function StrategySummary({
  data,
  stale,
}: {
  data: StrategyResponse | undefined
  stale: boolean
}) {
  const debit = (data?.net_value ?? 0) >= 0
  const breakevens = data?.breakevens.length
    ? data.breakevens.map((b) => fixed(b, 2)).join(' · ')
    : 'None'

  return (
    <Card className={cn('transition-opacity', stale && 'opacity-60')}>
      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-8">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-muted-foreground text-sm">{debit ? 'Net debit' : 'Net credit'}</p>
            <p className="mt-1 font-semibold text-5xl tracking-tight">
              {data ? fixed(Math.abs(data.net_value), 2) : '—'}
            </p>
            <p className="mt-1.5 text-muted-foreground text-xs">
              {data ? `${debit ? 'Paid' : 'Received'} to open · ${data.engine_label}` : 'Pricing…'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 border-t pt-4">
            <Stat label="Max profit" value={data ? bound(data.max_profit) : '—'} />
            <Stat label="Max loss" value={data ? bound(data.max_loss) : '—'} />
            <Stat label="Breakevens at horizon" value={data ? breakevens : '—'} />
            <Stat label="Horizon" value={data ? `${fixed(data.horizon, 2)} yrs` : '—'} />
          </div>
        </div>
        <GreekTiles greeks={data?.greeks} source="Whole position" title="Position Greeks" />
      </div>
    </Card>
  )
}
