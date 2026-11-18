# Binding Glossary: English (US) ↔ German

This glossary defines the binding English (US) terminology for the design bible, documentation, comments, and UI copy in the `city-game-design-system` repository. Its goal is a clear, architectural, journalistic tone across all domains.

## 8 Binding Rules

1. **Identifiers remain untouched:** Variable, function, type, property, and class names as well as string discriminants (e.g., `'bestand'`, `'faltwerk'`, `HochwegKnoten`, `LeitideeTon`) are **not** changed.
2. **Filenames, folders, and routes remain unchanged:** Paths under `src/routes/` (`/formen`, `/wachstum`, `/farben`, etc.), filenames (`stadtBausteine.ts`, `NAMING_CONVENTIONS.md`), and explicit application anchor IDs remain unchanged. Markdown heading anchors change when headings are translated. Update all inbound links to the translated heading anchors.
3. **Scope of translation:** Translated are comments (JSDoc and inline comments), Markdown documentation, UI labels, and visible explanatory/content copy (strings in `data/`, components, and pages).
4. **Numbers, dimensions, and units remain unchanged:** Numeric values, formulas, units (`m`, `m²`, `mm`, `px`, `rad`, `kN`, `%`, `°`), and scale ratios (`1 U = 4 px = 1 m`) remain exact; decimal points follow US convention (`1.5 m`), and thousands separators follow US convention (`1,240`).
5. **Keep quotes, proper names, and sources in the original:** External work titles, city names in historical comparisons (_Fès_, _Siena_, _Regensburg_, _Marrakesch_), person and group references (_Bauhaus_, _Archigram_, _Superstudio_, _Frei Otto_, _Buckminster Fuller_), license texts, and direct original quotes from external sources are not translated or reinterpreted.
6. **No content or logic changes:** Procedural logic, data structures, random draws (RNG), tests, or catalog values must not be changed. Statements, status labels, and rules retain their exact technical meaning.
7. **US English and consistent tone:** American spelling throughout (_color_, _meter_, _neighbor_, _center_, _gray_, _program_, _story_). The style is concise, active, architectural, and journalistic — short sentences, no flowery marketing language.
8. **Glossary fidelity (one concept, one name):** Every term in the following tables is translated consistently across the entire repository using the exact English equivalent defined here.

---

## 1. Chapters & Product Structure

| EN                   | DE                  | Note                                                                                              |
| :------------------- | :------------------ | :------------------------------------------------------------------------------------------------ |
| design bible / Bible | Designbibel / Bibel | Product section with binding rules for visual grammar and engine (`id: 'bibel'`).                 |
| workshop             | Werkstatt           | Second main section of the website (`id: 'werkstatt'`); derivation, simulation, and raw material. |
| City                 | Stadt               | Chapter 1 (route `/`).                                                                            |
| Forms                | Formen              | Chapter 2 (route `/formen`).                                                                      |
| Grid                 | Raster              | Chapter 3 (route `/raster`).                                                                      |
| Growth               | Wachstum            | Chapter 4 (route `/wachstum`).                                                                    |
| Color                | Farbe               | Chapter 5 (route `/farben`).                                                                      |
| Material             | Material            | Chapter 6 (route `/material`).                                                                    |
| Interface            | Interface           | Chapter 7 (route `/interface`).                                                                   |
| Lab                  | Labor               | Chapter 8 (route `/labor`); interactive product section, not a throwaway experiment.              |
| Archive              | Archiv              | Chapter 9 (route `/archiv`); cataloged image collection.                                          |
| guiding vision       | Leitbild            | Overarching stance on the start page (`leitbild` in `vision.ts`).                                 |
| guiding idea         | Leitidee            | One of the four core ideas of the guiding vision (`Leitidee`).                                    |
| stance               | Haltung             | Foundational design stance of the game (`haltung`).                                               |
| reading path         | Leseweg             | Recommended sequence through the chapters (`leseweg`).                                            |
| deep dive            | Vertiefung          | Collapsible detail or derivation block (`Vertiefung.svelte`).                                     |
| workbench            | Werkbank            | Interactive 3D inspection view for buildings and layers (`werkbank`).                             |

---

## 2. Game World & Urbanism

