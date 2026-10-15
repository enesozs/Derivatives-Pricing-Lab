import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertTriangleIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ChartCard, LegendKey } from '@/components/charts/chart-card'
import { EChart, type ChartOption } from '@/components/charts/echart'
import {
  axisStyle,
  type ChartColors,
  GRID,
  tooltipHeader,
  tooltipRow,
  tooltipStyle,
  useChartColors,
} from '@/components/charts/theme'
import { NumberInput } from '@/components/number-input'
import { PageHeader } from '@/components/page-header'
import { PanelSection } from '@/components/panel-section'
import { ParamControl } from '@/components/param-control'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardPanel, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { api, type Fan, type HWCalibrationResponse, type ShortRateResponse } from '@/lib/api'
import { fixed, money } from '@/lib/format'
import { cn } from '@/lib/utils'
import { tenorLabel, useCurveQuotes } from './curve-context'
import { CurveNote } from './curve-note'
import { Stat, StatGrid } from '@/components/stat-grid'

interface Params {
  a: number
  sigmaBp: number
  vasicekBPct: number
  horizon: number
  expiry: number
  tenor: number
}

const DEFAULTS: Params = { a: 0.05, sigmaBp: 100, vasicekBPct: 4, horizon: 10, expiry: 2, tenor: 5 }

const CAP_MATURITIES = [1, 2, 3, 5, 7, 10]
const CAP_VOLS_PCT = [30, 28, 26, 24, 22, 21]

function fanOption(c: ChartColors, fan: Fan, title: string, yRange: [number, number]): ChartOption {
  const axis = axisStyle(c)
  const pct = (xs: number[]) => xs.map((v) => v * 100)
  const p05 = pct(fan.p05)
  const p25 = pct(fan.p25)
  const p50 = pct(fan.p50)
  const p75 = pct(fan.p75)
  const p95 = pct(fan.p95)
  const band = (name: string, lower: number[], upper: number[], opacity: number) => [
    {
      name: `${name}-base`,
      type: 'line' as const,
      data: lower,
      stack: name,
      showSymbol: false,
      lineStyle: { opacity: 0 },
      silent: true,
    },
    {
      name,
      type: 'line' as const,
      data: upper.map((u, i) => u - lower[i]),
      stack: name,
      showSymbol: false,
      lineStyle: { opacity: 0 },
      areaStyle: { color: c.series1, opacity },
      silent: true,
    },
  ]
  return {
    animationDurationUpdate: 150,
    grid: GRID,
    tooltip: {
      ...tooltipStyle(c),
      formatter: (raw: unknown) => {
        const i = (raw as { dataIndex: number }[])[0]?.dataIndex ?? 0
        return (
          tooltipHeader(`${title} · year ${fixed(fan.times[i], 1)}`) +
          tooltipRow(c.series1, `${fixed(p50[i], 2)}%`, 'Median') +
          tooltipRow(c.muted, `${fixed(p25[i], 2)} to ${fixed(p75[i], 2)}%`, 'Middle 50%') +
          tooltipRow(c.muted, `${fixed(p05[i], 2)} to ${fixed(p95[i], 2)}%`, 'Middle 90%')
        )
      },
    },
    xAxis: {
      type: 'category',
      data: fan.times.map((t) => fixed(t, 1)),
      boundaryGap: false,
      name: 'Years ahead',
      nameLocation: 'middle',
      nameGap: 28,
      ...axis,
      axisLabel: { ...axis.axisLabel, interval: Math.round(fan.times.length / 5) - 1 },
      splitLine: { show: false },
    },
    yAxis: { type: 'value', name: 'Short rate (%)', min: yRange[0], max: yRange[1], ...axis },
    series: [
      ...band('90%', p05, p95, 0.14),
      ...band('50%', p25, p75, 0.22),
      {
        name: 'Median',
        type: 'line',
        data: p50,
        showSymbol: false,
        lineStyle: { width: 2, color: c.series1 },
        itemStyle: { color: c.series1 },
      },
    ],
  }
}

