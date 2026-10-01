# Vinyl and bilingual verification · October 1, 2026

Candidate: `feat/vinyl-carousel-bilingual`, based on verified remote main
`dd2e7ddec5c566f543f0018bfb4cda41f4f9e555`. Implementation and independent QA
used GPT-6.1 Sol with Medium reasoning; the available agent controls do not
expose a speed selector. This is local engineering verification, not publication
or production activation.

## Results

| Check | Executed evidence | Outcome |
| --- | --- | --- |
| Build and syntax | `npm run build`; Node checks of app, locale, carousel and motion modules | Passed |
| Offline regression | `npm test` | 25 passed; 0 failed, cancelled or skipped |
| Translation completeness | Explicit baseline inventory of all original questionnaire labels, help, options and placeholders | 387/387 sources have English mappings |
| Existing responsive browser suite | Chromium 1440/768/390/320px, all 12 forms, radio/photo controls, mocked intake | Passed; zero landing/form/admin axe violations or page errors |
| Native motion suite | Desktop/mobile entrances, train once, initial/live reduced motion, missing observer/animation/module, no JS | Passed; six sections revealed once; 840ms train entrance observed |
| Bilingual browser suite | All 12 forms in English and Spanish; locale toggles at every form step and review | 24 flows passed; answers remain identical |
| Draft recovery | Saved drafts restored in both locales; separate saved $50 and nondefault song-language regressions | 22 full browser restores passed; $50 and canonical `Idioma=Inglés` preserved |
| Native mobile carousel | Genuine CDP touch events on Chromium mobile emulation | 320px swipe changes native scroll position; no page overflow |
| Carousel controls and focus | Real SVG clicks, Home/End/Arrow keys, centered endpoints and boundary states | Passed; selected sleeve faces forward |
| Settled adjacent navigation | Desktop/320px × normal/reduced motion, every Next/Previous neighbor plus endpoint form returns | 88 adjacent steps passed; native snap, endpoint states and focus remain correct |
| Photo state | Local files, blob URLs, captions, reorder/remove, locale switches | References and captions retained; no live transport used |
| Success and payment status | EN/ES mocked submission, modal toggle, payment-status toggle/reload | Canonical payloads retained; checkout remains disabled |
| Error and storage recovery | Denied local storage and unknown mocked provider error | Locale switches still work; customer errors are safely localized |
| Independent interaction review | Actual selected-sleeve pointer clicks through native controls, all 12 × two locales × desktop/320px, normal Previous and reduced-motion Next traversal | 96 cases passed; keyboard/focus and genuine screenshots also inspected |

`npm run test:browser` runs all three committed browser suites and exited 0.
The combined suites made three mocked submissions and three mocked
finalizations. External routing was installed before navigation; no live
orders, Supabase uploads, Stripe operations or payments occurred.

The implementation repaired an actual pointer-focus race: auto-centering a
sleeve on pointer focus could move it between press and release. Pointer focus
now remains stable while keyboard focus centers appropriately. A separately
observed Playwright auto-scroll attempt to click an arbitrary offscreen,
transformed sleeve was not representative of a visible customer selection;
the independent customer-path verification navigates with native controls
before clicking and uses no forced clicks or direct handler invocation.

Nested locale spans initially inherited radio-label borders. Styling was scoped
to the direct label span; genuine mobile form captures now show single borders.

Independent normal-motion mobile checks also caught a Previous click skipping
a sleeve after returning from the final questionnaire. The outer snap items
now stay stationary, with 3D transforms on inner sleeve faces, so native snap
positions remain stable. Boundary controls transfer focus to the opposite
enabled control before becoming disabled. Retained navigation regressions
check every adjacent Next and Previous step after native scrolling settles,
in normal and reduced motion on desktop and 320px mobile, plus opening and
returning from forms at both endpoints.

## Genuine local artifacts

All evidence remains excluded from Git under ignored `artifacts/`:

- `vinyl-{en,es}-{desktop,mobile}-{hero,carousel,form}.png` — both customer locales.
- `vinyl-{en,es}-payment-status.png` — localized payment-status text.
- `vinyl-en-desktop-coverflow.png` — middle selection with angled neighbors.
- `vinyl-train-arrival.mp4` — approximately two seconds, 58 genuine browser
  screencast frames encoded using the already-installed system FFmpeg.
- `browser-report.json`, `motion-browser-report.json`, `vinyl-bilingual-report.json`.
- `vinyl-independent-check.json`, `vinyl-pointer-regression.json`,
  `vinyl-pointer-previous-normal-motion.json`, and
  `vinyl-independent-*.png` — independent interaction and screenshot evidence.

No image or video was generated to impersonate a browser capture. Existing
licensed photos, backend source, lockfile and environment configuration are
unchanged. Screenshots, recording frames and video are not committed.

## Changed files

- Pages: `index.html`, `credits.html`, `payment-status.html`.
- Styles: `assets/css/design.css`, `assets/css/legacy.css`.
- Customer scripts: `assets/js/app.js`, `assets/js/carousel.js`,
  `assets/js/i18n.js`, `assets/js/motion.js`, `assets/js/payments.js`,
  `assets/js/questionnaire-translations.js`, `assets/js/static-translations.js`.
- Tests: `tests/browser.mjs`, `tests/dom.test.js`, `tests/locale.test.js`,
  `tests/motion-browser.mjs`, `tests/vinyl-bilingual-browser.mjs`.
- Test command and documentation: `package.json`, `README.md`,
  `docs/QA_STATUS.md`, `docs/VINYL_BILINGUAL.md`, `docs/VINYL_BILINGUAL_QA.md`.

## Limits

Physical iPhone/iPad, other browser engines and live provider/upload/payment
transport were not exercised. Native swiping is verified in Chromium mobile
emulation, not claimed as a physical-device test. A real-device acceptance pass
remains appropriate before production use.

The references were user-provided descriptions of general ideas, not personally
viewed reference screenshots. No reference API/proxy access was retried.
The skills' referenced formal QA schema/validator is unavailable from its
package and local checkout; formal `READY_FOR_CRISTIAN_TESTING` approval is not
claimed. The executed checks and raw evidence above remain inspectable.

No remote push, PR, merge, deployment, new environment, credentials, permission
grants, account settings or environment configuration changes were performed.
