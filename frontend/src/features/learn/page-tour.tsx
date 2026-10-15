import { ArrowRightIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import type { PageGuide } from '@/content/guides'
import { cn } from '@/lib/utils'
import { AnnotatedScreen } from './annotated-screen'

/** One page of the lab, explained: purpose, how to use it, and every numbered region. */
export function PageTour({ guide }: { guide: PageGuide }) {
  const [active, setActive] = useState<number | null>(null)
  return (
    <section id={guide.id} className="scroll-mt-20 border-t pt-10 first:border-t-0 first:pt-0">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-semibold text-xl tracking-tight">{guide.title}</h2>
        <Link
          to={guide.path}
          className="inline-flex items-center gap-1 font-medium text-sm underline-offset-4 hover:underline"
        >
          Open the page <ArrowRightIcon className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
      <p className="max-w-3xl text-muted-foreground">{guide.purpose}</p>
      <div className="mt-4 max-w-3xl rounded-xl border bg-muted/30 p-4">
        <p className="mb-2 font-medium text-sm">How to use it</p>
        <ol className="list-decimal space-y-1 ps-5 text-muted-foreground text-sm">
          {guide.workflow.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-20 lg:self-start">
          <AnnotatedScreen
            screenId={guide.id}
            regions={guide.regions}
            active={active}
            onActive={setActive}
            alt={`Screenshot of the ${guide.title} page with numbered regions`}
          />
          <p className="mt-2 text-muted-foreground text-xs">
            Default inputs. Hover a number or an explanation to link them; your numbers will differ
            once you change the inputs.
          </p>
        </div>
        <ol className="flex flex-col gap-3">
          {guide.regions.map((region, i) => (
            <li
              key={region.key + i}
              id={`${guide.id}-${i}`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              className={cn(
                'scroll-mt-24 rounded-xl border p-4 text-sm transition-colors',
                active === i && 'border-[#eb6834]/60 bg-[#eb6834]/5',
              )}
            >
              <p className="mb-1.5 flex items-center gap-2 font-semibold">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#2a78d6] font-semibold text-[11px] text-white">
                  {i + 1}
                </span>
                {region.label}
              </p>
              <p>{region.what}</p>
              <ul className="mt-2 list-disc space-y-1 ps-5 text-muted-foreground">
                {region.read.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {region.try && (
                <p className="mt-2">
                  <span className="font-medium">Try: </span>
                  <span className="text-muted-foreground">{region.try}</span>
                </p>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
