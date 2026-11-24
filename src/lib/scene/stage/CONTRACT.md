# Stage contract

One stage owns one canvas, its WebGPU device, renderer, orthographic camera,
scheduled frame and theme observer. Coordinates are in meters with Z up.
The canvas is supplied by the caller, who also forwards its CSS pixel size.

`show` replaces the drawables in order, with one build per drawable when the ordered shapes change.
Ground marks use the footprint of parts touching the lowest plane. The cast shadow projects the bounding outline.
The optional landscape profile fits kilometer-scale geometry and draws only boundaries.
The terrain finish uses a bicubic field of true heights and grades when supplied, contouring every 2 m with a stronger index line every 10 m. The view fit uses visible bounds and accepts an optional focus box, bearing, elevation, fill and zoom. An optional elevation curve reads the fitted width in meters. Explicit strokes can set their own token, pixel width and opacity.
The stage counts a new list of shapes as one geometry batch and also counts its individual drawables.
Changing view, display, surface, size or theme preserves those geometries.
Retained parts stay in the scene during `show`; only stale parts leave and new parts join.
`setWork` runs a caller's budgeted task at the start of each frame while it returns true; a
frame that only ran work and changed nothing keeps the last image.
`read` returns detached state. `delete` releases the stage and may be repeated.

The fixed house is available through `stageExample()`. See `/blocks` for its controls.

A fit can specify the frame width and an offset along the image axes in meters. The stage
reports the fitted width, meters per CSS pixel and the point the camera looks at. A presentation can vary color, opacity,
stroke width and vertical scale from that reading while retaining every drawable's geometry.
The stage view binds pointer and keyboard navigation to those framing inputs.
A wheel or pinch zoom keeps the displayed terrain point under the cursor at the same pixel, even
when the camera elevation follows the frame width; off the terrain it falls back to the plane
through the frame centre. A drawable may set its own face values (roof, lit wall, wall in shade).

A translucent drawable that occludes lays its depth after every opaque body: bodies behind it
show through its tint, only its front layer is tinted, and explicit strokes behind it switch to
their hidden pass, thinner and at the stroke's `hidden` share of its opacity. Strokes lose up to
their `recede` share with view depth. `hatch` adds pencil strokes on faces turned from the sun.
The shadow finish darkens the ground with the darker of shade and ground, so shadows never stack.
A warp moves retained positions by an amount times per-vertex offsets in place; it uploads
changed arrays, recomputes normals and bounds, and builds nothing.
