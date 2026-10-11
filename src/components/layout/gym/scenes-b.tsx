"use client";

import { useEffect, useRef, useState } from "react";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/format";
import { Buddy, GOLD, Ground, Head, INK, IRON, Limb, type Line, RED, SHORTS, SKIN, Shoe, useFlash, useScrollPercent } from "./parts";

type Vars = React.CSSProperties & Record<`--${string}`, string>;

/* ───────────────────────── Cart: pull-ups + kettlebell swings ───────────────────────── */

const PULL_LINES: Line[] = [
  { text: "Pull up… your cart total 😜" },
  { text: `Free delivery above ₹${siteConfig.delivery.freeAbove} 🚚` },
  { text: "Back day = best day 🦍" },
  { text: "Tap me — chin over the bar! 🔝" },
  { text: "Add a shaker to your cart 🥤", href: "/shop" },
];

export function PullUpBro() {
  const [reps, setReps] = useState(0);
  const [say, flash] = useFlash();
  return (
    <Buddy
      lines={PULL_LINES}
      say={say}
      label="Pull-ups"
      stat={reps}
      onTap={() => {
        setReps((r) => r + 1);
        flash("Chin over the bar! 🔝 +1");
      }}
      tapHint="Gym buddy doing pull-ups — tap to cheer"
      className="gb-pull"
    >
      <Ground rx={44} />
      <Limb x1={14} y1={20} x2={14} y2={198} w={5} color={IRON} />
      <Limb x1={126} y1={20} x2={126} y2={198} w={5} color={IRON} />
      <Limb x1={8} y1={22} x2={132} y2={22} w={5} color={IRON} />
      <g className="gb-pull-body" onAnimationIteration={() => setReps((r) => r + 1)}>
        <Limb x1={62} y1={148} x2={58} y2={182} w={11} />
        <Limb x1={78} y1={148} x2={82} y2={182} w={11} />
        <Shoe cx={56} cy={186} rx={8} />
        <Shoe cx={84} cy={186} rx={8} />
        <path d="M54 124 L86 124 L88 150 L72 150 L70 138 L68 150 L52 150 Z" fill={SHORTS} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M46 72 Q70 62 94 72 L86 128 L54 128 Z" fill={SKIN} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <g stroke={INK} strokeWidth="1.5" fill="none" strokeLinecap="round">
          <path d="M58 86 Q64 92 70 86 Q76 92 82 86" />
          <path d="M70 94 V122 M63 104 H77 M64 114 H76" />
        </g>
        <rect x="63" y="58" width="14" height="10" fill={SKIN} stroke={INK} strokeWidth="2.5" />
        <Head x={70} y={48} hair="short" band={RED} mood="grit" />
      </g>
      <g className="gb-pull-arm" style={{ transformOrigin: "48px 22px" }}>
        <Limb x1={48} y1={22} x2={52} y2={76} w={11} />
      </g>
      <g className="gb-pull-arm" style={{ transformOrigin: "92px 22px" }}>
        <Limb x1={92} y1={22} x2={88} y2={76} w={11} />
      </g>
      <circle cx="48" cy="22" r="5.5" fill={SKIN} stroke={INK} strokeWidth="2" />
      <circle cx="92" cy="22" r="5.5" fill={SKIN} stroke={INK} strokeWidth="2" />
    </Buddy>
  );
}

const KB_LINES: Line[] = [
  { text: "Hip hinge, not a squat! 😤" },
  { text: "Swing it like it's checkout day 🛒" },
  { text: "Tap me — heavier bell 🔔" },
  { text: "UPI or COD — your choice 💳" },
  { text: "Glutamine for recovery 🔄", href: "/shop/glutamine" },
];

