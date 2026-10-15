import { useId } from 'react'
import { Label } from '@/components/ui/label'
import { NumberField, NumberFieldGroup, NumberFieldInput } from '@/components/ui/number-field'
import { Slider } from '@/components/ui/slider'

interface ParamControlProps {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step: number
  /** Shown after the number, e.g. "%" or "yrs". */
  unit?: string
  /** Fraction digits shown in the input. */
  digits?: number
}

/** Labelled slider paired with an exact numeric input; both edit the same value. */
export function ParamControl({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  digits = 0,
}: ParamControlProps) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id} className="font-normal text-muted-foreground">
          {label}
        </Label>
        <NumberField
          id={id}
          size="sm"
          className="w-28"
          value={value}
          min={min}
          max={max}
          step={step}
          format={{ minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, 4) }}
          onValueChange={(next) => {
            if (next != null && Number.isFinite(next)) onChange(next)
          }}
        >
          <NumberFieldGroup className="items-center">
            <NumberFieldInput className="text-right font-medium" />
            {unit && (
              <span className="pe-2.5 text-muted-foreground text-xs select-none">{unit}</span>
            )}
          </NumberFieldGroup>
        </NumberField>
      </div>
      <Slider
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        onValueChange={(next) => onChange(Array.isArray(next) ? next[0] : next)}
      />
    </div>
  )
}
