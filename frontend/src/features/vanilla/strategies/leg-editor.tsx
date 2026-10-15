import { XIcon } from 'lucide-react'
import { NumberInput } from '@/components/number-input'
import { Segmented } from '@/components/segmented'
import { Button } from '@/components/ui/button'
import type { OptionKind } from '@/lib/api'
import type { Leg, Side } from './params'

interface LegEditorProps {
  leg: Leg
  index: number
  onChange: (leg: Leg) => void
  onRemove: () => void
}

export function LegEditor({ leg, index, onChange, onRemove }: LegEditorProps) {
  const set =
    <K extends keyof Leg>(key: K) =>
    (value: Leg[K]) =>
      onChange({ ...leg, [key]: value })

  return (
    <fieldset className="flex flex-col gap-3 rounded-xl border p-3">
      <legend className="sr-only">Leg {index + 1}</legend>
      <div className="flex items-center gap-2">
        <Segmented<Side>
          label={`Leg ${index + 1} side`}
          size="sm"
          value={leg.side}
          onChange={set('side')}
          options={[
            { value: 'long', label: 'Buy' },
            { value: 'short', label: 'Sell' },
          ]}
        />
        <Segmented<OptionKind>
          label={`Leg ${index + 1} type`}
          size="sm"
          value={leg.kind}
          onChange={set('kind')}
          options={[
            { value: 'call', label: 'Call' },
            { value: 'put', label: 'Put' },
          ]}
        />
        <Button
          variant="ghost"
          size="icon-sm"
          className="ms-auto"
          onClick={onRemove}
          aria-label={`Remove leg ${index + 1}`}
        >
          <XIcon />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <NumberInput
          label="Qty"
          value={leg.quantity}
          onChange={set('quantity')}
          min={1}
          max={100}
        />
        <NumberInput
          label="Strike"
          value={leg.strike}
          onChange={set('strike')}
          min={1}
          max={1000}
        />
        <NumberInput
          label="Expiry"
          value={leg.expiry}
          onChange={set('expiry')}
          min={0.01}
          max={5}
          step={0.25}
          digits={2}
          unit="y"
        />
      </div>
    </fieldset>
  )
}
