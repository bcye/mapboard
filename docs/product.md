# Product

## Start

- Base elements as in the prototype: draw, arrow, marker, post-it, eraser
- Arrow: drawn exactly like a line, with an arrowhead at one end
- Board link: a marker can link to another board. No separate pin tool.
  - Its label is the board's name, always in box style, with a ↗ suffix. Renaming the board renames the label.
  - Selected: open, change board, unlink. Unlinking keeps the name as a normal label.
  - One-time hint about it the first time you place a marker.
- Drawings snap to a post-it or marker if one is in the area. Snapped lines follow when it moves; only the last part of the line moves.
- Export and import as JSON for backup from day one. Import creates a new board.
- Labels on markers and lines, not on post-its. Plain (darker shade of the element's color) or in a box (black on white). Below markers, near the midpoint for lines. Wraps instead of growing wide. Edited in place on the map.
- Elements get bigger and smaller with zoom, slower than the map and within limits. Applies to all elements. Size depends only on the current zoom, not the zoom an element was drawn at.
- Post-its: font size small, medium or large; grow as you type. Resizable, but not smaller than their text (trying it).
- City-level plans go on a separate board, linked from a marker (instead of hiding elements by zoom)
- Works fairly decently on mobile/touch
- One toolbar for mode selection, a separate toolbar for modifying the tool (color etc.) if applicable. Both 1 unit high.
- On phones (below `sm`), color and width each collapse into one button that opens a picker.

## Design

- Not as minimalistic as Excalidraw. Color palette and icons with a fun/travel mood.
- Tailwind default theme to start, mainly for accent and background colors.

## Planned separate (possibly paid) features

- Sync, collab, anything non-local
- Tile selection other than default (satellite, oceanic etc.). Implement this one already.

## Not for now

- Search, place info, routing

## Later

- Trip length etc.
- Geocoding labels, if at all
- Maybe v1.1: upload pictures, shown as polaroids on the map

## Open

- Lines more hand-drawn (texture)?
