"use client";

import { useState } from "react";
import { cn } from "@/lib/format";
import { Buddy, GOLD, Ground, Head, INK, IRON, Limb, type Line, Meter, RED, SHORTS, SKIN, Shoe, useFlash, useScrollPercent } from "./parts";

type Vars = React.CSSProperties & Record<`--${string}`, string>;

/* ───────────────────────── Home: bicep curls + squats ───────────────────────── */

const CURL_LINES: Line[] = [
  { text: "Leg day skip pannaadheenga! 🦵" },
  { text: "One more rep… maybe two 😅" },
  { text: "Protein shake kudichiteengala? 🥤", href: "/shop/whey-protein" },
  { text: "Light weight baby! 💪" },
  { text: "Tap me for a flex 👆" },
  { text: "Creatine = more reps ⚡", href: "/shop/creatine" },
];

export function CurlBro() {
  const [reps, setReps] = useState(0);
  const [say, flash] = useFlash();
  const flex = say !== undefined;
  const rep = () => setReps((r) => r + 1);
  return (
    <Buddy
      lines={CURL_LINES}
      say={say}
      label="Reps"
      stat={reps}
      onTap={() => !flex && flash("💪 Gun show! Tickets ₹0 😎")}
      tapHint="Gym buddy doing bicep curls — tap to flex"
      viewBox="0 0 120 210"
      className={cn("gb-curl", flex && "is-flex")}
    >
      <Ground cx={60} rx={34} />
      <Limb x1={49} y1={140} x2={47} y2={188} w={12} />
      <Limb x1={71} y1={140} x2={73} y2={188} w={12} />
      <Shoe cx={44} cy={192} />
      <Shoe cx={76} cy={192} />
      <path d="M40 110 L80 110 L84 146 L63 146 L60 128 L57 146 L36 146 Z" fill={SHORTS} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M28 58 Q60 48 92 58 L80 114 L40 114 Z" fill={SKIN} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M40 62 Q60 78 80 62 L79 114 L41 114 Z" fill={RED} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <text x="60" y="102" textAnchor="middle" fontSize="13" fontWeight="900" fontStyle="italic" fill={GOLD}>PX</text>
      <Limb x1={32} y1={62} x2={22} y2={92} w={13} />
      <Limb x1={88} y1={62} x2={98} y2={92} w={13} />
      <ellipse className="gb-bicep" style={{ transformOrigin: "25px 76px" }} cx="25" cy="76" rx="7" ry="6" fill={SKIN} stroke={INK} strokeWidth="2" />
      <ellipse className="gb-bicep gb-late" style={{ transformOrigin: "95px 76px" }} cx="95" cy="76" rx="7" ry="6" fill={SKIN} stroke={INK} strokeWidth="2" />
      {[
        { cls: "gb-curl-l", x: 22 },
        { cls: "gb-curl-r", x: 98 },
      ].map(({ cls, x }) => (
        <g key={cls} className={cls} style={{ transformOrigin: `${x}px 92px` }} onAnimationIteration={rep}>
          <Limb x1={x} y1={92} x2={x} y2={120} w={11} />
          <rect x={x - 12} y="123" width="24" height="4" rx="2" fill={INK} />
          <rect x={x - 15} y="117" width="6" height="16" rx="1.5" fill={IRON} stroke={INK} strokeWidth="2" />
          <rect x={x + 9} y="117" width="6" height="16" rx="1.5" fill={IRON} stroke={INK} strokeWidth="2" />
        </g>
      ))}
      <rect x="53" y="40" width="14" height="14" fill={SKIN} stroke={INK} strokeWidth="2.5" />
      <Head x={60} y={30} band={GOLD} mood={flex ? "grin" : "smile"} />
      {flex && (
        <g className="gb-twinkle" fill={GOLD}>
          <path d="M8 60 l3 -8 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 Z" />
          <path d="M104 44 l2 -6 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 Z" />
        </g>
      )}
    </Buddy>
  );
}