export function KettlebellBro() {
  const [kg, setKg] = useState(12);
  const [swings, setSwings] = useState(0);
  const [say, flash] = useFlash();
  const tap = () => {
    const next = kg >= 32 ? 12 : kg + 4;
    setKg(next);
    flash(next === 12 ? "Okay okay, back to 12 kg 😅" : `${next} kg kettlebell 🔔`);
  };
  const r = 8 + (kg - 12) / 4;
  return (
    <Buddy lines={KB_LINES} offset={1} say={say} label={`${kg} kg ×`} stat={swings} onTap={tap} tapHint={`Kettlebell swings with ${kg} kg — tap for a heavier bell`} className="gb-kb">
      <Ground />
      <Limb x1={62} y1={120} x2={60} y2={186} w={12} />
      <Limb x1={70} y1={120} x2={72} y2={186} w={12} />
      <Shoe cx={66} cy={190} rx={11} />
      <Shoe cx={78} cy={190} rx={11} />
      <g className="gb-kb-torso" style={{ transformOrigin: "66px 120px" }}>
        <path d="M54 110 L78 110 L80 132 L52 132 Z" fill={SHORTS} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M54 64 Q66 56 80 64 L78 118 L54 118 Z" fill="#7c3aed" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <rect x="61" y="50" width="12" height="12" fill={SKIN} stroke={INK} strokeWidth="2.5" />
        <Head x={68} y={40} hair="bun" mood="grit" look={4} />
        <g className="gb-kb-arms" style={{ transformOrigin: "66px 68px" }} onAnimationIteration={() => setSwings((s) => s + 1)}>
          <Limb x1={66} y1={68} x2={66} y2={120} w={10} />
          <path d="M59 124 Q66 113 73 124" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="66" cy={124 + r} r={r} fill={IRON} stroke={INK} strokeWidth="2.5" />
          <circle cx={63} cy={121 + r} r="2" fill="#a1a1aa" />
        </g>
      </g>
    </Buddy>
  );
}

/* ───────────────────────── About: punching bag + champion podium ───────────────────────── */

const BOX_LINES: Line[] = [
  { text: "Genuine products only — no fakes 🥊" },
  { text: "Knock out your goals 💥" },
  { text: "Tap me for a combo 👊" },
  { text: "Local shop, big energy ⚡" },
];

export function Boxer() {
  const [punches, setPunches] = useState(0);
  const [say, flash] = useFlash(2000);
  const combo = say !== undefined;
  const vars: Vars = { "--gb-spd": combo ? "0.55s" : "1.3s" };
  return (
    <Buddy lines={BOX_LINES} say={say} label="Punches" stat={punches} onTap={() => flash("Combo! Jab-jab-cross 🥊")} tapHint="Boxer hitting a punching bag — tap for a combo" className="gb-box">
      <g style={vars}>
        <Ground rx={52} />
        <g className="gb-bag" style={{ transformOrigin: "104px 0px" }}>
          <line x1="104" y1="-4" x2="104" y2="34" stroke={IRON} strokeWidth="2.5" strokeDasharray="4 2" />
          <rect x="88" y="34" width="32" height="102" rx="12" fill={RED} stroke={INK} strokeWidth="2.5" />
          <rect x="88" y="50" width="32" height="6" fill={GOLD} stroke={INK} strokeWidth="1.5" />
          <rect x="88" y="114" width="32" height="6" fill={GOLD} stroke={INK} strokeWidth="1.5" />
          <text x="104" y="92" textAnchor="middle" fontSize="12" fontWeight="900" fontStyle="italic" fill={GOLD}>PX</text>
        </g>
        <Limb x1={34} y1={124} x2={26} y2={186} w={12} />
        <Limb x1={46} y1={124} x2={54} y2={186} w={12} />
        <Shoe cx={28} cy={190} />
        <Shoe cx={58} cy={190} />
        <g className="gb-punch" onAnimationIteration={() => setPunches((p) => p + 1)}>
          <Limb x1={30} y1={76} x2={62} y2={80} w={10} />
          <circle cx="68" cy="80" r="9" fill={RED} stroke={INK} strokeWidth="2.5" />
        </g>
        <path d="M24 114 L56 114 L58 134 L22 134 Z" fill={SHORTS} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M24 68 Q40 60 56 68 L52 118 L28 118 Z" fill={SKIN} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <Limb x1={44} y1={74} x2={54} y2={92} w={10} />
        <circle cx="56" cy="84" r="8" fill={RED} stroke={INK} strokeWidth="2.5" />
        <rect x="35" y="52" width="12" height="12" fill={SKIN} stroke={INK} strokeWidth="2.5" />
        <Head x={42} y={42} hair="short" band={RED} mood="grit" look={4} />
        <g className="gb-pow">
          <path d="M86 64 l6 -10 l3 9 l10 -4 l-5 9 l10 3 l-10 4 l4 9 l-9 -4 l-4 9 l-2 -10 l-10 2 l7 -8 Z" fill={GOLD} stroke={INK} strokeWidth="1.5" />
          <text x="96" y="74" textAnchor="middle" fontSize="7" fontWeight="900" fill={INK}>POW</text>
        </g>
      </g>
    </Buddy>
  );
}

