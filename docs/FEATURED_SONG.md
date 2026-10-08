# Featured song

The user selected their uploaded **Qué suerte la mía.mp3** for public playback on
the SHIA SONGS website. The complete recording is presented as a featured song.

- Published file: `assets/media/que-suerte-la-mia.mp3`.
- Original length: 199.44 seconds (3:19); stereo MP3 at 48 kHz.
- Audio is stream-copied without re-encoding. Attached artwork and metadata are
  removed from the website copy. The original upload is preserved.
- The waveform SVG is derived from 180 equal-duration RMS windows of the decoded
  recording, with a visible played-position overlay.
- Playback starts from the hero listening link or the native audio controls.
  UI language changes preserve the recording and playback position.
- Native controls remain available with JavaScript disabled. The vinyl graphic
  follows playback and stays still under reduced-motion preferences.
- The song and audible film players take turns; playback stops when the document
  is hidden or the visitor enters the questionnaire or administration view.

The separate 15-second brand film retains its original instrumental and label.
Pricing, questionnaires, intake and payment behavior retain their existing scope.

## Verification

- `npm run build`: passed.
- `npm test`: 35 passed, 0 failed, including three integrated song/film checks.
- All linked assets and static translations resolve; no duplicate page IDs.
- Complete MP3 decoded for the waveform; FFprobe confirms 199.44 seconds,
  stereo MP3 at 48 kHz, with no attached artwork in the published copy.
- `git diff --check`: passed.
- Browser/layout, native-media and physical-device QA were unavailable in the
  managed environment. Offline media mocks do not establish those results.