| EN                                          | DE                                   | Note                                                                                                               |
| :------------------------------------------ | :----------------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| world                                       | Welt                                 | Composed city scene (`welt/`); not the `World` class of `city-library`.                                            |
| district                                    | Quartier                             | Urban neighborhood unit (e.g., 4×4 blocks).                                                                        |
| old town                                    | Altstadt                             | Historically grown comparison city (`altstaedte.ts`).                                                              |
| existing stock / existing building          | Bestand                              | Pre-existing building fabric (rendered gray, code `'bestand'`). For individual buildings also _existing building_. |
| old building / existing building            | Altbau                               | Individual existing building in the district.                                                                      |
| new build / new addition                    | Neubau / Neues                       | Newly added building components (colored by flow, code `'neu'`).                                                   |
| building on existing stock / adaptive reuse | Weiterbauen (Weiterbauen am Bestand) | Guiding idea: retain, convert, and extend instead of demolishing (`weiterbauen`).                                  |
| retain, convert, extend                     | Behalten, umbauen, ergänzen          | The three stages of building on existing stock (`behalten`, `umbauen`, `ergaenzen`).                               |
| adaptive reuse / convert                    | Umnutzung / umnutzen                 | Change of use within an existing building.                                                                         |
| rooftop extension / vertical extension      | Aufstockung / aufstocken             | New stories added atop an existing roof (`aufstockung`).                                                           |
| densification / densify                     | Verdichtung / verdichten             | Spatial infill densification and epoch in parcel growth (`verdichtung`).                                           |
| deconstruction / disassembly                | Rückbau                              | Clean, sorted disassembly for reuse (focus mode `'rueckbau'`), never _demolition_.                                 |
| component passport / passport               | Bauteilpass / Pass                   | Individual provenance and lifecycle record of each component (`Pass`).                                             |
| instance / specimen                         | Exemplar                             | Individual physical piece with its own number (as opposed to component type).                                      |
| offcut / remnant                            | Reststück                            | Piece created when cutting to size, carrying its own passport (`abkoemmling`: _derived piece_).                    |
| lifecycle record / history                  | Lebenslauf                           | Chronicle of installations and removals in the component passport (`lebenslauf`).                                  |
| sponge city                                 | Schwammstadt                         | Stormwater retention and reuse in the district (`schwamm`).                                                        |
| steady rain / heavy rain                    | Landregen / Starkregen               | The two rain scenarios in the sponge-city simulation (`land`, `stark`).                                            |
| green roof                                  | Gründach                             | Water-retaining roof in the sponge city.                                                                           |
| infiltration / infiltrate                   | Versickerung / versickern            | Water absorption through open ground.                                                                              |
| gravel trench / infiltration crate          | Kieskiste                            | Underground infiltration storage beneath the courtyard.                                                            |
| cistern                                     | Zisterne                             | Underground or basement rainwater storage tank.                                                                    |
| retention basin / basin                     | Becken (Rückhaltebecken)             | Open water basin in the courtyard (`becken`).                                                                      |
| flood swale                                 | Flutmulde                            | Overflow channel for heavy rain.                                                                                   |
| unsealing / unsealed ground                 | Entsiegelung / Boden geöffnet        | Removing asphalt to restore infiltration (`entsiegelt`).                                                           |
| alley                                       | Gasse                                | The city has no streets. Alleys are narrow public pedestrian routes between blocks (`alley`).                      |
| riverside promenade                         | Uferpromenade                        | Broadest pedestrian route, following the bank (`riversidePromenade`).                                              |
| main alley                                  | Hauptgasse                           | Principal pedestrian connection between squares and parcel frontages (`mainAlley`).                                |
| stair alley                                 | Treppengasse                         | Stepped pedestrian connection across a slope (`stairAlley`).                                                       |
| pedestrian footbridge                       | Fußgängerbrücke                      | River crossing with pedestrian approaches (`footbridge`). Rail and capsule rail use their own structures.          |
| cul-de-sac / dead-end alley                 | Stichgasse / Sackgasse               | Alley leading into the interior of a block (e.g., Fès, Marrakesch).                                                |
| square                                      | Platz                                | Public gathering space (`square`, collection `squares`); do not confuse with _square grid_.                        |
| courtyard / back courtyard                  | Hof / Hinterhof                      | Open center of a block (`hof`, _shared courtyard_ for shared block interiors).                                     |
| perimeter block                             | Blockrand                            | Closed built edge along the block perimeter (`blockrand`).                                                         |
| perimeter row / historic row                | Gründerzeitzeile                     | Continuous historic row of perimeter buildings (`zeile`).                                                          |
| infill gap / gap                            | Baulücke / Lücke                     | Unbuilt parcel between existing buildings (`luecke`).                                                              |
| vacant lot                                  | Brache                               | Unbuilt lot.                                                                                                       |
| green corridor                              | Grünzug                              | Planted block edge (`gruen`).                                                                                      |
| waterfront / water's edge                   | Ufer / Wasserkante                   | Block edge along water (`ufer`).                                                                                   |
| party wall / firewall                       | Brandwand                            | Blank boundary wall toward a neighbor (`party`, `wand`).                                                           |
| passage / passageway                        | Durchgang                            | Public cut-through through the perimeter block into the courtyard (`durchgang`).                                   |
| transit stop / stop                         | Haltepunkt / Halt                    | Public transit node (`stops`, `halt`).                                                                             |
| elevated walkway / skywalk                  | Hochweg                              | Walkable connection above alley level (`hochwege`, `skywalk`).                                                     |
| elevated walkway network                    | Hochwegnetz                          | Connected path network on level 2 (8 m) and level 4 (16 m).                                                        |
| gallery walkway                             | Galerie / Laubengang                 | Elevated walkway at 8 m height (level 2) along the facade or around the courtyard.                                 |
| rooftop walkway                             | Dachweg                              | Elevated walkway at 16 m height (level 4).                                                                         |
| footbridge / catwalk                        | Steg                                 | Narrow, lightly spanning pedestrian bridge (`steg`).                                                               |
| walking distance                            | Gehweite                             | Accessibility on foot (e.g., 15-minute city).                                                                      |
| landmark                                    | Landmarke                            | Single tall cell in calm surroundings (`landmarke`).                                                               |

