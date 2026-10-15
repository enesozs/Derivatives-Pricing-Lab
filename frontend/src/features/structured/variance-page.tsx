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
import { PageHeader } from '@/components/page-header'
import { PanelSection } from '@/components/panel-section'
import { ParamControl } from '@/components/param-control'
import { Segmented } from '@/components/segmented'
import { Stat, StatGrid } from '@/components/stat-grid'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { api, type VarianceModelSpec, type VarianceRequest, type VarianceResponse } from '@/lib/api'
import { fixed, signed } from '@/lib/format'
import { cn } from '@/lib/utils'
import { HistogramChart, LinesChart } from './charts'
import { DEFAULT_MARKET, MarketSection, type MarketParams, toMarket } from './market-section'

interface Model {
  type: VarianceModelSpec['type']
  volPct: number
  xi: number
  rho: number
  kappa: number
  intensity: number
  jumpMeanPct: number
  jumpVolPct: number
}

const DEFAULT_MODEL: Model = {
  type: 'heston',
  volPct: 25,
  xi: 0.6,
  rho: -0.7,
  kappa: 1.5,
  intensity: 0.5,
  jumpMeanPct: -10,
  jumpVolPct: 15,
}

function toSpec(m: Model): VarianceModelSpec {
  const sigma = m.volPct / 100
  if (m.type === 'heston')
    return {
      type: 'heston',
      v0: sigma * sigma,
      theta: sigma * sigma,
      kappa: m.kappa,
      xi: m.xi,
      rho: m.rho,
    }
  if (m.type === 'merton')
    return {
      type: 'merton',
      volatility: sigma,
      intensity: m.intensity,
      jump_mean: m.jumpMeanPct / 100,
      jump_volatility: m.jumpVolPct / 100,
    }
  return { type: 'black_scholes', volatility: sigma }
}

const vol = (variance: number) => Math.sqrt(Math.max(variance, 0)) * 100

function StripChart({ data, stale }: { data?: VarianceResponse; stale: boolean }) {
  const c = useChartColors()
  const option = useMemo<ChartOption | null>(() => {
    if (!data) return null
    const axis = axisStyle(c)
    const total = data.contributions.reduce((a, b) => a + b, 0) || 1
    const share = data.contributions.map((v) => (100 * v) / total)
    const below = data.strikes.map((k, i) => (k < data.forward ? share[i] : 0))
    const above = data.strikes.map((k, i) => (k >= data.forward ? share[i] : 0))
    return {
      animationDurationUpdate: 150,
      grid: GRID,
      tooltip: {
        ...tooltipStyle(c),
        axisPointer: { type: 'shadow' },
        formatter: (raw: unknown) => {
          const i = (raw as { dataIndex: number }[])[0]?.dataIndex ?? 0
          const put = data.strikes[i] < data.forward
          return (
            tooltipHeader(`Strike ${fixed(data.strikes[i], 1)} · ${put ? 'put' : 'call'}`) +
            tooltipRow(
              put ? c.series1 : c.series2,
              `${fixed(share[i], 2)}%`,
              'Share of the variance strike',
            ) +
            tooltipRow(c.muted, fixed(data.option_prices[i], 4), 'Option price') +
            tooltipRow(c.muted, fixed(data.weights[i] * 1e4, 3), 'Weight ×10⁴ (∝ 1/K²)')
          )
        },
      },
      xAxis: {
        type: 'category',
        data: data.strikes.map((k) => fixed(k, 0)),
        name: 'Strike',
        nameLocation: 'middle',
        nameGap: 28,
        ...axis,
        axisLabel: {
          ...axis.axisLabel,
          interval: Math.max(0, Math.round(data.strikes.length / 7) - 1),
        },
        splitLine: { show: false },
      },
      yAxis: { type: 'value', name: 'Share of fair variance (%)', ...axis },
      series: [
        {
          name: 'Puts',
          type: 'bar',
          stack: 's',
          data: below,
          barCategoryGap: 1,
          itemStyle: { color: c.series1, borderRadius: [4, 4, 0, 0] },
        },
        {
          name: 'Calls',
          type: 'bar',
          stack: 's',
          data: above,
          barCategoryGap: 1,
          itemStyle: { color: c.series2, borderRadius: [4, 4, 0, 0] },
        },
      ],
    }
  }, [data, c])
  return (
    <ChartCard
      title="The replicating strip"
      description="Each bar is one out-of-the-money option times its 1/K² weight. Most of the value comes from strikes near the money, but the weights favour low strikes, so puts outweigh calls and a steep put skew makes variance expensive."
      action={
        <div className="flex gap-4">
          <LegendKey color={c.series1} label="Puts (below forward)" band />
          <LegendKey color={c.series2} label="Calls (above forward)" band />
        </div>
      }
      stale={stale}
    >
      {option ? (
        <EChart option={option} ariaLabel="Contribution of each option in the replicating strip" />
      ) : (
        <div className="h-72" />
      )}
    </ChartCard>
  )
}

