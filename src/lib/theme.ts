export const THEME_KEY = "px_theme";
export const INTRO_KEY = "px_intro_v2"; // sessionStorage — intro plays once per visit
export const SOUND_KEY = "px_sound"; // localStorage — "off" once the visitor mutes the intro
export type Theme = "dark" | "light";

/**
 * Runs before first paint (inlined in <head>) so there's no flash of the wrong theme,
 * and so the intro is hidden instantly for returning visitors / reduced-motion users.
 * Safety net: if the page's JavaScript fails to load (so React never starts), clicking ENTER / Skip
 * still hides the intro — visitors can never get stuck behind it.
 * `?theme=light` / `?theme=dark` sets (and remembers) the theme; `?intro=1` forces the intro, `?intro=0` hides it.
 */
export const themeInitScript = `try{var d=document.documentElement,q=new URLSearchParams(location.search),m=q.get("theme");if(m==="light"||m==="dark")localStorage.setItem("${THEME_KEY}",m);if(localStorage.getItem("${THEME_KEY}")==="light")d.dataset.theme="light";if(q.get("intro")==="0"||q.get("intro")!=="1"&&(sessionStorage.getItem("${INTRO_KEY}")||matchMedia("(prefers-reduced-motion: reduce)").matches||/bot|crawl|spider|lighthouse/i.test(navigator.userAgent)))d.dataset.intro="off";document.addEventListener("click",function(e){var t=e.target;if(!window.__pxIntro&&t&&t.closest&&t.closest(".px-enter,.px-skip")){d.dataset.intro="off";try{sessionStorage.setItem("${INTRO_KEY}","1")}catch(x){}}},true)}catch(e){}`;