const CHAMP_LINES: Line[] = [
  { text: `${siteConfig.contact.googleRating.value}★ on Google — thank you! 🙏` },
  { text: "Champions trust PowerX 🏆" },
  { text: "Tap me — confetti! 🎉" },
  { text: "Come say hi at the shop 👋", href: "/contact" },
];

export function Champion() {
  const [say, flash] = useFlash();
  const [burst, setBurst] = useState(0);
  const cheer = ["Champion vibes 🏆", "Crowd goes wild! 📣", "Gold medal gains 🥇"];
  const colors = [RED, GOLD, "#60a5fa", "#4ade80", "#f472b6"];
  return (
    <Buddy
      lines={CHAMP_LINES}
      offset={1}
      say={say}
      label="Rated"
      stat={`${siteConfig.contact.googleRating.value}★`}
      onTap={() => {
        setBurst((b) => b + 1);
        flash(cheer[burst % cheer.length]);
      }}
      tapHint="Champion flexing on a podium — tap for confetti"
      className={cn("gb-champ", say && "is-burst")}
    >
      <rect x="6" y="176" width="26" height="24" fill="#a1a1aa" stroke={INK} strokeWidth="2" />
      <text x="19" y="194" textAnchor="middle" fontSize="12" fontWeight="900" fill={INK}>2</text>
      <rect x="108" y="182" width="26" height="18" fill="#b45309" stroke={INK} strokeWidth="2" />
      <text x="121" y="196" textAnchor="middle" fontSize="11" fontWeight="900" fill={INK}>3</text>
      <rect x="32" y="160" width="76" height="40" fill={GOLD} stroke={INK} strokeWidth="2.5" />
      <text x="70" y="190" textAnchor="middle" fontSize="22" fontWeight="900" fill={INK}>1</text>
      <g className="gb-champ-body">
        <Limb x1={62} y1={118} x2={58} y2={154} w={12} />
        <Limb x1={78} y1={118} x2={82} y2={154} w={12} />
        <Shoe cx={56} cy={157} rx={9} />
        <Shoe cx={84} cy={157} rx={9} />
        <path d="M50 108 L90 108 L92 128 L72 128 L70 118 L68 128 L48 128 Z" fill={RED} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M36 58 Q70 46 104 58 L88 112 L52 112 Z" fill={SKIN} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <g stroke={INK} strokeWidth="1.5" fill="none" strokeLinecap="round">
          <path d="M54 72 Q62 80 70 72 Q78 80 86 72" />
          <path d="M70 84 V108 M63 92 H77 M64 101 H76" />
        </g>
        <Limb x1={40} y1={62} x2={20} y2={62} w={13} />
        <Limb x1={20} y1={62} x2={22} y2={36} w={11} />
        <Limb x1={100} y1={62} x2={120} y2={62} w={13} />
        <Limb x1={120} y1={62} x2={118} y2={36} w={11} />
        <ellipse className="gb-bicep" style={{ transformOrigin: "30px 57px" }} cx="30" cy="57" rx="7" ry="6" fill={SKIN} stroke={INK} strokeWidth="2" />
        <ellipse className="gb-bicep" style={{ transformOrigin: "110px 57px" }} cx="110" cy="57" rx="7" ry="6" fill={SKIN} stroke={INK} strokeWidth="2" />
        <path d="M62 50 L70 70 L78 50" fill="none" stroke={RED} strokeWidth="2.5" />
        <circle cx="70" cy="72" r="5.5" fill={GOLD} stroke={INK} strokeWidth="1.5" />
        <rect x="63" y="40" width="14" height="12" fill={SKIN} stroke={INK} strokeWidth="2.5" />
        <Head x={70} y={30} hair="spiky" mood="grin" />
      </g>
      {Array.from({ length: 12 }, (_, i) => (
        <rect
          key={`${burst}-${i}`}
          className="gb-confetti"
          style={{ animationDelay: `${(i * 0.37) % 3}s`, transformOrigin: `${8 + i * 11}px -6px` }}
          x={8 + i * 11}
          y="-8"
          width="4"
          height="7"
          rx="1"
          fill={colors[i % colors.length]}
        />
      ))}
    </Buddy>
  );
}