---

## 3. Architecture, Building & Form Vocabulary

| EN                                | DE                       | Note                                                                                        |
| :-------------------------------- | :----------------------- | :------------------------------------------------------------------------------------------ |
| building volume / massing         | Baukörper / Körper       | Three-dimensional building volume.                                                          |
| floor / story                     | Geschoss                 | Architectural story (4 m height, `floors`); do not confuse with discrete _level_.           |
| ground floor                      | Erdgeschoss              | Lowest story at the public path.                                                            |
| eaves height / eaves              | Traufhöhe / Traufe       | Roof edge of existing buildings (often 8 m = elevated walkway connection).                  |
| building zone / zone              | Bauzone / Zone           | Vertical articulation of a building (`sockel`, `stapel`, `kopf`).                           |
| plinth / base                     | Sockel                   | Lower public zone of a building (`sockel`).                                                 |
| stack                             | Stapel                   | Middle program zone of stacked stories (`stapel`).                                          |
| crown / cap                       | Kopf                     | Top termination of a tower or building (`kopf`, e.g., dome, solar crown, roof garden).      |
| core                              | Kern                     | Load-bearing and circulation interior of a building or tower.                               |
| structural frame / scaffold       | Gerüst                   | Permanent primary structure into which plug-in modules are hung (`geruest`).                |
| plug-in module / module           | Einschub / Modul         | Replaceable spatial unit inside the structural frame (`einschub`, `modul`).                 |
| form group                        | Formgruppe               | One of the twelve basic families of the form vocabulary (`Formgruppe`).                     |
| block mass / slab                 | Klotz                    | Form group 1: cuboid, cube stack, wedge, step (`klotz`).                                    |
| cylinder                          | Zylinder                 | Form group 2: silo, round tower, half-cylinder (`zylinder`).                                |
| capsule                           | Kapsel                   | Form group 3: rigid plug-in spatial unit such as tube, sphere house, cushion (`kapsel`).    |
| arch / arcade / barrel vault      | Bogen / Arkade / Tonne   | Form group 4: passage and plinth forms (`bogen`).                                           |
| frame                             | Rahmen                   | Form group 5: lattice cube, scaffold, truss (`rahmen`).                                     |
| ring / helix / torus              | Ring / Wendel / Torus    | Form group 6: large circulation gesture around a core (`ring`).                             |
| pipe / tube transit               | Rohr / Röhrenbahn        | Form group 7: exposed exterior conduits and transit tubes (`rohr`).                         |
| envelope / climate skin           | Hülle / Klimahaut        | Form group 9 & level of representation: second skin of glass/membrane or `hull` (`huelle`). |
| circulation / access              | Erschließung             | Form group 10: stairs, ramps, footbridges on the exterior (`erschliessung`).                |
| vegetation / voxel tree           | Vegetation / Voxelbaum   | Form group 11: courtyard and roof trees (`vegetation`).                                     |
| roof garden / rooftop farm        | Dachgarten / Dachfarm    | Planted or agricultural roof surface.                                                       |
| deformation cage / cage           | Käfig (Verformungskäfig) | Eight-point cage for trilinear deformation of a tower.                                      |
| shear / tilt                      | Scherung / Neigen        | Lateral tilting of the tower inside the deformation cage (`scherung`).                      |
| taper / tapering                  | Verjüngung / Verjüngen   | Tower form narrowing toward the top (`verjuengung`).                                        |
| twist / rotation                  | Drehung / Drehen         | Rotation of the tower around the vertical axis (`drehung`).                                 |
| corner module                     | Eckmodul                 | Building module placed on the dual grid (`eck`, `L10Corners`).                              |
| corner mask / mask                | Eckmaske / Maske         | 8-bit occupancy pattern of the eight quad corners.                                          |
| inside corner / re-entrant corner | Innenecke                | Corner module when three of four corners are occupied (`innenecke`).                        |

