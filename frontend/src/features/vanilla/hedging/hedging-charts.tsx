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
  type ChartColors,
} from '@/components/charts/theme'
import type { HedgeResponse } from '@/lib/api'
import { compact, fixed, integer, signed } from '@/lib/format'

interface ChartProps {
  data: HedgeResponse | undefined
  stale: boolean
}

const pathColors = (c: ChartColors) => [c.series1, c.series2, c.series3]

export function PnlHistogram({ data, stale }: ChartProps) {
  const c = useChartColors()
  const option = useMemo<ChartOption | null>(() => {
    if (!data) return null
    const axis = axisStyle(c)
    const { edges, counts } = data.histogram
    const centres = counts.map((_, i) => (edges[i] + edges[i + 1]) / 2)
    const total = counts.reduce((a, b) => a + b, 0)
    return {
      animationDurationUpdate: 200,
      grid: GRID,
      tooltip: {
        ...tooltipStyle(c),
        trigger: 'item',
        formatter: (raw: unknown) => {
          const i = (raw as { dataIndex: number }).dataIndex
          return (
            tooltipHeader(`P&L ${fixed(edges[i], 2)} to ${fixed(edges[i + 1], 2)}`) +
            tooltipRow(
              c.series1,
              `${integer(counts[i])} paths`,
              `${fixed((100 * counts[i]) / total, 1)}%`,
            )
          )
        },
      },
      xAxis: {
        type: 'category',
        data: centres.map((x) => fixed(x, 2)),
        name: 'Hedged P&L per option',
        nameLocation: 'middle',
        nameGap: 28,
        ...axis,
        axisLabel: { ...axis.axisLabel, interval: 7 },
        splitLine: { show: false },
      },
      yAxis: { type: 'value', name: 'Paths', ...axis },
      series: [
        {
          name: 'Paths',
          type: 'bar',
          data: counts,
          barCategoryGap: 2,
          barMaxWidth: 24,
          itemStyle: { color: c.series1, borderRadius: [4, 4, 0, 0] },
        },
      ],
    }
  }, [data, c])

  return (
    <ChartCard
      title="Distribution of hedged P&L"
      description="Paths per P&L bucket (central 99% shown). Continuous hedging would put every path at zero; discrete re-balancing spreads them out."
      stale={stale}
    >
      {option ? (
        <EChart
          option={option}
          ariaLabel="Histogram of hedged profit and loss across simulated paths"
        />
      ) : (
        <div className="h-72" />
      )}
    </ChartCard>
  )
}

function pathChartOption(
  c: ChartColors,
  times: number[],
  rows: number[][],
  name: string,
  digits: number,
  signedValues: boolean,
): ChartOption {
  const axis = axisStyle(c)
  const colors = pathColors(c)
  return {
    animationDurationUpdate: 200,
    grid: GRID,
    tooltip: {
      ...tooltipStyle(c),
      formatter: (raw: unknown) => {
        const i = (raw as { dataIndex: number }[])[0]?.dataIndex ?? 0
        return (
          tooltipHeader(`t = ${fixed(times[i], 3)}y`) +
          rows
            .map((r, k) =>
              tooltipRow(
                colors[k],
                signedValues ? signed(r[i], digits) : fixed(r[i], digits),
                `Path ${k + 1}`,
              ),
            )
            .join('')
        )
      },
    },
    xAxis: {
      type: 'value',
      name: 'Years',
      nameLocation: 'middle',
      nameGap: 28,
      min: 0,
      max: times[times.length - 1],
      ...axis,
      splitLine: { show: false },
    },
    yAxis: { type: 'value', name, scale: true, ...axis },
    series: rows.map((r, k) => ({
      name: `Path ${k + 1}`,
      type: 'line' as const,
      data: times.map((t, i) => [t, r[i]]),
      showSymbol: false,
      lineStyle: { width: 2, color: colors[k] },
      itemStyle: { color: colors[k] },
    })),
  }
}

