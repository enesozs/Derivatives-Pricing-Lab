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
import type { MethodResult, PriceResponse } from '@/lib/api'
import { fixed, milliseconds, scientific, signed } from '@/lib/format'
import { cn } from '@/lib/utils'
import { GREEKS } from '@/lib/greeks'

const STATUS: Record<
  MethodResult['status'],
  { label: string; variant: 'success' | 'outline' | 'error' }
> = {
  ok: { label: 'Priced', variant: 'success' },
  unsupported: { label: 'Not supported', variant: 'outline' },
  error: { label: 'Failed', variant: 'error' },
}

// Delta, gamma and vega show how differently each method estimates sensitivities.
const SHOWN = GREEKS.filter((g) => ['delta', 'gamma', 'vega'].includes(g.key))

export function MethodsTable({ data, stale }: { data: PriceResponse | undefined; stale: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base" render={<h2 />}>
          Same option, five methods
        </CardTitle>
        <CardDescription>
          Closed form, two binomial trees, a PDE grid and Monte Carlo should agree within their
          numerical error. Monte Carlo gamma uses the likelihood-ratio method, so it is noisier.
          {data && <> Reference: {data.reference_label}.</>}
        </CardDescription>
      </CardHeader>
      <div className={cn('overflow-x-auto px-2 pb-2 transition-opacity', stale && 'opacity-60')}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="ps-4">Method</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead className="text-right">95% interval</TableHead>
              <TableHead className="text-right">Error</TableHead>
              {SHOWN.map((g) => (
                <TableHead key={g.key} className="text-right">
                  {g.symbol} {g.label}
                </TableHead>
              ))}
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
                    <div className="mt-1 max-w-72 whitespace-normal text-muted-foreground text-xs leading-snug">
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
                <TableCell className="text-right tabular-nums">{scientific(m.abs_error)}</TableCell>
                {SHOWN.map((g) => (
                  <TableCell key={g.key} className="text-right text-muted-foreground tabular-nums">
                    {m.greeks ? signed(m.greeks[g.key] * g.scale, 4) : '—'}
                  </TableCell>
                ))}
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
