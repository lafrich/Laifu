# Laifu

Independent new-generation 3D map and character suite. This repository is intentionally separate from Semesta and its old assets.

## Apps

- **[Laifu Character](apps/laifu-character/)** — editable pixel body parts, bone hierarchy/pivot, four directions, pose preview, Male / Female Genesis category, **manual export only**. Inspired by the skeletal editor model of [Rigby2D](https://github.com/jaisurya-dev-art/rigby2d) (bones → slots → attachments). This is an original lightweight editor, **not a full Rigby2D fork/runtime**.
- **[Laifu Map](apps/laifu-map/)** — full isometric 3D placeholder editor with asset categories, camera lock, X/Y/Z positioning, L0–L20 elevation placement, W/H/D inspector, six-sided texture uploads, and JSON world save/load; does not import Semesta assets.\n- **[Character Plane Test](apps/laifu-map-test/)** — standalone Three.js 3D character importer. Imports `.laifu-character.zip` or `character.json` and places them as transparent vertical planes on selected levels; orthographic camera remains locked to isometric.

## Run locally

Requires Node.js 20.19+ or 22.12+. Run `npm install && npm run dev`, open the Vite localhost URL, select any app. `npm test` checks the scale contract. `npm run build` creates a static multi-page `dist/` suitable for GitHub Pages.

## Locked scale: **character : door : level = 1 : 1 : 2**

| Object | World Y height |
|---|---:|
| Genesis character visible plane | **2** |
| One door | **2** |
| One level of elevation | **4** |
| Smallest building | **4** |

A character at level N has **foot Y = N × 4**, rendered as a 2-unit-tall cropped sprite plane centered at **Y = N × 4 + 1**. Other views share the same physical height; width follows visible sprite aspect ratio. The 64×112 work canvas is *not* mapped directly to 1 unit: its transparent margins are cropped before plane creation.

## Laifu Character editor

1. Start with a single `Genesis 01` template; set Male Genesis or Female Genesis as a **category**, not a replacement geometry preset. Customize anatomy independently in each direction with body parts.
2. Choose a view (`front`, `left`, `right`, `back`), then a part (17 body parts). Brush/Eraser/Fill edit the chosen layer. Select, Copy, Paste, Paste Flip, Flip Part, Move, and per-part pivot/rotation controls are provided. Lock/visibility and Undo/Redo work per document.
3. Preview skeletal pose presets (`idle`, `walk`, `sit`). Bone transforms are hierarchical. These presets use rotation keys; **this MVP does not implement Rigby2D's full IK, weighted meshes, or animation authoring timeline**.
4. Click **Export Manual ZIP** to download the entire editable JSON source and the four directional PNGs (full frame and cropped), plus package README. Nothing is automatically saved. No `localStorage`, IndexedDB, autosave, or Drive synchronization. The browser warns when leaving with unexported edits.
5. In Laifu Map Test, manually import this same ZIP (or extracted `character.json`); click the map to place the 1-door-high plane on a selected level.

### Character format `laifu.character.v1`

The JSON contains `name`, `genesis`, `frame`, immutable scale contract, `views.{front,left,right,back}.parts[]` (part IDs, bones/parents, pivots, offsets, per-pixel colors) and basic `animations` keyframe arrays. The map uses `src/plane.js` as its reusable Three.js adapter (`createCharacterPlane`, `placeCharacterPlane`, `faceCharacterPlaneToCamera`). When the full Laifu Map app is implemented, import this module there.

**Compatibility:** This format is **Laifu native**. It is inspired by Rigby2D concepts, but it is not claimed to be interchangeable with Rigby2D `.rigby`, Spine skeletons, or `.skel` exports. Rigby2D itself exports skeleton JSON and atlases; native Rigby2D imports need a future converter and are not silently accepted here.

## License attribution

Rigby2D © its respective authors, available under MIT OR Apache-2.0. This repo's editor code does not copy Rigby2D source; it takes inspiration from the public rig conceptual model. No Rigby2D demo assets are used.

## Isometric map authoring

Use **Laifu Map** to place procedural-size placeholders by category: street slabs, curbs, platforms, kiosk/house/shop/school/office/towers, cars/buses/trucks, trees and characters as billboards, and generic props. Click a preset, then click the canvas; edit exact width, depth, and height in the inspector. Building height cannot go below 4 world units and characters are locked to 2. For custom visual assets, select a placed object, open **Textures**, and upload per-face images (six sides of solid boxes, or one plane image). Save city drafts locally or export/import the `laifu.world.v1` JSON. Camera projection is locked to 2:1 isometric; pan, zoom and focus still work, but orbit and perspective switching are disabled. The older character plane test is retained separately. The scale of legacy Character v1 ZIPs with 1u/2u metadata is upgraded on import without altering pixels.
