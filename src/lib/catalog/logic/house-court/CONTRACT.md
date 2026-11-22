# House and court

`createHouseCourt(parcel, occupancy?, reservations?)` takes the parcel’s resolved block inputs, cell space, exterior exit face and nine distinct slot bindings. Number rows from the entrance and columns from the left, starting at zero. The front-middle and centre slots become one reserved court with empty fills. Each arm and the rear have their own room ID.

The result shares the supplied cell space and block inputs. Its fills, reservations, room and court addresses are detached. IDs derive from the parcel ID and semantic roles. The recipe uses zero random draws. It rejects unavailable slots, disconnected groups, an invalid exit face and conflicting fills or reservations.

`exposedHouseFaces(house)` emits detached outward rings in face ID order. A face between two cells filled by the same house is omitted. The five executable examples are in `house-court.test.ts`.
