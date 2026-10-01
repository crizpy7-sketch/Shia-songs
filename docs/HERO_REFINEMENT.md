# Hero motion and occasion navigation refinement

Local candidate: `feat/hero-motion-occasion-refresh`, based on native-Git-verified
main `d3b1b69d2c5d629c6d5a156431483dd3cd246e6f`. The prior tested branch is preserved.
No environment, permissions, backend, pricing, checkout or publishing changes.

## Motion and placement

| Moment | Trigger | Duration / cadence | Reduced motion |
| --- | --- | --- | --- |
| Layered hero | First visible hero composition | One eight-second photo drift / vinyl rotation; no automatic loop | Completely disabled |
| Pause / resume | Explicit accessible button, also usable by keyboard | Holds native animation time; locale changes preserve paused state | Control hidden; static composition visible |
| Hero inactive | Offscreen, hidden customer view, hidden document / pagehide | Pauses; resumes when visible if not manually paused | Never restarts motion |
| Occasion train | Section enters view once | Existing 840ms entrance | Disabled |
| Mouse arrow hover | Fine mouse pointer enters enabled arrow | 650ms initial delay; one adjacent native stop every 850ms | Same explicit behavior, immediate scrolling |
| Touch / pen hold | Press enabled arrow | 450ms initial delay; 850ms repeat | Immediate scrolling |
| Tap, click or keyboard | Explicit activation | One adjacent stop; holds do not add a release step | Immediate scrolling |

The selector is now immediately after the how-it-works introduction and before
the photo story band, pricing and FAQ. Intro and section spacing are shortened;
a localized CTA links to the sleeves. The arrows are 76px desktop / 64px phone
with original inline SVG. Native track swiping and scroll snap remain intact.

Repeats stop on pointer leave, blur, pointer cancel, end, scrolling the page,
leaving the active customer context, or pressing a card. They use individual
immediate native scroll stops, so there is no in-flight smooth scroll after
cancellation. Merely focusing or reading a card starts no repeat. Normal single
click/keyboard scrolling retains smooth behavior; reduced motion is immediate.
Touch taps commit only on a valid pointerup within the arrow and consume any
synthetic click. Move outside / beyond 18px, cancel and completed holds add no
release movement. A later ordinary tap resets the gesture state.

Explicit immediate commands temporarily cancel compositor swipe/snap state
for 250ms, then restore native scrolling and snap. A real new track pointerdown
restores them immediately. This fixes a verified reduced-motion End-key
rebound after a native swipe; the browser regression now checks stable selection
as well as keyboard focus and endpoint button state. Explicit immediate navigation cancels
pending native swipe/snap for 250ms; a new track pointer press immediately restores
native scrolling. This prevents reduced-motion End from rebounding after a swipe.

## Photography boundary

The user supplied separately verified Pexels records and existing private build
inputs for twelve NEW distinct genuine photographs. The official license/source
verification is from that authorized research handoff, not a successful website
request from this executor. The complete source, photographer, license, terms,
original/optimized dimensions and hashes, bilingual alt text and local mapping
are in `OCCASION_PHOTO_CREDITS.json`.

The first original-download request to `images.pexels.com` failed with
`URLError: <urlopen error Tunnel connection failed: 403 Forbidden>`. That route
was stopped immediately; no alternative photo website or proxy was used.
Earlier official license requests to Unsplash, Wikimedia Commons and Pexels
were also denied. None of those denied routes was retried.

The user then supplied existing authenticated Library build-input file IDs.
Supported `download_file` transferred the 25,241,122-byte ZIP and its manifest.
Before extraction the ZIP was checked for exactly twelve expected JPEGs and
the identical manifest, no traversal paths, symlinks or unrelated entries.
All twelve original SHA-256 hashes, byte counts and dimensions match.
Originals and the archive remain private outside the repository/Git.

The twelve distinct WebP derivatives are self-hosted under
`assets/photos/occasions/`, each at most 1200px on its longer edge, 811,816 bytes
combined. Each has a unique hash and differs from the old site assets.
Actual photographs and candidate desktop/mobile crops were visually inspected.
The originals are not served as a stock-download collection. Existing hero and
story photographs are unchanged; none is reused in the new occasion sleeves.
The quinceañera sleeve uses an adult ball-gown illustration, not an assertion
of a verified XV event or an actual fifteen-year-old. The credit page makes
clear these are illustrative photographs, not customer/testimonial endorsements.
Individual model-release paperwork is not publicly verified or guaranteed.

Canonical mappings remain exactly as on main:

| ID | English enhanced label | Spanish |
| --- | --- | --- |
| aniversario | Wedding anniversary | Aniversario de bodas |
| memorial | In memory of a loved one | En memoria de un ser querido |
| cumpleanos | Birthday | Cumpleaños |
| boda | Wedding | Boda |
| quinceanera | Quinceañera | Quinceañera |
| madre_padre | For mom or dad | Para mamá o papá |
| bebe | Baby, baptism or baby shower | Bebé, bautizo o baby shower |
| graduacion | Graduation | Graduación |
| propuesta | Proposal or declaration of love | Propuesta o declaración de amor |
| amistad | Friendship or gratitude | Amistad o agradecimiento |
| negocio | Business jingle or song | Jingle o canción para negocio |
| personalizada | Another occasion | Otra ocasión |

Every record has its photographer, primary source URL, license, optimized
local asset and bilingual description. Actual browser load, crop and mapping
checks are recorded in `HERO_REFINEMENT_QA.md`.

## Verification

`npm run build`, `npm test` and `npm run test:browser` run local validation.
Browser services are mocked or blocked before navigation; no live intake,
upload, payment or Stripe action is used. The refinement suite adds real
pointer hover and CDP touch/hold/cancel coverage, all four viewport sizes,
localized pause state, no overflow, progressive fallback, and genuine captures.
Existing bilingual regression retains all 12 forms in both locales,
mid-form/draft/photo preservation and canonical payload checks.