const SQUAT_LINES: Line[] = [
  { text: "Squat deep, live strong 🏋️" },
  { text: "Knees out, chest up!" },
  { text: "Scroll down = more reps 👇" },
  { text: "Tap me to add plates ➕" },
  { text: "Gaining season? Try a mass gainer 🍚", href: "/shop/mass-gainer" },
];

export function SquatBro() {
  const [kg, setKg] = useState(60);
  const [say, flash] = useFlash();
  const pump = useScrollPercent();
  const plates = 1 + (kg - 60) / 20;
  const tap = () => {
    const next = kg + 20;
    if (next > 140) {
      setKg(60);
      flash("💥 Too heavy! Back to 60 kg 😂");
    } else {
      setKg(next);
      flash(`+20 kg! Now ${next} kg 🔥`);
    }
  };
  return (
    <Buddy
      lines={SQUAT_LINES}
      offset={2}
      say={say ?? (pump >= 98 ? "🏆 Workout complete! Nice scroll 💪" : undefined)}
      label="Squat"
      stat={`${kg} kg`}
      onTap={tap}
      tapHint={`Gym buddy squatting ${kg} kg — tap to add plates`}
      className="gb-squat"
      footer={<Meter label="Pump" pct={pump} />}
    >
      <Ground />
      <g className="gb-squat-legs" style={{ transformOrigin: "70px 194px" }}>
        <Limb x1={58} y1={118} x2={52} y2={188} w={13} />
        <Limb x1={82} y1={118} x2={88} y2={188} w={13} />
      </g>
      <Shoe cx={49} cy={192} />
      <Shoe cx={91} cy={192} />
      <g className="gb-squat-upper">
        <path d="M48 110 L92 110 L96 138 L74 138 L70 124 L66 138 L44 138 Z" fill={SHORTS} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M40 62 Q70 52 100 62 L90 114 L50 114 Z" fill={SKIN} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M50 66 Q70 80 90 66 L89 114 L51 114 Z" fill={GOLD} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <text x="70" y="104" textAnchor="middle" fontSize="12" fontWeight="900" fontStyle="italic" fill={RED}>PX</text>
        <Limb x1={44} y1={66} x2={30} y2={80} w={12} />
        <Limb x1={30} y1={80} x2={28} y2={56} w={11} />
        <Limb x1={96} y1={66} x2={110} y2={80} w={12} />
        <Limb x1={110} y1={80} x2={112} y2={56} w={11} />
        <rect x="2" y="52" width="136" height="5" rx="2.5" fill="#71717a" stroke={INK} strokeWidth="1.5" />
        {Array.from({ length: plates }, (_, i) => (
          <g key={i} fill={i % 2 ? GOLD : RED} stroke={INK} strokeWidth="1.5">
            <rect x={14 - i * 5} y={40 - Math.min(i, 2)} width="5" height={29 + Math.min(i, 2) * 2} rx="1.5" />
            <rect x={121 + i * 5} y={40 - Math.min(i, 2)} width="5" height={29 + Math.min(i, 2) * 2} rx="1.5" />
          </g>
        ))}
        <rect x="63" y="42" width="14" height="12" fill={SKIN} stroke={INK} strokeWidth="2.5" />
        <Head x={70} y={30} hair="spiky" mood="grit" />
        <ellipse className="gb-strain" cx="61" cy="36" rx="3.5" ry="2" fill="#ff4d4d" />
        <ellipse className="gb-strain" cx="79" cy="36" rx="3.5" ry="2" fill="#ff4d4d" />
        <path className="gb-sweat" d="M88 20 q3 5 0 7 q-3 -2 0 -7 Z" fill="#60a5fa" />
      </g>
    </Buddy>
  );
}

/* ───────────────────────── Shop: protein shaker + treadmill ───────────────────────── */

