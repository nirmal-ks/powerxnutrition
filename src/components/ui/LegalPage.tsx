import { PageHero } from "./PageHero";

export function LegalPage({ title, highlight, updated, children }: { title: string; highlight?: string; updated: string; children: React.ReactNode }) {
  return (
    <>
      <PageHero title={title} highlight={highlight} crumbs={[{ label: `${title} ${highlight ?? ""}`.trim() }]} subtitle={`Last updated: ${updated}`} />
      <article className="prose-legal mx-auto max-w-3xl px-4 py-12 sm:px-6">{children}</article>
    </>
  );
}
