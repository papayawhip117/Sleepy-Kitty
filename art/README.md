# Window Kitty art pipeline

The room is made from hand-finished pixel-art layers, not drawn in code. Code adds
the sky, weather, time-of-day light, lamp glow, sway and the kitty on top.

## The rules every piece follows

- **Native size:** the whole scene is **480×270** true pixels, shown at 4× (1920×1080),
  3× or 8×. Every layer is cut to its true pixel size, so all pieces share one pixel grid.
- **Palette:** only the colours in `palette/window-kitty.json`. Since room-base-v1 it is
  48 colours extracted from that approved room (`tools/art_palette_from.py`); the first
  hand-picked palette is kept as `window-kitty.prev.json`. Every later piece is snapped to
  it so it matches the room. Import `window-kitty.gpl`, `.hex` or `-1px.png` into Resprite.
- **Light:** warm daylight from the window in the middle of the back wall, so things on the
  left are lit from their right and things on the right are lit from their left.
- **View:** straight-on, front view of the back wall, a gentle top-down tilt (you can see
  the top of the bed and desk). No strong 3D perspective.
- **Look:** soft coloured outlines (never black), 3–4 tones per surface, clean pixel
  clusters, rounded silhouettes, no checkerboard dithering, no noise.
- **Backgrounds:** a piece is generated on one flat background colour that the piece
  itself does not use. The window glass in the room shell is solid magenta `#FF00FF`.

See `guides/layout-480x270.png` for where everything sits.

## Workflow per piece

1. Generate the piece (prompt below), or draw it in Resprite on a canvas of the native size.
2. Put the raw image in `art/raw/<piece>.png`.
3. Clean it:
   `python3 tools/art_clean.py art/raw/<piece>.png --width <native width> --bg auto --name <piece>`
   This snaps it to the pixel grid and palette, removes the background, folds away
   noise/dithering and writes `art/layers/<piece>.png`, a 4× preview and a report.
4. Review the preview against the style check below; touch up in Resprite if needed.
5. Only when the piece is approved, move to the next one.

### Style check (what each piece is reviewed against)

| Check | Pass when |
|---|---|
| Palette | report `off_palette_share` under 0.25 and nothing looks recoloured |
| Pixel grid | `source_px_per_pixel` at least 3 and no smeared or half-size pixels |
| Noise | `dither_share_before_cleanup` under 0.04, surfaces read as clean clusters |
| Outlines | coloured, not black; 1px; consistent with earlier pieces |
| Light | brightest side faces the window |
| Silhouette | soft and rounded; reads clearly at 1× |
| Fit | matches its box in the layout guide |

## Style lock (start every prompt with this)

> cozy Studio Ghibli-inspired kawaii pixel art, lo-fi bedroom illustration, warm soft
> daylight, soft coloured outlines (no black outlines), rich warm colours: blush pink,
> peach, coral, butter yellow, cream, lavender, powder blue, sage and leaf green,
> chocolate and honey wood, plum-violet shadows, three to four tones per surface, large
> clean pixel clusters, crisp square pixels, no dithering, no noise, no checkerboard
> pattern, no text, no watermark

## Pieces (in order)

| # | Piece | Native size | Background | Status |
|---|---|---|---|---|
| 1 | Room shell (walls, floor, window frame) | 480×270 | n/a, window glass magenta | prompt ready |
| 2 | Bed | 176×128 | flat bright green `#00FF00` | prompt ready |
| 3 | Desk, laptop, lamp (lamp on and off) | 146×100 | flat green | later |
| 4 | Window seat, cushions, curtains | 160×30 + curtains | flat green | later |
| 5 | Plants (monstera, leafy pot, trailing vine) | ~40×60 each | flat magenta | later |
| 6 | Shelves with books and trinkets | 140×52 | flat green | later |
| 7 | Rug | 180×48 | flat green | later |
| 8 | Fairy lights | 200×16 strand | flat green | later |
| 9 | Kitty sprite sheet | 32×24 frames | flat green | later |

### 1. Room shell — 480×270

**Ask the tool for:** a wide landscape image (16:9 if it offers it, otherwise 3:2; the cleaner
crops it to 16:9). If the tool accepts a reference image, attach
`guides/layout-480x270.png` and say "use only the layout, not the labels or colours".