/* ───────────────────────── Contact: push-ups + battle ropes ───────────────────────── */

const PUSH_LINES: Line[] = [
  { text: `Call us: ${siteConfig.contact.phone} 📞`, href: `tel:+91${siteConfig.contact.phone}` },
  { text: "Drop a WhatsApp, we reply fast 💬" },
  { text: "Tap me — one-arm push-up? 😅" },
  { text: "Visit the shop, get free advice 🧠" },
];

export function PushUpBro() {
  const [reps, setReps] = useState(0);
  const [say, flash] = useFlash();
  return (
    <Buddy
      lines={PUSH_LINES}
      say={say}
      label="Push-ups"
      stat={reps}
      onTap={() => flash("One-arm push-up? Next time 😅")}
      tapHint="Gym buddy doing push-ups — tap him"
      className="gb-push"
    >
      <line x1="2" y1="198" x2="138" y2="198" stroke="#52525b" strokeWidth="2" strokeLinecap="round" />
      <g className="gb-push-body" style={{ transformOrigin: "124px 192px" }} onAnimationIteration={() => setReps((r) => r + 1)}>
        <Limb x1={92} y1={176} x2={122} y2={190} w={12} />
        <ellipse cx="128" cy="191" rx="6" ry="4" fill="#f4f4f5" stroke={INK} strokeWidth="2" />
        <path d="M80 166 L100 172 L96 188 L76 182 Z" fill={SHORTS} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M34 148 L84 164 L80 184 L32 166 Z" fill="#0ea5e9" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <Head x={22} y={150} hair="short" band={GOLD} mood="grit" look={-4} />
      </g>
      <g className="gb-push-arm" style={{ transformOrigin: "42px 196px" }}>
        <Limb x1={42} y1={196} x2={42} y2={160} w={10} />
      </g>
    </Buddy>
  );
}

const ROPES_LINES: Line[] = [
  { text: `Open ${siteConfig.contact.hours.split("·")[1]?.trim() ?? ""} ⏰` },
  { text: "Make waves, not excuses 🌊" },
  { text: "Tap me — power waves! 💥" },
  { text: "Directions on the map below 📍" },
];

