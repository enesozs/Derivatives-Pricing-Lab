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
} from '@/components/charts/theme'
import type { StrategyResponse } from '@/lib/api'
import { fixed, signed } from '@/lib/format'

interface PnlChartProps {
  spot: number
  data: StrategyResponse | undefined
  stale: boolean
}

export function PnlChart({ spot, data, stale }: PnlChartProps) {
  const c = useChartColors()

  const option = useMemo<ChartOption | null>(() => {
    if (!data) return null
    const axis = axisStyle(c)
    return {
      animationDurationUpdate: 200,
      grid: GRID,
      tooltip: {
        ...tooltipStyle(c),
        formatter: (raw: unknown) => {
          const i = (raw as { dataIndex: number }[])[0]?.dataIndex ?? 0
          return (
            tooltipHeader(`Spot ${fixed(data.spots[i], 2)}`) +
            tooltipRow(c.series1, signed(data.pnl_horizon[i], 2), 'P&L at horizon') +
            tooltipRow(c.series2, signed(data.pnl_today[i], 2), 'P&L today')
          )
        },
      },
      xAxis: {
        type: 'value',
        name: 'Spot price',
        nameLocation: 'middle',
        nameGap: 28,
        min: data.spots[0],
        max: data.spots[data.spots.length - 1],
        ...axis,
        splitLine: { show: false },
      },
      yAxis: { type: 'value', name: 'P&L', ...axis },
      series: [
        {
          name: 'P&L today',
          type: 'line',
          data: data.spots.map((s, i) => [s, data.pnl_today[i]]),
          showSymbol: false,
          lineStyle: { width: 2, color: c.series2 },
          itemStyle: { color: c.series2 },
          z: 1,
        },
        {
          name: 'P&L at horizon',
          type: 'line',
          data: data.spots.map((s, i) => [s, data.pnl_horizon[i]]),
          showSymbol: false,
          lineStyle: { width: 2, color: c.series1 },
          itemStyle: { color: c.series1 },
          z: 2,
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: c.axis, width: 1, type: 'solid' },
            label: { color: c.muted, fontSize: 11, formatter: '{b}' },
            data: [
              { name: 'Spot', xAxis: spot },
              { name: '', yAxis: 0 },
            ],
          },
          markPoint: {
            silent: true,
            symbol: 'circle',
            symbolSize: 10,
            itemStyle: { color: c.series1, borderColor: c.surface, borderWidth: 2 },
            label: { show: false },
            data: data.breakevens.map((b) => ({ name: 'Breakeven', coord: [b, 0] })),
          },
        },
      ],
    }
  }, [data, c, spot])

  return (
    <ChartCard
      title="Profit and loss across spot"
      description={
        data
          ? `At horizon: on the first expiry (${fixed(data.horizon, 2)}y), other legs keep their time value. Today: if spot moved right now. Dots are breakevens.`
          : 'Loading…'
      }
      action={
        <div className="flex gap-4">
          <LegendKey color={c.series1} label="At horizon" />
          <LegendKey color={c.series2} label="Today" />
        </div>
      }
      stale={stale}
    >
      {option ? (
        <EChart
          option={option}
          className="h-96"
          ariaLabel="Line chart of strategy profit and loss across spot prices, today and at the first expiry"
        />
      ) : (
        <div className="h-96" />
      )}
    </ChartCard>
  )
}
