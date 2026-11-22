# Glossary

Use US English for repository text and names. The German column helps readers translate source material. Keep source quotations, titles, proper names, formulas and units intact. See [Naming Conventions](NAMING_CONVENTIONS.md#language).

## 1. Chapters & Product Structure

| EN                   | DE                  | Note                                                              |
| :------------------- | :------------------ | :---------------------------------------------------------------- |
| design bible / Bible | Designbibel / Bibel | Product section with binding rules for visual grammar and engine. |
| guiding vision       | Leitbild            | Overarching design stance.                                        |
| guiding idea         | Leitidee            | An idea that shapes the guiding vision.                           |
| stance               | Haltung             | Foundational design stance of the game.                           |
| reading path         | Leseweg             | Recommended sequence through the chapters.                        |
| deep dive            | Vertiefung          | Collapsible detail or derivation block.                           |
| workbench            | Werkbank            | Interactive 3D inspection view for buildings and layers.          |

---

## 2. Game World & Urbanism

| EN                                          | DE                                   | Note                                                                                       |
| :------------------------------------------ | :----------------------------------- | :----------------------------------------------------------------------------------------- |
| world                                       | Welt                                 | Composed city scene; not the `World` class of `city-library`.                              |
| district                                    | Quartier                             | Urban neighborhood unit (e.g., 4×4 blocks).                                                |
| old town                                    | Altstadt                             | Historically grown comparison city.                                                        |
| existing stock / existing building          | Bestand                              | Pre-existing building fabric. For individual buildings also _existing building_.           |
| old building / existing building            | Altbau                               | Individual existing building in the district.                                              |
| new build / new addition                    | Neubau / Neues                       | Newly added building components.                                                           |
| building on existing stock / adaptive reuse | Weiterbauen (Weiterbauen am Bestand) | Guiding idea: retain, convert, and extend instead of demolishing.                          |
| retain, convert, extend                     | Behalten, umbauen, ergänzen          | The three stages of building on existing stock.                                            |
| adaptive reuse / convert                    | Umnutzung / umnutzen                 | Change of use within an existing building.                                                 |
| rooftop extension / vertical extension      | Aufstockung / aufstocken             | New stories added atop an existing roof.                                                   |
| densification / densify                     | Verdichtung / verdichten             | Spatial infill densification and epoch in parcel growth.                                   |
| deconstruction / disassembly                | Rückbau                              | Clean, sorted disassembly for reuse, never _demolition_.                                   |
| component passport / passport               | Bauteilpass / Pass                   | Individual provenance and lifecycle record of each component.                              |
| instance / specimen                         | Exemplar                             | Individual physical piece with its own number (as opposed to component type).              |
| offcut / remnant                            | Reststück                            | Piece created when cutting to size, carrying its own passport.                             |
| lifecycle record / history                  | Lebenslauf                           | Chronicle of installations and removals in the component passport.                         |
| sponge city                                 | Schwammstadt                         | Stormwater retention and reuse in the district.                                            |
| steady rain / heavy rain                    | Landregen / Starkregen               | The two rain scenarios in the sponge-city simulation.                                      |
| green roof                                  | Gründach                             | Water-retaining roof in the sponge city.                                                   |
| infiltration / infiltrate                   | Versickerung / versickern            | Water absorption through open ground.                                                      |
| gravel trench / infiltration crate          | Kieskiste                            | Underground infiltration storage beneath the courtyard.                                    |
| cistern                                     | Zisterne                             | Underground or basement rainwater storage tank.                                            |
| retention basin / basin                     | Becken (Rückhaltebecken)             | Open water basin in the courtyard.                                                         |
| flood swale                                 | Flutmulde                            | Overflow channel for heavy rain.                                                           |
| unsealing / unsealed ground                 | Entsiegelung / Boden geöffnet        | Removing asphalt to restore infiltration.                                                  |
| alley                                       | Gasse                                | The city has no streets. Alleys are narrow public pedestrian routes between blocks.        |
| riverside promenade                         | Uferpromenade                        | Broadest pedestrian route, following the bank.                                             |
| main alley                                  | Hauptgasse                           | Principal pedestrian connection between squares and parcel frontages.                      |
| stair alley                                 | Treppengasse                         | Stepped pedestrian connection across a slope.                                              |
| pedestrian footbridge                       | Fußgängerbrücke                      | River crossing with pedestrian approaches. Rail and capsule rail use their own structures. |
| cul-de-sac / dead-end alley                 | Stichgasse / Sackgasse               | Alley leading into the interior of a block (e.g., Fès, Marrakesch).                        |
| square                                      | Platz                                | Public gathering space; do not confuse with _square grid_.                                 |
| courtyard / back courtyard                  | Hof / Hinterhof                      | Open center of a block.                                                                    |
| perimeter block                             | Blockrand                            | Closed built edge along the block perimeter.                                               |
| perimeter row / historic row                | Gründerzeitzeile                     | Continuous historic row of perimeter buildings.                                            |
| infill gap / gap                            | Baulücke / Lücke                     | Unbuilt parcel between existing buildings.                                                 |
| vacant lot                                  | Brache                               | Unbuilt lot.                                                                               |
| green corridor                              | Grünzug                              | Planted block edge.                                                                        |
| waterfront / water's edge                   | Ufer / Wasserkante                   | Block edge along water.                                                                    |
| party wall / firewall                       | Brandwand                            | Blank boundary wall toward a neighbor.                                                     |
| passage / passageway                        | Durchgang                            | Public cut-through through the perimeter block into the courtyard.                         |
| transit stop / stop                         | Haltepunkt / Halt                    | Public transit node.                                                                       |
| elevated walkway / skywalk                  | Hochweg                              | Walkable connection above alley level.                                                     |
| elevated walkway network                    | Hochwegnetz                          | Connected path network on level 2 (8 m) and level 4 (16 m).                                |
| gallery walkway                             | Galerie / Laubengang                 | Elevated walkway at 8 m height (level 2) along the facade or around the courtyard.         |
| rooftop walkway                             | Dachweg                              | Elevated walkway at 16 m height (level 4).                                                 |
| footbridge / catwalk                        | Steg                                 | Narrow, lightly spanning pedestrian bridge.                                                |
| walking distance                            | Gehweite                             | Accessibility on foot (e.g., 15-minute city).                                              |
| landmark                                    | Landmarke                            | Single tall cell in calm surroundings.                                                     |

---

## 3. Architecture, Building & Form Vocabulary

| EN                                | DE                       | Note                                                                             |
| :-------------------------------- | :----------------------- | :------------------------------------------------------------------------------- |
| building volume / massing         | Baukörper / Körper       | Three-dimensional building volume.                                               |
| floor / story                     | Geschoss                 | Architectural story; do not confuse with discrete _level_.                       |
| ground floor                      | Erdgeschoss              | Lowest story at the public path.                                                 |
| eaves height / eaves              | Traufhöhe / Traufe       | Roof edge of existing buildings (often 8 m = elevated walkway connection).       |
| building zone / zone              | Bauzone / Zone           | Vertical articulation of a building.                                             |
| plinth / base                     | Sockel                   | Lower public zone of a building.                                                 |
| stack                             | Stapel                   | Middle program zone of stacked stories.                                          |
| crown / cap                       | Kopf                     | Top termination of a tower or building.                                          |
| core                              | Kern                     | Load-bearing and circulation interior of a building or tower.                    |
| structural frame / scaffold       | Gerüst                   | Permanent primary structure into which plug-in modules are hung.                 |
| plug-in module / module           | Einschub / Modul         | Replaceable spatial unit inside the structural frame.                            |
| form group                        | Formgruppe               | One of the twelve basic families of the form vocabulary.                         |
| block mass / slab                 | Klotz                    | Form group 1: cuboid, cube stack, wedge, step.                                   |
| cylinder                          | Zylinder                 | Form group 2: silo, round tower, half-cylinder.                                  |
| capsule                           | Kapsel                   | Form group 3: rigid plug-in spatial unit such as tube, sphere house, cushion.    |
| arch / arcade / barrel vault      | Bogen / Arkade / Tonne   | Form group 4: passage and plinth forms.                                          |
| frame                             | Rahmen                   | Form group 5: lattice cube, scaffold, truss.                                     |
| ring / helix / torus              | Ring / Wendel / Torus    | Form group 6: large circulation gesture around a core.                           |
| pipe / tube transit               | Rohr / Röhrenbahn        | Form group 7: exposed exterior conduits and transit tubes.                       |
| envelope / climate skin           | Hülle / Klimahaut        | Form group 9 & level of representation: second skin of glass/membrane or `hull`. |
| circulation / access              | Erschließung             | Form group 10: stairs, ramps, footbridges on the exterior.                       |
| vegetation / voxel tree           | Vegetation / Voxelbaum   | Form group 11: courtyard and roof trees.                                         |
| roof garden / rooftop farm        | Dachgarten / Dachfarm    | Planted or agricultural roof surface.                                            |
| deformation cage / cage           | Käfig (Verformungskäfig) | Eight-point cage for trilinear deformation of a tower.                           |
| shear / tilt                      | Scherung / Neigen        | Lateral tilting of the tower inside the deformation cage.                        |
| taper / tapering                  | Verjüngung / Verjüngen   | Tower form narrowing toward the top.                                             |
| twist / rotation                  | Drehung / Drehen         | Rotation of the tower around the vertical axis.                                  |
| corner module                     | Eckmodul                 | Building module placed on the dual grid.                                         |
| corner mask / mask                | Eckmaske / Maske         | 8-bit occupancy pattern of the eight quad corners.                               |
| inside corner / re-entrant corner | Innenecke                | Corner module when three of four corners are occupied.                           |

---

## 4. Structural Systems & Structural Analysis

| EN                                       | DE                           | Note                                                                                               |
| :--------------------------------------- | :--------------------------- | :------------------------------------------------------------------------------------------------- |
| structural system / structure            | Tragwerk                     | Load-bearing construction of a building.                                                           |
| structural family / construction type    | Trägerfamilie / Bauweise     | A group of structures with a shared construction method.                                           |
| folded plate structure / folded plate    | Faltwerk                     | Family 1: folded surface structure following the Miura principle.                                  |
| mountain fold / valley fold / fold line  | Bergfalte / Talfalte / Falz  | Fold edges of a folded plate.                                                                      |
| geodesic dome / dome                     | Kuppel (Geodätische Kuppel)  | Family 2: strut dome derived from a subdivided icosahedron.                                        |
| honeycomb skin / hex-pent Goldberg shell | Wabenhaut                    | Dual dome skin of hexagons and twelve pentagons.                                                   |
| honeycomb structure / hex cluster        | Wabe                         | Family 3: stacked hexagonal prisms around an open shaft.                                           |
| central shaft / core shaft               | Schacht                      | Open interior shaft in the honeycomb structure.                                                    |
| space frame / octet truss                | Raumfachwerk                 | Family 4: strut truss assembled from tetrahedra and octahedra.                                     |
| gridshell                                | Gitterschale                 | Family 5: shell determined by form finding (inverted hanging form).                                |
| hanging form / funicular form            | Hängeform                    | Mesh hanging under self-weight before inversion.                                                   |
| force density                            | Kraftdichte                  | Ratio of member force to member length during form finding.                                        |
| strut / secondary strut / rib            | Stab / Nebenstab / Rippe     | Linear load-bearing members in the structural layout.                                              |
| node / hub                               | Knoten / Nabe                | Connection point of struts in a space frame or dome.                                               |
| post and beam / mullion and transom      | Pfosten und Riegel           | Vertical and horizontal timber members of the honeycomb structure.                                 |
| house principle                          | Hausprinzip                  | The way a house carries itself: layers, scaffold, exoskeleton, mast, tower, fanned truss.          |
| rod / strut / tie                        | Stange / Druckstab / Zugstab | Straight member between two nodes of a house; a tie only pulls.                                    |
| grip                                     | Zugpunkt                     | Point at which a skin holds a node or a rod.                                                       |
| skin patch                               | Hüllfeld                     | One cloth tensioned between grips.                                                                 |
| platform                                 | Plattform                    | Occupied level at one datum; a room only where declared.                                           |
| datum                                    | Höhenlage                    | Height of a walking surface in meters.                                                             |
| span                                     | Spannweite                   | Freely bridged distance in meters (e.g., 13 m for elevated walkways, 36 m for structural systems). |
| structural analysis / force analysis     | Kräfteanalyse / Analyse      | Structural evaluation view.                                                                        |
| full candidate grid                      | Vollgitter                   | Stage 1 of topology optimization: full starting grid.                                              |
| sizing / structural sizing               | Bemessung                    | Stage 2 of structural simulation: cross-section sizing by load.                                    |
| pruning / load-path reduction            | Abtrag (Topologie-Abtrag)    | Stage 3 of structural simulation: removal of lightly loaded struts.                                |
| axial force                              | Normalkraft                  | Longitudinal force in a member in newtons or `kN`.                                                 |
| tension / compression                    | Zug / Druck                  | Positive axial force (teal, solid) vs. negative axial force (violet, hollow).                      |
| utilization                              | Ausnutzung                   | Ratio of actual to allowable stress in `%`.                                                        |
| deflection / deformation                 | Durchbiegung / Verformung    | Static displacement under load in `mm`.                                                            |

---

## 5. Grids, Topology & Urban Growth

| EN                          | DE                              | Note                                                                                          |
| :-------------------------- | :------------------------------ | :-------------------------------------------------------------------------------------------- |
| universal grid / grid       | Universalraster / Raster        | Generator of a cellular decomposition.                                                        |
| carrier                     | Träger (Topologischer Träger)   | Topological structure on which grids sit as position layers.                                  |
| embedding / position layer  | Einbettung / Lage               | Geometric coordinates attached to a fixed topology.                                           |
| block / macro cell          | Block / Makrozelle              | Buildable region between alleys.                                                              |
| fringe                      | Saum                            | Cyclic perimeter of a block.                                                                  |
| cell                        | Zelle                           | Subdivided area unit inside a block, decomposed into quads.                                   |
| quad / face                 | Viereck / Slot                  | Elementary quad face of the carrier on which modules sit.                                     |
| build cell / carrier vertex | Bauzelle                        | Corner of a quad on which occupancy sits.                                                     |
| occupancy / sample          | Belegung / Probe                | Occupancy state on `build cell × level`; do not confuse with the verb `sample` (random draw). |
| level                       | Ebene                           | Discrete vertical index, not height in meters.                                                |
| checkerboard / square grid  | Schachbrett (Quadratraster)     | Regular orthogonal grid.                                                                      |
| axial grid                  | Achsraster                      | Grid aligned to primary axes.                                                                 |
| contour grid                | Konturraster                    | Grid following elevation or shoreline contours.                                               |
| irregular quad grid         | Unregelmäßiges Viereck          | Relaxed quad mesh after Oskar Stålberg / Townscaper.                                          |
| corner leeway / valid range | Spielraum (der Ecken)           | Permitted movement range of a corner (angles between 5° and 180°).                            |
| distortion / warping        | Verzug / Verziehen              | Continuous shifting of grid corners on a fixed topology.                                      |
| smoothing / relaxation      | Glätten / Entspannen            | Equalizing corner positions.                                                                  |
| paths first                 | Wege zuerst                     | Organic city genesis: path network first, blocks derived from it.                             |
| direction field / field     | Richtungsfeld / Feld            | Spatial vector or scalar field for direction, distance, or attraction.                        |
| split tree                  | Teilungsbaum                    | Hierarchical tree of block and parcel cuts.                                                   |
| strip / perimeter strip     | Streifen / Randstreifen         | First split step along an accessed block edge.                                                |
| perpendicular to frontage   | Quer zur Front                  | Split rule ensuring every resulting parcel retains access to the alley.                       |
| parcel / lot                | Parzelle / Grundstück           | Individual lot with a stable provenance ID.                                                   |
| epoch / era                 | Epoche                          | Time phase of parcel evolution: _founding_, _densification_, _crisis_, _transition_.          |
| split, merge, convert       | Teilen, Zusammenlegen, Umnutzen | The three discrete event operators on parcels.                                                |
| method matrix               | Verfahrensmatrix                | Overview table mapping procedural methods to building tasks.                                  |

---

## 6. Color, Focus & Flows

| EN                                                      | DE                                               | Note                                                                        |
| :------------------------------------------------------ | :----------------------------------------------- | :-------------------------------------------------------------------------- |
| flow / flows                                            | Strom / Ströme                                   | The five functional urban cycles.                                           |
| People / Water / Energy / Food / Material               | Menschen / Wasser / Energie / Nahrung / Material | The five flow names in UI and legends.                                      |
| flow color                                              | Stromfarbe                                       | Functional color of a flow from the central palette.                        |
| color ramp / step ladder                                | Farbreihe / Leiter                               | Five-step color gradation between paper and ink.                            |
| Steps 1–5: Surroundings, Surface, Volume, Network, Core | Stufen 1–5: Umfeld, Fläche, Volumen, Netz, Kern  | The five semantic roles within each color ramp.                             |
| base tone / primary tone                                | Grundton                                         | Step 4 of a color ramp.                                                     |
| quiet surface / neutral area                            | Ruhige Fläche                                    | Colorless existing-stock and background share (at least 75 % of the image). |
| Signal / Blueprint / Hazard                             | Signal / Blaupause / Warnung                     | The three stepless accent colors.                                           |
| focus mode                                              | Fokus-Modus                                      | Player question coloring at most three flows.                               |
| focus layer                                             | Fokus-Ebene                                      | Three-way split of the scene into _Focus_, _Context_, and _Background_.     |
| level of representation                                 | Darstellungsstufe                                | Geometric detail level of a model.                                          |
| visual grammar / house style                            | Leitstil                                         | Context-dependent visual grammar across zoom, mode, and situation.          |
| architectural drawing / plan drawing                    | Planzeichnung                                    | Target style A: bright paper surface, crisp ink and pencil lines.           |

---

## 7. Material & Surface

| EN                                        | DE                         | Note                                                                                                          |
| :---------------------------------------- | :------------------------- | :------------------------------------------------------------------------------------------------------------ |
| material family                           | Materialfamilie            | A group of materials with shared properties.                                                                  |
| white architectural model / plaster model | Weißbau                    | Opaque, chalky plaster/paper-model material for existing stock and structure.                                 |
| exposed concrete / concrete               | Sichtbeton / Beton         | Matte core and plinth material with formwork joints.                                                          |
| painted steel                             | Stahl lackiert             | Satin metal for flow-carrying parts.                                                                          |
| ceramic glaze / ceramics                  | Glasur / Keramik           | Glossy material for crowns and roofs.                                                                         |
| frosted acrylic / plastic                 | Acryl milchig / Kunststoff | Translucent pastel material for envelopes and capsules.                                                       |
| membrane                                  | Membran                    | Opal, strongly diffusing foil skin for domes and cushions.                                                    |
| greenhouse glass                          | Gewächshaus                | Clear glass with mullion grid and green tint.                                                                 |
| ghost                                     | Geist                      | Semi-transparent, muted plaster-model material for occluding existing stock.                                  |
| opacity                                   | Deckkraft                  | Alpha axis of the material.                                                                                   |
| finish / gloss                            | Mattigkeit / Glanz         | Surface axis: _matte_, _satin_, _gloss_.                                                                      |
| milkiness / turbidity                     | Milchigkeit / Trübung      | Fresnel brightening toward paper color: _clear_, _hint_, _milky_, _opal_.                                     |
| diffusion                                 | Diffusion                  | Blurred background transmission: _none_, _soft_, _strong_.                                                    |
| edge rendering / edge style               | Kantenbild                 | Contour stroke: _ink_, _fine_, _muted_, _none_.                                                               |
| procedural noise / grain                  | Rauschen                   | World-locked shader pattern: _pores_, _wood grain_, _brushed_, _glaze clouds_, _streaks_, _fiber_, _ripples_. |
| joint pattern / joints                    | Fugen                      | Scale-giving lines: _formwork_, _slats_, _panels_, _tiles_, _mullions_, _seams_.                              |

---

## 8. Interface, HUD & Archive

| EN                                                      | DE                                                | Note                                                              |
| :------------------------------------------------------ | :------------------------------------------------ | :---------------------------------------------------------------- |
| building view                                           | Hausansicht                                       | One of the five inspection views of the workbench.                |
| Exterior / X-Ray / Section / Exploded View / Floor Plan | Außen / Röntgen / Schnitt / Explosion / Geschoss  | The five building views.                                          |
| control panel / UI controls                             | Bedientafel / Bedienelemente                      | Drafting-inspired interaction components based on Bits UI.        |
| button / switch / checkbox / slider / tab               | Knopf / Schalter / Häkchen / Regler / Reiter      | The basic control-panel elements.                                 |
| tooltip / tag / metric / tiles / timeline               | Hinweis / Marke / Kennzahl / Kacheln / Zeitleiste | Information and control building blocks.                          |
| hairline                                                | Haarlinie                                         | Fine 1-px leader line for spatial labels and UI frames.           |
| ink / paper                                             | Tinte / Papier                                    | The two fundamental poles of the drawing sheet.                   |
| axonometric view / isometric projection                 | Achsensicht / Isometrie                           | Oblique parallel projection of the city scene and volume icons.   |
| walkthrough / street-level tour                         | Rundgang                                          | Eye-level camera tour through the simulation.                     |
| original adaptation                                     | Eigene Übertragung                                | Original design reinterpretation following documented principles. |
| raw material / external references                      | Rohmaterial / Fremde Vorbilder                    | Collection groups in the archive.                                 |

---

## 9. Procedural Principles & Standards

| EN                                | DE                             | Note                                                                                        |
| :-------------------------------- | :----------------------------- | :------------------------------------------------------------------------------------------ |
| intent                            | Absicht                        | Authoritative, pure data input to a generator.                                              |
| derivation                        | Ableitung                      | Deterministic computation path from state to geometry.                                      |
| provenance / origin               | Herkunft                       | Rule path from which a stable ID arises.                                                    |
| seed                              | Saat                           | Normalized 32-bit start value of the random generator (`seed`); never a continuation state. |
| random draw / draw sequence       | Zufallszug / Zugfolge          | PRNG call (`sample`) or contractually fixed sequence of draws (PD-6).                       |
| continuation state                | Fortsetzungszustand            | Complete state inventory for resuming a run (PD-8).                                         |
| invariant                         | Invariante                     | Geometric or topological condition that holds after every operation.                        |
| degeneracy                        | Entartung                      | Boundary case such as undersized block or acute angle; handled as a rule branch.            |
| single source of truth / owner    | Faktenhoheit / Owner           | Exactly one document or module owns a fact; all others link (DOC-01).                       |
| frozen evidence                   | Eingefrorene Evidenz           | Historical measurement reports, hashes, and findings that are never rewritten (DOC-60).     |
| author sign-off / author decision | Autorenabnahme / Autorenurteil | Explicit sign-off or decision by David.                                                     |
| measurement contract / metric     | Messvertrag / Kennzahl         | Binding test conditions (device, seed, budget) and measured value with unit.                |