const SHAKER_LINES: Line[] = [
  { text: "Shake well, gain well 🥤" },
  { text: "1 scoop = 24 g protein 💪", href: "/shop/whey-protein" },
  { text: "Chocolate or vanilla? 🤔" },
  { text: "Tap me — blender mode 🌪️" },
  { text: "Mass gainer for hard gainers 🍚", href: "/shop/mass-gainer" },
];

export function ProteinShaker() {
  const [shakes, setShakes] = useState(0);
  const [say, flash] = useFlash(1600);
  const turbo = say !== undefined;
  return (
    <Buddy
      lines={SHAKER_LINES}
      say={say}
      label="Shakes"
      stat={shakes}
      onTap={() => {
        setShakes((s) => s + 10);
        flash("Blender mode ON 🌪️🌪️");
      }}
      tapHint="Protein shaker — tap to shake it faster"
      className={cn("gb-shaker", turbo && "is-turbo")}
    >
      <Ground rx={34} />
      <defs>
        <clipPath id="gb-bottle">
          <path d="M44 76 L96 76 L91 186 Q70 192 49 186 Z" />
        </clipPath>
      </defs>
      <g className="gb-shake" style={{ transformOrigin: "70px 190px" }} onAnimationIteration={() => setShakes((s) => s + 1)}>
        <path d="M44 76 L96 76 L91 186 Q70 192 49 186 Z" fill="#ffffff" fillOpacity="0.2" />
        <g clipPath="url(#gb-bottle)">
          <path className="gb-liquid" d="M0 116 q10 -7 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 V200 H0 Z" fill="#7b4a26" />
        </g>
        <path d="M44 76 L96 76 L91 186 Q70 192 49 186 Z" fill="none" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <rect x="52" y="132" width="36" height="26" rx="3" fill={GOLD} stroke={INK} strokeWidth="2" />
        <text x="70" y="149" textAnchor="middle" fontSize="9" fontWeight="900" fill={INK}>WHEY</text>
        <g className="gb-blink" style={{ transformOrigin: "70px 100px" }}>
          <circle cx="61" cy="100" r="2.2" fill={INK} />
          <circle cx="79" cy="100" r="2.2" fill={INK} />
        </g>
        {turbo ? <ellipse cx="70" cy="110" rx="4" ry="5" fill={INK} /> : <path d="M63 108 Q70 114 77 108" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />}
        <rect x="40" y="62" width="60" height="16" rx="4" fill={RED} stroke={INK} strokeWidth="2.5" />
        <rect x="62" y="50" width="16" height="13" rx="3" fill={RED} stroke={INK} strokeWidth="2.5" />
      </g>
      <g className="gb-scoop" style={{ transformOrigin: "20px 30px" }}>
        <Limb x1={2} y1={20} x2={26} y2={30} w={4} color={IRON} />
        <path d="M24 22 Q30 46 48 30 Z" fill="#f4f4f5" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      </g>
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} className="gb-powder" style={{ animationDelay: `${i * 0.18}s` }} cx="46" cy="36" r="2.2" fill="#c08a5a" />
      ))}
    </Buddy>
  );
}

const RUN_LINES: Line[] = [
  { text: "Cardio kills gains? Myth! 🏃" },
  { text: "Tap me to speed up ⏩" },
  { text: "L-Carnitine + cardio = 🔥", href: "/shop/fat-burners" },
  { text: "10,000 steps done? 👣" },
  { text: "Hydrate! Electrolytes 💧" },
];