export default function VariancePage() {
  const c = useChartColors()
  const [model, setModel] = useState<Model>(DEFAULT_MODEL)
  const [expiry, setExpiry] = useState(1)
  const [strikes, setStrikes] = useState(41)
  const [width, setWidth] = useState(6)
  const [market, setMarket] = useState<MarketParams>(DEFAULT_MARKET)
  // One stable object per change, so the debounce settles instead of re-rendering forever.
  const inputs = useMemo(
    () => ({ model, expiry, strikes, width, market }),
    [model, expiry, strikes, width, market],
  )
  const settled = useDebouncedValue(inputs, 200)
  const request = useMemo<VarianceRequest>(
    () => ({
      ...toMarket(settled.market),
      expiry: settled.expiry,
      n_strikes: settled.strikes,
      width: settled.width,
      model: toSpec(settled.model),
      paths: 20_000,
    }),
    [settled],
  )
  const query = useQuery({
    queryKey: ['structured', 'variance', request],
    queryFn: ({ signal }) => api.varianceSwap(request, signal),
    placeholderData: keepPreviousData,
  })
  const data = query.data
  const stale = query.isPlaceholderData
  const set =
    <K extends keyof Model>(key: K) =>
    (value: Model[K]) =>
      setModel({ ...model, [key]: value })
  const replicationError = data ? vol(data.replicated_variance) - vol(data.expected_variance) : null
  const smile = data
    ? data.strikes.flatMap((k, i) => {
        const v = data.implied_vols[i]
        return v == null ? [] : [[k, v * 100] as [number, number]]
      })
    : []

  return (
    <>
      <PageHeader title="Variance and volatility swaps">
        A variance swap pays the difference between realised variance and a strike fixed today. It
        is a pure bet on volatility, with no exposure to where the stock goes. Remarkably, it can be
        hedged with a static strip of options, which is how its fair strike (and the VIX) is
        computed.
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside>
          <Card className="overflow-hidden">
            <PanelSection
              title="Model"
              hint={
                model.type === 'merton'
                  ? 'Jumps break the replication: the option strip no longer equals expected variance.'
                  : model.type === 'heston'
                    ? 'Stochastic volatility: a skewed smile and a convexity gap between variance and volatility swaps.'
                    : 'Constant volatility: every method agrees on σ².'
              }
            >
              <Segmented<Model['type']>
                label="Model"
                value={model.type}
                onChange={set('type')}
                options={[
                  { value: 'black_scholes', label: 'Black–Scholes' },
                  { value: 'heston', label: 'Heston' },
                  { value: 'merton', label: 'Jumps' },
                ]}
                className="w-full"
              />
              <ParamControl
                label={model.type === 'merton' ? 'Diffusion volatility' : 'Volatility level'}
                value={model.volPct}
                onChange={set('volPct')}
                min={5}
                max={60}
                step={1}
                unit="%"
              />
              {model.type === 'heston' && (
                <>
                  <ParamControl
                    label="Vol of variance ξ"
                    value={model.xi}
                    onChange={set('xi')}
                    min={0.05}
                    max={1.5}
                    step={0.05}
                    digits={2}
                  />
                  <ParamControl
                    label="Correlation ρ"
                    value={model.rho}
                    onChange={set('rho')}
                    min={-0.95}
                    max={0.95}
                    step={0.05}
                    digits={2}
                  />
                  <ParamControl
                    label="Mean reversion κ"
                    value={model.kappa}
                    onChange={set('kappa')}
                    min={0.2}
                    max={8}
                    step={0.1}
                    digits={1}
                  />
                </>
              )}
              {model.type === 'merton' && (
                <>
                  <ParamControl
                    label="Jumps per year"
                    value={model.intensity}
                    onChange={set('intensity')}
                    min={0}
                    max={3}
                    step={0.1}
                    digits={1}
                  />
                  <ParamControl
                    label="Average jump"
                    value={model.jumpMeanPct}
                    onChange={set('jumpMeanPct')}
                    min={-30}
                    max={10}
                    step={1}
                    unit="%"
                  />
                  <ParamControl
                    label="Jump size volatility"
                    value={model.jumpVolPct}
                    onChange={set('jumpVolPct')}
                    min={0}
                    max={40}
                    step={1}
                    unit="%"
                  />
                </>
              )}
            </PanelSection>
            <Separator />
            <PanelSection
              title="Contract and strip"
              hint="The strip spans ± the chosen number of at-the-money standard deviations around the forward."
            >
              <ParamControl
                label="Maturity"
                value={expiry}
                onChange={setExpiry}
                min={0.25}
                max={3}
                step={0.25}
                unit="yrs"
                digits={2}
              />
              <ParamControl
                label="Options in the strip"
                value={strikes}
                onChange={(v) => setStrikes(Math.round(v / 2) * 2 + 1)}
                min={5}
                max={201}
                step={2}
              />
              <ParamControl
                label="Strike range"
                value={width}
                onChange={setWidth}
                min={2}
                max={12}
                step={0.5}
                unit="sd"
                digits={1}
              />
            </PanelSection>
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
                <p className="text-muted-foreground text-sm">Fair variance strike</p>
                <p className="mt-1 font-semibold text-5xl tracking-tight tabular-nums">
                  {data ? fixed(vol(data.replicated_variance), 2) : '—'}
                </p>
                <p className="mt-1.5 text-muted-foreground text-xs">
                  Volatility points, from {strikes} options · quoted as √K<sub>var</sub>
                </p>
              </div>
              <StatGrid className="self-start grid-cols-2">
                <Stat
                  label="Model’s expected variance"
                  value={data ? `${fixed(vol(data.expected_variance), 2)} pts` : '—'}
                  hint="Exact, continuous monitoring"
                />
                <Stat
                  label="Replication error"
                  value={replicationError == null ? '—' : `${signed(replicationError, 2)} pts`}
                  hint={
                    model.type === 'merton'
                      ? 'Jumps: the strip misprices variance'
                      : 'Strike spacing and range'
                  }
                />
                <Stat
                  label="Simulated, daily returns"
                  value={data ? `${fixed(vol(data.simulated_variance), 2)} pts` : '—'}
                  hint={
                    data
                      ? `± ${fixed((1.96 * data.simulated_variance_stderr * 100 * 100) / (2 * vol(data.simulated_variance)), 2)} · 20,000 paths`
                      : undefined
                  }
                />
                <Stat
                  label="Volatility swap strike"
                  value={data ? `${fixed(data.fair_volatility * 100, 2)} pts` : '—'}
                  hint={
                    data
                      ? `${fixed(data.convexity_adjustment * 100, 2)} pts below √K_var (convexity)`
                      : undefined
                  }
                />
              </StatGrid>
            </div>
          </Card>
          <div className="grid gap-6 xl:grid-cols-2">
            <LinesChart
              title="The smile the options are priced on"
              description="Black–Scholes implied volatility of each option in the strip. Heston’s negative spot–vol correlation makes low strikes dearer; jumps steepen the short-dated skew."
              series={[{ name: 'Implied vol', color: c.series1, points: smile }]}
              xName="Strike"
              yName="Implied vol (%)"
              xFormat={(x) => fixed(x, 0)}
              yFormat={(y) => fixed(y, 1)}
              current={data?.forward}
              stale={stale}
              ariaLabel="Implied volatility by strike"
            />
            <StripChart data={data} stale={stale} />
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <LinesChart
              title="More options, smaller error"
              description="The strip is an integral approximated with discrete strikes. The error falls with the square of the spacing; listed strikes are a few points apart, which is one source of VIX error."
              series={
                data
                  ? [
                      {
                        name: 'Replicated',
                        color: c.series1,
                        points: data.convergence.x.map((n, i) => [n, vol(data.convergence.y[i])]),
                        markers: true,
                      },
                      {
                        name: 'Model’s expected variance',
                        color: c.series2,
                        dashed: true,
                        points: [
                          [data.convergence.x[0], vol(data.expected_variance)],
                          [
                            data.convergence.x[data.convergence.x.length - 1],
                            vol(data.expected_variance),
                          ],
                        ],
                      },
                    ]
                  : []
              }
              xName="Options in the strip (log scale)"
              yName="√K_var (vol points)"
              logX
              xFormat={(x) => fixed(x, 0)}
              yFormat={(y) => fixed(y, 2)}
              stale={stale}
              ariaLabel="Replicated variance strike against the number of options"
            />
            <HistogramChart
              title="Realised volatility across paths"
              description="What the swap pays depends on the path. The dashed lines mark the volatility swap strike (the average, left) and √K_var (the root-mean-square, right), which is always higher."
              histograms={
                data ? [{ name: 'Paths', color: c.series1, data: data.realised_vols }] : []
              }
              xName="Realised volatility (%)"
              xFormat={(x) => fixed(x * 100, 1)}
              markers={
                data
                  ? [
                      { x: data.fair_volatility, label: 'vol swap' },
                      { x: Math.sqrt(data.simulated_variance), label: '√var' },
                    ]
                  : []
              }
              stale={stale}
              ariaLabel="Distribution of realised volatility"
            />
          </div>
        </div>
      </div>
    </>
  )
}
