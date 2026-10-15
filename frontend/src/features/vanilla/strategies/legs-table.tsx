import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Greeks, StrategyResponse } from '@/lib/api'
import { fixed, signed } from '@/lib/format'
import { cn } from '@/lib/utils'
import { GREEKS } from '@/lib/greeks'
import { describeLeg, type StrategyParams } from './params'

interface LegsTableProps {
  params: StrategyParams
  data: StrategyResponse | undefined
  stale: boolean
}

function scaled(greeks: Greeks | null, quantity: number) {
  return GREEKS.map((g) => (greeks ? signed(greeks[g.key] * quantity * g.scale, 3) : '—'))
}

export function LegsTable({ params, data, stale }: LegsTableProps) {
  // Responses can lag the editor by a debounce; only show rows once they line up.
  const rows = data && data.legs.length === params.legs.length ? data.legs : []
  const stock = params.underlying

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base" render={<h2 />}>
          Legs
        </CardTitle>
        <CardDescription>
          Unit price per option; value and Greeks scaled by position size and side.
        </CardDescription>
      </CardHeader>
      <div className={cn('overflow-x-auto px-2 pb-2 transition-opacity', stale && 'opacity-60')}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="ps-4">Position</TableHead>
              <TableHead className="text-right">Unit price</TableHead>
              <TableHead className="text-right">Value</TableHead>
              {GREEKS.map((g) => (
                <TableHead key={g.key} className="text-right last:pe-4">
                  {g.symbol} {g.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => {
              const leg = params.legs[i]
              const qty = leg.side === 'long' ? leg.quantity : -leg.quantity
              return (
                <TableRow key={leg.id}>
                  <TableCell className="ps-4 font-medium">{describeLeg(leg)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fixed(r.unit_value, 4)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {signed(r.position_value, 4)}
                  </TableCell>
                  {scaled(r.greeks, qty).map((v, j) => (
                    <TableCell
                      key={GREEKS[j].key}
                      className="text-right text-muted-foreground tabular-nums last:pe-4"
                    >
                      {v}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })}
            {stock !== 0 && rows.length > 0 && (
              <TableRow>
                <TableCell className="ps-4 font-medium">
                  {stock > 0 ? 'Long' : 'Short'} {Math.abs(stock)} × underlying
                </TableCell>
                <TableCell className="text-right tabular-nums">{fixed(params.spot, 4)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {signed(stock * params.spot, 4)}
                </TableCell>
                {scaled({ delta: 1, gamma: 0, vega: 0, theta: 0, rho: 0 }, stock).map((v, j) => (
                  <TableCell
                    key={GREEKS[j].key}
                    className="text-right text-muted-foreground tabular-nums last:pe-4"
                  >
                    {v}
                  </TableCell>
                ))}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  )
}
