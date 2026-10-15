import { InfoIcon } from 'lucide-react'
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip'
import type { Greeks } from '@/lib/api'
import { signed } from '@/lib/format'
import { GREEKS } from '@/lib/greeks'

interface GreekTilesProps {
  greeks: Greeks | null | undefined
  /** Where the numbers come from, e.g. "Analytic". */
  source?: string
  title?: string
}

/** Five Greek stat tiles in market-convention units, each with an explanation on hover/focus. */
export function GreekTiles({ greeks, source, title = 'Greeks' }: GreekTilesProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold text-sm">{title}</h2>
        <span className="text-muted-foreground text-xs">{source ?? ''}</span>
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-5">
        {GREEKS.map((g) => {
          const raw = greeks?.[g.key]
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
    </div>
  )
}