export function TreadmillRunner() {
  const [speed, setSpeed] = useState(8);
  const [say, flash] = useFlash();
  const tap = () => {
    if (speed >= 16) {
      setSpeed(8);
      flash("😵 Too fast! Back to 8 km/h");
    } else {
      setSpeed(speed + 2);
      flash(`Speed ${speed + 2} km/h 🔥`);
    }
  };
  const vars: Vars = { "--gb-spd": `${(4.8 / speed).toFixed(2)}s` };
  return (
    <Buddy lines={RUN_LINES} offset={1} say={say} label="Speed" stat={`${speed} km/h`} onTap={tap} tapHint={`Runner on a treadmill at ${speed} km/h — tap to go faster`} className="gb-run">
      <g style={vars}>
        <Ground rx={60} />
        <Limb x1={118} y1={184} x2={108} y2={112} w={5} color={IRON} />
        <rect x="94" y="98" width="28" height="17" rx="3" fill={INK} stroke="#52525b" strokeWidth="1.5" />
        <text x="108" y="110" textAnchor="middle" fontSize="9" fontWeight="900" fill={GOLD}>{speed}</text>
        <rect x="6" y="180" width="118" height="11" rx="5.5" fill={IRON} stroke={INK} strokeWidth="2" />
        <line className="gb-belt" x1="12" y1="185.5" x2="118" y2="185.5" stroke="#a1a1aa" strokeWidth="2" strokeDasharray="6 6" />
        <g className="gb-bob">
          <g className="gb-swing gb-late" style={{ transformOrigin: "58px 122px" }}>
            <Limb x1={58} y1={122} x2={58} y2={172} w={12} />
            <Shoe cx={62} cy={175} rx={9} />
          </g>
          <g className="gb-swing gb-reverse" style={{ transformOrigin: "60px 72px" }}>
            <Limb x1={60} y1={72} x2={60} y2={104} w={10} />
          </g>
          <path d="M46 112 L72 112 L72 132 L46 132 Z" fill={SHORTS} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M46 68 Q60 58 74 68 L70 116 L48 116 Z" fill={RED} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <g className="gb-swing" style={{ transformOrigin: "58px 122px" }}>
            <Limb x1={58} y1={122} x2={58} y2={172} w={12} />
            <Shoe cx={62} cy={175} rx={9} />
          </g>
          <g className="gb-swing gb-reverse gb-late" style={{ transformOrigin: "60px 72px" }}>
            <Limb x1={60} y1={72} x2={60} y2={104} w={10} />
          </g>
          <rect x="56" y="50" width="12" height="12" fill={SKIN} stroke={INK} strokeWidth="2.5" />
          <Head x={64} y={40} hair="cap" band={GOLD} mood={speed >= 14 ? "o" : "grin"} look={4} />
          <path className="gb-sweat" d="M52 30 q3 5 0 7 q-3 -2 0 -7 Z" fill="#60a5fa" />
        </g>
      </g>
    </Buddy>
  );
}

/* ───────────────────────── Product: bench press + jump rope ───────────────────────── */

const BENCH_LINES: Line[] = [
  { text: "International chest day 📅 Monday!" },
  { text: "Spot me bro! 🙏" },
  { text: "Tap me to add weight ➕" },
  { text: "Pre-workout before PRs ⚡", href: "/shop/pre-workout" },
  { text: "Read the reviews below 👇" },
];

