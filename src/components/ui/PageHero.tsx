import Link from "next/link";

export function PageHero({
  title,
  highlight,
  subtitle,
  crumbs,
}: {
  title: string;
  highlight?: string;
  subtitle?: string;
  crumbs: { href?: string; label: string }[];
}) {
  return (
    <section className="relative overflow-hidden border-b border-white/8">
      <div className="bg-grid absolute inset-0" />
      <div className="absolute -top-32 left-1/4 h-72 w-72 rounded-full bg-blood/25 blur-[100px]" />
      <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16">
        <nav aria-label="Breadcrumb" className="animate-fade-up text-xs font-semibold uppercase tracking-widest text-smoke">
          <ol className="flex flex-wrap items-center gap-2">
            <li><Link href="/" className="hover:text-white">Home</Link></li>
            {crumbs.map((c) => (
              <li key={c.label} className="flex items-center gap-2">
                <span className="text-blood">/</span>
                {c.href ? <Link href={c.href} className="hover:text-white">{c.label}</Link> : <span className="text-zinc-300">{c.label}</span>}
              </li>
            ))}
          </ol>
        </nav>
        <h1 className="font-display animate-fade-up mt-4 text-5xl leading-[0.92] [animation-delay:80ms] sm:text-7xl">
          {title} {highlight && <span className="text-gold-gradient">{highlight}</span>}
        </h1>
        {subtitle && <p className="animate-fade-up mt-4 max-w-2xl text-zinc-300 [animation-delay:160ms]">{subtitle}</p>}
      </div>
    </section>
  );
}
