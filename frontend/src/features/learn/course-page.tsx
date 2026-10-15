import {
  ArrowRightIcon,
  BookAIcon,
  CheckCircle2Icon,
  CompassIcon,
  FlaskConicalIcon,
  MonitorIcon,
} from 'lucide-react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { Card } from '@/components/ui/card'
import { guidesForChapter } from '@/content/guides'
import { cn } from '@/lib/utils'
import { CHAPTERS } from './chapters'
import { loadChapter, loadGlossary, loadStart } from './pages'
import { useProgress } from './progress'

const linkClass =
  'group block h-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring'

export default function CoursePage() {
  const { done } = useProgress()
  const finished = CHAPTERS.filter((c) => done.has(c.id)).length
  return (
    <>
      <PageHeader title="Learn">
        A course through the lab, from a single call option to counterparty risk. Each chapter first
        shows you how to use and read its pages (annotated screenshots of every chart), then gives
        experiments to run, then the theory behind them.
      </PageHeader>
      <Link
        to="/learn/start"
        onMouseEnter={() => void loadStart()}
        className={cn(linkClass, 'mb-6')}
      >
        <Card className="flex-row items-center gap-4 border-[#2a78d6]/40 bg-[#2a78d6]/5 p-5 transition-colors group-hover:bg-[#2a78d6]/10">
          <CompassIcon className="size-6 shrink-0 text-[#2a78d6]" aria-hidden="true" />
          <div className="flex-1">
            <h2 className="font-semibold">Start here: how to use the lab</h2>
            <p className="text-muted-foreground text-sm">
              The layout every page shares, units, how to read each kind of chart, and what the
              numbers mean (and don’t). Ten minutes.
            </p>
          </div>
          <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Card>
      </Link>
      <p className="mb-4 text-muted-foreground text-sm">
        {finished} of {CHAPTERS.length} chapters marked as done
      </p>
      <ol className="grid gap-4 md:grid-cols-2">
        {CHAPTERS.map((c, i) => (
          <li key={c.id}>
            <Link
              to={`/learn/${c.id}`}
              onMouseEnter={() => void loadChapter()}
              className={linkClass}
            >
              <Card
                className={cn(
                  'h-full p-5 transition-colors group-hover:bg-accent/40',
                  done.has(c.id) && 'opacity-80',
                )}
              >
                <div className="flex items-start gap-4">
                  <span className="font-mono text-muted-foreground text-sm tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <h2 className="flex items-center gap-2 font-semibold">
                      {c.title}
                      {done.has(c.id) && (
                        <CheckCircle2Icon className="size-4 text-success" aria-label="Done" />
                      )}
                    </h2>
                    <p className="text-muted-foreground text-sm">{c.summary}</p>
                    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs">
                      <span className="inline-flex items-center gap-1.5">
                        <MonitorIcon className="size-3.5" aria-hidden="true" />
                        {guidesForChapter(c.id).length} page tours
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <FlaskConicalIcon className="size-3.5" aria-hidden="true" />
                        {c.experiments.length} experiments
                      </span>
                    </p>
                  </div>
                  <ArrowRightIcon
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </div>
              </Card>
            </Link>
          </li>
        ))}
        <li>
          <Link to="/learn/glossary" onMouseEnter={() => void loadGlossary()} className={linkClass}>
            <Card className="h-full p-5 transition-colors group-hover:bg-accent/40">
              <div className="flex items-start gap-4">
                <BookAIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="flex-1">
                  <h2 className="font-semibold">Glossary</h2>
                  <p className="text-muted-foreground text-sm">
                    Every term the lab uses, in plain language, with a page to see it on.
                  </p>
                </div>
                <ArrowRightIcon
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
            </Card>
          </Link>
        </li>
      </ol>
    </>
  )
}
