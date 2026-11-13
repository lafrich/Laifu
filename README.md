# LAIFU.EXE — Independent 3D World Editor

A **new, clean-room 3D world-builder** with a classic Windows/XP-style city-editor layout. It is inspired by the *workflow* of Semesta, **not** by any Semesta code, images, textures, sprites, or data.

## Scale contract (locked)

| Thing | World height | Ratio |
|---|---:|---|
| Standard door | 2 units | 1 door |
| Character plane | 2 units | 1 door |
| One elevation level | 4 units | 2 doors vertically |
| Smallest building | **4 units minimum** | 1 level / 2 doors |
| Two-level building | 8 units | 2 levels |
| Three-level building | 12 units | 3 levels |

**All heights are Y-up world coordinates**, not baked isometric sprites. Level changes only move the object's base Y; the actual object height is independent. The minimum height applies to every building preset, property edit, and JSON import. Character height remains exactly 2 units.

## Objects

- **Road and sidewalk:** real thick 3D slab, customizable width/depth/thickness.
- **Building:** cuboid of arbitrary width/depth/height, minimum height 4. Six assignable image faces.
- **Vehicles:** cuboid, six assignable faces (LFC-style vehicle placeholder).
- **Tree and character:** camera-facing vertical planes, optional transparent PNG/WEBP textures; rendered as generated placeholders until replaced.
- **Platform:** solid surface with actual top Y for stacking / dropping objects above ground.
- **Props:** cuboids; 3D transforms and logic metadata.

## 3D editor

- Isometric orthographic and perspective camera modes; mouse-wheel zoom, right-drag orbit, middle-drag pan, and two-finger touch gestures.
- Select / Place / Move / Pan / Orbit tools.
- Land (Y=0), Top Surface (raycast against 3D top surfaces), 20 explicit height levels (4 units each) and Custom Y placement.
- Hover placement preview, grid and snapping, +/-90° rotations, duplicate, replace placeholder, delete, undo/redo.
- Properties: X, Y, Z, rotation, width, depth, height, opacity, color, level, lock, blocking, tags, actions, notes.
- **Per-face image replacement**: upload from device or enter HTTP(S) texture URL; image data is embedded in exported JSON.
- New blank city, procedural demo, named browser-local drafts, autosave, export/import `.json`.
- No runtime network calls to Semesta, Google Drive, or other game services; entirely standalone.

## Run locally

Requires Node.js 20+.

```sh
npm run dev
```

Open the local URL displayed by the built-in development server (usually `http://localhost:4173`). No external asset pack is required. To build a static site:

```sh
npm test
npm run build
npm run preview
```

The `dist/` directory is deployable as a static site. There are **no npm or runtime dependencies**; the browser's WebGL is the rendering backend. The 3D renderer is written specifically for Laifu.

## GitHub Pages

This project includes `.github/workflows/deploy.yml` to test, build, and deploy the site whenever `main` receives a push. For the repository **`lafrich/Laifu`**, configure **Settings → Pages → Source: GitHub Actions**. The project does not copy or modify the existing Semesta repository.

## Controls

| Input | Effect |
|---|---|
| Pick asset in FILES | Activate Place mode |
| Left click | Select/place; drag selected object to move |
| Right mouse drag | Orbit camera |
| Middle mouse drag | Pan camera |
| Mouse wheel | Zoom |
| Two-finger touch | Pan and pinch-zoom |
| Delete/Backspace | Delete selection |
| Ctrl/Cmd+Z | Undo |
| Ctrl/Cmd+Shift+Z | Redo |
| Esc | Exit Place mode or clear selection |

## JSON schema

`src/world.js` defines `laifu.world.v1`. No Semesta JSON importer is included. Each object has `id`, `preset`, `kind`, `x`, `y`, `z`, `width`, `height`, `depth`, `rotation`, `color`, `levelMode`, `level`, `textures`, and optional logic fields. The JSON preserves editable placeholders for future external artwork or models.

**Note:** Laifu v0.1 is an editor/prototype, not the full Semesta gameplay or AI simulation. Browser drafts are local to the same browser; export JSON to move worlds between devices. Image URLs need CORS permissions for WebGL textures. Very large embedded textures can exceed browser storage quotas.
