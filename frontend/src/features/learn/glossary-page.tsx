import { SearchIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { Input } from '@/components/ui/input'
import { GLOSSARY } from '@/content/glossary'

export default function GlossaryPage() {
  const [query, setQuery] = useState('')
  const terms = useMemo(() => {
    const q = query.trim().toLowerCase()
    return GLOSSARY.filter(
      (t) => !q || t.term.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q),
    )
  }, [query])
  return (
    <>
      <Link
        to="/learn"
        className="mb-3 inline-block text-muted-foreground text-sm hover:text-foreground"
      >
        ← All chapters
      </Link>
      <PageHeader title="Glossary">
        Every term the lab uses, in plain language, with a page where you can see it in action.
      </PageHeader>
      <div className="relative mb-6 max-w-md">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          aria-label="Search the glossary"
          placeholder="Search terms…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="ps-9"
        />
      </div>
      <dl className="grid gap-x-10 gap-y-5 md:grid-cols-2">
        {terms.map((t) => (
          <div key={t.term} className="border-b pb-4">
            <dt className="font-semibold">{t.term}</dt>
            <dd className="mt-1 text-muted-foreground text-sm">
              {t.definition}
              {t.see && (
                <>
                  {' '}
                  <Link
                    to={t.see.to}
                    className="whitespace-nowrap text-foreground underline underline-offset-4"
                  >
                    See: {t.see.label}
                  </Link>
                </>
              )}
            </dd>
          </div>
        ))}
        {terms.length === 0 && <p className="text-muted-foreground">No term matches “{query}”.</p>}
      </dl>
    </>
  )
}
