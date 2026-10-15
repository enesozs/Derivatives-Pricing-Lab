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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardDescription, CardHeader, CardPanel, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { api, type BondResponse, type SwapResponse } from '@/lib/api'
import { compact, fixed } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useCurveQuotes } from './curve-context'
import { CurveNote } from './curve-note'
import { money } from './format'
import { Stat, StatGrid } from './stats'

const NOTIONAL = 10_000_000

interface SwapParams {
  maturity: number
  frequency: number
  side: 'payer' | 'receiver'
  rateMode: 'par' | 'custom'
  fixedPct: number
}

interface BondParams {
  couponPct: number
  maturity: number
  frequency: number
}

function CashFlowChart({
  data,
  payer,
  stale,
}: {
  data?: SwapResponse
  payer: boolean
  stale: boolean
}) {
  const c = useChartColors()
  const option = useMemo<ChartOption | null>(() => {
    if (!data) return null
    const axis = axisStyle(c)
    const sign = payer ? 1 : -1
    const flows = data.cash_flows
    return {
      animationDurationUpdate: 150,
      grid: GRID,
      tooltip: {
        ...tooltipStyle(c),
        axisPointer: { type: 'shadow' },
        formatter: (raw: unknown) => {
          const i = (raw as { dataIndex: number }[])[0]?.dataIndex ?? 0
          const f = flows[i]
          return (
            tooltipHeader(`Payment at ${fixed(f.time, 2)}y · DF ${fixed(f.discount, 4)}`) +
            tooltipRow(c.series1, money(sign * f.floating), 'Floating (projected)') +
            tooltipRow(c.series2, money(-sign * f.fixed), 'Fixed') +
            tooltipRow(
              c.muted,
              money(sign * (f.floating - f.fixed) * f.discount),
              'Net, discounted',
            )
          )
        },
      },
      xAxis: {
        type: 'category',
        data: flows.map((f) => fixed(f.time, f.time % 1 === 0 ? 0 : 2)),
        name: 'Payment date (years)',
        nameLocation: 'middle',
        nameGap: 28,
        ...axis,
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: 'Cash flow',
        ...axis,
        axisLabel: { ...axis.axisLabel, formatter: (v: number) => compact(v) },
      },
      series: [
        {
          name: 'Floating',
          type: 'bar',
          stack: 'flows',
          data: flows.map((f) => sign * f.floating),
          barMaxWidth: 28,
          itemStyle: { color: c.series1, borderRadius: payer ? [4, 4, 0, 0] : [0, 0, 4, 4] },
        },
        {
          name: 'Fixed',
          type: 'bar',
          stack: 'flows',
          data: flows.map((f) => -sign * f.fixed),
          barMaxWidth: 28,
          itemStyle: { color: c.series2, borderRadius: payer ? [0, 0, 4, 4] : [4, 4, 0, 0] },
        },
      ],
    }
  }, [data, payer, c])
  return (
    <ChartCard
      title="Cash flows"
      description="Received above zero, paid below. Floating coupons are projected from the curve’s forward rates; at the par rate their present values exactly offset the fixed leg."
      action={
        <div className="flex gap-4">
          <LegendKey color={c.series1} label="Floating leg" band />
          <LegendKey color={c.series2} label="Fixed leg" band />
        </div>
      }
      stale={stale}
    >
      {option ? (
        <EChart option={option} ariaLabel="Swap cash flows per payment date" />
      ) : (
        <div className="h-72" />
      )}
    </ChartCard>
  )
}

