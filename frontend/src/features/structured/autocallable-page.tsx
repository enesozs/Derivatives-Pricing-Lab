import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertTriangleIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
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
import {
  DEFAULT_MODEL,
  type ModelParams,
  ModelSection,
  toModelSpec,
} from '@/components/model-section'
import { PageHeader } from '@/components/page-header'
import { PanelSection } from '@/components/panel-section'
import { ParamControl } from '@/components/param-control'
import { Segmented } from '@/components/segmented'
import { Stat, StatGrid } from '@/components/stat-grid'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { api, type AutocallableRequest, type AutocallableResponse } from '@/lib/api'
import { fixed } from '@/lib/format'
import { cn } from '@/lib/utils'
import { HistogramChart, LinesChart } from '@/components/charts/simple-charts'
import { DEFAULT_MARKET, MarketSection, type MarketParams, toMarket } from './market-section'

type Frequency = AutocallableRequest['frequency']

interface Params {
  maturity: number
  frequency: Frequency
  couponPct: number
  autocallPct: number
  couponBarrierPct: number
  protectionPct: number
  memory: boolean
  monitoring: AutocallableRequest['monitoring']
  assets: number
  correlation: number
}

const DEFAULTS: Params = {
  maturity: 3,
  frequency: 4,
  couponPct: 8,
  autocallPct: 100,
  couponBarrierPct: 70,
  protectionPct: 60,
  memory: true,
  monitoring: 'maturity',
  assets: 1,
  correlation: 0.5,
}

const pct = (v: number, digits = 1) => `${fixed(v * 100, digits)}%`

function RedemptionChart({ data, stale }: { data?: AutocallableResponse; stale: boolean }) {
  const c = useChartColors()
  const option = useMemo<ChartOption | null>(() => {
    if (!data) return null
    const axis = axisStyle(c)
    const probs = data.redemption_probabilities
    const last = probs.length - 1
    const par = probs.map((p, i) => 100 * (i === last ? p - data.loss_probability : p))
    const loss = probs.map((_, i) => (i === last ? 100 * data.loss_probability : 0))
    return {
      animationDurationUpdate: 150,
      grid: GRID,
      tooltip: {
        ...tooltipStyle(c),
        axisPointer: { type: 'shadow' },
        formatter: (raw: unknown) => {
          const i = (raw as { dataIndex: number }[])[0]?.dataIndex ?? 0
          const header =
            i === last
              ? `Maturity · ${fixed(data.observation_times[i], 2)}y`
              : `Observation ${i + 1} · ${fixed(data.observation_times[i], 2)}y`
          return (
            tooltipHeader(header) +
            tooltipRow(
              c.series1,
              `${fixed(par[i], 1)}%`,
              i === last ? 'Repaid at par' : 'Autocalled',
            ) +
            (i === last
              ? tooltipRow(c.series2, `${fixed(loss[i], 1)}%`, 'Repaid with a capital loss')
              : '')
          )
        },
      },
      xAxis: {
        type: 'category',
        data: data.observation_times.map((t) => fixed(t, t % 1 === 0 ? 0 : 2)),
        name: 'Observation date (years)',
        nameLocation: 'middle',
        nameGap: 28,
        ...axis,
        splitLine: { show: false },
      },
      yAxis: { type: 'value', name: 'Probability (%)', ...axis },
      series: [
        {
          name: 'Par',
          type: 'bar',
          stack: 'p',
          data: par,
          barMaxWidth: 28,
          itemStyle: { color: c.series1 },
        },
        {
          name: 'Loss',
          type: 'bar',
          stack: 'p',
          data: loss,
          barMaxWidth: 28,
          itemStyle: { color: c.series2, borderRadius: [4, 4, 0, 0] },
        },
      ],
    }
  }, [data, c])
  return (
    <ChartCard
      title="When does the note end?"
      description="Probability of redeeming on each date. Most notes are called early, when the stock is above its initial level; the risk sits in the final bar, where a breached barrier means the investor takes the stock’s loss."
      action={
        <div className="flex gap-4">
          <LegendKey color={c.series1} label="Repaid at par" band />
          <LegendKey color={c.series2} label="Capital loss" band />
        </div>
      }
      stale={stale}
    >
      {option ? (
        <EChart option={option} ariaLabel="Probability of redemption on each observation date" />
      ) : (
        <div className="h-72" />
      )}
    </ChartCard>
  )
}

