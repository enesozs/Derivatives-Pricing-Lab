import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertTriangleIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ChartCard, LegendKey } from '@/components/charts/chart-card'
import { EChart, type ChartOption } from '@/components/charts/echart'
import { LinesChart } from '@/components/charts/simple-charts'
import {
  axisStyle,
  GRID,
  tooltipHeader,
  tooltipRow,
  tooltipStyle,
  useChartColors,
} from '@/components/charts/theme'
import { PageHeader } from '@/components/page-header'
import { PanelSection } from '@/components/panel-section'
import { ParamControl } from '@/components/param-control'
import { Segmented } from '@/components/segmented'
import { Stat, StatGrid } from '@/components/stat-grid'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { api, type XVARequest, type XVAResponse } from '@/lib/api'
import { compact, fixed, money } from '@/lib/format'
import { cn } from '@/lib/utils'

const NOTIONAL = 10_000_000

interface Params {
  maturity: number
  side: 'payer' | 'receiver'
  a: number
  sigmaBp: number
  ratePct: number
  counterpartyBp: number
  counterpartyRecoveryPct: number
  bilateral: boolean
  ownBp: number
  collateral: boolean
  thresholdK: number
}

const DEFAULTS: Params = {
  maturity: 10,
  side: 'payer',
  a: 0.05,
  sigmaBp: 100,
  ratePct: 3,
  counterpartyBp: 150,
  counterpartyRecoveryPct: 40,
  bilateral: true,
  ownBp: 80,
  collateral: false,
  thresholdK: 100,
}

function ContributionChart({ data, stale }: { data?: XVAResponse; stale: boolean }) {
  const c = useChartColors()
  const option = useMemo<ChartOption | null>(() => {
    if (!data) return null
    const axis = axisStyle(c)
    // Aggregate the fine simulation grid into yearly buckets.
    const years = Math.ceil(data.times[data.times.length - 1] - 1e-9)
    const cva = Array<number>(years).fill(0)
    const dva = Array<number>(years).fill(0)
    data.cva_by_time.forEach((v, i) => {
      const y = Math.min(years - 1, Math.floor(data.times[i] + 1e-9))
      cva[y] += v
      dva[y] -= data.dva_by_time[i]
    })
    return {
      animationDurationUpdate: 150,
      grid: GRID,
      tooltip: {
        ...tooltipStyle(c),
        axisPointer: { type: 'shadow' },
        formatter: (raw: unknown) => {
          const i = (raw as { dataIndex: number }[])[0]?.dataIndex ?? 0
          return (
            tooltipHeader(`Year ${i + 1}`) +
            tooltipRow(c.series1, money(cva[i]), 'CVA (counterparty defaults)') +
            tooltipRow(c.series2, money(-dva[i]), 'DVA (we default)')
          )
        },
      },
      xAxis: {
        type: 'category',
        data: cva.map((_, i) => String(i + 1)),
        name: 'Year of default',
        nameLocation: 'middle',
        nameGap: 28,
        ...axis,
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: 'Contribution',
        ...axis,
        axisLabel: { ...axis.axisLabel, formatter: (v: number) => compact(v) },
      },
      series: [
        {
          name: 'CVA',
          type: 'bar',
          stack: 'x',
          data: cva,
          barMaxWidth: 28,
          itemStyle: { color: c.series1, borderRadius: [4, 4, 0, 0] },
        },
        {
          name: 'DVA',
          type: 'bar',
          stack: 'x',
          data: dva,
          barMaxWidth: 28,
          itemStyle: { color: c.series2, borderRadius: [0, 0, 4, 4] },
        },
      ],
    }
  }, [data, c])
  return (
    <ChartCard
      title="Where the adjustment comes from"
      description="CVA by year of the counterparty’s default: exposure that year × chance of default that year × loss given default. DVA (below zero) is the same calculation for our own default on what we owe."
      action={
        <div className="flex gap-4">
          <LegendKey color={c.series1} label="CVA" band />
          <LegendKey color={c.series2} label="DVA" band />
        </div>
      }
      stale={stale}
    >
      {option ? (
        <EChart option={option} ariaLabel="CVA and DVA contributions by year" />
      ) : (
        <div className="h-72" />
      )}
    </ChartCard>
  )
}

