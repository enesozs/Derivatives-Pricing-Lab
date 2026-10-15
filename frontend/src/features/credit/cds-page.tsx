import { ChartGuide } from '@/components/chart-guide'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertTriangleIcon, PlusIcon, XIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { LinesChart } from '@/components/charts/simple-charts'
import { useChartColors } from '@/components/charts/theme'
import { NumberInput } from '@/components/number-input'
import { PageHeader } from '@/components/page-header'
import { PanelSection } from '@/components/panel-section'
import { ParamControl } from '@/components/param-control'
import { Segmented } from '@/components/segmented'
import { Stat, StatGrid } from '@/components/stat-grid'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { api, type CDSQuoteIn, type CDSRequest } from '@/lib/api'
import { fixed, money, scientific } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Illustrative investment-grade issuer (not live data); mirrors the backend sample. */
const SAMPLE: CDSQuoteIn[] = [
  { maturity: 1, spread: 0.006 },
  { maturity: 2, spread: 0.0075 },
  { maturity: 3, spread: 0.009 },
  { maturity: 5, spread: 0.0115 },
  { maturity: 7, spread: 0.013 },
  { maturity: 10, spread: 0.014 },
]

const NOTIONAL = 10_000_000
const bp = (v: number, digits = 0) => `${fixed(v * 1e4, digits)}bp`
const pct = (v: number, digits = 2) => `${fixed(v * 100, digits)}%`

