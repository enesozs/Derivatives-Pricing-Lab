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
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { type AmericanMCResponse, api, type OptionKind } from '@/lib/api'
import { compact, fixed, milliseconds } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  DEFAULT_MODEL,
  type ModelParams,
  ModelSection,
  toModelSpec,
} from '@/components/model-section'

interface Params {
  kind: OptionKind
  strike: number
  expiry: number
  spot: number
  ratePct: number
  dividendPct: number
  model: ModelParams
  paths: number
  exerciseDates: number
  degree: number
}

const DEFAULTS: Params = {
  kind: 'put',
  strike: 100,
  expiry: 1,
  spot: 100,
  ratePct: 5,
  dividendPct: 0,
  model: { ...DEFAULT_MODEL, volPct: 20 },
  paths: 50_000,
  exerciseDates: 50,
  degree: 3,
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex flex-col gap-0.5 bg-card p-3.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-semibold text-lg tracking-tight">{value}</span>
      <span className="text-[11px] text-muted-foreground">{hint}</span>
    </div>
  )
}

function Summary({ data, stale }: { data: AmericanMCResponse | undefined; stale: boolean }) {
  return (
    <Card className={cn('transition-opacity', stale && 'opacity-60')}>
      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-8">
        <div>
          <p className="text-muted-foreground text-sm">Longstaff–Schwartz value</p>
          <p className="mt-1 font-semibold text-5xl tracking-tight">
            {data ? fixed(data.lsm_value, 4) : '—'}
          </p>
          <p className="mt-1.5 text-muted-foreground text-xs">
            {data
              ? `± ${fixed(1.96 * data.lsm_stderr, 4)} (95%) · ${milliseconds(data.runtime_ms)} incl. reference`
              : 'Simulating…'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-px self-start overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
          <Stat
            label="Reference"
            value={data?.reference_value == null ? '—' : fixed(data.reference_value, 4)}
            hint={data?.reference_label ?? 'No tree for this model'}
          />
          <Stat
            label="European (no early exercise)"
            value={data ? fixed(data.european_value, 4) : '—'}
            hint="Closed form / Fourier"
          />
          <Stat
            label="Early-exercise premium"
            value={data ? fixed(data.lsm_value - data.european_value, 4) : '—'}
            hint="American − European"
          />
        </div>
      </div>
    </Card>
  )
}

function BoundaryChart({
  data,
  stale,
  strike,
}: {
  data: AmericanMCResponse | undefined
  stale: boolean
  strike: number
}) {
  const c = useChartColors()
  const option = useMemo<ChartOption | null>(() => {
    if (!data) return null
    const axis = axisStyle(c)
    return {
      animation: false,
      grid: { ...GRID, right: 52 }, // room for the Strike label
      tooltip: {
        ...tooltipStyle(c),
        trigger: 'item',
        formatter: (raw: unknown) => {
          const item = raw as { seriesName: string; value: number[] }
          return (
            tooltipHeader(`t = ${fixed(item.value[0], 3)}y`) +
            tooltipRow(c.series1, fixed(item.value[1], 2), item.seriesName)
          )
        },
      },
      xAxis: {
        type: 'value',
        name: 'Years from today',
        nameLocation: 'middle',
        nameGap: 28,
        min: 0,
        ...axis,
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: 'Spot',
        scale: true,
        ...axis,
        axisLabel: { ...axis.axisLabel, formatter: (v: number) => fixed(v, 0) },
      },
      series: [
        {
          name: 'Simulated exercise',
          type: 'scatter',
          data: data.exercise_points,
          symbolSize: 4,
          itemStyle: { color: c.muted, opacity: 0.45 },
        },
        ...(data.reference_boundary.length
          ? [
              {
                name: 'PDE boundary',
                type: 'line' as const,
                data: data.reference_times.map((t, i) => [t, data.reference_boundary[i]]),
                showSymbol: false,
                connectNulls: false,
                lineStyle: { width: 2, color: c.series2 },
                itemStyle: { color: c.series2 },
              },
            ]
          : []),
        {
          name: 'Longstaff–Schwartz boundary',
          type: 'line',
          data: data.exercise_times.map((t, i) => [t, data.lsm_boundary[i]]),
          symbol: 'circle',
          symbolSize: 7,
          connectNulls: false,
          lineStyle: { width: 2, color: c.series1 },
          itemStyle: { color: c.series1, borderColor: c.surface, borderWidth: 2 },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: c.axis, width: 1, type: 'solid' },
            label: { color: c.muted, fontSize: 11, formatter: '{b}' },
            data: [{ name: 'Strike', yAxis: strike }],
          },
        },
      ],
    }
  }, [data, c, strike])

  return (
    <ChartCard
      title="Where the simulation chooses to exercise"
      description="Grey dots are paths the regression told to exercise. The boundary it implies (blue) tracks the exact PDE boundary (orange) without ever building a grid, which is why the method extends to models and products grids can’t handle."
      action={
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <LegendKey color={c.series1} label="Longstaff–Schwartz" />
          {data?.reference_boundary.length ? (
            <LegendKey color={c.series2} label="PDE (exact)" />
          ) : null}
          <LegendKey color={c.muted} label="Exercised paths" band />
        </div>
      }
      stale={stale}
    >
      {option ? (
        <EChart
          option={option}
          className="h-80"
          ariaLabel="Early exercise boundary from simulation and PDE"
        />
      ) : (
        <div className="h-80" />
      )}
    </ChartCard>
  )
}