export default function XvaPage() {
  const c = useChartColors()
  const [params, setParams] = useState(DEFAULTS)
  const settled = useDebouncedValue(params, 200)
  const request = useMemo<XVARequest>(
    () => ({
      rate: settled.ratePct / 100,
      a: settled.a,
      sigma: settled.sigmaBp / 1e4,
      maturity: settled.maturity,
      frequency: 1,
      payer: settled.side === 'payer',
      fixed_rate: null,
      notional: NOTIONAL,
      counterparty_spread: settled.counterpartyBp / 1e4,
      counterparty_recovery: settled.counterpartyRecoveryPct / 100,
      own_spread: settled.bilateral ? settled.ownBp / 1e4 : null,
      own_recovery: 0.4,
      threshold: settled.collateral ? settled.thresholdK * 1000 : null,
      paths: 5_000,
    }),
    [settled],
  )
  const query = useQuery({
    queryKey: ['credit', 'xva', request],
    queryFn: ({ signal }) => api.xva(request, signal),
    placeholderData: keepPreviousData,
  })
  const data = query.data
  const stale = query.isPlaceholderData
  const set =
    <K extends keyof Params>(key: K) =>
    (value: Params[K]) =>
      setParams({ ...params, [key]: value })
  const exposure = useMemo(
    () =>
      data
        ? [
            {
              name: 'Expected exposure',
              color: c.series1,
              points: data.times.map((t, i) => [t, data.epe[i]] as [number, number]),
            },
            {
              name: '95% potential future exposure',
              color: c.series2,
              points: data.times.map((t, i) => [t, data.pfe95[i]] as [number, number]),
            },
          ]
        : [],
    [data, c],
  )
  const paths = useMemo(
    () =>
      data
        ? data.sample_values.map((row, k) => ({
            name: `Scenario ${k + 1}`,
            color: c.ordinal[k % c.ordinal.length],
            points: data.times.map((t, i) => [t, row[i]] as [number, number]),
          }))
        : [],
    [data, c],
  )
  const worstCheck = data
    ? Math.max(...data.check_simulated.map((s, i) => Math.abs(s / data.check_exact[i] - 1)))
    : null

  return (
    <>
      <PageHeader title="Counterparty risk: CVA and DVA">
        A swap with a bank’s client is only worth its model value if the client survives to pay. CVA
        is the price of the risk that they default while owing us money. It depends on how much they
        could owe (exposure, simulated with Hull–White) and how likely they are to default (their
        CDS spread).
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside>
          <Card className="overflow-hidden">
            <PanelSection
              title="The trade"
              hint={`At-the-money swap, annual fixed leg, ${money(NOTIONAL)} notional.`}
            >
              <Segmented<Params['side']>
                label="Our side"
                value={params.side}
                onChange={set('side')}
                options={[
                  { value: 'payer', label: 'We pay fixed' },
                  { value: 'receiver', label: 'We receive fixed' },
                ]}
                className="w-full"
              />
              <ParamControl
                label="Maturity"
                value={params.maturity}
                onChange={set('maturity')}
                min={1}
                max={20}
                step={1}
                unit="yrs"
              />
            </PanelSection>
            <Separator />
            <PanelSection
              title="Rates model (Hull–White)"
              hint="Flat curve. Rate volatility drives how far the swap’s value can drift."
            >
              <ParamControl
                label="Interest rate"
                value={params.ratePct}
                onChange={set('ratePct')}
                min={0}
                max={8}
                step={0.25}
                unit="%"
                digits={2}
              />
              <ParamControl
                label="Rate volatility σ"
                value={params.sigmaBp}
                onChange={set('sigmaBp')}
                min={20}
                max={250}
                step={10}
                unit="bp"
              />
              <ParamControl
                label="Mean reversion a"
                value={params.a}
                onChange={set('a')}
                min={0.01}
                max={0.5}
                step={0.01}
                digits={2}
              />
            </PanelSection>
            <Separator />
            <PanelSection
              title="Credit"
              hint="Flat hazard rates from the credit triangle, spread ÷ (1 − recovery)."
            >
              <ParamControl
                label="Counterparty CDS spread"
                value={params.counterpartyBp}
                onChange={set('counterpartyBp')}
                min={0}
                max={1000}
                step={10}
                unit="bp"
              />
              <ParamControl
                label="Counterparty recovery"
                value={params.counterpartyRecoveryPct}
                onChange={set('counterpartyRecoveryPct')}
                min={0}
                max={80}
                step={5}
                unit="%"
              />
              <Segmented<string>
                label="Own default"
                value={params.bilateral ? 'on' : 'off'}
                onChange={(v) => set('bilateral')(v === 'on')}
                options={[
                  { value: 'off', label: 'CVA only' },
                  { value: 'on', label: 'CVA and DVA' },
                ]}
                className="w-full"
              />
              {params.bilateral && (
                <ParamControl
                  label="Our CDS spread"
                  value={params.ownBp}
                  onChange={set('ownBp')}
                  min={0}
                  max={500}
                  step={10}
                  unit="bp"
                />
              )}
            </PanelSection>
            <Separator />
            <PanelSection
              title="Collateral"
              hint="With a threshold, the counterparty posts collateral for any exposure above it."
            >
              <Segmented<string>
                label="Collateral"
                value={params.collateral ? 'on' : 'off'}
                onChange={(v) => set('collateral')(v === 'on')}
                options={[
                  { value: 'off', label: 'Uncollateralised' },
                  { value: 'on', label: 'Threshold' },
                ]}
                className="w-full"
              />
              {params.collateral && (
                <ParamControl
                  label="Threshold"
                  value={params.thresholdK}
                  onChange={set('thresholdK')}
                  min={0}
                  max={1000}
                  step={25}
                  unit="k"
                />
              )}
            </PanelSection>
          </Card>
        </aside>
        <div className="flex min-w-0 flex-col gap-6">
          {query.error && (
            <Alert variant="error">
              <AlertTriangleIcon />
              <AlertTitle>Simulation failed</AlertTitle>
              <AlertDescription>{query.error.message}</AlertDescription>
            </Alert>
          )}
          <Card className={cn('transition-opacity', stale && 'opacity-60')}>
            <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-8">
              <div>
                <p className="text-muted-foreground text-sm">CVA</p>
                <p className="mt-1 font-semibold text-5xl tracking-tight tabular-nums">
                  {data ? money(data.cva) : '—'}
                </p>
                <p className="mt-1.5 text-muted-foreground text-xs">
                  {data
                    ? `≈ ${fixed(data.cva_running_bp, 1)}bp a year added to the fixed rate`
                    : ' '}
                </p>
              </div>
              <StatGrid className="self-start grid-cols-2">
                <Stat
                  label="DVA"
                  value={data ? money(data.dva) : '—'}
                  hint={params.bilateral ? 'Our own default: a benefit to us' : 'Off'}
                />
                <Stat
                  label="Net adjustment"
                  value={data ? money(data.bilateral) : '—'}
                  hint="−CVA + DVA, added to the risk-free value"
                />
                <Stat
                  label="Risk-free value"
                  value={data ? money(data.swap_value) : '—'}
                  hint={data ? `At the par rate ${fixed(data.fixed_rate * 100, 3)}%` : undefined}
                />
                <Stat
                  label="Exposure check"
                  value={worstCheck == null ? '—' : `≤ ${fixed(worstCheck * 100, 1)}%`}
                  hint="Largest gap to the exact swaption value at resets (simulation noise)"
                />
              </StatGrid>
            </div>
          </Card>
          <div className="grid gap-6 xl:grid-cols-2">
            <LinesChart
              title="Exposure profile"
              description="What the counterparty could owe us, over time. It starts at zero (an at-the-money swap), grows as rates drift, then shrinks as payments are made: the classic hump. Potential future exposure is the bad case regulators look at."
              series={exposure}
              xName="Years"
              yName="Exposure"
              xFormat={(x) => fixed(x, 1)}
              yFormat={(y) => compact(y)}
              stale={stale}
              ariaLabel="Expected and potential future exposure over time"
            />
            <LinesChart
              title="The swap’s value in a few scenarios"
              description="Simulated mark-to-market along eight rate paths. Above zero the counterparty owes us (exposure); below zero we owe them. Every path ends at zero once all payments are made."
              series={paths}
              legend={false}
              xName="Years"
              yName="Swap value"
              xFormat={(x) => fixed(x, 1)}
              yFormat={(y) => compact(y)}
              stale={stale}
              ariaLabel="Simulated swap values along eight rate scenarios"
            />
          </div>
          <ContributionChart data={data} stale={stale} />
        </div>
      </div>
    </>
  )
}
