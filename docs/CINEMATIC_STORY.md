# SHIA SONGS / Your story in motion

The KINETIC motion study is adapted to the existing SHIA SONGS identity with ivory,
sage, peach, ink, expressive type, and reflective geometry.

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

The film introduces the brand with a 15-second excerpt of the user-selected
**Qué suerte la mía** recording. Both language editions use the same song excerpt,
from 00:48–01:03, with short entrance and exit fades. The hero's **Play with song**
button starts the film from the beginning with sound; turning sound on also
replays a finished film. The full recording remains available below the hero.
Photography is illustrative, credited on `credits.html`, and does not depict
customers or endorsements.

## Re-render

`npm ci` and `npm run render:film` render the matching 1080p/60 fps H.264/AAC files.
Rendering requires FFmpeg and the URW Base 35 system fonts used by the source.
The renderer is deterministic and uses the pinned development-only canvas package.
Render intermediates go into ignored `artifacts/film-render/`.
`npm run remix:hero-song` replaces only the films' audio using the selected MP3,
without re-rendering their video. Published movie names include `-song-` to avoid
reusing cached editions with the previous instrumental.

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
- `npm test`: 37 passed, 0 failed, including six film-controller checks and three
  integrated full-song/film checks.
- Every static interface translation is present, all linked local assets exist, and
  the customer page has no duplicate IDs.
- FFprobe: both editions are exactly 15 seconds, 900 frames, 1920×1080 at 60 fps,
  with H.264 video and stereo AAC audio. Video packet hashes match the previously
  inspected visual editions; audio packet hashes match the selected song excerpt.
- `git diff --check`: passed.
- Browser/layout, native media, accessibility and physical-device QA were unavailable
  in this managed environment. The real-browser suite was not run. Offline controller
  coverage does not establish those results.
