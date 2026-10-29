// Button sounds are synthesized, so there are no audio files to ship.
let ctx: AudioContext | undefined;

function tone(type: OscillatorType, from: number, to: number, peak: number, length: number) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + length);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + length);
}

const KEY = "lq-sound";

// Remembered per browser. Storage can be blocked, so the module copy is the source of truth for this page.
let on = (() => {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
})();

export function isSoundOn() {
  return on;
}

export function setSoundOn(next: boolean) {
  on = next;
  try {
    localStorage.setItem(KEY, next ? "on" : "off");
  } catch {
    /* storage blocked: the setting lasts for this page only */
  }
}

// A "blop": a round sine that drops in pitch fast, plus a tiny high tick on the attack so it reads as a click.
export function blip(pitch: number) {
  if (!on) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    tone("sine", pitch * 1.8, pitch, 0.4, 0.14);
    tone("triangle", pitch * 4, pitch * 4, 0.15, 0.02);
  } catch {
    /* no Web Audio support: stay silent */
  }
}