function ShiftChart({ data, stale }: { data?: SwapResponse; stale: boolean }) {
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
            tooltipHeader(`Curve shift ${data.shifts_bp[i] > 0 ? '+' : ''}${data.shifts_bp[i]}bp`) +
            tooltipRow(c.series1, money(data.shifted_npv[i]), 'NPV')
          )
        },
      },
      xAxis: {
        type: 'value',
        name: 'Parallel shift of zero rates (bp)',
        nameLocation: 'middle',
        nameGap: 28,
        min: -200,
        max: 200,
        ...axis,
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: 'NPV',
        ...axis,
        axisLabel: { ...axis.axisLabel, formatter: (v: number) => compact(v) },
      },
      series: [
        {
          name: 'NPV',
          type: 'line',
          data: data.shifts_bp.map((b, i) => [b, data.shifted_npv[i]]),
          showSymbol: false,
          lineStyle: { width: 2, color: c.series1 },
          itemStyle: { color: c.series1 },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: c.axis, type: 'dashed', width: 1 },
            label: { show: false },
            data: [{ yAxis: 0 }, { xAxis: 0 }],
          },
        },
      ],
    }
  }, [data, c])
  return (
    <ChartCard
      title="Value if rates move"
      description="NPV after shifting the whole zero curve. The slope at zero is the DV01; the slight bend is convexity. A payer swap gains when rates rise."
      stale={stale}
    >
      {option ? (
        <EChart option={option} ariaLabel="Swap value against a parallel curve shift" />
      ) : (
        <div className="h-72" />
      )}
    </ChartCard>
  )
}

function PriceYieldChart({ data, stale }: { data?: BondResponse; stale: boolean }) {
  const c = useChartColors()
  const option = useMemo<ChartOption | null>(() => {
    if (!data) return null
    const axis = axisStyle(c)
    const pts = (ys: number[]) => data.yields.map((y, i) => [y * 100, ys[i]])
    return {
      animationDurationUpdate: 150,
      grid: GRID,
      tooltip: {
        ...tooltipStyle(c),
        formatter: (raw: unknown) => {
          const i = (raw as { dataIndex: number }[])[0]?.dataIndex ?? 0
          return (
            tooltipHeader(`Yield ${fixed(data.yields[i] * 100, 2)}%`) +
            tooltipRow(c.series1, fixed(data.exact[i], 3), 'Exact price') +
            tooltipRow(c.series2, fixed(data.duration_approx[i], 3), 'Duration only') +
            tooltipRow(c.series3, fixed(data.convexity_approx[i], 3), 'Duration + convexity')
          )
        },
      },
      xAxis: {
        type: 'value',
        name: 'Yield to maturity (%)',
        nameLocation: 'middle',
        nameGap: 28,
        scale: true,

        ...axis,
        splitLine: { show: false },
        axisLabel: { ...axis.axisLabel, formatter: (v: number) => fixed(v, 1) },
      },
      yAxis: { type: 'value', name: 'Price (per 100)', scale: true, ...axis },
      series: [
        {
          name: 'Duration',
          type: 'line',
          data: pts(data.duration_approx),
          showSymbol: false,
          lineStyle: { width: 2, color: c.series2 },
          itemStyle: { color: c.series2 },
        },
        {
          name: 'Convexity',
          type: 'line',
          data: pts(data.convexity_approx),
          showSymbol: false,
          lineStyle: { width: 2, color: c.series3, type: 'dashed' },
          itemStyle: { color: c.series3 },
        },
        {
          name: 'Exact',
          type: 'line',
          data: pts(data.exact),
          showSymbol: false,
          lineStyle: { width: 2, color: c.series1 },
          itemStyle: { color: c.series1 },
          markPoint: {
            silent: true,
            symbol: 'circle',
            symbolSize: 8,
            itemStyle: { color: c.series1, borderColor: c.surface, borderWidth: 2 },
            label: { show: false },
            data: [{ name: 'Today', coord: [data.yield_to_maturity * 100, data.price] }],
          },
        },
      ],
    }
  }, [data, c])
  return (
    <ChartCard
      title="Price against yield"
      description="The exact price curve bends (convexity). Duration alone is its tangent and always underprices; adding the convexity term follows the curve closely for moves of a few percent."
      action={
        <div className="flex flex-wrap gap-4">
          <LegendKey color={c.series1} label="Exact" />
          <LegendKey color={c.series2} label="Duration" />
          <LegendKey color={c.series3} label="Duration + convexity" />
        </div>
      }
      stale={stale}
    >
      {option ? (
        <EChart
          option={option}
          className="h-80"
          ariaLabel="Bond price against yield, exact and approximations"
        />
      ) : (
        <div className="h-80" />
      )}
    </ChartCard>
  )
}

