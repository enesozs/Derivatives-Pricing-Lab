import { ChartGuide } from '@/components/chart-guide'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertTriangleIcon, PlusIcon, XIcon } from 'lucide-react'
import { useMemo } from 'react'
import { ChartCard, LegendKey } from '@/components/charts/chart-card'
import { EChart, type ChartOption } from '@/components/charts/echart'
import {
  axisStyle,
  GRID,
  tooltipHeader,
  tooltipRow,
  tooltipStyle,
  useChartColors,
} from '@/components/charts/theme'
import { NumberInput } from '@/components/number-input'
import { PageHeader } from '@/components/page-header'
import { PanelSection } from '@/components/panel-section'
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
import { api, type CurveResponse, type RateQuote } from '@/lib/api'
import { fixed, scientific } from '@/lib/format'
import { cn } from '@/lib/utils'
import { SAMPLE_QUOTES, tenorLabel, useCurveQuotes } from './curve-context'

function CurveChart({ data, stale }: { data: CurveResponse | undefined; stale: boolean }) {
  const c = useChartColors()
  const option = useMemo<ChartOption | null>(() => {
    if (!data) return null
    const axis = axisStyle(c)
    return {
      animationDurationUpdate: 150,
      grid: GRID,
      tooltip: {
        ...tooltipStyle(c),
        formatter: (raw: unknown) => {
          const i = (raw as { dataIndex: number }[])[0]?.dataIndex ?? 0
          return (
            tooltipHeader(`${fixed(data.grid[i], 2)} years`) +
            tooltipRow(c.series1, `${fixed(data.zero[i] * 100, 3)}%`, 'Zero rate') +
            tooltipRow(c.series2, `${fixed(data.forward[i] * 100, 3)}%`, 'Instantaneous forward')
          )
        },
      },
      xAxis: {
        type: 'value',
        name: 'Years',
        nameLocation: 'middle',
        nameGap: 28,
        min: 0,
        max: data.grid[data.grid.length - 1],
        ...axis,
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: 'Rate (%)',
        scale: true,
        ...axis,
        axisLabel: { ...axis.axisLabel, formatter: (v: number) => fixed(v, 2) },
      },
      series: [
        {
          name: 'Forward',
          type: 'line',
          data: data.grid.map((t, i) => [t, data.forward[i] * 100]),
          showSymbol: false,
          step: false,
          lineStyle: { width: 2, color: c.series2 },
          itemStyle: { color: c.series2 },
        },
        {
          name: 'Zero',
          type: 'line',
          data: data.grid.map((t, i) => [t, data.zero[i] * 100]),
          showSymbol: false,
          lineStyle: { width: 2, color: c.series1 },
          itemStyle: { color: c.series1 },
          markPoint: {
            silent: true,
            symbol: 'circle',
            symbolSize: 8,
            itemStyle: { color: c.series1, borderColor: c.surface, borderWidth: 2 },
            label: { show: false },
            data: data.node_times.map((t, i) => ({
              name: data.node_labels[i],
              coord: [t, data.node_zero[i] * 100],
            })),
          },
        },
      ],
    }
  }, [data, c])
  return (
    <ChartCard
      title="Zero and forward curves"
      description="Zero rates average the forward rates up to each maturity, so forwards swing more. Log-linear interpolation of discount factors makes forwards flat between nodes: the steps you see. Dots mark the bootstrapped nodes."
      action={
        <div className="flex gap-4">
          <LegendKey color={c.series1} label="Zero rate" />
          <LegendKey color={c.series2} label="Forward rate" />
        </div>
      }
      stale={stale}
    >
      {option ? (
        <EChart
          option={option}
          className="h-80"
          ariaLabel="Zero and instantaneous forward rate curves"
        />
      ) : (
        <div className="h-80" />
      )}
    </ChartCard>
  )
}

function DiscountChart({ data, stale }: { data: CurveResponse | undefined; stale: boolean }) {
  const c = useChartColors()
  const option = useMemo<ChartOption | null>(() => {
    if (!data) return null
    const axis = axisStyle(c)
    return {
      animationDurationUpdate: 150,
      grid: GRID,
      tooltip: {
        ...tooltipStyle(c),
        formatter: (raw: unknown) => {
          const i = (raw as { dataIndex: number }[])[0]?.dataIndex ?? 0
          return (
            tooltipHeader(`${fixed(data.grid[i], 2)} years`) +
            tooltipRow(c.series1, fixed(data.discount[i], 5), 'Discount factor')
          )
        },
      },
      xAxis: {
        type: 'value',
        name: 'Years',
        nameLocation: 'middle',
        nameGap: 28,
        min: 0,
        max: data.grid[data.grid.length - 1],
        ...axis,
        splitLine: { show: false },
      },
      yAxis: { type: 'value', name: 'Value of 1 paid then', min: 0, max: 1, ...axis },
      series: [
        {
          name: 'Discount factor',
          type: 'line',
          data: data.grid.map((t, i) => [t, data.discount[i]]),
          showSymbol: false,
          lineStyle: { width: 2, color: c.series1 },
          itemStyle: { color: c.series1 },
          areaStyle: { color: c.band },
        },
      ],
    }
  }, [data, c])
  return (
    <ChartCard
      title="Discount factors"
      description="What one unit paid at each date is worth today. Every rates price is a sum of cash flows times these."
      stale={stale}
    >
      {option ? (
        <EChart option={option} ariaLabel="Discount factor curve" />
      ) : (
        <div className="h-72" />
      )}
    </ChartCard>
  )
}

