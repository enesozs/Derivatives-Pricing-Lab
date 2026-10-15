import { Outlet } from 'react-router'
import { AppHeader } from './app-header'

export function AppShell() {
  return (
    <div className="min-h-dvh bg-background">
      <AppHeader />
      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:py-8">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-[1440px] px-4 pb-8 text-muted-foreground text-xs sm:px-6">
        Educational research tool, not investment advice. Prices are per unit of underlying; rates
        and volatility are annualised.
      </footer>
    </div>
  )
}
