"use client";

import { usePathname } from "next/navigation";
import "./gym/gym.css";
import { BenchPresser, CurlBro, JumpRoper, ProteinShaker, SquatBro, TreadmillRunner } from "./gym/scenes-a";
import { BattleRopes, Boxer, Champion, KettlebellBro, PullUpBro, PushUpBro, SleepyBro, ZenBro } from "./gym/scenes-b";

/**
 * Fun cartoon gym buddies that live in the empty space either side of the page container
 * on wide screens (hidden when there isn't room). Every section of the site gets its own
 * pair of workouts. Click them — they react.
 */

type Scene = { match: (path: string) => boolean; left: React.ComponentType; right: React.ComponentType };

const LEGAL = ["/privacy-policy", "/terms-and-conditions", "/refund-policy", "/shipping-policy"];

const SCENES: Scene[] = [
  { match: (p) => p.startsWith("/shop"), left: ProteinShaker, right: TreadmillRunner },
  { match: (p) => p.startsWith("/product/"), left: BenchPresser, right: JumpRoper },
  { match: (p) => p.startsWith("/cart"), left: PullUpBro, right: KettlebellBro },
  { match: (p) => p.startsWith("/about"), left: Boxer, right: Champion },
  { match: (p) => p.startsWith("/contact"), left: PushUpBro, right: BattleRopes },
  { match: (p) => LEGAL.some((l) => p.startsWith(l)), left: SleepyBro, right: ZenBro },
  { match: (p) => p.startsWith("/faq"), left: ZenBro, right: PullUpBro },
  { match: (p) => p.startsWith("/protein-calculator"), left: ProteinShaker, right: SquatBro },
  { match: (p) => p.startsWith("/track-order"), left: TreadmillRunner, right: KettlebellBro },
];
const HOME: Scene = { match: () => true, left: CurlBro, right: SquatBro };

const HIDE_ON = ["/checkout", "/order-success"];

export function SideGym() {
  const pathname = usePathname();
  if (HIDE_ON.some((p) => pathname.startsWith(p))) return null;
  const { left: Left, right: Right } = SCENES.find((s) => s.match(pathname)) ?? HOME;
  return (
    <div className="gb-gym pointer-events-none fixed inset-0 z-30 hidden min-[1560px]:block">
      <div className="absolute inset-y-0 left-0 flex w-[calc((100vw-80rem)/2)] items-center justify-center pt-16">
        <Left key={pathname} />
      </div>
      <div className="absolute inset-y-0 right-0 flex w-[calc((100vw-80rem)/2)] items-center justify-center pt-16">
        <Right key={pathname} />
      </div>
    </div>
  );
}