function ConvergenceChart({
  data,
  stale,
}: {
  data: AmericanMCResponse | undefined
  stale: boolean
}) {
  const c = useChartColors()
  const option = useMemo<ChartOption | null>(() => {
    if (!data || data.convergence.length === 0) return null
    const axis = axisStyle(c)
    const pts = data.convergence
    const ref = data.reference_value
    return {
      animation: false,
      grid: GRID,
      tooltip: {
        ...tooltipStyle(c),
        formatter: (raw: unknown) => {
          const i = (raw as { dataIndex: number }[])[0]?.dataIndex ?? 0
          const p = pts[i]
          return (
            tooltipHeader(`${compact(p.paths)} paths`) +
            tooltipRow(c.series1, `${fixed(p.value, 4)} ± ${fixed(1.96 * p.stderr, 4)}`, 'LSM') +
            (ref != null ? tooltipRow(c.series2, fixed(ref, 4), 'Tree') : '')
          )
        },
      },
      xAxis: {
        type: 'log',
        name: 'Paths',
        nameLocation: 'middle',
        nameGap: 28,
        min: pts[0].paths,
        max: pts[pts.length - 1].paths,
        ...axis,
        axisLabel: { ...axis.axisLabel, formatter: (v: number) => compact(v) },
        splitLine: { show: false },
      },
      yAxis: { type: 'value', name: 'Value', scale: true, ...axis },
      series: [
        {
          name: 'lower',
          type: 'line',
          stack: 'ci',
          data: pts.map((p) => [p.paths, p.value - 1.96 * p.stderr]),
          showSymbol: false,
          lineStyle: { opacity: 0 },
          silent: true,
        },
        {
          name: '95% interval',
          type: 'line',
          stack: 'ci',
          data: pts.map((p) => [p.paths, 2 * 1.96 * p.stderr]),
          showSymbol: false,
          lineStyle: { opacity: 0 },
          areaStyle: { color: c.band },
          silent: true,
        },
        {
          name: 'LSM',
          type: 'line',
          data: pts.map((p) => [p.paths, p.value]),
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { width: 2, color: c.series1 },
          itemStyle: { color: c.series1, borderColor: c.surface, borderWidth: 2 },
          markLine:
            ref != null
              ? {
                  silent: true,
                  symbol: 'none',
                  lineStyle: { color: c.series2, width: 2, type: 'solid' },
                  label: { show: false },
                  data: [{ yAxis: ref }],
                }
              : undefined,
        },
      ],
    }
  }, [data, c])

  return (
    <ChartCard
      title="Convergence in paths"
      description="More paths shrink the noise; a small gap to the tree remains because exercise is only allowed on the chosen dates and the regression is imperfect."
      action={
        <div className="flex gap-4">
          <LegendKey color={c.series1} label="LSM" />
          <LegendKey color={c.band} label="95% interval" band />
          {data?.reference_value != null && <LegendKey color={c.series2} label="Tree" />}
        </div>
      }
      stale={stale}
    >
      {option ? (
        <EChart
          option={option}
          className="h-80"
          ariaLabel="Longstaff–Schwartz value against number of paths"
        />
      ) : (
        <div className="h-80" />
      )}
    </ChartCard>
  )
}

