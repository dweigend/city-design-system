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
`read` returns detached state. `delete` releases the stage and may be repeated.

The fixed house is available through `stageExample()`. See `/blocks` for its controls.

A fit can specify the frame width and an offset along the image axes in meters. The stage
reports the fitted width and meters per CSS pixel. A presentation can vary color, opacity,
stroke width and vertical scale from that reading while retaining every drawable's geometry.
The stage view binds pointer and keyboard navigation to those framing inputs.
