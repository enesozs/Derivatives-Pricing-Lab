import { LineChart, type LineSeriesOption } from 'echarts/charts'
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
} from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

// Register only what we use; keeps the bundle far smaller than `import * as echarts`.
echarts.use([
  LineChart,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  MarkPointComponent,
  TooltipComponent,
  CanvasRenderer,
])

export type ChartOption = echarts.ComposeOption<
  | LineSeriesOption
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
    // Merge (not replace) so lines morph smoothly while a slider is dragged.
    chart.current?.setOption(option, { replaceMerge: ['series'] })
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
