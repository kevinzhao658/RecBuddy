import { Link } from 'react-router-dom'
import { Footer } from '../../components/ui/Footer'
import { Wordmark } from '../../components/ui/Wordmark'

/** Shared shell for the public legal/support pages (/privacy, /terms, /support).
 *  Public — never wrap in RequireCoach or RedirectIfCoach.
 *  The prose column styles bare <p>/<ul>/<li>/<strong> so page content stays
 *  plain HTML with no per-element classes. */
export function LegalPage({ title, updated, children }: {
  title: string
  updated: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-hairline px-6 py-5">
        <Link to="/" aria-label="RecBuddy home"><Wordmark className="text-2xl" /></Link>
      </header>
      <main className="mx-auto w-full max-w-[720px] flex-1 px-6 py-10">
        <h1 className="text-[32px] font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-text-faint">Last updated {updated}</p>
        <div className="mt-8 [&_li]:mt-1.5 [&_li]:text-[15px] [&_li]:leading-relaxed [&_li]:text-text-mute [&_p]:mt-3 [&_p]:text-[15px] [&_p]:leading-relaxed [&_p]:text-text-mute [&_strong]:font-semibold [&_strong]:text-text [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  )
}

/** One titled block within a LegalPage. */
export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="text-[19px] font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  )
}
