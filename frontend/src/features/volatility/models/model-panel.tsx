import { PanelSection } from '@/components/panel-section'
import { ParamControl } from '@/components/param-control'
import { Segmented } from '@/components/segmented'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { ModelParams } from '@/lib/api'
import {
  DEFAULT_MODEL_PARAMS,
  MODEL_INTROS,
  MODEL_LABELS,
  type ModelId,
  PARAM_SPECS,
} from './params'

interface ModelPanelProps {
  model: ModelId
  params: ModelParams
  onModelChange: (model: ModelId) => void
  onParamsChange: (params: ModelParams) => void
}

export function ModelPanel({ model, params, onModelChange, onParamsChange }: ModelPanelProps) {
  const values = params as unknown as Record<string, number>
  return (
    <Card className="overflow-hidden">
      <PanelSection title="Model" hint={MODEL_INTROS[model]}>
        <Segmented<ModelId>
          label="Model"
          value={model}
          onChange={onModelChange}
          options={(Object.keys(MODEL_LABELS) as ModelId[]).map((id) => ({
            value: id,
            label: id === 'black_scholes' ? 'BS' : MODEL_LABELS[id].split(' ')[0],
          }))}
          className="w-full"
        />
      </PanelSection>
      <Separator />
      <PanelSection title="Parameters">
        {PARAM_SPECS[model].map((spec) => (
          <div key={spec.key} className="flex flex-col gap-1">
            <ParamControl
              label={spec.label}
              value={values[spec.key]}
              onChange={(value) => onParamsChange({ ...params, [spec.key]: value } as ModelParams)}
              min={spec.min}
              max={spec.max}
              step={spec.step}
              digits={spec.digits}
            />
            <p className="text-muted-foreground text-xs">{spec.hint}</p>
          </div>
        ))}
      </PanelSection>
      <Separator />
      <div className="px-5 py-4">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => onParamsChange(DEFAULT_MODEL_PARAMS[model])}
        >
          Reset {MODEL_LABELS[model]}
        </Button>
      </div>
    </Card>
  )
}
