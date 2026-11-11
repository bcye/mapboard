# Product

## Start

- Base elements as in the prototype: draw, arrow, marker, post-it, eraser
- Arrow: drawn exactly like a line, with an arrowhead at one end
- New element: board pin. Links to another board, opens it in a new tab on click.
- Drawings snap to a post-it or marker if one is in the area. Snapped lines follow when it moves; only the last part of the line moves.
- Export and import as JSON for backup from day one. Import creates a new board.
- Probably: optional label on any element. Choice of plain (a bit of shadow), in a box, or in a post-it. Attached to the element, near the midpoint for lines.
- Elements get bigger and smaller with zoom, slower than the map and within limits. Applies to all elements. Size depends only on the current zoom, not the zoom an element was drawn at.
- Post-its: fixed font size, grow as you type. Resizable, but not smaller than their text (trying it).
- City-level plans go on a separate board, linked with a board pin (instead of hiding elements by zoom)
- Works fairly decently on mobile/touch
- One toolbar for mode selection, a separate toolbar for modifying the tool (color etc.) if applicable. Both 1 unit high.

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
