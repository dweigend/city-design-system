# Valley

`Valley.create({ seed: 1201, parameters: { sinuosity: 1.15 } })` returns the same frozen valley on every call.
The uint32 seed derives independent course, open-bank and ground streams, with keyed child streams for individual draws.
Sinuosity is a unitless target ratio of channel length to endpoint chord over one full meander.
It ranges from 1.04 to 1.28 in steps of 0.01 and defaults to 1.15.
Seeded curvature adds an offset from −0.011 to +0.027 over a full wave. Clipped reaches have their own measured ratios.
The course has downstream XY vertices at 6.25 m chainage intervals and one wet width and bankfull width for the whole main stem.
The regular 2 km ground grid is north-first and has a 12.5 m cell size. Elevations are in meters with Z up.
Its band indices name channel, floodplain, terraces and slopes. `heightAt(x, y)` samples the same bed in the closed window.
