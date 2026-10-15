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

export function LatticeConvergenceChart({ data, stale }: ConvergenceProps) {
  const c = useChartColors()
  const option = useMemo<ChartOption | null>(() => {
    if (!data) return null
    const axis = axisStyle(c)
    // Log scales cannot show an exact zero; floor at machine-precision level.
    const points = data.lattice.map((p) => [p.steps, Math.max(p.abs_error, 1e-12)])
    return {
      animationDurationUpdate: 200,
      grid: GRID,
      tooltip: {
        ...tooltipStyle(c),
        formatter: (raw: unknown) => {
          const i = (raw as { dataIndex: number }[])[0]?.dataIndex ?? 0
          const p = data.lattice[i]
          return (
            tooltipHeader(`${integer(p.steps)} steps`) +
            tooltipRow(c.series1, scientific(p.abs_error), 'Absolute error') +
            tooltipRow(c.muted, fixed(p.value, 5), 'Tree value')
          )
        },
      },
      xAxis: {
        type: 'log',
        logBase: 2,
        min: data.lattice[0].steps,
        max: data.lattice[data.lattice.length - 1].steps,
        name: 'Tree steps',
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
      series: [
        {
          name: 'Absolute error',
          type: 'line',
          data: points,
          ...MARKER,
          lineStyle: { width: 2, color: c.series1 },
          itemStyle: { color: c.series1, borderColor: c.surface, borderWidth: 2 },
        },
      ],
    }
  }, [data, c])

  return (
    <ChartCard
      title="Tree convergence"
      description="Error of the CRR tree against the reference. Roughly halves when steps double, with an odd/even zig-zag."
      stale={stale}
    >
      {option ? (
        <EChart
          option={option}
          ariaLabel="Log-log chart of binomial tree error versus number of steps"
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
