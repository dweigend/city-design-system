# House structure

Kind: recipe
Purpose: Builds house frames with occupied decks, access and cloth supports.
Exports: fannedTrussHouse, mastHouse, checkHouseStructure
Outputs: HouseStructure with nodes, members, platforms, access runs and skin patches.
Input: plot | Plot | m | Oriented building plot | Required
Input: shape.datums | number[] | m | Platform heights above ground | Required
Input: shape.height | number | m | Structure height above ground | Required

A house declares its nodes, rods, occupied platforms, cloth supports and access runs in world metres, with Z up.
Platform datums give the top of the walking surface. Each access names its destination platform and starts at ground or at the preceding platform.
Mast and fanned-truss decks share a winding well offset from the trunk.
A winding run records its angular stations and stairwell. The platforms and treads share the well boundary at every landing.
A transverse batten divides a four-corner sail into two panels joined at the same pair of supported grips.
The builders consume no random draws. The same plot and shape produce the same ordered parts.
For example, `fannedTrussHouse(plot, { datums: [3, 6], height: 11 })` puts two decks three and six metres above the plot ground.
