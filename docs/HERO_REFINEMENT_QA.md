# Hero and occasion refinement verification

Candidate: `feat/hero-motion-occasion-refresh`.
Base: `d3b1b69d2c5d629c6d5a156431483dd3cd246e6f`, verified through authorized native Git.
Local-only implementation; no publishing or environment changes.

## Executed validation

Final regression status: PASS — full command exit 0.

- `npm test`: 28 offline tests, zero failures/skips. Includes twelve-asset distinctness, actual hashes/bytes/WebP format, canonical HTML/module mappings, bilingual descriptions and supplied license provenance, plus existing contract/state/database coverage.
- `npm run build`: pinned local bundle build succeeds.
- `npm run test:browser`: four genuine Chromium suites, with mocks/blocked external services installed before navigation. Final complete command exited 0; all four suites passed.
- Viewports: desktop 1440, tablet 768, mobile 390, small mobile 320. No horizontal page overflow. The selector follows the hero/introduction and precedes the story, pricing and FAQ.
- Existing baseline: all twelve questionnaire routes, validation, photo controls and mocked submit/finalize.
- Bilingual regression: all twelve forms in both languages; mid-form toggling preserves answers/options/song-language; restored drafts preserve answers; photo references/captions survive toggle, reorder and remove. Document language and localized control names remain accurate. Backend identifiers and payloads remain canonical.
- Hero: actual layered movement, keyboard pause/resume, localized pause state, paused animation time, offscreen/context pause, finite eight-second duration, initial/live reduced motion, missing animation/observer/module and no-JavaScript visibility.
- Carousel: native CDP touch swipe; large accessible SVG arrows; delayed fine-pointer hover, adjacent repeat, leave/blur/cancel/context/end stopping; click/keyboard; touch tap/hold/release/cancel/movement cancellation and next-tap recovery at 320/390, normal and reduced motion. No release/synthetic-click extra step.
- Photography: all twelve decode and map correctly in both locales at all four viewports (96 image/locale/viewport checks), plus no-JavaScript loads. Desktop/mobile crops actually inspected. Twelve distinct new optimized assets total 811,816 bytes. Primary source/license verification came from the authorized research handoff; this executor verified the transferred files and website derivatives.
- Axe scans: zero reported violations on tested landing/form states. This is scoped automated evidence, not a universal accessibility certification.

## Defects found and repaired

Mouse pointer cancellation previously left a hover timer active; cancellation now stops it before checking any touch pointer ID.

Chromium could omit a touch synthetic click after a cancelled/moved gesture. Valid touch/pen pointerup now commits a tap exactly once; any subsequent synthetic click is consumed. Cancel, movement beyond 18px/outside the arrow, and completed holds add no release movement.

A genuine reduced-motion mobile swipe followed by Next/focus/End could briefly select sleeve twelve and then rebound to sleeve two while retaining keyboard focus on twelve. Explicit instant commands now cancel the pending compositor snap for 250ms; new track pointerdown restores native scrolling immediately. The test asserts the settled target, focus and endpoint flags rather than accepting a transient active state.

Independent QA preserved the failing evidence and retested fresh contexts: 12/12 stable End/Home checks pass across three runs per motion preference. Independent photo review passed 51/51 checks. Earlier touch recovery retest passed 12/12. Final independent control retest: 26/26 checks passed with zero browser errors or external requests (`artifacts/independent/report-instant-scroll-fixed.json`).

## Genuine local artifacts

All artifacts are ignored and excluded from the source commit:

- `artifacts/refinement-{en,es}-{desktop,tablet,mobile,small-mobile}-{hero,occasions}.png`
- `artifacts/refinement-{desktop,small-mobile}-{occasion_id}-sleeve.png` (24 actual selected-sleeve captures)
- `artifacts/refinement-no-js.png`
- `artifacts/refinement-hero-motion.mp4` (real Chromium CDP frames; capture-derived frame rate, ffprobe frame-count verification)
- `artifacts/{browser-report,motion-browser-report,vinyl-bilingual-report,hero-refinement-report}.json`
- `artifacts/independent/photos-report.json`, `photos-desktop-contact.png`, `photos-mobile-contact.png`
- `artifacts/independent/swipe-end-home-summary-fixed.json` and raw trace; the original failing trace is retained separately.

The video shows actual hero motion; it is not generated photography or a reconstructed animation. Final recording: 190 actual captured frames, 3.175 seconds. Exact capture metadata is in the final refinement report.

## Boundaries and remaining limits

No real orders, intake submissions, storage uploads, payments or Stripe actions were made. Any intake requests in reports were intercepted local mocks. Checkout remains disabled. Existing backend launch limitations remain documented in the prior QA reports.

The first Pexels original request was denied by proxy CONNECT 403 and was never retried. The user authorized supported native `download_file` transfer of existing private build inputs instead; both files transferred successfully. ZIP inspection preceded extraction: exactly twelve expected images and the matching manifest, no traversal, symlinks or unrelated entries. Archive/originals remain private outside Git. Full credits are in `OCCASION_PHOTO_CREDITS.json`; the generic adult pink-gown illustration does not claim a verified XV event. Model-release paperwork is not publicly verified.

Testing uses genuine installed Chromium with desktop/mobile emulation and CDP input, not physical iOS/Android devices. Safari/Firefox and physical-device acceptance are untested. Referenced formal QA-skill validator resources were not available through the current skill provider; no formal validator or universal readiness certification is claimed. No remaining implementation blocker was found in the executed coverage; the device/engine and formal-validator limits above remain.
