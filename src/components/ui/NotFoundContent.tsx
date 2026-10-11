import Link from "next/link";
import { ArrowRight } from "@/components/ui/Icons";

export function NotFoundContent() {
  return (
    <div className="relative flex min-h-[60vh] flex-col items-center justify-center overflow-hidden px-4 py-20 text-center">
      <div className="bg-grid absolute inset-0" />
      <p className="font-display text-outline relative text-[9rem] leading-none sm:text-[14rem]">404</p>
      <h1 className="font-display relative -mt-4 text-4xl">
        Page <span className="text-gold-gradient">not found</span>
      </h1>
      <p className="relative mt-3 text-smoke">This rep didn&apos;t count. Let&apos;s get you back to the gains.</p>
      <Link href="/shop" className="btn btn-red relative mt-8">
        Go to shop <ArrowRight size={18} />
      </Link>
    </div>
  );
}