export function BenchPresser() {
  const [kg, setKg] = useState(60);
  const [reps, setReps] = useState(0);
  const [say, flash] = useFlash();
  const tap = () => {
    if (kg >= 140) {
      setKg(60);
      flash("😱 Spotter!! Help! Back to 60 kg");
    } else {
      setKg(kg + 20);
      flash(`${kg + 20} kg on the bar! 🔥`);
    }
  };
  const r = 13 + (kg - 60) / 10;
  return (
    <Buddy lines={BENCH_LINES} say={say} label={`${kg} kg ×`} stat={reps} onTap={tap} tapHint={`Bench press ${kg} kg — tap to add weight`} className="gb-bench">
      <Ground rx={60} />
      <Limb x1={32} y1={155} x2={32} y2={196} w={5} color={IRON} />
      <Limb x1={98} y1={155} x2={98} y2={196} w={5} color={IRON} />
      <rect x="18" y="146" width="92" height="10" rx="5" fill={RED} stroke={INK} strokeWidth="2.5" />
      <Limb x1={104} y1={138} x2={122} y2={162} w={12} />
      <Limb x1={122} y1={162} x2={122} y2={192} w={11} />
      <Shoe cx={126} cy={195} rx={8} />
      <path d="M40 124 Q70 116 98 128 L98 146 L40 146 Z" fill={GOLD} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="92" y="128" width="18" height="18" rx="3" fill={SHORTS} stroke={INK} strokeWidth="2.5" />
      <Head x={27} y={134} hair="short" mood="grit" />
      <ellipse className="gb-strain" cx="22" cy="138" rx="3" ry="2" fill="#ff4d4d" />
      <g className="gb-press-arm" style={{ transformOrigin: "54px 132px" }} onAnimationIteration={() => setReps((n) => n + 1)}>
        <Limb x1={54} y1={132} x2={54} y2={98} w={11} />
      </g>
      <g className="gb-press-bar">
        <circle cx="54" cy="94" r={r} fill={IRON} stroke={INK} strokeWidth="2.5" />
        <circle cx="54" cy="94" r={r - 5} fill="none" stroke="#52525b" strokeWidth="2" />
        <circle cx="54" cy="94" r="4" fill="#a1a1aa" stroke={INK} strokeWidth="1.5" />
      </g>
    </Buddy>
  );
}

const ROPE_LINES: Line[] = [
  { text: "Skip rope, not leg day 🦘" },
  { text: "Tap me for double unders ⚡" },
  { text: "Boxers' favourite cardio 🥊" },
  { text: "Add to cart before it's gone 🛒" },
  { text: "BCAA keeps you going 🔋", href: "/shop/amino-acids" },
];

export function JumpRoper() {
  const [skips, setSkips] = useState(0);
  const [say, flash] = useFlash(2000);
  const fast = say !== undefined;
  const vars: Vars = { "--gb-spd": fast ? "0.36s" : "0.72s" };
  return (
    <Buddy
      lines={ROPE_LINES}
      offset={2}
      say={say}
      label="Skips"
      stat={skips}
      onTap={() => flash("Double unders! ⚡⚡")}
      tapHint="Gym buddy skipping rope — tap for double unders"
      className="gb-rope"
    >
      <g style={vars}>
        <Ground rx={34} />
        <g className="gb-jump" onAnimationIteration={() => setSkips((s) => s + 1)}>
          <Limb x1={62} y1={126} x2={60} y2={180} w={12} />
          <Limb x1={78} y1={126} x2={80} y2={180} w={12} />
          <Shoe cx={58} cy={184} />
          <Shoe cx={82} cy={184} />
          <path d="M50 114 L90 114 L92 138 L72 138 L70 128 L68 138 L48 138 Z" fill={SHORTS} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M44 66 Q70 58 96 66 L88 120 L52 120 Z" fill={SKIN} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M52 70 Q70 84 88 70 L87 120 L53 120 Z" fill="#0ea5e9" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <Limb x1={48} y1={72} x2={38} y2={100} w={11} />
          <Limb x1={38} y1={100} x2={34} y2={118} w={10} />
          <Limb x1={92} y1={72} x2={102} y2={100} w={11} />
          <Limb x1={102} y1={100} x2={106} y2={118} w={10} />
          <rect x="63" y="50" width="14" height="12" fill={SKIN} stroke={INK} strokeWidth="2.5" />
          <Head x={70} y={40} hair="spiky" mood={fast ? "o" : "grin"} />
          <g className="gb-rope-arc" style={{ transformOrigin: "70px 118px" }}>
            <path d="M34 118 C 28 262, 112 262, 106 118" fill="none" stroke={RED} strokeWidth="2.5" />
          </g>
          <rect x="30" y="112" width="8" height="12" rx="2" fill={GOLD} stroke={INK} strokeWidth="1.5" />
          <rect x="102" y="112" width="8" height="12" rx="2" fill={GOLD} stroke={INK} strokeWidth="1.5" />
        </g>
      </g>
    </Buddy>
  );
}
