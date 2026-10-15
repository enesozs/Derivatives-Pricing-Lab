import { useMemo } from 'react'
import { EChart, type ChartOption } from '@/components/charts/echart'
import {
  axisStyle,
  GRID,
  tooltipHeader,
  tooltipRow,
  tooltipStyle,
  useChartColors,
} from '@/components/charts/theme'
import type { ConvergenceResponse } from '@/lib/api'
import { compact, fixed, integer, scientific } from '@/lib/format'
import { ChartCard, LegendKey } from '@/components/charts/chart-card'

interface ConvergenceProps {
  data: ConvergenceResponse | undefined
  stale: boolean
}

const MARKER = { symbol: 'circle', symbolSize: 8 } as const

const GRID_SERIES = [
  { key: 'crr', label: 'CRR tree', color: 'series1' },
  { key: 'leisen_reimer', label: 'Leisen–Reimer tree', color: 'series2' },
  { key: 'pde', label: 'Crank–Nicolson PDE', color: 'series3' },
] as const

export function LatticeConvergenceChart({ data, stale }: ConvergenceProps) {
  const c = useChartColors()
  const option = useMemo<ChartOption | null>(() => {
    if (!data) return null
    const axis = axisStyle(c)
    // Log scales cannot show an exact zero; floor at machine-precision level.
    const floor = (e: number) => Math.max(e, 1e-12)
    const all = GRID_SERIES.flatMap((s) => data[s.key].map((p) => p.steps))
    return {
      animationDurationUpdate: 200,
      grid: { ...GRID, right: 96 },
      tooltip: {
        ...tooltipStyle(c),
        trigger: 'item',
        formatter: (raw: unknown) => {
          const item = raw as { seriesIndex: number; dataIndex: number }
          const series = GRID_SERIES[item.seriesIndex]
          const p = data[series.key][item.dataIndex]
          const unit = series.key === 'pde' ? 'space steps' : 'steps'
          return (
            tooltipHeader(`${series.label} · ${integer(p.steps)} ${unit}`) +
            tooltipRow(c[series.color], scientific(p.abs_error), 'Absolute error') +
            tooltipRow(c.muted, fixed(p.value, 6), 'Value')
          )
        },
      },
      xAxis: {
        type: 'log',
        logBase: 2,
        min: Math.min(...all),
        max: Math.max(...all),
        name: 'Steps (tree) / space steps (PDE)',
        nameLocation: 'middle',
        nameGap: 28,
        ...axis,
        splitLine: { show: false },
      },
      yAxis: {
        type: 'log',
        name: 'Absolute error',
        ...axis,
        axisLabel: { ...axis.axisLabel, formatter: (v: number) => scientific(v) },
      },
      series: GRID_SERIES.map((s) => ({
        name: s.label,
        type: 'line' as const,
        data: data[s.key].map((p) => [p.steps, floor(p.abs_error)]),
        ...MARKER,
        lineStyle: { width: 2, color: c[s.color] },
        itemStyle: { color: c[s.color], borderColor: c.surface, borderWidth: 2 },
        // Direct labels at the line ends: identity never relies on colour alone.
        endLabel: { show: true, formatter: s.label.split(' ')[0], color: c.ink2, fontSize: 11 },
      })),
    }
  }, [data, c])

  return (
    <ChartCard
      title="Grid and tree convergence"
      description="Error against the reference as resolution doubles. CRR improves ~2× per doubling and zig-zags; Leisen–Reimer and the PDE improve ~4× (second order)."
      action={
        <div className="flex flex-wrap gap-4">
          {GRID_SERIES.map((s) => (
            <LegendKey key={s.key} color={c[s.color]} label={s.label} />
          ))}
        </div>
      }
      stale={stale}
    >
      {option ? (
        <EChart
          option={option}
          ariaLabel="Log-log chart of pricing error versus resolution for CRR, Leisen–Reimer and PDE"
        />
      ) : (
        <div className="h-72" />
      )}
    </ChartCard>
  )
}

export function MonteCarloConvergenceChart({ data, stale }: ConvergenceProps) {
  const c = useChartColors()
  const option = useMemo<ChartOption | null>(() => {
    if (!data || data.monte_carlo.length === 0) return null
    const axis = axisStyle(c)
    const mc = data.monte_carlo
    const lower = mc.map((p) => [p.paths, p.value - 1.96 * p.stderr])
    const width = mc.map((p) => [p.paths, 2 * 1.96 * p.stderr])
    return {
      animationDurationUpdate: 200,
      grid: GRID,
      tooltip: {
        ...tooltipStyle(c),
        formatter: (raw: unknown) => {
          const i = (raw as { dataIndex: number }[])[0]?.dataIndex ?? 0
          const p = mc[i]
          return (
            tooltipHeader(`${integer(p.paths)} paths`) +
            tooltipRow(c.series1, fixed(p.value, 4), 'Estimate') +
            tooltipRow(c.band, `± ${fixed(1.96 * p.stderr, 4)}`, '95% interval') +
            tooltipRow(c.series2, fixed(data.reference, 4), 'Reference')
          )
        },
      },
      xAxis: {
        type: 'log',
        min: mc[0].paths,
        max: mc[mc.length - 1].paths,
        name: 'Paths',
        nameLocation: 'middle',
        nameGap: 28,
        ...axis,
        axisLabel: { ...axis.axisLabel, formatter: (v: number) => compact(v) },
        splitLine: { show: false },
      },
      yAxis: { type: 'value', name: 'Value', scale: true, ...axis },
      series: [
        // The interval is drawn as a stacked band: an invisible lower edge plus the band width.
        {
          name: 'lower',
          type: 'line',
          data: lower,
          stack: 'ci',
          showSymbol: false,
          lineStyle: { opacity: 0 },
          silent: true,
          tooltip: { show: false },
        },
        {
          name: '95% interval',
          type: 'line',
          data: width,
          stack: 'ci',
          showSymbol: false,
          lineStyle: { opacity: 0 },
          areaStyle: { color: c.band },
          silent: true,
        },
        {
          name: 'Estimate',
          type: 'line',
          data: mc.map((p) => [p.paths, p.value]),
          ...MARKER,
          lineStyle: { width: 2, color: c.series1 },
          itemStyle: { color: c.series1, borderColor: c.surface, borderWidth: 2 },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: c.series2, width: 2, type: 'solid' },
            label: { show: false },
            data: [{ yAxis: data.reference }],
          },
        },
      ],
    }
  }, [data, c])

  return (
    <ChartCard
      title="Monte Carlo convergence"
      description="Estimate and 95% interval as paths grow. The interval narrows like 1/√paths."
      action={
        option && (
          <div className="flex gap-4">
            <LegendKey color={c.series1} label="Estimate" />
            <LegendKey color={c.band} label="95% interval" band />
            <LegendKey color={c.series2} label="Reference" />
          </div>
        )
      }
      stale={stale}
    >
      {option ? (
        <EChart
          option={option}
          ariaLabel="Chart of Monte Carlo estimate and confidence interval versus number of paths"
        />
      ) : !data ? (
        <div className="h-72" />
      ) : (
        <div className="flex h-72 flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-center">
          <p className="font-medium text-sm">Not available for American exercise</p>
          <p className="max-w-80 text-muted-foreground text-xs">{data.monte_carlo_note}</p>
        </div>
      )}
    </ChartCard>
  )
}
