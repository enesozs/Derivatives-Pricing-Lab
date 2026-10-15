import { useQuery } from '@tanstack/react-query'
import { MoonIcon, SunIcon } from 'lucide-react'
import { NavLink } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  segmentedControlItemVariants,
  segmentedControlRootClassName,
} from '@/lib/segmented-control'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

// Sections follow the roadmap in AGENTS.md; only Vanilla exists so far.
const SECTIONS = [
  { label: 'Vanilla', phase: null },
  { label: 'Volatility', phase: 2 },
  { label: 'Exotics', phase: 3 },
  { label: 'Rates', phase: 5 },
] as const

function ApiStatus() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const response = await fetch('/api/health')
      if (!response.ok) throw new Error('unhealthy')
      return true
    },
    refetchInterval: 15_000,
    retry: false,
  })
  const online = health.isSuccess
  return (
    <span className="hidden items-center gap-1.5 text-muted-foreground text-xs sm:inline-flex">
      <span
        aria-hidden="true"
        className={cn(
          'size-2 rounded-full',
          online ? 'bg-success' : health.isPending ? 'bg-muted-foreground' : 'bg-destructive',
        )}
      />
      {online ? 'API connected' : health.isPending ? 'Connecting…' : 'API offline'}
    </span>
  )
}

export function AppHeader() {
  const { theme, toggle } = useTheme()
  const item = segmentedControlItemVariants({ size: 'sm', state: 'current' })

  return (
    <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-6 px-4 sm:px-6">
        <NavLink to="/vanilla" className="flex items-center gap-2.5">
          <Logo />
          <span className="font-semibold text-sm tracking-tight">Derivatives Pricing Lab</span>
        </NavLink>
        <nav aria-label="Sections" className={cn(segmentedControlRootClassName, 'hidden md:flex')}>
          {SECTIONS.map((s) =>
            s.phase == null ? (
              <NavLink key={s.label} to="/vanilla" className={item}>
                {s.label}
              </NavLink>
            ) : (
              <span
                key={s.label}
                aria-disabled="true"
                className={cn(item, 'cursor-default opacity-64')}
                title={`Planned for phase ${s.phase}`}
              >
                {s.label}
                <Badge variant="outline" size="sm">
                  Soon
                </Badge>
              </span>
            ),
          )}
        </nav>
        <div className="ms-auto flex items-center gap-3">
          <ApiStatus />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </Button>
        </div>
      </div>
    </header>
  )
}

function Logo() {
  // A payoff hockey stick: flat, then rising past the strike.
  return (
    <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
      <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden="true">
        <path
          d="M2 11.5h5.5L14 4"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}