/** Traveling-wave ropes drawn with requestAnimationFrame (no re-renders). */
export function BattleRopes() {
  const [say, flash] = useFlash(2200);
  const [waves, setWaves] = useState(0);
  const power = say !== undefined;
  const ropes = useRef<(SVGPathElement | null)[]>([]);
  const amp = useRef(7);

  useEffect(() => {
    amp.current = power ? 13 : 7;
  }, [power]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let last = 0;
    let cycles = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 33) return; // ~30 fps is plenty
      last = t;
      const phase = t / 90;
      const c = Math.floor(phase / (2 * Math.PI));
      if (c !== cycles) {
        cycles = c;
        setWaves((w) => w + 1);
      }
      ropes.current.forEach((el, i) => {
        if (!el) return;
        const [x0, y0] = i ? [64, 116] : [68, 108];
        const [x1, y1] = [130, 152];
        let d = `M${x0} ${y0}`;
        for (let s = 1; s <= 24; s++) {
          const k = s / 24;
          const off = Math.sin(k * 9 - phase - i * 1.3) * amp.current * (1 - k);
          d += ` L${(x0 + (x1 - x0) * k).toFixed(1)} ${(y0 + (y1 - y0) * k + off).toFixed(1)}`;
        }
        el.setAttribute("d", d);
      });
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <Buddy lines={ROPES_LINES} offset={2} say={say} label="Waves" stat={waves} onTap={() => flash("Power waves! 🌊🌊")} tapHint="Gym buddy doing battle ropes — tap for power waves" className={cn("gb-ropes", power && "is-power")}>
      <Ground rx={60} />
      <rect x="128" y="140" width="9" height="58" rx="2" fill={IRON} stroke={INK} strokeWidth="2" />
      <circle cx="132" cy="152" r="4.5" fill="none" stroke="#a1a1aa" strokeWidth="2.5" />
      {[0, 1].map((i) => (
        <path key={i} ref={(el) => void (ropes.current[i] = el)} d={i ? "M64 116 L130 152" : "M68 108 L130 152"} fill="none" stroke={i ? "#18181b" : "#27272a"} strokeWidth="4.5" strokeLinecap="round" />
      ))}
      <Limb x1={36} y1={128} x2={24} y2={158} w={12} />
      <Limb x1={24} y1={158} x2={30} y2={188} w={11} />
      <Limb x1={50} y1={128} x2={60} y2={158} w={12} />
      <Limb x1={60} y1={158} x2={54} y2={188} w={11} />
      <Shoe cx={32} cy={192} />
      <Shoe cx={58} cy={192} />
      <path d="M26 116 L58 116 L60 138 L24 138 Z" fill={SHORTS} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M24 74 Q40 66 58 74 L56 122 L28 122 Z" fill={RED} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <g className="gb-rope-arms">
        <Limb x1={40} y1={82} x2={62} y2={114} w={10} />
        <Limb x1={52} y1={80} x2={66} y2={106} w={10} />
      </g>
      <rect x="38" y="58" width="12" height="12" fill={SKIN} stroke={INK} strokeWidth="2.5" />
      <Head x={44} y={48} hair="cap" band={GOLD} mood="grit" look={4} />
    </Buddy>
  );
}

/* ───────────────────────── Policies: rest day + meditation ───────────────────────── */

const SLEEP_LINES: Line[] = [
  { text: "Rest day. Muscles grow while sleeping 😴" },
  { text: "Reading policies? Respect 📜" },
  { text: "Tap to wake me… if you dare 😤" },
  { text: "ZMA for deep sleep 🌙", href: "/shop/vitamins" },
];

