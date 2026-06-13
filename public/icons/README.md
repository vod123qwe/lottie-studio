# List + Search icon animation

A simple, looped **list + magnifier (search)** icon: three list rows with a
magnifying glass resting in the bottom-right corner. The lens sweeps up over
the rows to "scan" them, returns to rest with a little pop, and the rows light
up top-to-bottom as results are found. Motion uses cubic-bezier easing
(slow-outs and a punchy ease-in-out) and loops seamlessly.

| File | What it is |
| --- | --- |
| `list-search.json` | Player-ready Lottie (bodymovin), 512×512, 50 fps, 3 s loop |
| `list-search.gif` | Raster preview, 480×480, 50 fps |
| `preview.html` | Plays the real Lottie via `lottie-web`, with the GIF alongside |

## Preview

Open `preview.html` in a browser (or run `npm run dev` and visit
`/icons/preview.html`). The GIF needs nothing — just open it.

## How it was made

Both the Lottie **and** the GIF are generated from a single source of truth so
the preview always matches the vector output:

```bash
python3 tools/lottie-gen/gen.py
```

The generator (`tools/lottie-gen/gen.py`) defines the animation once
(layers, shape primitives, keyframed transforms + easing) and emits the
Lottie JSON while rasterising the same keyframes to the GIF with Pillow.
Only transform-based animation is used (anchor / position / scale / rotation /
opacity), which keeps the rasteriser faithful to `lottie-web`.
