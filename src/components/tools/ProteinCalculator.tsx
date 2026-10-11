"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/format";
import { ArrowRight, DumbbellIcon } from "../ui/Icons";

const GOALS = [
  { id: "build", label: "Build muscle", emoji: "💪", range: [1.6, 2.2] },
  { id: "cut", label: "Lose fat, keep muscle", emoji: "🔥", range: [1.8, 2.4] },
  { id: "fit", label: "Stay fit", emoji: "🏃", range: [1.2, 1.6] },
  { id: "basic", label: "Not training yet", emoji: "🙂", range: [0.8, 1.0] },
] as const;
type GoalId = (typeof GOALS)[number]["id"];

const SCOOP_G = 24;
const FOODS = {
  veg: [
    { name: "Paneer (100 g)", g: 18 },
    { name: "Soya chunks (50 g dry)", g: 26 },
    { name: "Milk (1 glass, 250 ml)", g: 8 },
    { name: "Curd (1 cup)", g: 7 },
    { name: "Dal / chana (1 cup cooked)", g: 9 },
    { name: "Peanuts (30 g)", g: 8 },
  ],
  nonveg: [
    { name: "Chicken breast (100 g)", g: 31 },
    { name: "Whole egg (1)", g: 6 },
    { name: "Fish (100 g)", g: 22 },
    { name: "Milk (1 glass, 250 ml)", g: 8 },
    { name: "Paneer (100 g)", g: 18 },
    { name: "Dal / chana (1 cup cooked)", g: 9 },
  ],
};

const KEY = "px_protein_calc_v1";

