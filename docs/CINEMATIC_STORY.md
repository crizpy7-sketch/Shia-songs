# SHIA SONGS / Your story in motion

The KINETIC motion study is adapted to the existing SHIA SONGS identity with ivory,
sage, peach, ink, expressive type, reflective geometry, and an original instrumental.

The hero screening panel contains a real, finite 15-second film. The English and
Spanish editions have matching timing and change with the existing language switch.
The dialog provides native playback controls, visual captions, and a text transcript.
Decorative playback is silent, stops when hidden or outside the customer flow, and
does not start under reduced-motion preferences. Explicit play remains available.

| Time | Story | Motion |
| --- | --- | --- |
| 00–03 | Your story / Su historia | Staggered type and a reflective rotating form |
| 03–06 | The little things / Los pequeños detalles | Licensed illustrative couple photography and rhythm lines |
| 06–09 | Made to feel / Hecha para sentir | Sculptural reflective geometry |
| 09–12 | One story, two songs / Una historia, dos canciones | Concentric rhythm and resolving typography |
| 12–15 | SHIA SONGS | Brand resolution and the existing $20 entry package |

The film introduces the brand. Its instrumental is authored for this film and is
not represented as an example of a personalized customer order. Photography is
illustrative, credited on `credits.html`, and does not depict customers or endorsements.

## Re-render

`npm ci` and `npm run render:film` render the matching 1080p/60 fps H.264/AAC files.
Rendering requires FFmpeg and the URW Base 35 system fonts used by the source.
The renderer is deterministic and uses the pinned development-only canvas package.
Render intermediates go into ignored `artifacts/film-render/`.

## Scope

The existing occasion carousel, twelve questionnaires, $20/$50 package selection,
optional drafts, photo uploads, private administration and disabled Stripe scaffold
retain their existing behavior. This change activates no payment service or backend.

Offline media-controller coverage checks explicit/reduced playback, end/replay,
English/Spanish source and position preservation, modal audio/focus, lifecycle pause,
customer context and media-error recovery. Existing tests exercise all twelve forms
and mocked intake/payment/database behavior. Browser and physical-device verification
must be reported separately from these offline checks.

## Verification for this update

- `npm run build`: passed; the existing pinned browser bundle is unchanged.
- `npm test`: 32 passed, 0 failed, including four film-controller checks.
- Every static interface translation is present, all linked local assets exist, and
  the customer page has no duplicate IDs.
- FFprobe: both editions are exactly 15 seconds, 900 frames, 1920×1080 at 60 fps,
  with H.264 video and stereo AAC audio. Film frames were visually inspected.
- `git diff --check`: passed.
- Browser/layout, native media, accessibility and physical-device QA were unavailable
  in this managed environment. The real-browser suite was not run. Offline controller
  coverage does not establish those results.