---

## 4. Structural Systems & Structural Analysis

| EN                                       | DE                          | Note                                                                                               |
| :--------------------------------------- | :-------------------------- | :------------------------------------------------------------------------------------------------- |
| structural system / structure            | Tragwerk                    | Load-bearing construction of a building (`tragwerke`, `haus-tragwerk`).                            |
| structural family / construction type    | Trägerfamilie / Bauweise    | One of the five structural families on the Forms page (`TraegerFamilieText`).                      |
| folded plate structure / folded plate    | Faltwerk                    | Family 1: folded surface structure following the Miura principle (`faltwerk`).                     |
| mountain fold / valley fold / fold line  | Bergfalte / Talfalte / Falz | Fold edges of a folded plate (`falz`).                                                             |
| geodesic dome / dome                     | Kuppel (Geodätische Kuppel) | Family 2: strut dome derived from a subdivided icosahedron (`kuppel`).                             |
| honeycomb skin / hex-pent Goldberg shell | Wabenhaut                   | Dual dome skin of hexagons and twelve pentagons.                                                   |
| honeycomb structure / hex cluster        | Wabe                        | Family 3: stacked hexagonal prisms around an open shaft (`wabe`).                                  |
| central shaft / core shaft               | Schacht                     | Open interior shaft in the honeycomb structure.                                                    |
| space frame / octet truss                | Raumfachwerk                | Family 4: strut truss assembled from tetrahedra and octahedra (`raumfachwerk`).                    |
| gridshell                                | Gitterschale                | Family 5: shell determined by form finding (inverted hanging form) (`gitterschale`).               |
| hanging form / funicular form            | Hängeform                   | Mesh hanging under self-weight before inversion.                                                   |
| force density                            | Kraftdichte                 | Ratio of member force to member length during form finding.                                        |
| strut / secondary strut / rib            | Stab / Nebenstab / Rippe    | Linear load-bearing members in the structural layout (`stab`, `nebenstab`, `rippe`).               |
| node / hub                               | Knoten / Nabe               | Connection point of struts in a space frame or dome (`nabe`).                                      |
| post and beam / mullion and transom      | Pfosten und Riegel          | Vertical and horizontal timber members of the honeycomb structure.                                 |
| span                                     | Spannweite                  | Freely bridged distance in meters (e.g., 13 m for elevated walkways, 36 m for structural systems). |
| structural analysis / force analysis     | Kräfteanalyse / Analyse     | Structural evaluation view (`analyse`, `statikSkala.ts`).                                          |
| full candidate grid                      | Vollgitter                  | Stage 1 of topology optimization: full starting grid (`block`).                                    |
| sizing / structural sizing               | Bemessung                   | Stage 2 of structural simulation: cross-section sizing by load (`kraefte`).                        |
| pruning / load-path reduction            | Abtrag (Topologie-Abtrag)   | Stage 3 of structural simulation: removal of lightly loaded struts (`abtrag`).                     |
| axial force                              | Normalkraft                 | Longitudinal force in a member in newtons or `kN` (`klassenNormalkraft`).                          |
| tension / compression                    | Zug / Druck                 | Positive axial force (teal, solid) vs. negative axial force (violet, hollow).                      |
| utilization                              | Ausnutzung                  | Ratio of actual to allowable stress in `%` (`klassenAusnutzung`).                                  |
| deflection / deformation                 | Durchbiegung / Verformung   | Static displacement under load in `mm` (`klassenVerformung`).                                      |

