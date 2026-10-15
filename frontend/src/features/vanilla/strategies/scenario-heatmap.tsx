import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { ChartCard } from '@/components/charts/chart-card'
import { EChart, type ChartOption } from '@/components/charts/echart'
import {
  axisStyle,
  FONT_FAMILY,
  tooltipHeader,
  tooltipRow,
  tooltipStyle,
  useChartColors,
} from '@/components/charts/theme'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { api, type StrategyRequest } from '@/lib/api'
import { fixed, signed } from '@/lib/format'

interface ScenarioHeatmapProps {
  request: StrategyRequest
  /** Years to the first expiry; the elapsed-time slider stops there. */
  horizon: number
  enabled: boolean
}

const volLabel = (shift: number) =>
  shift === 0 ? 'Today’s vol' : `${shift > 0 ? '+' : '−'}${fixed(Math.abs(shift) * 100, 1)} pts`

export function ScenarioHeatmap({ request, horizon, enabled }: ScenarioHeatmapProps) {
  const c = useChartColors()
  const maxDays = Math.max(0, Math.floor(horizon * 365))
  const [days, setDays] = useState(0)
  const clampedDays = Math.min(days, maxDays)
  const settledDays = useDebouncedValue(clampedDays, 200)
  const scenarioRequest = useMemo(
    () => ({ ...request, elapsed: settledDays / 365 }),
    [request, settledDays],
  )
  const query = useQuery({
    queryKey: ['strategies', 'scenarios', scenarioRequest],
    queryFn: ({ signal }) => api.scenarios(scenarioRequest, signal),
    placeholderData: keepPreviousData,
    enabled,
  })
  const data = query.data

  const option = useMemo<ChartOption | null>(() => {
    if (!data) return null
    const axis = axisStyle(c)
    const cells = data.pnl.flatMap((row, i) => row.map((v, j) => [j, i, v]))
    const extreme = Math.max(1e-9, ...cells.map((cell) => Math.abs(cell[2])))
    return {
      animation: false,
      grid: { left: 8, right: 16, top: 16, bottom: 56, containLabel: true },
      tooltip: {
        ...tooltipStyle(c),
        trigger: 'item',
        formatter: (raw: unknown) => {
          const [j, i, v] = (raw as { value: number[] }).value
          return (
            tooltipHeader(`Spot ${fixed(data.spots[j], 2)} · ${volLabel(data.vol_shifts[i])}`) +
            tooltipRow(v >= 0 ? c.diverging[4] : c.diverging[0], signed(v, 2), 'P&L')
          )
        },
      },
      xAxis: {
        type: 'category',
        data: data.spots.map((s) => fixed(s, 0)),
        name: 'Spot price',
        nameLocation: 'middle',
        nameGap: 28,
        ...axis,
        splitLine: { show: false },
      },
      yAxis: {
        type: 'category',
        data: data.vol_shifts.map(volLabel),
        ...axis,
        splitLine: { show: false },
      },
      visualMap: {
        type: 'continuous',
        min: -extreme,
        max: extreme,
        calculable: false,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        itemWidth: 10,
        itemHeight: 160,
        text: ['Profit', 'Loss'],
        textStyle: { color: c.muted, fontFamily: FONT_FAMILY, fontSize: 11 },
        inRange: { color: [...c.diverging] },
      },
      series: [
        {
          name: 'P&L',
          type: 'heatmap',
          data: cells,
          itemStyle: { borderColor: c.surface, borderWidth: 1 },
          emphasis: { itemStyle: { borderColor: c.ink, borderWidth: 1 } },
        },
      ],
    }
  }, [data, c])

  return (
    <ChartCard
      title="Stress test: P&L by spot and volatility"
      description="Each cell re-prices the whole position with spot and volatility moved and time passed. Blue is profit, red is loss, grey is break-even."
      action={
        <div className="flex w-64 flex-col gap-2">
          <div className="flex justify-between text-xs">
            <Label className="font-normal text-muted-foreground text-xs">Days from today</Label>
            <span className="font-medium tabular-nums">
              {clampedDays} / {maxDays}
            </span>
          </div>
          <Slider
            aria-label="Days from today"
            value={clampedDays}
            min={0}
            max={Math.max(maxDays, 1)}
            step={1}
            disabled={maxDays === 0}
            onValueChange={(v) => setDays(Array.isArray(v) ? v[0] : v)}
          />
        </div>
      }
      stale={query.isPlaceholderData}
    >
      {option ? (
        <EChart
          option={option}
          className="h-96"
          ariaLabel="Heatmap of strategy profit and loss across spot prices and volatility changes"
        />
      ) : (
        <div className="h-96" />
      )}
    </ChartCard>
  )
}