export default function AutocallablePage() {
  const c = useChartColors()
  const [params, setParams] = useState(DEFAULTS)
  const [model, setModel] = useState<ModelParams>(DEFAULT_MODEL)
  const [market, setMarket] = useState<MarketParams>(DEFAULT_MARKET)
  // One stable object per change, so the debounce settles instead of re-rendering forever.
  const inputs = useMemo(() => ({ params, model, market }), [params, model, market])
  const settled = useDebouncedValue(inputs, 200)
  const request = useMemo<AutocallableRequest>(() => {
    const p = settled.params
    return {
      ...toMarket(settled.market),
      maturity: p.maturity,
      frequency: p.frequency,
      coupon: p.couponPct / 100,
      autocall_level: p.autocallPct / 100,
      coupon_barrier: p.couponBarrierPct / 100,
      protection_barrier: p.protectionPct / 100,
      memory: p.memory,
      monitoring: p.monitoring,
      non_call_periods: 0,
      assets: p.assets,
      correlation: p.correlation,
      model: toModelSpec(settled.model),
      paths: 20_000,
    }
  }, [settled])
  const query = useQuery({
    queryKey: ['structured', 'autocallable', request],
    queryFn: ({ signal }) => api.autocallable(request, signal),
    placeholderData: keepPreviousData,
  })
  const data = query.data
  const stale = query.isPlaceholderData
  const set =
    <K extends keyof Params>(key: K) =>
    (value: Params[K]) =>
      setParams({ ...params, [key]: value })
  const setAssets = (n: number) => {
    setParams({ ...params, assets: n })
    // Worst-of notes run under correlated Black–Scholes.
    if (n > 1 && model.type !== 'black_scholes') setModel({ ...model, type: 'black_scholes' })
  }
  const changeModel = (m: ModelParams) => {
    setModel(m)
    if (m.type !== 'black_scholes' && params.assets > 1) setParams({ ...params, assets: 1 })
  }
  const calledYear1 = data
    ? data.redemption_probabilities.reduce(
        (sum, p, i) =>
          sum +
          (data.observation_times[i] <= 1 && i < data.redemption_probabilities.length - 1 ? p : 0),
        0,
      )
    : null

  return (
    <>
      <PageHeader title="Autocallable notes">
        The investor earns a high coupon while the stock stays above a barrier, gets repaid early as
        soon as it is back above its starting level, and loses capital only if it ends below the
        protection barrier. In exchange they have sold the bank a put.
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside>
          <Card className="overflow-hidden">
            <PanelSection title="Term sheet" hint="Levels are % of the initial fixing.">
              <ParamControl
                label="Maturity"
                value={params.maturity}
                onChange={set('maturity')}
                min={1}
                max={7}
                step={1}
                unit="yrs"
              />
              <Segmented<string>
                label="Observation frequency"
                value={String(params.frequency)}
                onChange={(v) => set('frequency')(Number(v) as Frequency)}
                options={[
                  { value: '12', label: 'Monthly' },
                  { value: '4', label: 'Quarterly' },
                  { value: '2', label: 'Semi' },
                  { value: '1', label: 'Annual' },
                ]}
                className="w-full"
              />
              <ParamControl
                label="Coupon p.a."
                value={params.couponPct}
                onChange={set('couponPct')}
                min={0}
                max={30}
                step={0.25}
                unit="%"
                digits={2}
              />
              <ParamControl
                label="Autocall level"
                value={params.autocallPct}
                onChange={set('autocallPct')}
                min={70}
                max={120}
                step={5}
                unit="%"
              />
              <ParamControl
                label="Coupon barrier"
                value={params.couponBarrierPct}
                onChange={set('couponBarrierPct')}
                min={40}
                max={100}
                step={5}
                unit="%"
              />
              <ParamControl
                label="Protection barrier"
                value={params.protectionPct}
                onChange={set('protectionPct')}
                min={30}
                max={100}
                step={5}
                unit="%"
              />
              <Segmented<Params['monitoring']>
                label="Protection monitoring"
                value={params.monitoring}
                onChange={set('monitoring')}
                options={[
                  { value: 'maturity', label: 'At maturity' },
                  { value: 'daily', label: 'Every day' },
                ]}
                className="w-full"
              />
              <Segmented<string>
                label="Coupon memory"
                value={params.memory ? 'on' : 'off'}
                onChange={(v) => set('memory')(v === 'on')}
                options={[
                  { value: 'on', label: 'Memory coupons' },
                  { value: 'off', label: 'No memory' },
                ]}
                className="w-full"
              />
            </PanelSection>
            <Separator />
            <PanelSection
              title="Underlyings"
              hint={
                params.assets > 1
                  ? 'Worst-of: every level is checked against the worst performer, under correlated Black–Scholes.'
                  : 'One stock or index.'
              }
            >
              <Segmented<string>
                label="Number of underlyings"
                value={String(params.assets)}
                onChange={(v) => setAssets(Number(v))}
                options={[
                  { value: '1', label: 'Single' },
                  { value: '2', label: 'Worst of 2' },
                  { value: '3', label: 'Worst of 3' },
                ]}
                className="w-full"
              />
              {params.assets > 1 && (
                <ParamControl
                  label="Correlation"
                  value={params.correlation}
                  onChange={set('correlation')}
                  min={0}
                  max={0.95}
                  step={0.05}
                  digits={2}
                />
              )}
            </PanelSection>
            <Separator />
            <ModelSection model={model} onChange={changeModel} />
            <Separator />
            <MarketSection market={market} onChange={setMarket} />
          </Card>
        </aside>
        <div className="flex min-w-0 flex-col gap-6">
          {query.error && (
            <Alert variant="error">
              <AlertTriangleIcon />
              <AlertTitle>Pricing failed</AlertTitle>
              <AlertDescription>{query.error.message}</AlertDescription>
            </Alert>
          )}
          <Card className={cn('transition-opacity', stale && 'opacity-60')}>
            <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-8">
              <div>
                <p className="text-muted-foreground text-sm">Note value, % of notional</p>
                <p className="mt-1 font-semibold text-5xl tracking-tight tabular-nums">
                  {data ? pct(data.value, 2) : '—'}
                </p>
                <p className="mt-1.5 text-muted-foreground text-xs">
                  {data ? `± ${pct(1.96 * data.stderr, 2)} · Monte Carlo, 20,000 paths` : ' '}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  disabled={!data}
                  onClick={() => data && set('couponPct')(Math.round(data.fair_coupon * 400) / 4)}
                >
                  Set the fair coupon
                </Button>
              </div>
              <StatGrid className="self-start grid-cols-2">
                <Stat
                  label="Fair coupon"
                  value={data ? `${pct(data.fair_coupon, 2)} p.a.` : '—'}
                  hint="Coupon that prices the note at 100%"
                />
                <Stat
                  label="Chance of a capital loss"
                  value={data ? pct(data.loss_probability) : '—'}
                  hint="Never called, protection breached"
                />
                <Stat
                  label="Expected life"
                  value={data ? `${fixed(data.expected_life, 2)} yrs` : '—'}
                  hint={`Out of ${params.maturity} years`}
                />
                <Stat
                  label="Called within a year"
                  value={calledYear1 == null ? '—' : pct(calledYear1)}
                  hint="Risk-neutral probability"
                />
              </StatGrid>
            </div>
          </Card>
          <RedemptionChart data={data} stale={stale} />
          <div className="grid gap-6 xl:grid-cols-2">
            <HistogramChart
              title="What the investor ends up with"
              description="Coupons received plus redemption, minus the 100 invested, per simulated path (undiscounted). A tall cluster of small gains, and a long tail of losses."
              histograms={data ? [{ name: 'Paths', color: c.series1, data: data.returns }] : []}
              xName="Total return"
              xFormat={(x) => `${fixed(x * 100, 0)}%`}
              markers={[{ x: 0, label: 'break-even' }]}
              stale={stale}
              ariaLabel="Distribution of the investor's total return"
            />
            <LinesChart
              title="Fair coupon against volatility"
              description="More volatility makes the sold put dearer, so the bank can pay a higher coupon. Notes are cheapest to issue when markets are calm."
              series={
                data
                  ? [
                      {
                        name: 'Fair coupon',
                        color: c.series1,
                        points: data.coupon_vs_vol.x.map((x, i) => [
                          x * 100,
                          data.coupon_vs_vol.y[i] * 100,
                        ]),
                        markers: true,
                      },
                    ]
                  : []
              }
              xName="Volatility (%)"
              yName="Fair coupon (% p.a.)"
              xFormat={(x) => fixed(x, 0)}
              yFormat={(y) => fixed(y, 1)}
              current={model.volPct}
              stale={stale}
              ariaLabel="Fair coupon against volatility"
            />
          </div>
          {data?.coupon_vs_correlation && (
            <LinesChart
              title="Fair coupon against correlation"
              description="The worst of several stocks is worse when they move independently: low correlation means more risk, so a higher coupon. The investor is short correlation."
              series={[
                {
                  name: 'Fair coupon',
                  color: c.series1,
                  points: data.coupon_vs_correlation.x.map((x, i) => [
                    x,
                    data.coupon_vs_correlation!.y[i] * 100,
                  ]),
                  markers: true,
                },
              ]}
              xName="Pairwise correlation"
              yName="Fair coupon (% p.a.)"
              xFormat={(x) => fixed(x, 1)}
              yFormat={(y) => fixed(y, 1)}
              current={params.correlation}
              stale={stale}
              ariaLabel="Fair coupon against correlation"
            />
          )}
        </div>
      </div>
    </>
  )
}