export default function CurvesPage() {
  const { quotes, setQuotes } = useCurveQuotes()
  const settled = useDebouncedValue(quotes, 200)
  const query = useQuery({
    queryKey: ['rates', 'curve', settled],
    queryFn: ({ signal }) => api.rateCurve({ quotes: settled }, signal),
    placeholderData: keepPreviousData,
  })
  const data = query.data
  const stale = query.isPlaceholderData
  const sorted = useMemo(
    () => quotes.map((q, i) => ({ q, i })).sort((a, b) => a.q.maturity - b.q.maturity),
    [quotes],
  )
  const update = (i: number, patch: Partial<RateQuote>) =>
    setQuotes(quotes.map((q, j) => (j === i ? { ...q, ...patch } : q)))
  const remove = (i: number) => setQuotes(quotes.filter((_, j) => j !== i))
  const shiftAll = (bp: number) =>
    setQuotes(quotes.map((q) => ({ ...q, rate: q.rate + bp / 10_000 })))
  const zeroAt = (t: number) => (data ? data.zero[data.grid.findIndex((g) => g >= t)] : undefined)
  const slope = data ? ((zeroAt(10) ?? 0) - (zeroAt(2) ?? 0)) * 10_000 : null

  return (
    <>
      <PageHeader title="Yield curves">
        Every rates product is priced off one curve: discount factors for each future date,
        bootstrapped so that the quoted deposits and swaps reprice exactly.
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <aside>
          <Card className="overflow-hidden">
            <PanelSection
              title="Market quotes"
              hint="Deposits (simple rates) and par swap rates (annual fixed leg). Edit any rate; the curve rebuilds instantly."
            >
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-[4.5rem_1fr_2rem] gap-2 text-muted-foreground text-xs">
                  <span>Tenor</span>
                  <span className="pe-1 text-right">Rate</span>
                </div>
                {sorted.map(({ q, i }) => (
                  <div key={i} className="grid grid-cols-[4.5rem_1fr_2rem] items-center gap-2">
                    <span className="text-xs">
                      <span className="font-medium">{tenorLabel(q.maturity)}</span>{' '}
                      <span className="text-muted-foreground">
                        {q.kind === 'swap' ? 'swap' : q.kind === 'fra' ? 'FRA' : 'depo'}
                      </span>
                    </span>
                    <NumberInput
                      hideLabel
                      label={`${tenorLabel(q.maturity)} rate`}
                      value={Math.round(q.rate * 1e6) / 1e4}
                      onChange={(v) => update(i, { rate: v / 100 })}
                      min={-2}
                      max={20}
                      step={0.01}
                      digits={2}
                      unit="%"
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${tenorLabel(q.maturity)} quote`}
                      onClick={() => remove(i)}
                      disabled={quotes.length <= 2}
                    >
                      <XIcon />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const last = Math.max(...quotes.map((q) => q.maturity))
                    setQuotes([
                      ...quotes,
                      {
                        kind: 'swap',
                        maturity: Math.min(last + 5, 50),
                        rate: quotes[quotes.length - 1].rate,
                        start: 0,
                        frequency: 1,
                      },
                    ])
                  }}
                >
                  <PlusIcon /> Swap
                </Button>
                <Button variant="outline" size="sm" onClick={() => setQuotes(SAMPLE_QUOTES)}>
                  Reset
                </Button>
              </div>
            </PanelSection>
            <Separator />
            <PanelSection
              title="Parallel shift"
              hint="Move every quote together and watch every Rates page reprice."
            >
              <div className="grid grid-cols-4 gap-2">
                {[-25, -5, 5, 25].map((bp) => (
                  <Button key={bp} variant="outline" size="sm" onClick={() => shiftAll(bp)}>
                    {bp > 0 ? '+' : '−'}
                    {Math.abs(bp)}bp
                  </Button>
                ))}
              </div>
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
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-border sm:grid-cols-4">
              {[
                ['2Y zero', zeroAt(2)],
                ['10Y zero', zeroAt(10)],
                ['30Y zero', zeroAt(29.9)],
              ].map(([label, v]) => (
                <div key={label as string} className="bg-card p-5">
                  <p className="text-muted-foreground text-xs">{label}</p>
                  <p className="mt-1 font-semibold text-2xl tracking-tight">
                    {v == null ? '—' : `${fixed((v as number) * 100, 3)}%`}
                  </p>
                </div>
              ))}
              <div className="bg-card p-5">
                <p className="text-muted-foreground text-xs">2s10s slope</p>
                <p className="mt-1 font-semibold text-2xl tracking-tight">
                  {slope == null ? '—' : `${fixed(slope, 0)} bp`}
                </p>
              </div>
            </div>
          </Card>
          <CurveChart data={data} stale={stale} />
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <DiscountChart data={data} stale={stale} />
            <Card>
              <CardHeader>
                <CardTitle className="text-base" render={<h2 />}>
                  Bootstrapped nodes
                </CardTitle>
                <CardDescription>
                  Each quote adds one node, solved so the quote reprices exactly. Repricing errors
                  should be at machine precision.
                </CardDescription>
                <ChartGuide heading="Bootstrapped nodes" noun="table" />
              </CardHeader>
              <div
                className={cn(
                  'max-h-80 overflow-auto px-2 pb-2 transition-opacity',
                  stale && 'opacity-60',
                )}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="ps-4">Instrument</TableHead>
                      <TableHead className="text-right">Discount factor</TableHead>
                      <TableHead className="text-right">Zero rate</TableHead>
                      <TableHead className="pe-4 text-right">Repricing error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.node_labels ?? []).map((label, i) => (
                      <TableRow key={label}>
                        <TableCell className="ps-4 font-medium">{label}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fixed(data!.node_discount[i], 6)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fixed(data!.node_zero[i] * 100, 3)}%
                        </TableCell>
                        <TableCell className="pe-4 text-right text-muted-foreground tabular-nums">
                          {scientific(Math.abs(data!.repricing_errors[i]))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
