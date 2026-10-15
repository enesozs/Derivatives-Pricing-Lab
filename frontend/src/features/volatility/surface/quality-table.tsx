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
import type { SurfaceResponse } from '@/lib/api'
import { fixed } from '@/lib/format'
import { cn } from '@/lib/utils'
import { expiryLabel } from '../format'

export function QualityTable({
  data,
  stale,
}: {
  data: SurfaceResponse | undefined
  stale: boolean
}) {
  const calendar = new Set(data?.calendar_violations.map((v) => v.t_long) ?? [])
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base" render={<h2 />}>
          From raw quotes to a smile
        </CardTitle>
        <CardDescription>
          What cleaning kept and why the rest was dropped, the forward implied by put–call parity,
          and how well SVI fits each expiry. Arbitrage checks: butterfly (within an expiry) and
          calendar (against the previous expiry).
        </CardDescription>
        <ChartGuide heading="From raw quotes to a smile" noun="table" />
      </CardHeader>
      <div className={cn('overflow-x-auto px-2 pb-2 transition-opacity', stale && 'opacity-60')}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="ps-4">Expiry</TableHead>
              <TableHead className="text-right">Years</TableHead>
              <TableHead className="text-right">Forward</TableHead>
              <TableHead className="text-right">Quotes used</TableHead>
              <TableHead>Dropped</TableHead>
              <TableHead className="text-right">ATM vol</TableHead>
              <TableHead className="text-right">SVI error</TableHead>
              <TableHead className="pe-4 text-right">Arbitrage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.slices ?? []).map((s) => {
              const dropped = Object.entries(s.dropped).sort((a, b) => b[1] - a[1])
              const flags = [
                s.svi.butterfly_violations ? 'butterfly' : null,
                calendar.has(s.t) ? 'calendar' : null,
              ].filter(Boolean)
              return (
                <TableRow key={s.expiry}>
                  <TableCell className="ps-4 font-medium">{expiryLabel(s.expiry)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fixed(s.t, 3)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fixed(s.forward, 2)}
                    {s.forward_method === 'fallback' && (
                      <span className="text-muted-foreground text-xs"> (assumed)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{s.points.length}</TableCell>
                  <TableCell className="max-w-72 whitespace-normal text-muted-foreground text-xs">
                    {dropped.length
                      ? dropped.map(([reason, n]) => `${n} ${reason}`).join(' · ')
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fixed(s.atm_vol * 100, 2)}%
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fixed(s.svi.rmse * 100, 2)} pts
                  </TableCell>
                  <TableCell className="pe-4 text-right">
                    {flags.length ? (
                      <Badge variant="warning">{flags.join(' + ')}</Badge>
                    ) : (
                      <Badge variant="success">None</Badge>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  )
}
