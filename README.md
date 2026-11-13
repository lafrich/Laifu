# Laifu

Independent new-generation 3D map and character suite. This repository is intentionally separate from Semesta and its old assets.

## Apps

- **[Laifu Character](apps/laifu-character/)** — editable pixel body parts, bone hierarchy/pivot, four directions, pose preview, Male / Female Genesis category, **manual export only**. Inspired by the skeletal editor model of [Rigby2D](https://github.com/jaisurya-dev-art/rigby2d) (bones → slots → attachments). This is an original lightweight editor, **not a full Rigby2D fork/runtime**.
- **[Laifu Map](apps/laifu-map/)** — full isometric 3D placeholder editor with asset categories, camera lock, X/Y/Z positioning, L0–L20 elevation placement, W/H/D inspector, six-sided texture uploads, and JSON world save/load; does not import Semesta assets.
- **[Character Plane Test](apps/laifu-map-test/)** — standalone Three.js 3D character importer. Imports `.laifu-character.zip` or `character.json` and places them as transparent vertical planes on selected levels; orthographic camera remains locked to isometric.

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

The JSON contains `name`, `genesis`, `frame`, immutable scale contract, `views.{front,left,right,back}.parts[]` (part IDs, bones/parents, pivots, offsets, per-pixel colors) and basic `animations` keyframe arrays. The map uses `src/plane.js` as its reusable Three.js adapter (`createCharacterPlane`, `placeCharacterPlane`, `orientCharacterPlane`). The Three.js Character Plane Test uses this adapter; the main Laifu Map currently accepts Front/Right/Back/Left image textures through its Inspector.

**Compatibility:** This format is **Laifu native**. It is inspired by Rigby2D concepts, but it is not claimed to be interchangeable with Rigby2D `.rigby`, Spine skeletons, or `.skel` exports. Rigby2D itself exports skeleton JSON and atlases; native Rigby2D imports need a future converter and are not silently accepted here.

## License attribution

Rigby2D © its respective authors, available under MIT OR Apache-2.0. This repo's editor code does not copy Rigby2D source; it takes inspiration from the public rig conceptual model. No Rigby2D demo assets are used.

## Isometric map authoring

Use **Laifu Map** to place procedural-size placeholders by category: street slabs, curbs, platforms, kiosk/house/shop/school/office/towers, cars/buses/trucks, trees as camera-facing billboards and characters as world-oriented planes, and generic props. Click a preset, then click the canvas; edit exact width, depth, and height in the inspector. Building height cannot go below 4 world units and characters are locked to 2. For custom visual assets, select a placed object, open **Textures**, and upload per-face images (six sides of solid boxes, one plane image for trees, or separate Front/Right/Back/Left textures for characters; Plane is a fallback). Save city drafts locally or export/import the `laifu.world.v1` JSON. Camera projection is locked to 2:1 isometric; pan, zoom and focus still work, but orbit and perspective switching are disabled. The older character plane test is retained separately. The scale of legacy Character v1 ZIPs with 1u/2u metadata is upgraded on import without altering pixels.

## Character heading in Laifu

A character is a **vertical 2D plane in 3D space**, but it never rotates to face the camera. Its own world rotation controls both its plane yaw and its editable Genesis direction: **0° Front (+Z), 90° Right (+X), 180° Back (-Z), 270° Left (-X)**. The default character placeholder comes from the four Genesis views. In the map Inspector → Textures, upload four directional PNGs; an optional Plane texture is used as fallback. Trees continue to face the camera. Note: physical planes can appear thin when their yaw is perpendicular to the fixed isometric camera.

The Character Map Test also uses world-oriented planes. The direction selector changes plane yaw and the rendered sprite together, not camera behavior. The numerical scale remains unchanged: 1 door = 1 character = 2 world units; one level = two doors = 4 world units. Editing Genesis design is still saved only with the **manual Export ZIP** workflow.

## Grid, placement rules, and Playtest (Laifu Map v0.3)

**Grid & snapping** — The map draws a ground lattice AND individual lines over the top of asphalt, sidewalk, grass, raised floor, and zebra cross tiles. Select GRID 0.5, 1, 2, 4 or 8 world units. Terrain tiles snap their *edges* to the same lattice, respecting 90° rotation and odd tile dimensions. Buildings/objects snap their pivot at half-grid precision by default. Turn SNAP off to free-position things, but collision and zoning rules **still apply**. Placement ghost becomes green for valid and red for invalid, with a reason. On phones drag a placement finger to preview and release to place.

**Mandatory zoning**

| Entity or surface | Allowed surface | Collision |
| --- | --- | --- |
| Grass, asphalt, sidewalk | Ground/elevation tile | Terrain tiles cannot overlap |
| Zebra cross | Fully covered by asphalt | Painted crosswalk may overlay its host asphalt |
| Trees | Grass only | Trunk occupancy prevents intersections |
| NPC character planes / Player | Sidewalk or zebra cross | Cannot pass through objects or grass/road |
| Cars, motorcycles, buses, vans, trucks | Asphalt or zebra cross | Vehicle footprints may not intersect each other |
| Buildings | Grass or raised floor | Structural collision blocks overlap |
| Bench, lamp, other props | Grass, sidewalk or floor | Cannot intersect other solid objects |

Terrain support height is used to anchor feet/wheels precisely at the top face, not Y=0 underneath the ground. Collision uses rotated 2D rectangles plus vertical interval overlap; both **preview and final placement**, move drag, rotate, duplicate, replace and inspector changes use the same validator. Removing/moving a tile with dependent objects is blocked until the objects are moved first. Older locally saved worlds remain untouched; press **Sample** to load the new rule-compliant world with grass, road, sidewalk and zebra crossing.

**Rotate during placement** — Use **↶ 90° / 90° ↷** in the canvas toolbar before placing. The older Rotate buttons in the Inspector adjust the selected existing object and also run the collision check.

**Simulate Player** — Press **▶ SIMULATE PLAYER** (desktop menu) or **▶ PLAY** (mobile map overlay). A temporary character spawns on a free pedestrian tile. Use WASD / arrow keys, or the mobile touch D-pad; the camera follows without changing its locked isometric yaw. Press **E** / ACTION to preview the nearest object's first configured action. Collision, terrain restriction and curbs are checked at every movement step. Exit to edit without modifying world data: simulated player state is never saved, never exported, and does not override the Genesis editor's separate **manual-only** character export.

This is a **movement/placement gameplay test**, not the complete Semesta life-simulation (no jobs, NPC conversation AI, player inventory, needs, or full action animation yet).