---

## 5. Grids, Topology & Urban Growth

| EN                          | DE                              | Note                                                                                                       |
| :-------------------------- | :------------------------------ | :--------------------------------------------------------------------------------------------------------- |
| universal grid / grid       | Universalraster / Raster        | Generator of a cellular decomposition (`Grid`, `raster/`).                                                 |
| carrier                     | Träger (Topologischer Träger)   | Topological structure on which grids sit as position layers (`carrier`, do not confuse with steel _beam_). |
| embedding / position layer  | Einbettung / Lage               | Geometric coordinates (`positions`) attached to a fixed topology.                                          |
| block / macro cell          | Block / Makrozelle              | Buildable region between alleys (`blocks`).                                                                |
| fringe                      | Saum                            | Cyclic perimeter of a block.                                                                               |
| cell                        | Zelle                           | Subdivided area unit inside a block, decomposed into quads (`zellen`).                                     |
| quad / face                 | Viereck / Slot                  | Elementary quad face of the carrier (`Face`, `vierecke`) on which modules sit.                             |
| build cell / carrier vertex | Bauzelle                        | Corner of a quad (`Vertex`) on which occupancy sits.                                                       |
| occupancy / sample          | Belegung / Probe                | Occupancy state on `build cell × level` (`Sample`); do not confuse with the verb `sample` (random draw).   |
| level                       | Ebene                           | Discrete vertical index (`level`), not height in meters.                                                   |
| checkerboard / square grid  | Schachbrett (Quadratraster)     | Regular orthogonal grid (`square`).                                                                        |
| axial grid                  | Achsraster                      | Grid aligned to primary axes (`axis`).                                                                     |
| contour grid                | Konturraster                    | Grid following elevation or shoreline contours (`contour`).                                                |
| irregular quad grid         | Unregelmäßiges Viereck          | Relaxed quad mesh after Oskar Stålberg / Townscaper (`quad-irregular`).                                    |
| corner leeway / valid range | Spielraum (der Ecken)           | Permitted movement range of a corner (angles between 5° and 180°).                                         |
| distortion / warping        | Verzug / Verziehen              | Continuous shifting of grid corners on a fixed topology (`verzug`).                                        |
| smoothing / relaxation      | Glätten / Entspannen            | Equalizing corner positions (`relax`).                                                                     |
| paths first                 | Wege zuerst                     | Organic city genesis: path network first, blocks derived from it (`wegeZuerst`).                           |
| direction field / field     | Richtungsfeld / Feld            | Spatial vector or scalar field for direction, distance, or attraction (`feld`).                            |
| split tree                  | Teilungsbaum                    | Hierarchical tree of block and parcel cuts (`teilung`, split grammar).                                     |
| strip / perimeter strip     | Streifen / Randstreifen         | First split step along an accessed block edge (`streifen`).                                                |
| perpendicular to frontage   | Quer zur Front                  | Split rule ensuring every resulting parcel retains access to the alley.                                    |
| parcel / lot                | Parzelle / Grundstück           | Individual lot with a stable provenance ID (`Parcel`, `parzelle`).                                         |
| epoch / era                 | Epoche                          | Time phase of parcel evolution: _founding_, _densification_, _crisis_, _transition_.                       |
| split, merge, convert       | Teilen, Zusammenlegen, Umnutzen | The three discrete event operators on parcels (`DriverSpec`).                                              |
| method matrix               | Verfahrensmatrix                | Overview table mapping procedural methods to building tasks (`wachstum-verfahren`).                        |