function FanCharts({ data, stale }: { data?: ShortRateResponse; stale: boolean }) {
  const c = useChartColors()
  const options = useMemo(() => {
    if (!data) return null
    const all = [
      ...data.hull_white.p05,
      ...data.hull_white.p95,
      ...data.vasicek.p05,
      ...data.vasicek.p95,
    ].map((v) => v * 100)
    const range: [number, number] = [
      Math.floor(Math.min(...all) / 2) * 2,
      Math.ceil(Math.max(...all) / 2) * 2,
    ]
    return [
      fanOption(c, data.hull_white, 'Hull–White', range),
      fanOption(c, data.vasicek, 'Vasicek', range),
    ]
  }, [data, c])
  const legend = (
    <div className="flex gap-4">
      <LegendKey color={c.series1} label="Median" />
      <LegendKey color={c.band} label="Middle 50% / 90%" band />
    </div>
  )
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <ChartCard
        title="Hull–White short rate"
        description="Its drift follows the market’s forward curve, so the median traces the forwards. Mean reversion a pulls rates back and caps how wide the fan gets."
        action={legend}
        stale={stale}
      >
        {options ? (
          <EChart
            option={options[0]}
            ariaLabel="Hull–White simulated short-rate percentiles over time"
          />
        ) : (
          <div className="h-72" />
        )}
      </ChartCard>
      <ChartCard
        title="Vasicek short rate"
        description="Same dynamics, but the drift pulls towards one constant level b instead of the curve. Today’s curve is ignored apart from the starting rate."
        action={legend}
        stale={stale}
      >
        {options ? (
          <EChart
            option={options[1]}
            ariaLabel="Vasicek simulated short-rate percentiles over time"
          />
        ) : (
          <div className="h-72" />
        )}
      </ChartCard>
    </div>
  )
}

function ZeroCurveChart({ data, stale }: { data?: ShortRateResponse; stale: boolean }) {
  const c = useChartColors()
  const option = useMemo<ChartOption | null>(() => {
    if (!data) return null
    const axis = axisStyle(c)
    const t = data.market_zero_times
    const line = (ys: number[]) => t.map((x, i) => [x, ys[i] * 100])
    return {
      animationDurationUpdate: 150,
      grid: GRID,
      tooltip: {
        ...tooltipStyle(c),
        formatter: (raw: unknown) => {
          const i = (raw as { dataIndex: number }[])[0]?.dataIndex ?? 0
          return (
            tooltipHeader(`${fixed(t[i], 1)} years`) +
            tooltipRow(c.series1, `${fixed(data.market_zero[i] * 100, 3)}%`, 'Market') +
            tooltipRow(c.series2, `${fixed(data.hull_white_zero[i] * 100, 3)}%`, 'Hull–White') +
            tooltipRow(c.series3, `${fixed(data.vasicek_zero[i] * 100, 3)}%`, 'Vasicek')
          )
        },
      },
      xAxis: {
        type: 'value',
        name: 'Maturity (years)',
        nameLocation: 'middle',
        nameGap: 28,
        min: 0,
        max: t[t.length - 1],
        ...axis,
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: 'Zero rate (%)',
        scale: true,
        ...axis,
        axisLabel: { ...axis.axisLabel, formatter: (v: number) => fixed(v, 2) },
      },
      series: [
        {
          name: 'Vasicek',
          type: 'line',
          data: line(data.vasicek_zero),
          showSymbol: false,
          lineStyle: { width: 2, color: c.series3 },
          itemStyle: { color: c.series3 },
        },
        {
          name: 'Market',
          type: 'line',
          data: line(data.market_zero),
          showSymbol: false,
          lineStyle: { width: 2, color: c.series1 },
          itemStyle: { color: c.series1 },
        },
        {
          name: 'Hull–White',
          type: 'line',
          data: line(data.hull_white_zero),
          showSymbol: false,
          lineStyle: { width: 2, color: c.series2, type: 'dashed' },
          itemStyle: { color: c.series2 },
        },
      ],
    }
  }, [data, c])
  return (
    <ChartCard
      title="Does the model fit today’s curve?"
      description="Hull–White’s time-dependent drift is solved so it reproduces the market curve exactly (the dashed line sits on it). Vasicek has three constants and can only produce a few curve shapes."
      action={
        <div className="flex flex-wrap gap-4">
          <LegendKey color={c.series1} label="Market" />
          <LegendKey color={c.series2} label="Hull–White" />
          <LegendKey color={c.series3} label="Vasicek" />
        </div>
      }
      stale={stale}
    >
      {option ? (
        <EChart option={option} ariaLabel="Zero curves: market, Hull–White and Vasicek" />
      ) : (
        <div className="h-72" />
      )}
    </ChartCard>
  )
}