export default function LinearPage() {
  const { quotes } = useCurveQuotes()
  const [swap, setSwap] = useState<SwapParams>({
    maturity: 5,
    frequency: 1,
    side: 'payer',
    rateMode: 'par',
    fixedPct: 4,
  })
  const [bond, setBond] = useState<BondParams>({ couponPct: 4, maturity: 10, frequency: 2 })
  const swapSettled = useDebouncedValue(swap, 150)
  const bondSettled = useDebouncedValue(bond, 150)
  const curveSettled = useDebouncedValue(quotes, 150)

  const swapQuery = useQuery({
    queryKey: ['rates', 'swap', swapSettled, curveSettled],
    queryFn: ({ signal }) =>
      api.rateSwap(
        {
          quotes: curveSettled,
          maturity: swapSettled.maturity,
          frequency: swapSettled.frequency,
          payer: swapSettled.side === 'payer',
          fixed_rate: swapSettled.rateMode === 'par' ? null : swapSettled.fixedPct / 100,
          notional: NOTIONAL,
        },
        signal,
      ),
    placeholderData: keepPreviousData,
  })
  const bondQuery = useQuery({
    queryKey: ['rates', 'bond', bondSettled, curveSettled],
    queryFn: ({ signal }) =>
      api.rateBond(
        {
          quotes: curveSettled,
          coupon: bondSettled.couponPct / 100,
          maturity: bondSettled.maturity,
          frequency: bondSettled.frequency,
        },
        signal,
      ),
    placeholderData: keepPreviousData,
  })
  const s = swapQuery.data
  const b = bondQuery.data
  const swapStale = swapQuery.isPlaceholderData
  const bondStale = bondQuery.isPlaceholderData
  const setS =
    <K extends keyof SwapParams>(key: K) =>
    (value: SwapParams[K]) =>
      setSwap({ ...swap, [key]: value })
  const setB =
    <K extends keyof BondParams>(key: K) =>
    (value: BondParams[K]) =>
      setBond({ ...bond, [key]: value })
  const error = swapQuery.error ?? bondQuery.error

  return (
    <>
      <PageHeader title="Swaps and bonds">
        Linear products: their value moves one-for-one with the curve, with no optionality. A swap
        trades fixed coupons for floating ones; a bond is a strip of fixed coupons plus the face
        value.
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside>
          <Card className="overflow-hidden">
            <PanelSection
              title="Interest-rate swap"
              hint={`Notional ${money(NOTIONAL)}. Floating leg pays the period’s forward rate.`}
            >
              <Segmented<SwapParams['side']>
                label="Swap direction"
                value={swap.side}
                onChange={setS('side')}
                options={[
                  { value: 'payer', label: 'Pay fixed' },
                  { value: 'receiver', label: 'Receive fixed' },
                ]}
                className="w-full"
              />
              <ParamControl
                label="Maturity"
                value={swap.maturity}
                onChange={setS('maturity')}
                min={1}
                max={30}
                step={1}
                unit="yrs"
              />
              <Segmented<string>
                label="Fixed payments per year"
                value={String(swap.frequency)}
                onChange={(v) => setS('frequency')(Number(v))}
                options={[
                  { value: '1', label: 'Annual' },
                  { value: '2', label: 'Semi' },
                  { value: '4', label: 'Quarterly' },
                ]}
                className="w-full"
              />
              <Segmented<SwapParams['rateMode']>
                label="Fixed rate"
                value={swap.rateMode}
                onChange={setS('rateMode')}
                options={[
                  { value: 'par', label: 'At par' },
                  { value: 'custom', label: 'Off-market' },
                ]}
                className="w-full"
              />
              {swap.rateMode === 'custom' && (
                <ParamControl
                  label="Fixed rate"
                  value={swap.fixedPct}
                  onChange={setS('fixedPct')}
                  min={0}
                  max={10}
                  step={0.05}
                  unit="%"
                  digits={2}
                />
              )}
            </PanelSection>
            <Separator />
            <PanelSection title="Fixed-rate bond" hint="Face 100, priced off the same curve.">
              <ParamControl
                label="Coupon"
                value={bond.couponPct}
                onChange={setB('couponPct')}
                min={0}
                max={10}
                step={0.125}
                unit="%"
                digits={3}
              />
              <ParamControl
                label="Maturity"
                value={bond.maturity}
                onChange={setB('maturity')}
                min={1}
                max={30}
                step={1}
                unit="yrs"
              />
              <Segmented<string>
                label="Coupons per year"
                value={String(bond.frequency)}
                onChange={(v) => setB('frequency')(Number(v))}
                options={[
                  { value: '1', label: 'Annual' },
                  { value: '2', label: 'Semi-annual' },
                ]}
                className="w-full"
              />
            </PanelSection>
          </Card>
        </aside>
        <div className="flex min-w-0 flex-col gap-6">
          <CurveNote />
          {error && (
            <Alert variant="error">
              <AlertTriangleIcon />
              <AlertTitle>Pricing failed</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}
          <Card className={cn('transition-opacity', swapStale && 'opacity-60')}>
            <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-8">
              <div>
                <p className="text-muted-foreground text-sm">
                  {swap.side === 'payer' ? 'Payer' : 'Receiver'} swap NPV
                </p>
                <p className="mt-1 font-semibold text-5xl tracking-tight tabular-nums">
                  {money(s?.npv)}
                </p>
                <p className="mt-1.5 text-muted-foreground text-xs">
                  {s
                    ? `Fixed ${fixed(s.fixed_rate * 100, 3)}% vs par ${fixed(s.par_rate * 100, 3)}%`
                    : ' '}
                </p>
              </div>
              <StatGrid className="self-start sm:grid-cols-3">
                <Stat
                  label="Par swap rate"
                  value={s ? `${fixed(s.par_rate * 100, 3)}%` : '—'}
                  hint="Fixed rate that makes NPV zero"
                />
                <Stat
                  label="Annuity"
                  value={s ? fixed(s.annuity, 4) : '—'}
                  hint="PV of 1 a year on the fixed dates"
                />
                <Stat label="DV01" value={money(s?.dv01)} hint="Gain if rates fall 1bp" />
              </StatGrid>
            </div>
          </Card>
          <div className="grid gap-6 xl:grid-cols-2">
            <CashFlowChart data={s} payer={swapSettled.side === 'payer'} stale={swapStale} />
            <ShiftChart data={s} stale={swapStale} />
          </div>
          <Card className={cn('transition-opacity', bondStale && 'opacity-60')}>
            <CardHeader>
              <CardTitle className="text-base" render={<h2 />}>
                Bond analytics
              </CardTitle>
              <CardDescription>
                Price from the curve; the yield is the single rate that gives the same price.
                Duration and convexity are measured against that yield.
              </CardDescription>
            </CardHeader>
            <CardPanel className="pt-0">
              <StatGrid className="grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
                <Stat label="Price" value={b ? fixed(b.price, 3) : '—'} hint="Per 100 face" />
                <Stat
                  label="Yield"
                  value={b ? `${fixed(b.yield_to_maturity * 100, 3)}%` : '—'}
                  hint={`Compounded ${bond.frequency === 2 ? 'semi-annually' : 'annually'}`}
                />
                <Stat
                  label="Macaulay duration"
                  value={b ? `${fixed(b.macaulay_duration, 2)}y` : '—'}
                  hint="PV-weighted average time"
                />
                <Stat
                  label="Modified duration"
                  value={b ? fixed(b.modified_duration, 2) : '—'}
                  hint="% price change per 1% yield"
                />
                <Stat
                  label="Convexity"
                  value={b ? fixed(b.convexity, 1) : '—'}
                  hint="Curvature of price in yield"
                />
                <Stat
                  label="DV01"
                  value={b ? fixed(b.dv01, 4) : '—'}
                  hint="Price gain per 1bp fall"
                />
              </StatGrid>
            </CardPanel>
          </Card>
          <PriceYieldChart data={b} stale={bondStale} />
        </div>
      </div>
    </>
  )
}
