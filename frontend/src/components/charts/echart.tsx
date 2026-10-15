import {
  BarChart,
  type BarSeriesOption,
  HeatmapChart,
  type HeatmapSeriesOption,
  LineChart,
  type LineSeriesOption,
  ScatterChart,
  type ScatterSeriesOption,
} from 'echarts/charts'
import {
  GridComponent,
  type GridComponentOption,
  LegendComponent,
  type LegendComponentOption,
  MarkLineComponent,
  type MarkLineComponentOption,
  MarkPointComponent,
  type MarkPointComponentOption,
  TooltipComponent,
  type TooltipComponentOption,
  VisualMapComponent,
  type VisualMapComponentOption,
} from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

// Register only what we use; keeps the bundle far smaller than `import * as echarts`.
echarts.use([
  BarChart,
  HeatmapChart,
  LineChart,
  ScatterChart,
  VisualMapComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  MarkPointComponent,
  TooltipComponent,
  CanvasRenderer,
])

export type ChartOption = echarts.ComposeOption<
  | BarSeriesOption
  | HeatmapSeriesOption
  | LineSeriesOption
  | ScatterSeriesOption
  | VisualMapComponentOption
  | GridComponentOption
  | LegendComponentOption
  | MarkLineComponentOption
  | MarkPointComponentOption
  | TooltipComponentOption
>

interface EChartProps {
  option: ChartOption
  /** Describes the chart for screen readers; the canvas itself is opaque to them. */
  ariaLabel: string
  className?: string
}

export function EChart({ option, ariaLabel, className }: EChartProps) {
  const container = useRef<HTMLDivElement>(null)
  const chart = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    const element = container.current
    if (!element) return
    const instance = echarts.init(element, undefined, { renderer: 'canvas' })
    chart.current = instance
    const observer = new ResizeObserver(() => instance.resize())
    observer.observe(element)
    return () => {
      observer.disconnect()
      instance.dispose()
      chart.current = null
    }
  }, [])

  useEffect(() => {
    // Merge (not replace) so lines morph smoothly while a slider is dragged. The first draw
    // animates quickly; ECharts' 1 s default feels sluggish.
    chart.current?.setOption(
      { animationDuration: 400, ...leftAlignYAxisName(option) },
      { replaceMerge: ['series'] },
    )
  }, [option])

  return (
    <div
      ref={container}
      role="img"
      aria-label={ariaLabel}
      className={cn('h-72 w-full', className)}
    />
  )
}

/** A y-axis title is centred on the axis line by default and gets clipped at the card edge;
 * start it at the axis instead so it always fits. */
function leftAlignYAxisName(option: ChartOption): ChartOption {
  const y = option.yAxis
  if (!y || Array.isArray(y) || !('name' in y) || !y.name || 'nameLocation' in y) return option
  return { ...option, yAxis: { ...y, nameTextStyle: { ...y.nameTextStyle, align: 'left' } } }
}