export function SleepyBro() {
  const [say, flash] = useFlash(1500);
  const awake = say !== undefined;
  return (
    <Buddy
      lines={SLEEP_LINES}
      say={say}
      label="Sleep"
      stat="8 hrs"
      onTap={() => flash("Huh?! Rest day da! Don't disturb 😤")}
      tapHint="Gym buddy sleeping on rest day — tap to wake him"
      className="gb-sleep"
    >
      <Ground rx={60} />
      <Limb x1={18} y1={170} x2={18} y2={196} w={5} color={IRON} />
      <Limb x1={122} y1={170} x2={122} y2={196} w={5} color={IRON} />
      <rect x="8" y="160" width="124" height="12" rx="5" fill={IRON} stroke={INK} strokeWidth="2.5" />
      <ellipse cx="28" cy="152" rx="17" ry="8" fill="#f4f4f5" stroke={INK} strokeWidth="2" />
      <Head x={30} y={138} hair="spiky" mood={awake ? "o" : "sleep"} />
      <g className="gb-breathe" style={{ transformOrigin: "80px 160px" }}>
        <path d="M44 136 Q84 120 126 142 L126 160 L44 160 Z" fill="#6366f1" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M60 130 L60 160 M80 126 L80 160 M100 130 L100 160" stroke="#818cf8" strokeWidth="3" />
      </g>
      <ellipse cx="128" cy="148" rx="5" ry="8" fill="#f4f4f5" stroke={INK} strokeWidth="2" />
      <g>
        <rect x="54" y="186" width="32" height="4" rx="2" fill={INK} />
        <rect x="48" y="180" width="7" height="16" rx="1.5" fill={IRON} stroke={INK} strokeWidth="2" />
        <rect x="85" y="180" width="7" height="16" rx="1.5" fill={IRON} stroke={INK} strokeWidth="2" />
      </g>
      {!awake &&
        [0, 1, 2].map((i) => (
          <text key={i} className="gb-zzz" style={{ animationDelay: `${i * 0.9}s` }} x="46" y="118" fontSize={10 + i * 3} fontWeight="900" fill={GOLD}>
            Z
          </text>
        ))}
    </Buddy>
  );
}

const ZEN_LINES: Line[] = [
  { text: "Recovery is part of training 🧘" },
  { text: "Omega-3 for happy joints 🐟", href: "/shop/omega-3" },
  { text: "Tap me — breathe with me 🌬️" },
  { text: "Questions? We're happy to help 💬", href: "/contact" },
];

export function ZenBro() {
  const [say, flash] = useFlash(2400);
  const calm = useScrollPercent();
  return (
    <Buddy
      lines={ZEN_LINES}
      offset={1}
      say={say}
      label="Recovery"
      stat={`${calm}%`}
      onTap={() => flash("Inhale… exhale… 🧘")}
      tapHint="Gym buddy meditating — tap to breathe"
      className={cn("gb-zen", say && "is-breath")}
    >
      <circle className="gb-aura" style={{ transformOrigin: "70px 118px" }} cx="70" cy="118" r="56" fill={GOLD} opacity="0.13" />
      <ellipse cx="70" cy="197" rx="46" ry="6" fill={RED} opacity="0.75" />
      <g className="gb-float">
        <path d="M34 162 Q70 182 106 162 Q108 148 92 146 L48 146 Q32 148 34 162 Z" fill={SHORTS} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <ellipse cx="54" cy="163" rx="9" ry="5" fill={SKIN} stroke={INK} strokeWidth="2" />
        <ellipse cx="86" cy="163" rx="9" ry="5" fill={SKIN} stroke={INK} strokeWidth="2" />
        <path d="M50 92 Q70 84 90 92 L86 150 L54 150 Z" fill="#14b8a6" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <Limb x1={54} y1={96} x2={40} y2={130} w={10} />
        <Limb x1={40} y1={130} x2={46} y2={150} w={9} />
        <Limb x1={86} y1={96} x2={100} y2={130} w={10} />
        <Limb x1={100} y1={130} x2={94} y2={150} w={9} />
        <circle cx="46" cy="152" r="4.5" fill={SKIN} stroke={INK} strokeWidth="2" />
        <circle cx="94" cy="152" r="4.5" fill={SKIN} stroke={INK} strokeWidth="2" />
        <rect x="63" y="78" width="14" height="10" fill={SKIN} stroke={INK} strokeWidth="2.5" />
        <Head x={70} y={68} hair="bun" mood="calm" />
      </g>
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} className="gb-rise" style={{ animationDelay: `${i * 0.8}s` }} cx={30 + i * 26} cy="180" r="2.5" fill={GOLD} />
      ))}
    </Buddy>
  );
}