**Prompt:**
> [style lock], empty cozy bedroom interior, straight-on front view of the back wall, one
> large tall arched window in the exact centre of the wall taking up about a third of the
> width and two thirds of the height, the window glass is solid flat bright magenta
> (#FF00FF) with no reflections, a chunky warm wooden window frame and a deep wooden
> windowsill, warm cream wallpaper with a very subtle tiny blush flower pattern, a honey
> wood baseboard, warm honey wooden floorboards in the bottom quarter of the image seen
> slightly from above, soft warm light pooling on the floor under the window, gentle
> lavender shadows in the corners, completely empty room, no furniture, no plants, no
> curtains, no objects

**Clean:** `python3 tools/art_clean.py art/raw/room-shell.png --width 480 --aspect 16:9 --keep-key --name room-shell`

**Must have:** window centred with a hard magenta edge (code puts the sky there), floor line
at about 3/4 height, nothing else in the room. Walls must be calm enough for furniture to
sit on top.

### 2. Bed — 176×128

**Ask the tool for:** a square image.

**Prompt:**
> [style lock], a single cozy bed seen from the front at a slight top-down angle, long side
> facing the viewer, rounded wooden headboard on the right end, low wooden footboard on
> the left end, an oversized fluffy puffy duvet in blush pink and cream that drapes over
> the side in soft rounded folds almost to the floor, a folded peach knitted throw at the
> foot, three or four plump layered pillows in cream, powder blue and butter yellow, one
> small round decorative cushion, a little cream bunny plushie and a small bear plushie
> sitting against the pillows, soft lavender shadows between the folds, light coming from
> the left, isolated object on a plain flat solid bright green (#00FF00) background, no
> floor, no shadow on the ground, no room

**Clean:** `python3 tools/art_clean.py art/raw/bed.png --width 176 --bg auto --name bed`

**Must have:** the duvet reads as soft and heavy (rounded lumps, visible folds), not a box;
a flat-ish area on top of the duvet where the kitty can curl up; the headboard on the right
so it sits against the right side of the room.

## Log

- **room-base-v1** (ChatGPT): passed. A full furnished room, not an empty shell. The palette was extracted from it.
- **bed-v1** (ChatGPT, on a dark vignette): passed after `--bg grow` cleanup at width 160. 10 of its colours were added
  to the palette (lavender and pinks the warm room lacked). Mock: `mocks/bed-in-room-v1.png`. It needs the room's
  right-side bookshelf, plant and cat cushion removed before it can sit there for real.
- **desk-lamp-v1** (ChatGPT sheet on cream): cut into `desk-v1` (146x157, lamp included), `lamp-on-v1` and
  `lamp-off-v1` at a shared scale of 1/6 (`--box`, `--scale`, `--bg grow --peel-light 0.85` to drop the sticker-style
  cream outline). Mock: `mocks/room-mock-v2.png`. The room's own desk, shelf and lamp must be removed before the
  desk can sit there.
- **windowseat-v1** (ChatGPT, cream): cut at scale 0.18 to 263x170. Its window panes show a painted sky, so it
  needs a magenta-glass version before the game sky can show through. Cody does not want cat-shaped pillows/plushies
  (the real kitty is the only cat): remove from bed and window seat.
- **plants-v1** (ChatGPT sheet): four layers at scale 0.143 (`--holes 0.015` clears the background between leaves):
  monstera, pothos on stool, hanging macrame, cat-face pot. Mock: `mocks/room-mock-v3.png`.
- **shelves-v1** (ChatGPT, cream): one 142x99 layer at scale 0.1. The pink painted wall shadow is turned into a
  translucent plum shadow (`--shadow "#F3BABB"`), so it works on any wall. Lantern and candle glow anchors are in
  `layers/shelves-v1.glow.json`. Kept as one layer; the plants are too tangled with the books to sway separately.
  Cody chose to keep room-base's big window, so windowseat-v1 is dropped.
- **rug-v1** (ChatGPT, top-down): squashed to 200x56 to lie flat in the room's floor perspective. Replaces the
  painted rug, which goes away in the room-shell edit. Mock: `mocks/room-mock-v5.png`.
- **kitty-sheet-v1** (ChatGPT, labelled rows): sliced with `tools/art_sprites.py` at scale 0.25 into
  `layers/kitty-sheet.png` with 53x58 cells: sleep 4, blink 5, stretch 5, walk 6 (faces right, mirrored in code),
  held 4 (top-anchored). Frame info is in `layers/kitty-sheet.json`. At 0.17 the face was lost, so the kitty is
  chibi-sized (about 45px long asleep). Mock: `mocks/room-mock-v6.png`.
- **bed-v2** (ChatGPT edit on flat black, no plushie): replaces bed-v1. Cleaned with `--width 160 --bg auto`,
  with clean edges and 1.5% off-palette. Mock: `mocks/room-mock-v7.png`.
- **room-shell-v1** (ChatGPT edit of room-base-v1): clean empty shell with magenta window, 42 colours, all
  in palette. Still has baked diagonal sunbeams on the left wall and floor. The full scene is now described in
  `scenes/room-v1.json` and rendered with `python3 tools/art_mock.py art/scenes/room-v1.json <out.png>`
  (the window is filled with a stand-in sky). Mock: `mocks/room-mock-v8.png`.
- **scenery-day-v1** (ChatGPT, 1586x992): cut to the window glass (225x137, aspect cropped), 17 colours added to the palette (now 80). Drawn behind the frame by src/main.js.
