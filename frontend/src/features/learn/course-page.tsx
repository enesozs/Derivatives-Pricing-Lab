import { ArrowRightIcon, CheckCircle2Icon, FlaskConicalIcon } from 'lucide-react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { CHAPTERS } from './chapters'
import { loadChapter } from './pages'
import { useProgress } from './progress'

export default function CoursePage() {
  const { done } = useProgress()
  const finished = CHAPTERS.filter((c) => done.has(c.id)).length
  return (
    <>
      <PageHeader title="Learn">
        A course through the lab, from a single call option to counterparty risk. Each chapter
        explains the theory, then gives you experiments to run on the pages: change one input, and
        see the idea happen. Chapters build on each other; read them in order the first time.
      </PageHeader>
      <p className="mb-4 text-muted-foreground text-sm">
        {finished} of {CHAPTERS.length} chapters marked as done
      </p>
      <ol className="grid gap-4 md:grid-cols-2">
        {CHAPTERS.map((c, i) => (
          <li key={c.id}>
            <Link
              to={`/learn/${c.id}`}
              onMouseEnter={() => void loadChapter()}
              className="group block h-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                    <p className="mt-1 inline-flex items-center gap-1.5 text-muted-foreground text-xs">
                      <FlaskConicalIcon className="size-3.5" aria-hidden="true" />
                      {c.experiments.length} experiments in {c.areaLabel}
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
      </ol>
    </>
  )
}
