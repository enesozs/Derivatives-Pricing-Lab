import { AppHeader } from '@/components/app-header'
import { VanillaLab } from '@/features/vanilla/vanilla-lab'

export default function App() {
  return (
    <div className="min-h-dvh bg-background">
      <AppHeader />
      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:py-8">
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="font-semibold text-2xl tracking-tight">Vanilla options</h1>
          <p className="max-w-3xl text-muted-foreground text-sm">
            Price a call or put with three independent methods, see how its value and Greeks respond
            to the market, and watch the numerical methods converge.
          </p>
        </div>
        <VanillaLab />
      </main>
      <footer className="mx-auto max-w-[1440px] px-4 pb-8 text-muted-foreground text-xs sm:px-6">
        Educational research tool, not investment advice. Prices are per unit of underlying; rates
        and volatility are annualised.
      </footer>
    </div>
  )
}
