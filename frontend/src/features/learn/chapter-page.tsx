import { useQuery } from '@tanstack/react-query'
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, FlaskConicalIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import NotFound from '@/components/not-found'
import { PageFallback } from '@/components/page-fallback'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardPanel, CardTitle } from '@/components/ui/card'
import { CHAPTERS, chapterById, type Experiment, loadChapterText } from './chapters'
import { ChapterMarkdown } from './markdown'
import { useProgress } from './progress'

function ExperimentCard({ experiment, index }: { experiment: Experiment; index: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm" render={<h3 />}>
          {index + 1}. {experiment.title}
        </CardTitle>
      </CardHeader>
      <CardPanel className="flex flex-col gap-3 pt-0 text-sm">
        <ol className="list-decimal space-y-1 ps-5 text-muted-foreground">
          {experiment.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p>
          <span className="font-medium">What to notice: </span>
          <span className="text-muted-foreground">{experiment.notice}</span>
        </p>
        <Link
          to={experiment.to}
          className="inline-flex items-center gap-1 self-start font-medium text-sm underline-offset-4 hover:underline"
        >
          Open the page <ArrowRightIcon className="size-3.5" aria-hidden="true" />
        </Link>
      </CardPanel>
    </Card>
  )
}

/** Section links built from the rendered h2 headings (ids come from rehype-slug). */
function useHeadings(ref: React.RefObject<HTMLDivElement | null>, text: string | undefined) {
  const [headings, setHeadings] = useState<{ id: string; label: string }[]>([])
  useEffect(() => {
    const root = ref.current
    if (!root || !text) return
    setHeadings(
      [...root.querySelectorAll('h2[id]')].map((h) => ({ id: h.id, label: h.textContent ?? '' })),
    )
  }, [ref, text])
  return headings
}

export default function ChapterPage() {
  const { chapterId = '' } = useParams()
  const chapter = chapterById(chapterId)
  const { done, toggle } = useProgress()
  const query = useQuery({
    queryKey: ['learn', chapterId],
    queryFn: () => loadChapterText(chapterId),
    enabled: Boolean(chapter),
    staleTime: Infinity,
  })
  const content = useRef<HTMLDivElement>(null)
  const headings = useHeadings(content, query.data)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [chapterId])

  if (!chapter) return <NotFound />
  const index = CHAPTERS.indexOf(chapter)
  const previous = CHAPTERS[index - 1]
  const next = CHAPTERS[index + 1]
  const isDone = done.has(chapter.id)

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[13rem_minmax(0,1fr)_20rem]">
      <nav aria-label="Sections" className="hidden xl:block">
        <div className="sticky top-20 flex flex-col gap-1 text-sm">
          <Link
            to="/learn"
            className="mb-3 inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="size-3.5" aria-hidden="true" /> All chapters
          </Link>
          {headings.map((h) => (
            <a
              key={h.id}
              href={`#${h.id}`}
              className="py-0.5 text-muted-foreground hover:text-foreground"
            >
              {h.label}
            </a>
          ))}
        </div>
      </nav>
      <div ref={content} className="min-w-0">
        <p className="mb-2 text-muted-foreground text-sm">
          Chapter {index + 1} of {CHAPTERS.length} ·{' '}
          <Link to={chapter.area} className="underline underline-offset-4 hover:text-foreground">
            open the {chapter.areaLabel} pages
          </Link>
        </p>
        {query.isPending ? (
          <PageFallback />
        ) : query.error ? (
          <p className="text-destructive">Could not load this chapter.</p>
        ) : (
          <ChapterMarkdown text={query.data ?? ''} />
        )}
        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t pt-6">
          {previous ? (
            <Button variant="outline" render={<Link to={`/learn/${previous.id}`} />}>
              <ArrowLeftIcon /> {previous.title}
            </Button>
          ) : (
            <span />
          )}
          <Button variant={isDone ? 'secondary' : 'default'} onClick={() => toggle(chapter.id)}>
            <CheckIcon /> {isDone ? 'Marked as done' : 'Mark as done'}
          </Button>
          {next ? (
            <Button variant="outline" render={<Link to={`/learn/${next.id}`} />}>
              {next.title} <ArrowRightIcon />
            </Button>
          ) : (
            <span />
          )}
        </div>
      </div>
      <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base" render={<h2 />}>
              <FlaskConicalIcon className="size-4" aria-hidden="true" /> Try it in the lab
            </CardTitle>
            <CardDescription>
              Read a section, then run the matching experiment. Each changes one input so you can
              see the idea at work.
            </CardDescription>
          </CardHeader>
        </Card>
        {chapter.experiments.map((e, i) => (
          <ExperimentCard key={e.title} experiment={e} index={i} />
        ))}
      </aside>
    </div>
  )
}
