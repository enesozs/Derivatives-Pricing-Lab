import { useQuery } from '@tanstack/react-query'
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, FlaskConicalIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useParams } from 'react-router'
import NotFound from '@/components/not-found'
import { PageFallback } from '@/components/page-fallback'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardPanel, CardTitle } from '@/components/ui/card'
import { guidesForChapter } from '@/content/guides'
import {
  segmentedControlItemVariants,
  segmentedControlRootClassName,
} from '@/lib/segmented-control'
import { CHAPTERS, chapterById, type Experiment, loadChapterText } from './chapters'
import { ChapterMarkdown } from './markdown'
import { PageTour } from './page-tour'
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

function Theory({ chapterId }: { chapterId: string }) {
  const chapter = chapterById(chapterId)!
  const query = useQuery({
    queryKey: ['learn', chapterId],
    queryFn: () => loadChapterText(chapterId),
    staleTime: Infinity,
  })
  const content = useRef<HTMLDivElement>(null)
  const headings = useHeadings(content, query.data)
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[13rem_minmax(0,1fr)_20rem]">
      <nav aria-label="Sections" className="hidden xl:block">
        <div className="sticky top-20 flex flex-col gap-1 text-sm">
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
        {query.isPending ? (
          <PageFallback />
        ) : query.error ? (
          <p className="text-destructive">Could not load this chapter.</p>
        ) : (
          <ChapterMarkdown text={query.data ?? ''} />
        )}
      </div>
      <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base" render={<h2 />}>
              <FlaskConicalIcon className="size-4" aria-hidden="true" /> Try it in the lab
            </CardTitle>
            <CardDescription>Read a section, then run the matching experiment.</CardDescription>
          </CardHeader>
        </Card>
        {chapter.experiments.map((e, i) => (
          <ExperimentCard key={e.title} experiment={e} index={i} />
        ))}
      </aside>
    </div>
  )
}

function Tours({ chapterId }: { chapterId: string }) {
  const chapter = chapterById(chapterId)!
  const guides = guidesForChapter(chapterId)
  return (
    <div className="flex flex-col gap-12">
      <nav aria-label="Pages in this chapter" className="flex flex-wrap gap-2 text-sm">
        <span className="text-muted-foreground">Pages:</span>
        {guides.map((g) => (
          <a key={g.id} href={`#${g.id}`} className="underline-offset-4 hover:underline">
            {g.title}
          </a>
        ))}
      </nav>
      {guides.map((g) => (
        <PageTour key={g.id} guide={g} />
      ))}
      <section className="border-t pt-10">
        <h2 className="mb-1 flex items-center gap-2 font-semibold text-xl tracking-tight">
          <FlaskConicalIcon className="size-5" aria-hidden="true" /> Experiments
        </h2>
        <p className="mb-4 max-w-3xl text-muted-foreground">
          Now that you can read the pages, use them: each experiment changes one input so you can
          see an idea at work. The Theory tab explains why.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {chapter.experiments.map((e, i) => (
            <ExperimentCard key={e.title} experiment={e} index={i} />
          ))}
        </div>
      </section>
    </div>
  )
}

const tabClassName = segmentedControlItemVariants({ state: 'current' })

export default function ChapterPage({ tab }: { tab: 'pages' | 'theory' }) {
  const { chapterId = '' } = useParams()
  const { hash } = useLocation()
  const chapter = chapterById(chapterId)
  const { done, toggle } = useProgress()

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0)
      return
    }
    // Wait for the section to render before jumping to it.
    const id = window.setTimeout(
      () => document.getElementById(hash.slice(1))?.scrollIntoView(),
      100,
    )
    return () => window.clearTimeout(id)
  }, [chapterId, tab, hash])

  if (!chapter) return <NotFound />
  const index = CHAPTERS.indexOf(chapter)
  const previous = CHAPTERS[index - 1]
  const next = CHAPTERS[index + 1]
  const isDone = done.has(chapter.id)

  return (
    <>
      <Link
        to="/learn"
        className="mb-4 inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" aria-hidden="true" /> All chapters
      </Link>
      <p className="text-muted-foreground text-sm">
        Chapter {index + 1} of {CHAPTERS.length}
      </p>
      <h1 className="mt-1 font-semibold text-3xl tracking-tight">{chapter.title}</h1>
      <p className="mt-2 max-w-3xl text-muted-foreground">{chapter.summary}</p>
      <nav aria-label="Chapter views" className={`${segmentedControlRootClassName} mt-6 mb-8`}>
        <NavLink to={`/learn/${chapter.id}`} end className={tabClassName}>
          Using the pages
        </NavLink>
        <NavLink to={`/learn/${chapter.id}/theory`} className={tabClassName}>
          Theory
        </NavLink>
      </nav>
      {tab === 'pages' ? <Tours chapterId={chapter.id} /> : <Theory chapterId={chapter.id} />}
      <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t pt-6">
        {previous ? (
          <Button variant="outline" render={<Link to={`/learn/${previous.id}`} />}>
            <ArrowLeftIcon /> {previous.title}
          </Button>
        ) : (
          <Button variant="outline" render={<Link to="/learn/start" />}>
            <ArrowLeftIcon /> Start here
          </Button>
        )}
        <Button variant={isDone ? 'secondary' : 'default'} onClick={() => toggle(chapter.id)}>
          <CheckIcon /> {isDone ? 'Marked as done' : 'Mark as done'}
        </Button>
        {next ? (
          <Button variant="outline" render={<Link to={`/learn/${next.id}`} />}>
            {next.title} <ArrowRightIcon />
          </Button>
        ) : (
          <Button variant="outline" render={<Link to="/learn/glossary" />}>
            Glossary <ArrowRightIcon />
          </Button>
        )}
      </div>
    </>
  )
}
