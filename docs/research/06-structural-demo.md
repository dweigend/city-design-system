# Structural Demo

**The structure is computed, not drawn.** It is a demo, not a code-compliant structural design. A full lattice carries the load, and whatever carries little drops away. What remains is the path of force.

## Principle

1. **Pose.** Existing stock, supports, clear spaces and loads are inputs.
2. **Compute.** A linear space truss solves `K·u = f` for all load cases.
3. **Size.** Tension takes a solid rod. Compression takes a tube, checked against buckling.
4. **Remove.** Nodes, then struts, weakest first. A removal stays if the rest stands and needs no more steel.

## Building and structure

The lattice lands on the wall crests at 8 m. The capsule hangs on rods; the roof garden is load. Shoes press down only; one that lifts off drops out. A usable room has at least 8 m² at 2.4 m clear height and an access 1.5 m wide. A change of use re-checks the built members and keeps the form.

## Image

Line weight is the computed diameter to scale. In analysis, compression is hollow and tension solid. Failures are results with a code: `mechanismus`, `lastpfad-fehlt`, `nicht-bemessbar`.

## Compute load

The game never waits on statics. The core is a pure function. A key hashes input and generator version. One job runs at a time; the newest request per channel wins. Removal stops after 400 trials; the host ends a worker after 5 s.

Seed 42 reduces 172 candidate struts to 97 in 126 ms (median of five runs, Bun 1.4.4, AMD Ryzen 9 8945HX).

## Appendix C · Demo values

Chosen inputs for reproducible models, SI units.

| Quantity     | Value                                            |
| ------------ | ------------------------------------------------ |
| Gravity      | 9.81 m/s²                                        |
| Steel (S235) | E = 210 GPa, yield 235 MPa, 7,850 kg/m³          |
| Capsule      | floor 1.5 kN/m², envelope 0.8 kN/m²              |
| Use          | living 2.0 kN/m², workshop and walkway 5.0 kN/m² |
| Garden       | 6.28 kN/m² (0.30 m wet substrate, 0.10 m water)  |
| Wind         | 0.8 kN/m²; sway 1/200 of vertical load           |
| Load factors | 1.35 permanent, 1.5 variable                     |
| Resistance   | yield / 1.0; Euler buckling with safety 2.5      |
| Deflection   | span / 300                                       |

Reference cases: a bar of 2 m, 1e-3 m², under 10 kN stretches 9.52e-5 m. A cantilever of 4 m, I = 8e-5 m⁴, under 10 kN deflects 12.7 mm. Four equal hangers under 80 kN carry 20 kN each.

## Limits

- Greedy removal finds a good form, not a proven minimum.
- Existing stock counts as rigid; masonry is not verified.
- Struts are pin-jointed; bending and joints are missing.
