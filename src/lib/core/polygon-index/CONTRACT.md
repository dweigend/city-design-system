# Polygon index

The index copies the contours of addressed simple polygons with implicitly closed edges.
Coordinates, queries and the optional boundary margin are in horizontal meters. The payload
remains the caller's original object. Point queries include edges and corners, and resolve a
tie by input order. Segment queries return intersected contours once each in the order the
segment reaches them. Ties use input order. The margin affects containment at the endpoints.
