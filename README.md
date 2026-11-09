# De-reverb

A Mixel app that takes the room out of a recording: reverb, echo, and the sound of the walls. The screen asks for a recording and where to save it. The dry copy is saved as `Name (Dry audio)` in the same format as the original (WAV, FLAC, MP3, or OGG; anything else becomes WAV) and is added to the Library. Every run uses UVR-DeEcho-DeReverb by FoxJoy, from the MIT-licensed [Ultimate Vocal Remover](https://github.com/Anjok07/ultimatevocalremovergui) engine. The weights are not in this repository. The first run downloads the model and keeps it on this computer.

```sh
pnpm install
pnpm dev
pnpm build
```

The desktop opens `dist/index.html`. The hero art is drawn in `src/hero.tsx`, and `icon.svg` is the app's card icon (`accent` and `icon` in `app.json`). `src/parts.tsx` and `src/song-wave.ts` are shared with Vocal Extractor; keep the copies the same. `@0x1audio/design-system` and `@0x1audio/sdk` are linked from the sibling checkouts.

## Licence

Apache-2.0 · contributions under the [DCO](CONTRIBUTING.md#sign-off-your-commits-dco).

This app is open source under the [Apache License 2.0](LICENSE); see also [NOTICE](NOTICE). The model weights it downloads keep their own licences. The licence covers the code, not the name: "Mixel" and its marks are trademarks of 0x1audio, and [TRADEMARKS.md](https://github.com/0x1audio/cloud/blob/main/TRADEMARKS.md) explains how to use them. To report a vulnerability, see [SECURITY.md](SECURITY.md).
