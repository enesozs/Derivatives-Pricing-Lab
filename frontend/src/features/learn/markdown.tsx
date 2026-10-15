import 'katex/dist/katex.min.css'
import Markdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

/** remark-math only treats $$ as display math when the delimiters sit on their own lines;
 * the notes also write `$$x = y$$` inline-style (as GitHub allows), so fence them first. */
function fenceDisplayMath(text: string): string {
  return text.replace(/\$\$([\s\S]+?)\$\$/g, (_, body: string) => `\n$$\n${body.trim()}\n$$\n`)
}

/** A docs/ note: GitHub-flavoured markdown with $…$ / $$…$$ math, typeset by KaTeX. */
export function ChapterMarkdown({ text }: { text: string }) {
  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none prose-headings:scroll-mt-24 prose-headings:tracking-tight prose-h1:text-3xl prose-h2:mt-12 prose-h2:border-t prose-h2:pt-8 prose-h2:text-xl prose-h3:text-base prose-code:before:content-none prose-code:after:content-none prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:font-normal prose-code:text-[0.85em] prose-table:text-sm prose-hr:hidden [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_table]:block [&_table]:overflow-x-auto">
      <Markdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex, rehypeSlug]}>
        {fenceDisplayMath(text)}
      </Markdown>
    </article>
  )
}