function CalibrationChart({ data }: { data?: HWCalibrationResponse }) {
  const c = useChartColors()
  const option = useMemo<ChartOption | null>(() => {
    if (!data) return null
    const axis = axisStyle(c)
    const pts = (ys: number[]) => data.maturities.map((m, i) => [m, ys[i] * 100])
    const marker = (color: string) => ({ color, borderColor: c.surface, borderWidth: 2 })
    return {
      animationDurationUpdate: 150,
      grid: GRID,
      tooltip: {
        ...tooltipStyle(c),
        formatter: (raw: unknown) => {
          const i = (raw as { dataIndex: number }[])[0]?.dataIndex ?? 0
          return (
            tooltipHeader(`${tenorLabel(data.maturities[i])} ATM cap`) +
            tooltipRow(c.series1, `${fixed(data.market_vols[i] * 100, 2)}%`, 'Market') +
            tooltipRow(c.series2, `${fixed(data.model_vols[i] * 100, 2)}%`, 'Hull–White')
          )
        },
      },
      xAxis: {
        type: 'value',
        name: 'Cap maturity (years)',
        nameLocation: 'middle',
        nameGap: 28,
        min: 0,
        ...axis,
        splitLine: { show: false },
      },
      yAxis: { type: 'value', name: 'Flat Black vol (%)', scale: true, ...axis },
      series: [
        {
          name: 'Market',
          type: 'line',
          data: pts(data.market_vols),
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { width: 2, color: c.series1 },
          itemStyle: marker(c.series1),
        },
        {
          name: 'Hull–White',
          type: 'line',
          data: pts(data.model_vols),
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { width: 2, color: c.series2 },
          itemStyle: marker(c.series2),
        },
      ],
    }
  }, [data, c])
  return option ? (
    <EChart option={option} ariaLabel="Market and Hull–White cap volatilities by maturity" />
  ) : (
    <div className="h-72" />
  )
}