export function SamplePaths({ data, stale }: ChartProps) {
  const c = useChartColors()
  const spots = useMemo(
    () =>
      data ? pathChartOption(c, data.sample_times, data.sample_spots, 'Spot', 2, false) : null,
    [data, c],
  )
  const pnl = useMemo(
    () =>
      data ? pathChartOption(c, data.sample_times, data.sample_pnl, 'Hedged P&L', 3, true) : null,
    [data, c],
  )
  const legend = (
    <div className="flex gap-4">
      {pathColors(c).map((color, k) => (
        <LegendKey key={color} color={color} label={`Path ${k + 1}`} />
      ))}
    </div>
  )
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <ChartCard
        title="Three sample spot paths"
        description="Simulated with the realised volatility."
        action={legend}
        stale={stale}
      >
        {spots ? (
          <EChart option={spots} ariaLabel="Three simulated spot price paths" />
        ) : (
          <div className="h-72" />
        )}
      </ChartCard>
      <ChartCard
        title="Their hedged P&L, marked to market"
        description="Cash + shares + the option at the hedger's model value. Small jumps at each re-balance add up to the final error."
        action={legend}
        stale={stale}
      >
        {pnl ? (
          <EChart
            option={pnl}
            ariaLabel="Mark-to-market hedged profit and loss over time for three paths"
          />
        ) : (
          <div className="h-72" />
        )}
      </ChartCard>
    </div>
  )
}

export function FrequencyChart({ data, stale }: ChartProps) {
  const c = useChartColors()
  const option = useMemo<ChartOption | null>(() => {
    if (!data) return null
    const axis = axisStyle(c)
    const f = data.frequency
    return {
      animationDurationUpdate: 200,
      grid: GRID,
      tooltip: {
        ...tooltipStyle(c),
        formatter: (raw: unknown) => {
          const i = (raw as { dataIndex: number }[])[0]?.dataIndex ?? 0
          const p = f[i]
          return (
            tooltipHeader(`${integer(p.rebalances)} re-balances`) +
            tooltipRow(c.series1, fixed(p.std, 3), 'Simulated std') +
            tooltipRow(c.series2, fixed(p.approx_std, 3), 'Derman–Kamal') +
            tooltipRow(c.muted, signed(p.mean, 3), 'Mean P&L') +
            tooltipRow(c.muted, fixed(p.mean_cost, 3), 'Mean trading cost')
          )
        },
      },
      xAxis: {
        type: 'log',
        name: 'Re-balances over the option’s life',
        nameLocation: 'middle',
        nameGap: 28,
        min: f[0].rebalances,
        max: f[f.length - 1].rebalances,
        ...axis,
        axisLabel: { ...axis.axisLabel, formatter: (v: number) => compact(v) },
        splitLine: { show: false },
      },
      yAxis: { type: 'log', name: 'P&L std', ...axis },
      series: [
        {
          name: 'Derman–Kamal',
          type: 'line',
          data: f.map((p) => [p.rebalances, p.approx_std]),
          showSymbol: false,
          lineStyle: { width: 2, color: c.series2 },
          itemStyle: { color: c.series2 },
        },
        {
          name: 'Simulated',
          type: 'line',
          data: f.map((p) => [p.rebalances, p.std]),
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { width: 2, color: c.series1 },
          itemStyle: { color: c.series1, borderColor: c.surface, borderWidth: 2 },
        },
      ],
    }
  }, [data, c])

  return (
    <ChartCard
      title="Hedge more often, err less, slowly"
      description="The error falls like 1/√N: four times the trades for half the error. With trading costs, more re-balancing eventually costs more than it saves."
      action={
        <div className="flex gap-4">
          <LegendKey color={c.series1} label="Simulated" />
          <LegendKey color={c.series2} label="Derman–Kamal" />
        </div>
      }
      stale={stale}
    >
      {option ? (
        <EChart
          option={option}
          ariaLabel="Log-log chart of hedging error against re-balancing frequency"
        />
      ) : (
        <div className="h-72" />
      )}
    </ChartCard>
  )
}
