import { cn } from "@/lib/format";

export function SectionHeading({
  eyebrow,
  title,
  highlight,
  subtitle,
  align = "left",
  children,
}: {
  eyebrow: string;
  title: string;
  highlight?: string;
  subtitle?: string;
  align?: "left" | "center";
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("mb-8 flex flex-col gap-4 sm:mb-12", align === "center" ? "items-center text-center" : "sm:flex-row sm:items-end sm:justify-between")}>
      <div data-reveal className={cn(align === "center" && "flex flex-col items-center")}>
        <span className="chip border border-blood/40 bg-blood/10 text-ember">
          <span className="h-1.5 w-1.5 rounded-full bg-ember" /> {eyebrow}
        </span>
        <h2 className="font-display mt-3 text-4xl leading-[0.95] sm:text-5xl lg:text-6xl">
          {title} {highlight && <span className="text-gold-gradient">{highlight}</span>}
        </h2>
        {subtitle && <p className="mt-3 max-w-xl text-sm text-smoke sm:text-base">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