export default function AmericanPage() {
  const [params, setParams] = useState(DEFAULTS)
  const settled = useDebouncedValue(params, 300)
  const request = useMemo(
    () => ({
      kind: settled.kind,
      strike: settled.strike,
      expiry: settled.expiry,
      spot: settled.spot,
      rate: settled.ratePct / 100,
      dividend_yield: settled.dividendPct / 100,
      model: toModelSpec(settled.model),
      paths: settled.paths,
      exercise_dates: settled.exerciseDates,
      degree: settled.degree,
    }),
    [settled],
  )
  const query = useQuery({
    queryKey: ['exotics', 'american', request],
    queryFn: ({ signal }) => api.americanMC(request, signal),
    placeholderData: keepPreviousData,
  })
  const set =
    <K extends keyof Params>(key: K) =>
    (value: Params[K]) =>
      setParams({ ...params, [key]: value })
  const stale = query.isPlaceholderData

  return (
    <>
      <PageHeader title="American options by simulation">
        Monte Carlo runs forward in time but early exercise is decided backwards. Longstaff and
        Schwartz bridge the two with regression, and that is how desks price callable and
        American-style exotics under any model.
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside>
          <Card className="overflow-hidden">
            <PanelSection
              title="Contract"
              hint="An American option: exercisable at any time up to expiry."
            >
              <Segmented<OptionKind>
                label="Option type"
                value={params.kind}
                onChange={set('kind')}
                options={[
                  { value: 'put', label: 'Put' },
                  { value: 'call', label: 'Call' },
                ]}
                className="w-full"
              />
              <ParamControl
                label="Strike"
                value={params.strike}
                onChange={set('strike')}
                min={50}
                max={150}
                step={1}
              />
              <ParamControl
                label="Time to expiry"
                value={params.expiry}
                onChange={set('expiry')}
                min={0.1}
                max={3}
                step={0.05}
                unit="yrs"
                digits={2}
              />
            </PanelSection>
            <Separator />
            <ModelSection model={params.model} onChange={set('model')} />
            <Separator />
            <PanelSection title="Market">
              <ParamControl
                label="Spot price"
                value={params.spot}
                onChange={set('spot')}
                min={50}
                max={150}
                step={1}
              />
              <ParamControl
                label="Risk-free rate"
                value={params.ratePct}
                onChange={set('ratePct')}
                min={0}
                max={15}
                step={0.25}
                unit="%"
                digits={2}
              />
              <ParamControl
                label="Dividend yield"
                value={params.dividendPct}
                onChange={set('dividendPct')}
                min={0}
                max={15}
                step={0.25}
                unit="%"
                digits={2}
              />
            </PanelSection>
            <Separator />
            <PanelSection
              title="Longstaff–Schwartz"
              hint="Exercise dates turn the American into a Bermudan; the polynomial degree sets the regression basis."
            >
              <ParamControl
                label="Paths"
                value={params.paths}
                onChange={set('paths')}
                min={5_000}
                max={200_000}
                step={5_000}
              />
              <ParamControl
                label="Exercise dates"
                value={params.exerciseDates}
                onChange={set('exerciseDates')}
                min={1}
                max={200}
                step={1}
              />
              <ParamControl
                label="Polynomial degree"
                value={params.degree}
                onChange={set('degree')}
                min={1}
                max={6}
                step={1}
              />
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
          <Summary data={query.data} stale={stale} />
          <BoundaryChart data={query.data} stale={stale} strike={settled.strike} />
          <ConvergenceChart data={query.data} stale={stale} />
        </div>
      </div>
    </>
  )
}
