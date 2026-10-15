import { ChartGuide } from '@/components/chart-guide'
import { Badge } from '@/components/ui/badge'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ExoticPriceResponse } from '@/lib/api'
import { fixed, milliseconds } from '@/lib/format'
import { cn } from '@/lib/utils'

const STATUS = {
  ok: { label: 'Priced', variant: 'success' },
  unsupported: { label: 'Not available', variant: 'outline' },
  error: { label: 'Failed', variant: 'error' },
} as const

export function ExoticMethods({
  data,
  stale,
}: {
  data: ExoticPriceResponse | undefined
  stale: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base" render={<h2 />}>
          Which methods can price it
        </CardTitle>
        <CardDescription>
          Closed forms exist only for some exotics and only under Black–Scholes; the PDE handles
          continuous barriers; Monte Carlo prices everything, under any model, at the cost of noise.
        </CardDescription>
        <ChartGuide heading="Which methods can price it" noun="table" />
      </CardHeader>
      <div className={cn('overflow-x-auto px-2 pb-2 transition-opacity', stale && 'opacity-60')}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="ps-4">Method</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead className="text-right">95% interval</TableHead>
              <TableHead className="text-right">Runtime</TableHead>
              <TableHead className="pe-4 text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.methods ?? []).map((m) => (
              <TableRow key={m.method}>
                <TableCell className="ps-4">
                  <div className="font-medium">{m.label}</div>
                  {m.note && (
                    <div className="mt-1 max-w-96 whitespace-normal text-muted-foreground text-xs leading-snug">
                      {m.note}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {fixed(m.value, 4)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground tabular-nums">
                  {m.ci_low == null ? '—' : `${fixed(m.ci_low, 3)} – ${fixed(m.ci_high, 3)}`}
                </TableCell>
                <TableCell className="text-right text-muted-foreground tabular-nums">
                  {milliseconds(m.runtime_ms)}
                </TableCell>
                <TableCell className="pe-4 text-right">
                  <Badge variant={STATUS[m.status].variant}>{STATUS[m.status].label}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  )
}
