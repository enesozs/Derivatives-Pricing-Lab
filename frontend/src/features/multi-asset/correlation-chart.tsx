import { useMemo } from 'react'
import { ChartCard } from '@/components/charts/chart-card'
import { EChart, type ChartOption } from '@/components/charts/echart'
import {
  axisStyle,
  GRID,
  tooltipHeader,
  tooltipRow,
  tooltipStyle,
  useChartColors,
} from '@/components/charts/theme'
import { fixed } from '@/lib/format'

interface CorrelationChartProps {
  grid: number[] | undefined
  values: number[] | undefined
  current: number
  stale: boolean
  description: string
}

/** Option value as the correlation between underlyings varies; the dot marks today's input. */
export function CorrelationChart({
  grid,
  values,
  current,
  stale,
  description,
}: CorrelationChartProps) {
  const c = useChartColors()
  const option = useMemo<ChartOption | null>(() => {
    if (!grid || !values) return null
    const axis = axisStyle(c)
    let at = 0
    grid.forEach((g, i) => {
      if (Math.abs(g - current) < Math.abs(grid[at] - current)) at = i
    })
    return {
      animationDurationUpdate: 150,
      grid: GRID,
      tooltip: {
        ...tooltipStyle(c),
        formatter: (raw: unknown) => {
          const i = (raw as { dataIndex: number }[])[0]?.dataIndex ?? 0
          return (
            tooltipHeader(`Correlation ${fixed(grid[i], 2)}`) +
            tooltipRow(c.series1, fixed(values[i], 4), 'Value')
          )
        },
      },
      xAxis: {
        type: 'value',
        name: 'Correlation ρ',
        nameLocation: 'middle',
        nameGap: 28,
        min: grid[0],
        max: grid[grid.length - 1],
        ...axis,
        // The grid ends at uneven values (e.g. 0.95); their labels would collide with round ticks.
        axisLabel: { ...axis.axisLabel, showMinLabel: false, showMaxLabel: false },
        splitLine: { show: false },
      },
      yAxis: { type: 'value', name: 'Value', scale: true, ...axis },
      series: [
        {
          name: 'Value',
          type: 'line',
          data: grid.map((g, i) => [g, values[i]]),
          showSymbol: false,
          lineStyle: { width: 2, color: c.series1 },
          itemStyle: { color: c.series1 },
          areaStyle: { color: c.band, origin: 'start' },
          markPoint: {
            silent: true,
            symbol: 'circle',
            symbolSize: 10,
            itemStyle: { color: c.series1, borderColor: c.surface, borderWidth: 2 },
            label: { show: false },
            data: [{ name: 'Today', coord: [grid[at], values[at]] }],
          },
        },
      ],
    }
  }, [grid, values, current, c])

  return (
    <ChartCard title="Price against correlation" description={description} stale={stale}>
      {option ? (
        <EChart option={option} ariaLabel="Option value as a function of correlation" />
      ) : (
        <div className="h-72" />
      )}
    </ChartCard>
  )
}
