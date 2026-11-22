# Stage contract

One stage owns one canvas, its WebGPU device, renderer, orthographic camera,
scheduled frame and theme observer. Coordinates are in meters with Z up.
The canvas is supplied by the caller, who also forwards its CSS pixel size.

`show` replaces the drawables in order, with one build per drawable when the ordered shapes change.
Ground marks use the footprint of parts touching the lowest plane. The cast shadow projects the bounding outline.
The optional landscape profile fits kilometer-scale geometry and draws only boundaries.
The terrain finish recovers true height from the projection scale and contours it at 2 m intervals, with a denser index line every 10 m.
The stage counts a new list of shapes as one geometry batch and also counts its individual drawables.
Changing view, display, surface, size or theme preserves those geometries.
`read` returns detached state. `delete` releases the stage and may be repeated.

The fixed house is available through `stageExample()`. See `/blocks` for its controls.
