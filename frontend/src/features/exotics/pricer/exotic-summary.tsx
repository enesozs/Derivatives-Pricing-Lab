import { GreekTiles } from '@/components/greek-tiles'
import { Card } from '@/components/ui/card'
import type { ExoticPriceResponse } from '@/lib/api'
import { fixed } from '@/lib/format'
import { cn } from '@/lib/utils'

export function ExoticSummary({
  data,
  stale,
  title,
}: {
  data: ExoticPriceResponse | undefined
  stale: boolean
  title: string
}) {
  const ratio = data?.vanilla_value ? data.value / data.vanilla_value : null
  return (
    <Card className={cn('transition-opacity', stale && 'opacity-60')}>
      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-8">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-muted-foreground text-sm first-letter:uppercase">{title}</p>
            <p className="mt-1 font-semibold text-5xl tracking-tight">
              {data ? fixed(data.value, 4) : '—'}
            </p>
            <p className="mt-1.5 text-muted-foreground text-xs">
              {data ? `${data.value_label} · per unit` : 'Pricing…'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 border-t pt-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground text-xs">Equivalent vanilla</span>
              <span className="font-medium text-sm tabular-nums">
                {fixed(data?.vanilla_value, 4)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground text-xs">Exotic / vanilla</span>
              <span className="font-medium text-sm tabular-nums">
                {ratio == null ? '—' : `${fixed(ratio * 100, 1)}%`}
              </span>
            </div>
          </div>
        </div>
        {data?.greeks ? (
          <GreekTiles greeks={data.greeks} source={data.greeks_label ?? undefined} />
        ) : (
          <div className="flex items-center rounded-xl border border-dashed p-4 text-muted-foreground text-sm">
            {data
              ? 'Greeks are shown under Black–Scholes. Under Heston, "vega" is ambiguous (which variance parameter?) and Monte Carlo bumps would be noisy.'
              : ''}
          </div>
        )}
      </div>
    </Card>
  )
}
