# Local motion implementation

This feature is local to `feat/local-song-motion`. It preserves the Spanish
copy, original licensed photographs, $20/$50 packages, all 12 questionnaires,
and the existing intake/payment contracts. No template assets, dependencies,
backend routes, credentials, or environment settings are added.

## Reference and original direction

The requested reference was
<https://www.motionsite.ai/templates/lenscraft>. A read on October 1, 2026
returned HTTP 403 through the managed network route. Its appearance and actual
motion could not be reviewed; no claim of a visual match is made. No paid
template was purchased or copied.

The original adaptation uses the existing paper, sage, serif typography, and
photographic composition. Small vertical entrances support reading order;
finite section reveals give the page rhythm without pinning, parallax, looping
effects, scroll interception, or delaying controls.

## Motion map

| Moment | Intent | Cue and trigger | Duration | Reduced motion |
| --- | --- | --- | --- | --- |
| Hero copy | Understand the offer | 14px entrance on document readiness, 45ms stagger | 520ms per item | Immediately visible |
| Hero photography | Establish the emotional setting | 20px entrance with 80ms delay | 680ms | Immediately visible |
| Main sections | Read the next chapter | 20px entrance on first intersection | 620ms, once per document | Immediately visible |
| Buttons and SVGs | Confirm interaction | Small press and directional hover feedback | 180–220ms | No transforms or transitions |
| Form step | Orient to the next questions | 10px entrance with immediate heading focus | 280ms | Immediate focus and visibility |
| Progress | Show position | Width transition after the synchronous state update | 280ms | Immediate update |

Entrances use `cubic-bezier(.22, 1, .36, 1)` and animate only opacity and
transform. The small native Web Animations / IntersectionObserver module adds
no third-party animation library. Default CSS keeps content visible. Missing
JavaScript or unsupported animation/observer APIs leave the landing content
readable; the optional motion module is independent of form initialization.

The JavaScript checks `prefers-reduced-motion` before animating and cancels
active animations when that preference changes. CSS removes motion and smooth
scrolling for the same preference. Revealed sections remain revealed on return
from a form and when scrolling back; animations never advance business state.

## Controls and regressions

Decorative arrows, photo-reordering arrows, and remove symbols are original
inline SVG paths with `aria-hidden="true"` and `focusable="false"`. Text or
Spanish `aria-label` attributes name the controls. Photo controls have 44px
targets. Radios remain native, focusable controls contained within their own
clickable labels; visible labels and keyboard selection are verified directly.

The browser image check scrolls each visible photograph into view and waits for
loading and decoding. It does not incorrectly require a CSS-hidden mobile
photograph or an offscreen lazy image to have loaded before it can be requested.

## Local validation

From `/workspace/Shia-songs`, run `npm run build`, `npm test`, and
`npm run test:browser`. The browser tests use a temporary loopback server and
intercept all external traffic. Intake submission/finalization are local mocks;
unexpected external requests are blocked. Checkout remains disabled. Do not
manually submit QA data through the standard frontend: it still points at the
existing live intake outside the mocked harness.

Current verification results and screenshot paths are recorded in
`docs/LOCAL_MOTION_QA.md`. No deployment or production approval is implied.
