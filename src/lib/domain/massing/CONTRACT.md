# Massing

`createHouseOccupancy` fills a cell space using metric block inputs, a uint32 seed and resolved
occupancy parameters. It keeps cell order and returns half-open storey runs, ordered entrance
paths and a reason when the plot cannot be built. Site callbacks sample the selected frontage
midpoint in plan meters and assign phase and use by datum index and cell ID. Only occupied
storeys take program rows. The eaves, cell jitter and open ground draws retain their independent
seed keys. The fixed example places an office above a raised entrance in one frontage cell.
