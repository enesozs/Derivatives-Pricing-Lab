import { Card } from '@/components/ui/card'
import type { PriceResponse } from '@/lib/api'
import { fixed } from '@/lib/format'
import { cn } from '@/lib/utils'
import { GreekTiles } from '../greek-tiles'
import type { VanillaParams } from './params'

interface ValueSummaryProps {
  params: VanillaParams
  data: PriceResponse | undefined
  stale: boolean
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-medium text-sm tabular-nums">{value}</span>
    </div>
  )
}

export function ValueSummary({ params, data, stale }: ValueSummaryProps) {
  const intrinsic = Math.max((params.kind === 'call' ? 1 : -1) * (params.spot - params.strike), 0)
  const value = data?.reference
  const style = params.exercise === 'european' ? 'European' : 'American'

  return (
    <Card className={cn('transition-opacity', stale && 'opacity-60')}>
      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-8">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-muted-foreground text-sm">
              {style} {params.kind} value
            </p>
            <p className="mt-1 font-semibold text-5xl tracking-tight">{fixed(value, 4)}</p>
            <p className="mt-1.5 text-muted-foreground text-xs">
              {data ? data.reference_label : 'Pricing…'} · per unit of underlying
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 border-t pt-4">
            <MiniStat label="Intrinsic" value={fixed(intrinsic, 2)} />
            <MiniStat
              label="Time value"
              value={value == null ? '—' : fixed(value - intrinsic, 2)}
            />
            <MiniStat label="Spot / strike" value={fixed(params.spot / params.strike, 3)} />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <GreekTiles greeks={data?.greeks} source={data?.greeks_label} />
          {data && !data.greeks && (
            <p className="text-muted-foreground text-xs">Greeks are undefined for these inputs.</p>
          )}
        </div>
      </div>
    </Card>
  )
}
