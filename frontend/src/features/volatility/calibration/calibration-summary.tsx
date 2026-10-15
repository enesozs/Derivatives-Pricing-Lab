import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { CalibrationResponse } from '@/lib/api'
import { fixed, milliseconds } from '@/lib/format'
import { cn } from '@/lib/utils'
import { maturityLabel } from '../format'

const HESTON_ROWS = [
  {
    key: 'v0',
    label: 'Initial variance v₀',
    note: (v: number) => `≈ ${fixed(Math.sqrt(v) * 100, 1)}% vol today`,
  },
  {
    key: 'theta',
    label: 'Long-run variance θ',
    note: (v: number) => `≈ ${fixed(Math.sqrt(v) * 100, 1)}% vol long term`,
  },
  {
    key: 'kappa',
    label: 'Mean reversion κ',
    note: (v: number) => `half-life ${fixed(Math.log(2) / v, 2)} years`,
  },
  { key: 'xi', label: 'Vol of variance ξ', note: () => 'smile curvature' },
  {
    key: 'rho',
    label: 'Correlation ρ',
    note: (v: number) => (v < 0 ? 'negative: equity-style skew' : 'positive skew'),
  },
]

export function CalibrationSummary({
  data,
  stale,
}: {
  data: CalibrationResponse | undefined
  stale: boolean
}) {
  return (
    <Card className={cn('transition-opacity', stale && 'opacity-60')}>
      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-8">
        <div>
          <p className="text-muted-foreground text-sm">Fit error (RMSE)</p>
          <p className="mt-1 font-semibold text-5xl tracking-tight">
            {data ? fixed(data.rmse * 100, 2) : '—'}
          </p>
          <p className="mt-1.5 text-muted-foreground text-xs">
            {data
              ? `vol points across ${data.slices.reduce((n, s) => n + s.market_vol.length, 0)} quotes · ${milliseconds(data.runtime_ms)}`
              : 'Calibrating…'}
          </p>
          {data?.feller_satisfied != null && (
            <div className="mt-4">
              <Badge variant={data.feller_satisfied ? 'success' : 'warning'}>
                Feller condition {data.feller_satisfied ? 'holds' : 'violated'}
              </Badge>
              <p className="mt-1.5 text-muted-foreground text-xs">
                {data.feller_satisfied
                  ? 'Variance can never reach zero.'
                  : 'Variance can touch zero. Common for fitted equity parameters; fine for Fourier pricing, harder for simulation.'}
              </p>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          {data?.model === 'heston' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parameter</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead>Meaning</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {HESTON_ROWS.map((row) => {
                  const value = data.parameters[0][row.key]
                  return (
                    <TableRow key={row.key}>
                      <TableCell className="font-medium">{row.label}</TableCell>
                      <TableCell className="text-right tabular-nums">{fixed(value, 4)}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {row.note(value)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : data ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Expiry</TableHead>
                  <TableHead className="text-right">Level α</TableHead>
                  <TableHead className="text-right">Skew ρ</TableHead>
                  <TableHead className="text-right">Vol of vol ν</TableHead>
                  <TableHead className="text-right">Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.parameters.map((p, i) => (
                  <TableRow key={data.slices[i].expiry}>
                    <TableCell className="font-medium">{maturityLabel(data.slices[i].t)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fixed(p.alpha, 4)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fixed(p.rho, 3)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fixed(p.nu, 3)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fixed(data.slices[i].rmse * 100, 2)} pts
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="h-48" />
          )}
        </div>
      </div>
    </Card>
  )
}
