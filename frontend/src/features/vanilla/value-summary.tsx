import { InfoIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip'
import type { PriceResponse } from '@/lib/api'
import { fixed, signed } from '@/lib/format'
import { cn } from '@/lib/utils'
import { GREEKS, type VanillaParams } from './params'

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
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold text-sm">Greeks</h2>
            <span className="text-muted-foreground text-xs">{data?.greeks_label ?? ''}</span>
          </div>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-5">
            {GREEKS.map((g) => {
              const raw = data?.greeks?.[g.key]
              return (
                <div key={g.key} className="flex flex-col gap-1 bg-card p-3.5">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          className="flex w-fit cursor-help items-center gap-1 text-muted-foreground text-xs outline-none focus-visible:text-foreground"
                        />
                      }
                    >
                      <span className="font-mono">{g.symbol}</span> {g.label}
                      <InfoIcon className="size-3 opacity-60" aria-hidden="true" />
                    </TooltipTrigger>
                    <TooltipPopup className="max-w-60">{g.description}</TooltipPopup>
                  </Tooltip>
                  <span className="font-semibold text-xl tracking-tight">
                    {raw == null ? '—' : signed(raw * g.scale, 4)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{g.unit}</span>
                </div>
              )
            })}
          </div>
          {data && !data.greeks && (
            <p className="text-muted-foreground text-xs">Greeks are undefined for these inputs.</p>
          )}
        </div>
      </div>
    </Card>
  )
}
