# Local motion verification · October 1, 2026

Candidate: local branch `feat/local-song-motion`, based on `2a97868`.
Scope: local motion and accessibility implementation, not deployment or payment
activation. Implementation and independent QA agents used GPT-6.1 Sol with
Medium reasoning. Speed selection is not exposed by the agent tools.

## Executed checks

| Requirement | Evidence | Outcome |
| --- | --- | --- |
| Build and offline contracts | `npm run build`; `npm test` | Build passed; 21 passed, 0 failed/skipped |
| Responsive original content | Chromium at 1440×1000, 768×1024, 390×844, 320×740 | Visible photos decode; 12 occasions; no horizontal overflow |
| Existing questionnaires | All 12 wizard flows, required validation, opt-in draft save/erase, progress and review | Passed |
| Local intake contract | Existing browser test intercepts submit/finalize before navigation | 1 mocked submission and 1 mocked finalization; 0 live orders |
| Radio interception repair | Visible labels clicked without forcing; independent Space/ArrowRight selection | Passed |
| Accessible SVG photo controls | Add two local image files; edit caption; reorder both ways; remove; inspect Spanish names and decorative SVG | Passed |
| Original hero and step motion | Native browser animation calls observed, focus checked | Finite entrances run; first and subsequent step headings receive focus |
| Once-only sections | Six sections scrolled into view, then revisited on desktop/mobile | Exactly six section entrances per document |
| Reduced motion | Initial preference, live preference change during animation, CSS transition and scroll checks | No initial entrances; active motion cancelled; later step motion suppressed |
| Progressive enhancement | Missing IntersectionObserver, Web Animations, both APIs, optional module; JavaScript disabled | Content readable; forms work without motion; no-JS notice/anchors/native FAQ work |
| Accessibility | Retained axe assertions on landing, form review, admin sign-in surface | 0 violations on each surface |
| Safety | Route interception installed before navigation; unexpected external traffic blocked | No live orders, uploads, Stripe calls or credentials used |

`npm run test:browser` runs both committed browser suites and exited 0.
The independent QA agent also reproduced the motion, native radio interaction,
heading focus, reduced-motion cancellation and progressive fallbacks in actual
Chromium without changing source files. Four existing small-text contrast
failures found by axe were repaired with a scoped darker sage text color and
the complete browser suite was rerun successfully.

Syntax checks for `app.js` and `motion.js`, a Unicode arrow/reorder/remove/emoji
scan of `index.html` and `app.js`, and `git diff --check` also passed. Backend
source, photos, lockfile and dependency declarations are unchanged; the package
script now includes the additional motion browser suite.

## Local evidence

Generated evidence is kept in ignored `artifacts/`:

- `browser-report.json` — responsive forms, mocked requests and axe results.
- `motion-browser-report.json` — motion, reduced-motion and fallback checks.
- `independent-qa.json` — independent browser findings.
- `motion-desktop-hero.png`, `motion-mobile-hero.png` — normal-motion landing.
- `motion-desktop-form.png`, `motion-mobile-form.png` — normal-motion forms.
- `desktop.png`, `tablet.png`, `mobile.png`, `small-mobile.png` — full landing.
- `form-desktop.png`, `form-mobile.png`, `admin-mobile.png` — functional surfaces.
- `no-js-landing.png` — honest unenhanced landing.

These are genuine local Chromium captures, not generated mockups. The motion
suite waits for animation and scroll completion before capture and checks that
the first form heading clears the sticky navigation.

## Boundaries and unavailable evidence

Only Chromium was tested; physical iPhone/iPad, other browser engines and live
intake/Stripe/fulfillment were not exercised. Photo manipulation was tested
locally; live storage upload transport was not tested. These integrations are
preserved and outside this task's authority.

The Lenscraft reference returned HTTP 403. No template code/assets were copied
and no direct visual-match claim is made. The motion skill's referenced research
and quality files, and the QA skill's test-matrix/release-contract/validator,
were unavailable from their packages and absent locally. The instruction to
validate a formal gate report could not be executed; formal
`READY_FOR_CRISTIAN_TESTING` approval is therefore not claimed. The executed
engineering checks above remain independently inspectable.

No environment configuration, permission grants, remote branches, pull
requests, merges, payments, live data, or deployments were changed.