export default function CdsPage() {
  const c = useChartColors()
  const [quotes, setQuotes] = useState(SAMPLE)
  const [recoveryPct, setRecoveryPct] = useState(40)
  const [ratePct, setRatePct] = useState(3)
  const [maturity, setMaturity] = useState(5)
  const [couponBp, setCouponBp] = useState(100)
  const inputs = useMemo(
    () => ({ quotes, recoveryPct, ratePct, maturity, couponBp }),
    [quotes, recoveryPct, ratePct, maturity, couponBp],
  )
  const settled = useDebouncedValue(inputs, 200)
  const request = useMemo<CDSRequest>(
    () => ({
      rate: settled.ratePct / 100,
      recovery: settled.recoveryPct / 100,
      quotes: settled.quotes,
      maturity: settled.maturity,
      coupon: settled.couponBp / 1e4,
      notional: NOTIONAL,
    }),
    [settled],
  )
  const query = useQuery({
    queryKey: ['credit', 'cds', request],
    queryFn: ({ signal }) => api.cds(request, signal),
    placeholderData: keepPreviousData,
  })
  const data = query.data
  const stale = query.isPlaceholderData
  const sorted = quotes.map((q, i) => ({ q, i })).sort((a, b) => a.q.maturity - b.q.maturity)
  const update = (i: number, spreadBp: number) =>
    setQuotes(quotes.map((q, j) => (j === i ? { ...q, spread: spreadBp / 1e4 } : q)))

  return (
    <>
      <PageHeader title="Credit default swaps">
        Insurance against a company defaulting. The buyer pays a yearly spread; if the company
        defaults, the seller covers the loss. Market spreads tell us how likely the market thinks
        default is, year by year: the default curve, built exactly like a yield curve.
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <aside>
          <Card className="overflow-hidden">
            <PanelSection
              title="Par CDS spreads"
              hint="Illustrative issuer. Each quote is the running spread that makes a CDS of that maturity worth zero."
            >
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-[4.5rem_1fr_2rem] gap-2 text-muted-foreground text-xs">
                  <span>Maturity</span>
                  <span className="pe-1 text-right">Spread</span>
                </div>
                {sorted.map(({ q, i }) => (
                  <div key={i} className="grid grid-cols-[4.5rem_1fr_2rem] items-center gap-2">
                    <span className="font-medium text-xs">{q.maturity}Y</span>
                    <NumberInput
                      hideLabel
                      label={`${q.maturity}Y spread`}
                      value={Math.round(q.spread * 1e5) / 10}
                      onChange={(v) => update(i, v)}
                      min={1}
                      max={3000}
                      step={5}
                      unit="bp"
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${q.maturity}Y quote`}
                      onClick={() => setQuotes(quotes.filter((_, j) => j !== i))}
                      disabled={quotes.length <= 1}
                    >
                      <XIcon />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={Math.max(...quotes.map((q) => q.maturity)) >= 30}
                  onClick={() => {
                    const last = quotes.reduce((a, b) => (b.maturity > a.maturity ? b : a))
                    setQuotes([
                      ...quotes,
                      { maturity: Math.min(last.maturity + 5, 30), spread: last.spread },
                    ])
                  }}
                >
                  <PlusIcon /> Quote
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setQuotes(quotes.map((q) => ({ ...q, spread: q.spread * 3 })))}
                >
                  Distress ×3
                </Button>
                <Button variant="outline" size="sm" onClick={() => setQuotes(SAMPLE)}>
                  Reset
                </Button>
              </div>
            </PanelSection>
            <Separator />
            <PanelSection title="Assumptions">
              <ParamControl
                label="Recovery rate"
                value={recoveryPct}
                onChange={setRecoveryPct}
                min={0}
                max={80}
                step={5}
                unit="%"
              />
              <ParamControl
                label="Interest rate"
                value={ratePct}
                onChange={setRatePct}
                min={0}
                max={8}
                step={0.25}
                unit="%"
                digits={2}
              />
            </PanelSection>
            <Separator />
            <PanelSection
              title="Contract"
              hint="Standard contracts trade at a fixed coupon (100bp investment grade, 500bp high yield) plus an upfront payment."
            >
              <ParamControl
                label="Maturity"
                value={maturity}
                onChange={setMaturity}
                min={1}
                max={10}
                step={1}
                unit="yrs"
              />
              <Segmented<string>
                label="Standard coupon"
                value={String(couponBp)}
                onChange={(v) => setCouponBp(Number(v))}
                options={[
                  { value: '100', label: '100bp' },
                  { value: '500', label: '500bp' },
                ]}
                className="w-full"
              />
            </PanelSection>
          </Card>
        </aside>
        <div className="flex min-w-0 flex-col gap-6">
          {query.error && (
            <Alert variant="error">
              <AlertTriangleIcon />
              <AlertTitle>Bootstrap failed</AlertTitle>
              <AlertDescription>{query.error.message}</AlertDescription>
            </Alert>
          )}
          <Card className={cn('transition-opacity', stale && 'opacity-60')}>
            <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-8">
              <div>
                <p className="text-muted-foreground text-sm">{maturity}Y par spread</p>
                <p className="mt-1 font-semibold text-5xl tracking-tight tabular-nums">
                  {data ? bp(data.par_spread, 1) : '—'}
                </p>
                <p className="mt-1.5 text-muted-foreground text-xs">
                  {data
                    ? `${pct(data.default_probability, 1)} chance of default within ${maturity} years`
                    : ' '}
                </p>
              </div>
              <StatGrid className="self-start grid-cols-2">
                <Stat
                  label={`Upfront at ${couponBp}bp`}
                  value={data ? pct(data.upfront) : '—'}
                  hint={
                    data
                      ? `${data.upfront >= 0 ? 'Buyer pays' : 'Buyer receives'} ${money(Math.abs(data.upfront) * NOTIONAL)} on ${money(NOTIONAL)}`
                      : undefined
                  }
                />
                <Stat
                  label="Risky annuity (RPV01)"
                  value={data ? fixed(data.rpv01, 3) : '—'}
                  hint="Value of 1 a year until default or maturity"
                />
                <Stat
                  label="Protection leg"
                  value={data ? pct(data.protection_leg) : '—'}
                  hint="Expected discounted loss, % of notional"
                />
                <Stat
                  label="CS01"
                  value={data ? money(data.cs01) : '—'}
                  hint="Buyer’s gain if every spread widens 1bp"
                />
              </StatGrid>
            </div>
          </Card>
          <div className="grid gap-6 xl:grid-cols-2">
            <LinesChart
              title="Survival probability"
              description="Chance the company has not defaulted by each date, implied by the spreads. Its slope is the default rate; widening spreads make it fall faster."
              series={
                data
                  ? [
                      {
                        name: 'Survival',
                        color: c.series1,
                        points: data.grid.map((t, i) => [t, data.survival[i] * 100]),
                      },
                    ]
                  : []
              }
              xName="Years"
              yName="Survival (%)"
              xFormat={(x) => fixed(x, 0)}
              yFormat={(y) => fixed(y, 0)}
              current={maturity}
              stale={stale}
              ariaLabel="Survival probability over time"
            />
            <LinesChart
              title="Hazard rate"
              description="The default rate in each year, given survival so far. It is flat between quote maturities (like flat forwards between yield-curve nodes) and rises with an upward-sloping spread curve."
              series={
                data
                  ? [
                      {
                        name: 'Hazard rate',
                        color: c.series2,
                        points: data.grid.map((t, i) => [t, data.hazard[i] * 100]),
                      },
                    ]
                  : []
              }
              xName="Years"
              yName="Hazard rate (% a year)"
              xFormat={(x) => fixed(x, 0)}
              yFormat={(y) => fixed(y, 2)}
              stale={stale}
              ariaLabel="Hazard rate over time"
            />
          </div>
          <Card className={cn('transition-opacity', stale && 'opacity-60')}>
            <CardHeader>
              <CardTitle className="text-base" render={<h2 />}>
                Bootstrapped default curve
              </CardTitle>
              <CardDescription>
                Each quote adds one hazard segment, solved so the quote prices at par. The credit
                triangle, spread ÷ (1 − recovery), is the average hazard rate to that maturity, a
                quick check.
              </CardDescription>
              <ChartGuide heading="Bootstrapped default curve" noun="table" />
            </CardHeader>
            <div className="overflow-x-auto px-2 pb-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="ps-4">Maturity</TableHead>
                    <TableHead className="text-right">Spread</TableHead>
                    <TableHead className="text-right">Segment hazard</TableHead>
                    <TableHead className="text-right">Credit triangle</TableHead>
                    <TableHead className="text-right">Survival</TableHead>
                    <TableHead className="pe-4 text-right">Repricing error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.nodes ?? []).map((n) => (
                    <TableRow key={n.maturity}>
                      <TableCell className="ps-4 font-medium">{n.maturity}Y</TableCell>
                      <TableCell className="text-right tabular-nums">{bp(n.spread)}</TableCell>
                      <TableCell className="text-right tabular-nums">{pct(n.hazard)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {pct(n.triangle_hazard)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {pct(n.survival, 1)}
                      </TableCell>
                      <TableCell className="pe-4 text-right text-muted-foreground tabular-nums">
                        {scientific(Math.abs(n.repricing_error))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
