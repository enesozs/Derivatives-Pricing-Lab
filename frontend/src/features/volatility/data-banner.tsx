import { DatabaseIcon, FlaskConicalIcon, RadioIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { SurfaceResponse } from '@/lib/api'
import { fixed } from '@/lib/format'

const dateTime = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/New_York',
})

/** States exactly what data the charts are built from. Synthetic data is always labelled. */
export function DataBanner({ meta }: { meta: SurfaceResponse['meta'] | undefined }) {
  if (!meta) return <div className="h-14 rounded-xl border border-dashed" />
  const Icon = meta.synthetic ? FlaskConicalIcon : meta.source === 'live' ? RadioIcon : DatabaseIcon
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-card px-4 py-3 text-sm">
      <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      <span className="font-semibold">{meta.ticker}</span>
      <span className="text-muted-foreground">
        spot <span className="font-medium text-foreground tabular-nums">{fixed(meta.spot, 2)}</span>
      </span>
      <span className="text-muted-foreground">
        as of {dateTime.format(new Date(meta.as_of))} New York
      </span>
      {meta.synthetic ? (
        <Badge variant="warning">Synthetic data</Badge>
      ) : (
        <Badge variant="outline">{meta.source === 'live' ? 'Live' : 'Snapshot'}</Badge>
      )}
      {meta.price_basis !== 'mid' && (
        <Badge variant="info">
          {meta.price_basis === 'last' ? 'Last-trade prices' : 'Mix of mid and last-trade prices'}
        </Badge>
      )}
      <span className="w-full text-muted-foreground text-xs sm:ms-auto sm:w-auto">
        {meta.description}
      </span>
    </div>
  )
}
