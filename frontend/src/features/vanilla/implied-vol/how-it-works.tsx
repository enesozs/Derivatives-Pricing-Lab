import { Card, CardDescription, CardHeader, CardPanel, CardTitle } from '@/components/ui/card'

const STEPS = [
  {
    title: 'Volatility is the only unobservable input',
    body: 'Spot, strike, expiry, rates and dividends are known. Volatility is not, so traders quote options by the volatility their price implies.',
  },
  {
    title: 'Bracket, then solve',
    body: 'The price must sit between its zero-volatility value and its limit at infinite volatility. Inside that range, Brent’s method finds the root in a handful of iterations.',
  },
  {
    title: 'Why it matters next',
    body: 'Real markets imply a different volatility for each strike and expiry: the volatility smile. Fitting that surface is Phase 2 of this lab.',
  },
]

export function HowItWorks() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">How implied volatility works</CardTitle>
        <CardDescription>The model runs backwards: price in, volatility out.</CardDescription>
      </CardHeader>
      <CardPanel className="grid gap-6 pt-0 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <div key={step.title} className="flex flex-col gap-1.5">
            <span className="font-mono text-muted-foreground text-xs">0{i + 1}</span>
            <p className="font-medium text-sm">{step.title}</p>
            <p className="text-muted-foreground text-sm leading-relaxed">{step.body}</p>
          </div>
        ))}
      </CardPanel>
    </Card>
  )
}
