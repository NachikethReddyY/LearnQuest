---
version: alpha
name: LearnQuest-design
description: A playful, sticker-style design system for a kids-learning-app feel applied to learning code. Warm white canvas (`#fffdf8`), near-black ink (`#1b1b1f`) outlines on every shape, hard offset shadows with no blur, flat bright fills. Pip, the lilac sprout mascot, appears in every illustration. Fraunces (soft, heavy) for display, Nunito for body, JetBrains Mono for code.

colors:
  ink: "#1b1b1f"
  paper: "#fffdf8"
  white: "#ffffff"
  sun: "#ffd23f"
  pink: "#ff8fb1"
  lilac: "#b9a4ff"
  mint: "#b6f0cf"
  blue: "#3b5bff"
  green: "#22c55e"
  green-deep: "#15803d"

typography:
  display:
    fontFamily: "'Fraunces', Georgia, serif"
    fontWeight: 600-900
    fontVariationSettings: "'SOFT' 100"
  body:
    fontFamily: "'Nunito', system-ui, sans-serif"
    fontWeight: 400 / 600 / 800 / 900
  code:
    fontFamily: "'JetBrains Mono', ui-monospace, monospace"
    fontWeight: 400 / 500

rounded:
  card: 1.5rem
  option: 0.75rem
  pill: 9999px

borders:
  control: 3px solid ink
  illustration: 6px solid ink

shadows:
  chunk: "6px 6px 0 ink"
  lip: "0 4px 0 ink"
  illustration: "8px 8px 0 ink"
---

# LearnQuest Design System

Source of truth: [apps/web/src/index.css](apps/web/src/index.css) (`@theme` tokens and component classes). If this file and the CSS disagree, the CSS wins; fix this file.

## Principles

- **Sticker, not screen.** Every shape has a thick ink outline, rounded corners and a hard offset shadow. No gradients, textures, blur or soft shadows.
- **Flat fills from the palette only.** No colors outside the table below.
- **Pressable.** Controls have a "lip" shadow and sink on press.
- **Bouncy.** Motion uses squash-and-stretch and overshoot easing, never linear fades.
- **Pip is the guide.** One mascot, same style everywhere.

## Colors

| Token | Hex | Use |
|---|---|---|
| ink | `#1b1b1f` | text, every outline, every hard shadow |
| paper | `#fffdf8` | page background |
| white | `#ffffff` | cards, option buttons, progress tracks |
| sun | `#ffd23f` | highlight, hint button, Predict card, band background |
| pink | `#ff8fb1` | Functions topic, Hint card, errors/oops |
| lilac | `#b9a4ff` | Async topic, Reveal card, Pip |
| mint | `#b6f0cf` | State topic, Adapt card, success panels |
| blue | `#3b5bff` | brand accent in the wordmark and headline, closing band |
| green | `#22c55e` | primary CTA, correct answers, progress |
| green-deep | `#15803d` | CTA lip only |

## Typography

- **Display** (headlines, wordmark): Fraunces 600–900 with `font-variation-settings: "SOFT" 100`. Tight leading, heavy weight. One word per headline may be blue and underlined with a sun-yellow bar.
- **Body and UI**: Nunito. 400 for paragraphs, 800 for buttons and pills, 900 for labels.
- **Code**: JetBrains Mono on ink-colored panels.

## Shape and elevation

| Class | Spec | Use |
|---|---|---|
| `.chunk` | 3px ink border, `6px 6px 0` ink shadow, `1.5rem` radius | cards, demo panel |
| `.btn` | pill, green fill, white 800 text, `0 5px 0` green-deep lip | primary CTA |
| `.pill` | pill, 3px ink border, `0 4px 0` ink lip, 800 weight | secondary buttons, topic tags |
| `.opt` | `0.75rem` radius, 3px ink border, `0 4px 0` ink lip | answer options |
| `.track` | pill, 3px ink border, white fill, overflow hidden | progress and mastery bars |

Press behavior: hover lifts 1–2px and grows the lip; active sinks the full lip height and drops the shadow to 0. Cards may tilt a few degrees for a stuck-on look.

## Motion

Defined in `index.css`: `shake` (wrong answer), `float` (idle mascot), `pop` (correct), `hop` (celebrate), `wiggle`, `slide-in`, `rise` (entrance), `ring` (yellow pulse on the attention target), `confetti` (burst). Everything is disabled under `prefers-reduced-motion`.

## Illustration (Pip)

Generate every illustration with this prompt prefix, then add the scene:

> Flat vector sticker illustration, playful and chunky. Thick uniform 6px near-black outline (#1b1b1f) on every shape, rounded corners and round line caps, no gradients, no textures, no soft shadows. Add one hard offset drop shadow in solid #1b1b1f, 8px right and 8px down, no blur. Flat fills from this palette only: sun yellow #ffd23f, pink #ff8fb1, lilac #b9a4ff, mint #b6f0cf, blue #3b5bff, green #22c55e, warm white #fffdf8. Friendly, bouncy, slightly squashed proportions, like a modern kids' learning app. Transparent background. No text or letters unless I specify. No watermark.

Assets live in `apps/web/public/img/` (`pip-wave`, `pip-think`, `pip-cheer`, `pip-oops`, `pip-sheet`, plus scene art for predict, hint, reveal, adapt, mastery, finale). Transparent PNG, no baked-in text.

## Layout

- Warm-white page, content column about 1300px wide, generous vertical rhythm.
- Full-bleed color bands (sun for topic chips, blue for the closing call to action) with 3px ink top and bottom rules.
- Dark footer in ink.
- Feature cards: one palette color each, tilted slightly, with illustration on top, number, title, one-line description.

## Voice

Short, friendly, concrete. Predict first, then watch. Never claim hints earn mastery. Each recommendation states its reason.

## Do and don't

- Do put an ink outline and hard shadow on every new component.
- Do reuse `.chunk`, `.btn`, `.pill`, `.opt`, `.track` before inventing styles.
- Don't add colors, gradients, blurred shadows or thin (under 3px) outlines.
- Don't put text inside generated illustrations.