---

## 6. Color, Focus & Flows

| EN                                                      | DE                                               | Note                                                                                                                                   |
| :------------------------------------------------------ | :----------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| flow / flows                                            | Strom / Ströme                                   | The five functional urban cycles (`FlowId`: `people`, `water`, `energy`, `food`, `material`).                                          |
| People / Water / Energy / Food / Material               | Menschen / Wasser / Energie / Nahrung / Material | The five flow names in UI and legends (`flows`).                                                                                       |
| flow color                                              | Stromfarbe                                       | Functional color of a flow from the central palette (`flowToken`).                                                                     |
| color ramp / step ladder                                | Farbreihe / Leiter                               | Five-step color gradation between paper (`--paper`) and ink (`--ink`).                                                                 |
| Steps 1–5: Surroundings, Surface, Volume, Network, Core | Stufen 1–5: Umfeld, Fläche, Volumen, Netz, Kern  | The five semantic roles within each color ramp (`flowSteps`).                                                                          |
| base tone / primary tone                                | Grundton                                         | Step 4 (`Network`) of a color ramp.                                                                                                    |
| quiet surface / neutral area                            | Ruhige Fläche                                    | Colorless existing-stock and background share (at least 75 % of the image).                                                            |
| Signal / Blueprint / Hazard                             | Signal / Blaupause / Warnung                     | The three stepless accent colors (`--signal`, `--blueprint`, `--cat-hazard`).                                                          |
| focus mode                                              | Fokus-Modus                                      | Player question coloring at most three flows (`FocusMode`: _Build_, _Paths_, _Supply_, _Harvest_, _Deconstruction_, _Existing Stock_). |
| focus layer                                             | Fokus-Ebene                                      | Three-way split of the scene into _Focus_, _Context_, and _Background_.                                                                |
| level of representation                                 | Darstellungsstufe                                | Geometric detail level of a model (`LevelId`: `detail`, `mid`, `block`, `hull`).                                                       |
| visual grammar / house style                            | Leitstil                                         | Context-dependent visual grammar across zoom, mode, and situation (`leitstil.ts`).                                                     |
| architectural drawing / plan drawing                    | Planzeichnung                                    | Target style A: bright paper surface, crisp ink and pencil lines.                                                                      |

---

## 7. Material & Surface

| EN                                        | DE                         | Note                                                                                                                                            |
| :---------------------------------------- | :------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| material family                           | Materialfamilie            | One of the nine base families on `/material` (`FamilieId`: metal, ceramics, concrete, plastic, glass, timber, membrane, water, existing stock). |
| white architectural model / plaster model | Weißbau                    | Opaque, chalky plaster/paper-model material for existing stock and structure (`id: 'paper'`).                                                   |
| exposed concrete / concrete               | Sichtbeton / Beton         | Matte core and plinth material with formwork joints (`concrete`).                                                                               |
| painted steel                             | Stahl lackiert             | Satin metal for flow-carrying parts (`metal`).                                                                                                  |
| ceramic glaze / ceramics                  | Glasur / Keramik           | Glossy material for crowns and roofs (`glaze`, `keramik`).                                                                                      |
| frosted acrylic / plastic                 | Acryl milchig / Kunststoff | Translucent pastel material for envelopes and capsules (`acrylic`, `kunststoff`).                                                               |
| membrane                                  | Membran                    | Opal, strongly diffusing foil skin for domes and cushions (`membrane`).                                                                         |
| greenhouse glass                          | Gewächshaus                | Clear glass with mullion grid and green tint (`greenhouse`).                                                                                    |
| ghost                                     | Geist                      | Semi-transparent, muted plaster-model material for occluding existing stock (`ghost`).                                                          |
| opacity                                   | Deckkraft                  | Alpha axis of the material (`solid`, `glass`, `hull`, `trace`).                                                                                 |
| finish / gloss                            | Mattigkeit / Glanz         | Surface axis: _matte_, _satin_, _gloss_.                                                                                                        |
| milkiness / turbidity                     | Milchigkeit / Trübung      | Fresnel brightening toward paper color: _clear_, _hint_, _milky_, _opal_.                                                                       |
| diffusion                                 | Diffusion                  | Blurred background transmission: _none_, _soft_, _strong_.                                                                                      |
| edge rendering / edge style               | Kantenbild                 | Contour stroke: _ink_, _fine_, _muted_, _none_.                                                                                                 |
| procedural noise / grain                  | Rauschen                   | World-locked shader pattern: _pores_, _wood grain_, _brushed_, _glaze clouds_, _streaks_, _fiber_, _ripples_.                                   |
| joint pattern / joints                    | Fugen                      | Scale-giving lines: _formwork_, _slats_, _panels_, _tiles_, _mullions_, _seams_.                                                                |