export default function ShortRatePage() {
  const c = useChartColors()
  const { quotes } = useCurveQuotes()
  const [params, setParams] = useState(DEFAULTS)
  const [capVols, setCapVols] = useState(CAP_VOLS_PCT)
  const settled = useDebouncedValue(params, 150)
  const curve = useDebouncedValue(quotes, 150)
  const vols = useDebouncedValue(capVols, 300)
  const query = useQuery({
    queryKey: ['rates', 'short-rate', settled, curve],
    queryFn: ({ signal }) =>
      api.shortRate(
        {
          quotes: curve,
          a: settled.a,
          sigma: settled.sigmaBp / 10_000,
          vasicek_b: settled.vasicekBPct / 100,
          horizon: settled.horizon,
          swaption_expiry: settled.expiry,
          swaption_tenor: settled.tenor,
        },
        signal,
      ),
    placeholderData: keepPreviousData,
  })
  const calibration = useQuery({
    queryKey: ['rates', 'hw-calibration', vols, curve],
    queryFn: ({ signal }) =>
      api.calibrateHullWhite(
        { quotes: curve, maturities: CAP_MATURITIES, black_vols: vols.map((v) => v / 100) },
        signal,
      ),
    placeholderData: keepPreviousData,
  })
  const set =
    <K extends keyof Params>(key: K) =>
    (value: Params[K]) =>
      setParams({ ...params, [key]: value })
  const data = query.data
  const stale = query.isPlaceholderData
  const fit = calibration.data
  const fitStale = calibration.isPlaceholderData
  const bermudanPremium = data ? data.bermudan_tree - data.european_tree : null
  const error = query.error ?? calibration.error

  return (
    <>
      <PageHeader title="Short-rate models">
        Instead of modelling each rate separately, model one random instantaneous rate r(t) and
        derive the whole curve from it. Hull–White fits today’s curve exactly and prices caps,
        swaptions and Bermudan swaptions consistently.
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside>
          <Card className="overflow-hidden">
            <PanelSection
              title="Dynamics"
              hint="dr = (θ(t) − a r) dt + σ dW. Vasicek replaces θ(t) with the constant a·b."
            >
              <ParamControl
                label="Mean reversion a"
                value={params.a}
                onChange={set('a')}
                min={0.01}
                max={1}
                step={0.01}
                digits={2}
              />
              <ParamControl
                label="Volatility σ"
                value={params.sigmaBp}
                onChange={set('sigmaBp')}
                min={10}
                max={300}
                step={5}
                unit="bp"
              />
              <ParamControl
                label="Vasicek level b"
                value={params.vasicekBPct}
                onChange={set('vasicekBPct')}
                min={0}
                max={10}
                step={0.1}
                unit="%"
                digits={1}
              />
              <ParamControl
                label="Simulation horizon"
                value={params.horizon}
                onChange={set('horizon')}
                min={1}
                max={30}
                step={1}
                unit="yrs"
              />
            </PanelSection>
            <Separator />
            <PanelSection
              title="Swaption"
              hint="At the money, payer, annual fixed leg, 10M notional."
            >
              <ParamControl
                label="Expiry"
                value={params.expiry}
                onChange={set('expiry')}
                min={0.5}
                max={10}
                step={0.5}
                unit="yrs"
                digits={1}
              />
              <ParamControl
                label="Swap tenor"
                value={params.tenor}
                onChange={set('tenor')}
                min={1}
                max={20}
                step={1}
                unit="yrs"
              />
            </PanelSection>
          </Card>
        </aside>
        <div className="flex min-w-0 flex-col gap-6">
          <CurveNote />
          {error && (
            <Alert variant="error">
              <AlertTriangleIcon />
              <AlertTitle>Model failed</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}
          <Card className={cn('transition-opacity', stale && 'opacity-60')}>
            <CardHeader>
              <CardTitle className="text-base" render={<h2 />}>
                {tenorLabel(params.expiry)} into {tenorLabel(params.tenor)} payer swaption under
                Hull–White
              </CardTitle>
              <CardDescription>
                The European price two ways: Jamshidian’s closed form and a trinomial tree. The same
                tree then lets the holder exercise on any fixed-leg date (Bermudan), which is worth
                more.
              </CardDescription>
            </CardHeader>
            <CardPanel className="pt-0">
              <StatGrid className="grid-cols-2 xl:grid-cols-4">
                <Stat
                  label="European, closed form"
                  value={money(data?.european_jamshidian)}
                  hint={data ? `Strike ${fixed(data.swaption_strike * 100, 3)}% (ATM)` : undefined}
                />
                <Stat
                  label="European, tree"
                  value={money(data?.european_tree)}
                  hint={
                    data
                      ? `${fixed(((data.european_tree - data.european_jamshidian) / data.european_jamshidian) * 100, 2)}% from closed form`
                      : undefined
                  }
                />
                <Stat
                  label="Bermudan, tree"
                  value={money(data?.bermudan_tree)}
                  hint="Exercise on any reset date"
                />
                <Stat
                  label="Early-exercise premium"
                  value={money(bermudanPremium)}
                  hint={
                    data && bermudanPremium != null
                      ? `${fixed((bermudanPremium / data.european_tree) * 100, 1)}% of the European`
                      : undefined
                  }
                />
              </StatGrid>
            </CardPanel>
          </Card>
          <FanCharts data={data} stale={stale} />
          <ZeroCurveChart data={data} stale={stale} />
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-base" render={<h2 />}>
                  Calibrate Hull–White to caps
                </CardTitle>
                <CardDescription>
                  Find a and σ so that model cap prices match at-the-money caps quoted as flat Black
                  vols. Two parameters can’t match six quotes exactly: the residual is the model’s
                  limit.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={!fit}
                onClick={() =>
                  fit &&
                  setParams({
                    ...params,
                    a: Math.round(fit.a * 100) / 100,
                    sigmaBp: Math.round(fit.sigma * 2000) * 5,
                  })
                }
              >
                Use fitted a, σ
              </Button>
            </CardHeader>
            <CardPanel className="flex flex-col gap-5 pt-0">
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {CAP_MATURITIES.map((m, i) => (
                  <NumberInput
                    key={m}
                    label={`${tenorLabel(m)} cap vol`}
                    value={capVols[i]}
                    onChange={(v) => setCapVols(capVols.map((x, j) => (j === i ? v : x)))}
                    min={5}
                    max={100}
                    step={0.5}
                    digits={1}
                    unit="%"
                  />
                ))}
              </div>
              <div
                className={cn(
                  'grid gap-6 transition-opacity xl:grid-cols-[14rem_minmax(0,1fr)]',
                  fitStale && 'opacity-60',
                )}
              >
                <StatGrid className="grid-cols-3 self-start xl:grid-cols-1">
                  <Stat label="Mean reversion a" value={fit ? fixed(fit.a, 3) : '—'} />
                  <Stat
                    label="Volatility σ"
                    value={fit ? `${fixed(fit.sigma * 10_000, 1)}bp` : '—'}
                  />
                  <Stat
                    label="Vol RMSE"
                    value={fit ? `${fixed(fit.rmse * 100, 2)}%` : '—'}
                    hint="Black vol points"
                  />
                </StatGrid>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-4">
                    <LegendKey color={c.series1} label="Market" />
                    <LegendKey color={c.series2} label="Hull–White" />
                  </div>
                  <CalibrationChart data={fit} />
                </div>
              </div>
            </CardPanel>
          </Card>
        </div>
      </div>
    </>
  )
}
