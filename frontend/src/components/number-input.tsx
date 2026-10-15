import { useId } from 'react'
import { Label } from '@/components/ui/label'
import { NumberField, NumberFieldGroup, NumberFieldInput } from '@/components/ui/number-field'
import { inputModeFor } from '@/lib/input-mode'
import { cn } from '@/lib/utils'

interface NumberInputProps {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  digits?: number
  unit?: string
  /** Keep the label for screen readers only (e.g. rows under a shared column header). */
  hideLabel?: boolean
}

/** Compact labelled number field (label above), for dense editors like strategy legs. */
export function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  digits = 0,
  unit,
  hideLabel = false,
}: NumberInputProps) {
  const id = useId()
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Label
        htmlFor={id}
        className={cn('font-normal text-muted-foreground text-xs', hideLabel && 'sr-only')}
      >
        {label}
      </Label>
      <NumberField
        id={id}
        size="sm"
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
          <NumberFieldInput
            className="text-right font-medium"
            inputMode={inputModeFor(min, step, digits)}
          />
          {unit && <span className="pe-2 text-muted-foreground text-xs select-none">{unit}</span>}
        </NumberFieldGroup>
      </NumberField>
    </div>
  )
}