export function ProteinCalculator() {
  const [weight, setWeight] = useState("70");
  const [goal, setGoal] = useState<GoalId>("build");
  const [meals, setMeals] = useState(4);
  const [trainHrs, setTrainHrs] = useState(1);
  const [diet, setDiet] = useState<"veg" | "nonveg">("nonveg");

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (s) {
        setWeight(String(s.weight ?? "70"));
        setGoal(s.goal ?? "build");
        setMeals(s.meals ?? 4);
        setTrainHrs(s.trainHrs ?? 1);
        setDiet(s.diet ?? "nonveg");
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ weight, goal, meals, trainHrs, diet }));
    } catch {}
  }, [weight, goal, meals, trainHrs, diet]);

  const kg = Number(weight);
  const valid = Number.isFinite(kg) && kg >= 30 && kg <= 200;
  const g = GOALS.find((x) => x.id === goal)!;
  const low = Math.round(kg * g.range[0]);
  const high = Math.round(kg * g.range[1]);
  const target = Math.round((low + high) / 2);
  const perMeal = Math.round(target / meals);
  const scoops = goal === "basic" ? 0 : target >= 140 ? 2 : 1;
  const fromWhey = scoops * SCOOP_G;
  const waterL = Math.round((kg * 0.035 + trainHrs * 0.5) * 10) / 10;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.15fr]">
      {/* Inputs */}
      <div className="space-y-6 rounded-3xl border border-white/8 bg-gradient-to-b from-steel to-coal p-6 sm:p-8">
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">Your body weight</span>
          <div className="flex items-center gap-3">
            <input
              type="number"
              inputMode="decimal"
              min={30}
              max={200}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className={cn("input w-32! text-2xl font-bold", !valid && weight && "border-ember!")}
              aria-describedby="w-help"
            />
            <span className="font-bold text-zinc-300">kg</span>
          </div>
          <input
            type="range"
            min={40}
            max={130}
            value={valid ? kg : 70}
            onChange={(e) => setWeight(e.target.value)}
            className="mt-4 w-full accent-[var(--color-blood)]"
            aria-label="Body weight slider"
          />
          <span id="w-help" className={cn("mt-1 block text-xs", valid ? "text-smoke" : "text-ember")}>
            {valid ? "Drag or type your weight." : "Enter a weight between 30 and 200 kg."}
          </span>
        </label>

        <fieldset>
          <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-400">Your goal</legend>
          <div className="grid grid-cols-2 gap-2">
            {GOALS.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setGoal(x.id)}
                aria-pressed={goal === x.id}
                className={cn(
                  "rounded-2xl border p-3 text-left text-sm font-semibold transition",
                  goal === x.id ? "border-gold bg-gold/10 shadow-[0_0_0_3px_rgba(245,183,0,0.12)]" : "border-white/10 hover:border-white/25",
                )}
              >
                <span className="text-xl">{x.emoji}</span>
                <span className="mt-1 block">{x.label}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">Meals per day</span>
            <select value={meals} onChange={(e) => setMeals(Number(e.target.value))} className="input">
              {[3, 4, 5, 6].map((n) => (
                <option key={n} value={n} className="bg-coal">{n} meals</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">Training per day</span>
            <select value={trainHrs} onChange={(e) => setTrainHrs(Number(e.target.value))} className="input">
              {[0, 0.5, 1, 1.5, 2].map((n) => (
                <option key={n} value={n} className="bg-coal">{n === 0 ? "Rest / none" : `${n} hr`}</option>
              ))}
            </select>
          </label>
        </div>

        <fieldset>
          <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-400">Food preference</legend>
          <div className="flex gap-2">
            {(["nonveg", "veg"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDiet(d)}
                aria-pressed={diet === d}
                className={cn("flex-1 rounded-full border px-4 py-2.5 text-sm font-bold transition", diet === d ? "border-gold bg-gold text-black" : "border-white/10 text-zinc-300 hover:border-white/30")}
              >
                {d === "veg" ? "🥗 Vegetarian" : "🍗 Non-veg"}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      {/* Results */}
      <div className="space-y-4" aria-live="polite">
        {valid ? (
          <>
            <div className="theme-dark relative overflow-hidden rounded-3xl border border-gold/30 bg-gradient-to-br from-[#2a0605] via-coal to-[#221802] p-6 sm:p-8">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/15 blur-3xl" />
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold">Your daily protein</p>
              <p className="font-display mt-2 text-7xl leading-none text-white sm:text-8xl">
                {target}
                <span className="ml-2 text-3xl text-gold">g</span>
              </p>
              <p className="mt-2 text-sm text-zinc-300">
                Range {low}–{high} g/day · {g.range[0]}–{g.range[1]} g per kg
              </p>
              <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                <Stat big={`${perMeal} g`} small={`per meal (${meals}×)`} />
                <Stat big={`${waterL} L`} small="water a day" />
                <Stat big={goal === "basic" ? "—" : "3–5 g"} small="creatine a day" />
              </div>
            </div>

            {scoops > 0 && (
              <div className="rounded-3xl border border-white/8 bg-gradient-to-b from-steel to-coal p-6">
                <p className="flex items-center gap-2 font-display text-2xl">
                  <DumbbellIcon size={22} className="text-gold" /> Easy way to hit it
                </p>
                <p className="mt-2 text-sm text-zinc-300">
                  <b className="text-white">{scoops} scoop{scoops > 1 ? "s" : ""} of whey</b> (~{fromWhey} g) covers {Math.round((fromWhey / target) * 100)}% of your day. Get the
                  remaining <b className="text-white">{Math.max(0, target - fromWhey)} g</b> from food:
                </p>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full bg-gradient-to-r from-blood to-gold" style={{ width: `${Math.min(100, (fromWhey / target) * 100)}%` }} />
                </div>
                <Link href="/shop/whey-protein" className="btn btn-red shine mt-5 w-full">
                  Shop whey protein <ArrowRight size={16} />
                </Link>
              </div>
            )}

            <div className="rounded-3xl border border-white/8 bg-white/[0.02] p-6">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-smoke">Protein in everyday food</p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {FOODS[diet].map((f) => (
                  <li key={f.name} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
                    <span className="text-zinc-300">{f.name}</span>
                    <b className="text-gold">{f.g} g</b>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[0.7rem] text-smoke">Approximate values. A scoop of whey is usually 22–27 g protein — check your tub&apos;s label.</p>
            </div>
          </>
        ) : (
          <div className="flex h-full min-h-60 items-center justify-center rounded-3xl border border-dashed border-white/10 p-10 text-center text-smoke">
            Enter your weight to see your protein target.
          </div>
        )}
        <p className="text-xs leading-relaxed text-smoke">
          General guidance for healthy adults, based on common sports-nutrition recommendations. Not medical advice — if you have kidney problems, diabetes or any
          medical condition, are pregnant or under 18, talk to your doctor first.
        </p>
      </div>
    </div>
  );
}

const Stat = ({ big, small }: { big: string; small: string }) => (
  <div className="rounded-2xl bg-white/5 p-3">
    <p className="font-display text-2xl text-white">{big}</p>
    <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-smoke">{small}</p>
  </div>
);
