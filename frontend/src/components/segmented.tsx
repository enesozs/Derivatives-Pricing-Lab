import { RadioGroupPrimitive, RadioPrimitive } from '@/components/ui/radio-group'
import {
  segmentedControlItemVariants,
  segmentedControlRootClassName,
  type SegmentedControlSize,
} from '@/lib/segmented-control'
import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  disabled?: boolean
}

interface SegmentedProps<T extends string> {
  /** Accessible name for the group. */
  label: string
  value: T
  options: SegmentedOption<T>[]
  onChange: (value: T) => void
  size?: SegmentedControlSize
  className?: string
}

/** Single-choice segmented control (coss Radio Group semantics: one value always selected). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  size = 'default',
  className,
}: SegmentedProps<T>) {
  const itemClassName = segmentedControlItemVariants({ className: 'grow', size, state: 'checked' })
  return (
    <RadioGroupPrimitive
      aria-label={label}
      className={cn(segmentedControlRootClassName, className)}
      value={value}
      onValueChange={(next) => onChange(next as T)}
    >
      {options.map((option) => (
        <RadioPrimitive.Root
          key={option.value}
          className={itemClassName}
          value={option.value}
          disabled={option.disabled}
        >
          {option.label}
        </RadioPrimitive.Root>
      ))}
    </RadioGroupPrimitive>
  )
}
