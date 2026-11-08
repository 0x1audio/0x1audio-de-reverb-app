# SonicDryer

A 0x1audio app that dries the room out of a recording. The saved file is marked Dry audio. The screen asks for a file and a format. Every run uses UVR-DeEcho-DeReverb by FoxJoy, from the MIT-licensed [Ultimate Vocal Remover](https://github.com/Anjok07/ultimatevocalremovergui) engine. The weights are not in this repository. The first run downloads the model and keeps it on this computer.

```sh
pnpm install
pnpm dev
pnpm build
```

The desktop opens `dist/index.html`. `@0x1audio/design-system` and `@0x1audio/sdk` are linked from the sibling checkouts.
