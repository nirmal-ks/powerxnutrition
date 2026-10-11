"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createIntroAudio } from "@/lib/intro-audio";
import { INTRO_KEY, SOUND_KEY } from "@/lib/theme";

const DURATION = 4700; // ms — keep in sync with the CSS timeline in globals.css
/**
 * The two PowerX founders (background removed, same framing & size).
 * Left starts with founder A, right with founder B; on each heartbeat they flip in 3D and swap sides.
 */
const FOUNDERS = { a: "/intro/founder-a.webp", b: "/intro/founder-b.webp", w: 760, h: 1200 };
/** Each founder also has a blurred, darkened copy of his own gym scene behind him ("-bg"), so he looks photographed, not cut out. */
const bgOf = (src: string) => src.replace(".webp", "-bg.webp");
const SIDES = [
  { side: "l", first: FOUNDERS.a, second: FOUNDERS.b },
  { side: "r", first: FOUNDERS.b, second: FOUNDERS.a },
] as const;

/** Glowing embers rising behind the owners (deterministic, so server and client match). */
const EMBERS = Array.from({ length: 22 }, (_, i) => ({
  left: (i * 37) % 100,
  size: 2 + ((i * 7) % 4),
  delay: -((i * 0.53) % 6),
  dur: 5 + ((i * 1.7) % 4),
  drift: ((i % 5) - 2) * 18,
}));

type Phase = "gate" | "play" | "exit" | "done";

/**
 * Entry screen shown first on every new visit:
 *  1. "gate"  — PowerX logo, athletes in silhouette and a big ENTER button.
 *  2. "play"  — clicking ENTER (a user gesture, so browsers allow sound) plays the cinematic
 *               intro with sound: athletes posing on both sides, the logo slamming in.
 *  3. "exit"  — doors open onto the website.
 * The gate is server-rendered, so it covers the page before anything else is visible.
 */
export function Intro() {
  const [phase, setPhase] = useState<Phase>("gate");
  const [soundOn, setSoundOn] = useState(true);
  const audio = useRef<ReturnType<typeof createIntroAudio>>(null);
  const t0 = useRef(0);
  const endTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const finish = useCallback((fast = false) => {
    clearTimeout(endTimer.current);
    setPhase((p) => (p === "done" ? p : "exit"));
    audio.current?.fadeOut();
    audio.current = null;
    try {
      sessionStorage.setItem(INTRO_KEY, "1");
    } catch {}
    setTimeout(() => setPhase("done"), fast ? 550 : 700);
  }, []);

  useEffect(() => {
    // Tells the no-JS safety net in lib/theme.ts that React is handling the intro now.
    (window as unknown as { __pxIntro?: boolean }).__pxIntro = true;
    if (document.documentElement.dataset.intro === "off") {
      setPhase("done");
      return;
    }
    try {
      setSoundOn(localStorage.getItem(SOUND_KEY) !== "off");
    } catch {}
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(true);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(endTimer.current);
    };
  }, [finish]);

  const enter = () => {
    if (phase !== "gate") return;
    // Created inside the click handler → the browser allows audio.
    if (soundOn) {
      audio.current = createIntroAudio();
      void audio.current?.start(0);
    }
    t0.current = performance.now();
    setPhase("play");
    endTimer.current = setTimeout(() => finish(), DURATION);
  };

  const toggleSound = async () => {
    const next = !soundOn;
    setSoundOn(next);
    try {
      if (next) localStorage.removeItem(SOUND_KEY);
      else localStorage.setItem(SOUND_KEY, "off");
    } catch {}
    if (phase !== "play") return;
    if (!next) {
      audio.current?.fadeOut();
      audio.current = null;
    } else if (!audio.current) {
      audio.current = createIntroAudio();
      void audio.current?.start((performance.now() - t0.current) / 1000);
    }
  };

  if (phase === "done") return null;

  return (
    <div className="px-intro theme-dark" data-phase={phase} role="dialog" aria-modal="true" aria-label="Welcome to PowerX Nutrition">
      {/* Doors (the black background) — slide apart at the end */}
      <div className="px-door px-door-l" />
      <div className="px-door px-door-r" />

      {/* The owners — silhouettes on the entry screen, lit up and flexing when the intro plays */}
      <div className="px-owners" aria-hidden>
        <div className="px-grid px-grid-on" />
        <div className="px-embers">
          {EMBERS.map((e, i) => (
            <span
              key={i}
              className="px-ember"
              style={{ left: `${e.left}%`, width: e.size, height: e.size, animationDelay: `${e.delay}s`, animationDuration: `${e.dur}s`, "--x": `${e.drift}px` } as React.CSSProperties}
            />
          ))}
        </div>
        {SIDES.map(({ side, first, second }) => (
          <div key={side} className={`px-own px-own-${side}`} style={{ aspectRatio: `${FOUNDERS.w} / ${FOUNDERS.h}` }}>
            <div className="px-own-enter">
              <div className="px-own-sway">
                <div className="px-own-body">
                  <div className="px-swap px-swap-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={bgOf(first)} alt="" width={FOUNDERS.w} height={FOUNDERS.h} className="px-bgpanel" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={first} alt="" width={FOUNDERS.w} height={FOUNDERS.h} fetchPriority="high" />
                    <span className="px-own-sweep" style={{ maskImage: `url(${first})`, WebkitMaskImage: `url(${first})` }} />
                  </div>
                  <div className="px-swap px-swap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={bgOf(second)} alt="" width={FOUNDERS.w} height={FOUNDERS.h} className="px-bgpanel" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={second} alt="" width={FOUNDERS.w} height={FOUNDERS.h} />
                    <span className="px-own-sweep" style={{ maskImage: `url(${second})`, WebkitMaskImage: `url(${second})` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
        <div className="px-floor" />
      </div>

      {phase === "gate" ? (
        <div className="px-gate">
          <div className="px-gate-center">
            <p className="px-gate-eyebrow">Welcome to</p>
            <div className="px-word px-word-static">
              POWER<span className="px-x px-x-static">X</span>
            </div>
            <div className="px-nutrition px-nutrition-static">NUTRITION</div>
            <button type="button" onClick={enter} className="px-enter" autoFocus>
              <span className="px-enter-ring" />
              <span className="px-enter-label">Enter</span>
            </button>
            <p className="px-gate-hint">{soundOn ? "🔊 Best with sound on" : "🔈 Sound is off"}</p>
          </div>
        </div>
      ) : (
        <div className="px-stage">
          <div className="px-beams" />
          <div className="px-flash" />

          {/* Centre logo */}
          <div className="px-logo">
            <div className="px-shock" />
            <div className="px-shock px-shock-2" />
            <div className="px-word">
              {"POWER".split("").map((ch, i) => (
                <span key={i} className="px-letter" style={{ "--i": i } as React.CSSProperties}>
                  {ch}
                </span>
              ))}
              <span className="px-x">X</span>
            </div>
            <div className="px-nutrition">NUTRITION</div>
            <div className="px-tagline">Fuel Your Better Tomorrow</div>
            <div className="px-bar">
              <span />
            </div>
          </div>
        </div>
      )}

      <div className="px-controls">
        <button type="button" onClick={toggleSound} className="px-btn" aria-label={soundOn ? "Turn sound off" : "Turn sound on"}>
          {soundOn ? "🔊 Sound on" : "🔈 Sound off"}
        </button>
        <button type="button" onClick={() => finish(true)} className="px-btn px-skip">
          Skip intro ›
        </button>
      </div>
    </div>
  );
}
