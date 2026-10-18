# OFFBEAT / BASS MIRROR 004 — Mobile interaction architecture

## Decision
Memory is a **listening surface**, not a long dashboard. The entry state must make three actions available without scrolling: **Play**, **Change**, **Keep**. Editing is a separate deliberate mode, never a requirement for listening.

## Information architecture (iPhone portrait)
- **Persistent 57 px top bar:** OFFBEAT back navigation, one visualization-mode selector, Saved.
- **One compact stage:** memory visualization → strongest recurring gesture → latest note/one-line hint. The explanation is intentionally behind “What is this?”.
- **Thumb dock:** Play/Stop, Change, Edit, Keep. No buried primary action and no competing CTAs in the visual stage.
- **Focused, dismissible bottom sheet:** Change (intent + protect + A/B), Edit (presets, source audio, pads, 16-step grid and tempo), Saved (Idea Vault + WAV export), About (math/evidence and scope).
- **No long document scroll by default.** The stage may scroll internally on short screens, and sheets scroll independently when needed. 44–50px minimum interactive controls, safe-area padding, touch-friendly tap targets.

## Preserve source-of-truth
V4 changes **presentation and interaction only**. It does not duplicate the sequencing, mutation, save, or audio code. DOM nodes are moved, not cloned, so live listeners/state remain attached.
- Audio: v2 Web Audio unlock + sample decode + bass harmonic reinforcement.
- Pattern analysis: v3 repeat scoring over the sequenced 16-step map.
- Variation: v3 constrained mutation with A/B keep/discard.
- Persistence: v3 named snapshots in localStorage, device/browser only.
- Mobile adapter: `public/bass-mirror/v4-mobile.js` + `v4-mobile.css`.
- Desktop retains its existing full laboratory layout: adapter exits for viewport width >780px.

## Progressive disclosure
Default = **hear and observe**. Change = **make one deliberate decision**. Edit = **touch the music directly**. Saved = **capture your discovery**. About = **understand the evidence**.

**Never** show long explanations, seven boxed panels, or a complete 16-step editor on the primary mobile listening screen.

## User outcomes and QA contract
1. Play works through the existing sample engine from the sticky dock.
2. Memory is selected by default, with modes still reachable in the header.
3. Pattern finding is readable without zoom; “What is this?” can explain the metric.
4. Change opens one sheet where user can choose Answer/Repeat/Space/Timing and protect a bass sample. A/B, Keep, and Discard remain wired to v3.
5. Edit opens real sample pads and the horizontally scrollable 16-step grid. Sound and controls are preserved.
6. Keep saves a named snapshot immediately, and only announces success if storage confirms.
7. Saved exposes re-open, deletion, and downloadable WAV.
8. Close, backdrop tap and Escape dismiss the sheet; focus returns to its launcher.
9. No desktop degradation.
10. Manual testing remains needed on real iPhone Safari: sound unlock, viewport resizing, 320px widths, short screens, sheet focus, route reload and export. READY status or static syntax check is not proof of mobile behavior.

## Corrections from V003
A saved record has shape `{id,title,snapshot:{pattern,tempo,swing,ghost}}`, not `{pattern}` at the top level. V3 previously filtered saved records incorrectly on reload. V4's release includes correcting that read path.

## Follow-on architecture
V5 should make recurrence a first-class **data model**:
`source audio → onset candidates → phrase segments → rhythm-normalized event signatures → recurrence links → verified listened excerpts → vault objects`.
Current **sequencer similarity is not yet source-audio pattern recognition**. Preserve this distinction in both UI and documentation.
For derived sequence similarity, keep a deterministic fingerprint and explainable matching step positions; do not invent raw-audio note identities or "AI found your musical style" claims.

## Visual system
Terracotta = active bass event; grey = incidental percussion; sand outline = proposed absent/removed event; soft vertical tint = current playhead; highlighted paired windows = matched phrase. Fixed rows encode sample identity; x-axis encodes the 16 time steps. Avoid floating unlabeled particles, arbitrary positions, gratuitous glows, tiny metadata, and instructional essays.

## Release
Repository `amydojo/offbeat` → Vercel `offbeat` production → `https://offbeat-pi.vercel.app/bass-mirror/`.
