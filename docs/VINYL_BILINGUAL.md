# Vinyl carousel and bilingual customer flow

Local branch: `feat/vinyl-carousel-bilingual`.
Verified Git base: `dd2e7ddec5c566f543f0018bfb4cda41f4f9e555` from `origin/main`.
This update is local only. The earlier motion branch and its commit are preserved.

## Original visual direction

The user's descriptions of **motionsites.ai Book Hero** and **Vertex Ecommerce**
were used as general inspiration for tactile depth and polish. The reference
screenshots were inspected in the parent conversation, not personally viewed
in this task. Neither reference's layout, palette, typography, code, or assets
was copied, and no template was bought.

Shia Songs retains its paper/sage identity. Occasion photos become record
jackets with thin sleeve edges, original CSS vinyl grooves, and receding angled
neighbors. The selected sleeve faces forward. Existing licensed photo files
are reused unchanged; no new photography is represented as authentic.

| Moment | Trigger | Motion | Reduced-motion behavior |
| --- | --- | --- | --- |
| Occasion train arrival | First section intersection | Track arrives 220px horizontally in 840ms; first four sleeves have 80px staggered carriage entrances, 670ms with 55ms spacing | No entrance; immediately usable |
| Coverflow selection | Native scroll, SVG controls or keyboard | Selected jacket faces forward; neighbors angle 34°/52° and recede 80px/140px | Static depth remains; transitions disabled |
| Form step | Synchronous wizard navigation | Existing 280ms entrance and immediate heading focus | Immediate visibility/focus |

Arrival happens once per document, never loops, and does not disable card
selection or advance business state. Dynamic reduced-motion changes cancel
running entrances. Missing animation/observer APIs leave content visible.

## Carousel interaction

The track uses native horizontal overflow with scroll snap. It does not emulate
swiping with pointer capture or intercept touch movement. Responsive endpoint
padding and stationary outer snap items keep native scroll positions stable;
only each inner sleeve face receives the 3D transform. This avoids changing
snap geometry during smooth navigation. The first and last sleeves center
correctly. Previous/next SVG buttons retain focus while navigating; at a
boundary, focus moves to the opposite enabled control before the current
control becomes disabled. Left/Right/Home/End keys move focus between occasions.
Keyboard focus can center a sleeve; pointer focus does not initiate scrolling
between press and release. Selecting an occasion opens its existing form.

At 320px the page does not overflow horizontally; only the carousel scrolls.
The unenhanced English HTML includes all 12 photo sleeves and an honest notice
that the questionnaire requires JavaScript.

## Locale and data boundaries

English is the default. English/Español controls are available in the navigation,
success dialog, payment-status page, and photo-credit page. Document/control
language updates with the interface. The unchanged internal administration
surface explicitly declares Spanish.

Locale is optionally stored under `shia-ui-language`. Storage failures are
nonfatal. Locale changes update marked text and attributes in place; they never
recreate the form, translate free-text answers, change input `name`/`value`,
revoke photo URLs, alter captions, save/erase drafts, or change song-language
answers. All original Spanish backend keys, enum values, template IDs, and
submission/file-manifest contracts remain canonical.

Explicit translations cover all 387 original questionnaire interface strings,
plus customer navigation, packages, photo controls, help, validation, success,
payment messages and static pages. Unknown provider errors show safe localized
customer text. Review labels and known option descriptions translate; raw
customer text, filenames, captions and order numbers remain untouched.

Existing drafts retain `shia-form-v2:<occasion>` storage keys. The update also
fixes restoration of a saved $50 package selection. Files remain intentionally
excluded from persisted drafts, as before; switching locale within the active
session preserves the existing file/blob references.

Prices and payment behavior are unchanged: $20 buys two songs and lyrics; $50
adds a photo slideshow using one song. Checkout remains disabled. No backend
schema, photo file, lockfile, credential or environment configuration changed.

## Verification and evidence

Run `npm run build`, `npm test`, and `npm run test:browser` from the repository.
The browser command runs the existing responsive suite, native motion suite,
and new bilingual vinyl suite. All external requests are intercepted before
navigation. Never manually submit QA data to the standard frontend's live
intake endpoint.

Current results and genuine artifact paths are in [VINYL_BILINGUAL_QA.md](VINYL_BILINGUAL_QA.md).