---

## 8. Interface, HUD & Archive

| EN                                                      | DE                                                | Note                                                                                               |
| :------------------------------------------------------ | :------------------------------------------------ | :------------------------------------------------------------------------------------------------- |
| building view                                           | Hausansicht                                       | One of the five inspection views of the workbench (`HausAnsichtId`).                               |
| Exterior / X-Ray / Section / Exploded View / Floor Plan | Außen / Röntgen / Schnitt / Explosion / Geschoss  | The five building views (`aussen`, `roentgen`, `schnitt`, `explosion`, `geschoss`).                |
| control panel / UI controls                             | Bedientafel / Bedienelemente                      | Drafting-inspired interaction components based on Bits UI (`bedienelemente`).                      |
| button / switch / checkbox / slider / tab               | Knopf / Schalter / Häkchen / Regler / Reiter      | The basic control-panel elements (`knopf`, `schalter`, `haken`, `regler`, `reiter`).               |
| tooltip / tag / metric / tiles / timeline               | Hinweis / Marke / Kennzahl / Kacheln / Zeitleiste | Information and control building blocks (`hinweis`, `marke`, `kennzahl`, `kacheln`, `zeitleiste`). |
| hairline                                                | Haarlinie                                         | Fine 1-px leader line for spatial labels and UI frames.                                            |
| ink / paper                                             | Tinte / Papier                                    | The two fundamental poles of the drawing sheet (`--ink`, `--paper`).                               |
| axonometric view / isometric projection                 | Achsensicht / Isometrie                           | Oblique parallel projection of the city scene and volume icons.                                    |
| walkthrough / street-level tour                         | Rundgang                                          | Eye-level camera tour through the simulation (`rundgang`).                                         |
| original adaptation                                     | Eigene Übertragung                                | Original design reinterpretation following documented principles (`uebertragung`).                 |
| raw material / external references                      | Rohmaterial / Fremde Vorbilder                    | Collection groups in the archive (`roh`, `fremd`).                                                 |

---

## 9. Procedural Principles & Standards

| EN                                | DE                             | Note                                                                                          |
| :-------------------------------- | :----------------------------- | :-------------------------------------------------------------------------------------------- |
| intent                            | Absicht                        | Authoritative, pure data input to a generator (`Intent`).                                     |
| derivation                        | Ableitung                      | Deterministic computation path from state to geometry (`Derivation`).                         |
| provenance / origin               | Herkunft                       | Rule path from which a stable ID arises (`origins`).                                          |
| seed                              | Saat                           | Normalized 32-bit start value of the random generator (`seed`); never a continuation state.   |
| random draw / draw sequence       | Zufallszug / Zugfolge          | PRNG call (`sample`) or contractually fixed sequence of draws (PD-6).                         |
| continuation state                | Fortsetzungszustand            | Complete state inventory for resuming a run (PD-8).                                           |
| invariant                         | Invariante                     | Geometric or topological condition that holds after every operation.                          |
| degeneracy                        | Entartung                      | Boundary case such as undersized block or acute angle; handled as a rule branch (`M2`, PN-5). |
| single source of truth / owner    | Faktenhoheit / Owner           | Exactly one document or module owns a fact; all others link (DOC-01).                         |
| frozen evidence                   | Eingefrorene Evidenz           | Historical measurement reports, hashes, and findings that are never rewritten (DOC-60).       |
| author sign-off / author decision | Autorenabnahme / Autorenurteil | Explicit sign-off or decision by David (`D`).                                                 |
| measurement contract / metric     | Messvertrag / Kennzahl         | Binding test conditions (device, seed, budget) and measured value with unit.                  |
