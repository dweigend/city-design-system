# Innovation: AI as a Second Toolbox

As of 2026-11-12. **Thought paper, no implementation and no measurement.** Author: Claude Opus 5.5 as research agent. Basis: Vision, research documents 100, 102, 104–107, 109, and 115, landscape metrics x0/x1 (rounds 1–2), all sidequest documents in this folder, `terrain-ml-lab/reports/RESULTS.md`, and the sidequest thread. Supplemented by a brief web search. What is marked "own idea" is a hypothesis. Calling something uncharted territory here means only: this research did not find it.

## Core Thesis

**A model that paints plausible terrain is no longer uncharted territory.** Talus, Terrain Diffusion, TerraFusion, and sketch-guided networks already do this. What would be new and fitting for this game is AI that proposes **histories instead of states**. It would be guided by **David's taste** and bound by a **hard mathematical framework** so that it can never violate hydrology, existing stock, or determinism. For landscape and city, this paper therefore recommends a division of labor: **AI for the natural and judgment; rules for topology, identity, and the visionary.**

One uncomfortable preliminary note: the failed x1 rounds are first a **procedural problem, not a model problem**. [Génevaux et al. 2013](https://hal.archives-ouvertes.fr/hal-01339224) build terrain from a hierarchical river graph. Drainage is coherent there by construction itself. Astra's rounds, by contrast, layered noise around a river and got sinks up to 6.5 m deep. No diffusion model repairs that ordering on its own.

## 1. State of the Art: Solved and Open

| Field                         | Largely Solved                                                                                                                                                                                                                                                                                               | Gap That Fits Us                                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Plausible heightfields        | [Terrain Diffusion](https://arxiv.org/html/2512.08309v4) (infinite, seed-consistent tiles), [Talus](https://huggingface.co/osfv/talus) (23M), [TerraFusion](https://arxiv.org/html/2505.04050v3) (elevation + texture jointly)                                                                               | 12.5 m scale with urban relevance; forms that fit a _history_ (paleochannel, terraces)                                                        |
| Sketch and river control      | [TDN](https://ojs.aaai.org/index.php/AAAI/article/view/29150), [Earthbender](https://cgvr.cs.uni-bremen.de/papers/mig2025/earthbender-paper.pdf) (multi-channel sketch, ControlNet), [Authoring Terrestrial Planets](https://diglib.eg.org/handle/10.1111/cgf70390) (river network as condition, ~2.4 km/px) | Conditioning on a river network exists. **A hard "never uphill" guarantee on the exported terrain was not found by the search.**              |
| Hydrology first, procedural   | [Génevaux 2013](https://hal.archives-ouvertes.fr/hal-01339224): river graph → catchments → terrain                                                                                                                                                                                                           | Not yet implemented on our side; immediately usable                                                                                           |
| Hard constraints in diffusion | [Projected Diffusion Models, NeurIPS 2024](https://arxiv.org/abs/2402.03559v3): projection in every denoising step                                                                                                                                                                                           | Applied to terrain and runoff: not found                                                                                                      |
| Learned landscape evolution   | [Roberts 2025, neural operators](https://esurf.copernicus.org/articles/13/563/2025/) on synthetic erosion                                                                                                                                                                                                    | Local, event-based operators with existing-stock protection                                                                                   |
| Urban layouts                 | [ControlCity](https://arxiv.org/pdf/2409.17049), [COHO](https://eccv2024.ecva.net/virtual/2024/oral/1610), growth diffusion per [Iyer 2026](https://papers.ssrn.com/abstract=7089538) (preprint)                                                                                                             | All learn **today's car cities**. That is the wrong norm for a street-free future. What is learned is a state, not an adaptive-reuse history. |
| Designer preference in PCG    | [Alvarez & Font 2020](https://arxiv.org/pdf/2003.03268), [Gallotta et al. 2022](https://arxiv.org/pdf/2210.13839) (preference emitters for MAP-Elites)                                                                                                                                                       | Tested at small scale; not found for landscape and city _histories_                                                                           |
| Local learned rules           | [NCA level generators](https://arxiv.org/pdf/2109.05489v2.pdf), [Graph-NCA](https://arxiv.org/abs/2110.14237v1) (arbitrary graphs, e.g., Voronoi)                                                                                                                                                            | Graph-NCA as event operator on a grid-agnostic carrier                                                                                        |
| Inverse procedural modeling   | Estimating parameters from images, e.g., [Garn 2023](https://arxiv.org/pdf/2303.00154) or textures                                                                                                                                                                                                           | **Inverse over driver schedules**, i.e., from the desired city back to the history that produces it: not found                                |

**Uncharted territory that fits this game:**

1. **History as output.** Generative models so far produce states. The game needs event sequences with provenance—that is, a palimpsest.
2. **Hard projection instead of soft penalty.** A model proposes freely, an exact operation makes the proposal valid, and the repair volume becomes the quality metric.
3. **A personal judgment model.** David's judgments become the fitness function. Crowd data would pull toward the average, which contradicts the avant-garde stance.
4. **Inverse evolution as a game mechanic.** The player names a target, and the system shows which driver changes lead there. This is simultaneously an authoring tool and a gameplay element.

## 2. Who Does What: AI and Procedural

| Task                                                     | Carrier                                                            | Why                                                                                                                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| River graph, catchments, IDs, quantity balances          | **procedural**                                                     | Topology and identity must be exact and reproducible. Otherwise a neural net invents identities.                                                          |
| Hydrological validity                                    | **exact projection** (math)                                        | Guaranteed, not learned (see 3.1).                                                                                                                        |
| Slope forms, terrace detail, form variety                | **learned**                                                        | A joint distribution of real forms is hard to write as rules. Here AI is genuinely strong.                                                                |
| Where and when an event happens                          | **learned proposal**, procedural execution                         | Amortized search. The event itself remains a public action.                                                                                               |
| "Looks grown, looks beautiful"                           | **learned from David's judgments**                                 | Cannot be formulated procedurally. That is why only David decides so far.                                                                                 |
| Intent → parameters ("wide floodplain, two tributaries") | **search + learned surrogate**                                     | Replace slider lottery.                                                                                                                                   |
| Avant-garde building forms                               | **procedural** (grammar, carrier × operator × vocabulary from 109) | Learned models pull toward the mean of training data. Unbuilt visions have no dataset.                                                                    |
| Style from David's own artworks                          | **only as features or 2D layer**                                   | Learning geometry from a few images is unsolved. Realistic are ranker features (image embeddings of renderings) and an illustrative representation layer. |
| Real-time in game                                        | **procedural**, AI at most as advisor in a Worker                  | What is saved is the decision, not inference. Replay never calls a network.                                                                               |
| Offline authoring tool                                   | **AI**                                                             | Here it may take minutes and require a rented GPU.                                                                                                        |

**On TerraMind, honestly:** multimodality is a property of the **input contract**, not of this single model. A U-Net with 5–30M parameters and six input channels (coarse elevation, flow forest, floodplain intent, existing-stock mask, edit mask, seed noise) is just as "multimodal". TerraMind's own prior consists of satellite observations of today's Earth. In the lab, a simple numerical baseline reconstructs terrain more accurately, with an MAE of 0.21–0.38 m versus 1.5–2.9 m. **What is valuable is the contract, not the checkpoint.** TerraMind should therefore be only a comparison arm (frozen encoder vs. no encoder) and not the main path unless a test shows otherwise.

## 3. An Architecture That Holds the Hard Principles

```text
Drivers + Existing Stock + Intent
        │
   ① Propose   procedural OR learned (free, may be invalid)
        │
   ② Project   exact, deterministic operation in TS (makes valid, measures repair)
        │
   ③ Verify    L1–L12, EV8 locality, existing-stock mask, balances — on export field
        │
   ④ Record    event + quantized delta (Int32 mm) + model/data hash into log
        │
   three.js only projects
```

| Principle                 | How It Is Kept                                                                                                                                                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Determinism               | Inference only in ①. What is recorded is the quantized result. Replay is `fold(apply, existing₀, log)` without a network (EV1). A network seed does not guarantee bit-exactness across devices. Therefore store, do not recompute. |
| Existing-stock protection | The projection treats protected cells as constants. If no solution exists then, the event is rejected as a conflict rather than silently bent.                                                                                     |
| Never uphill              | Guaranteed by the projection in 3.1. Verification runs on the export field.                                                                                                                                                        |
| Locality                  | Projection acts only within edit mask plus downstream. A Graph-NCA with k steps has a **provable** radius of effect of k neighborhood hops (EV8 by architecture).                                                                  |
| Browser performance       | In-game only ② through ④ run. Those are TypeScript algorithms; their runtime still needs to be measured.                                                                                                                           |

### 3.1 Own Idea: Hydrology as Exact Projection

1. **Fix flow forest:** every cell gets exactly one receiver, and every path ends at a declared outlet. Main rivers and creeks come from the engine's river graph, all remaining cells from a Priority-Flood order on the proposal. Ties are broken by ID. **Priority-Flood supplies only the forest here, not the elevations.**
2. **Compute projection:** sought are elevations h with minimum squared deviation from the proposal subject to `h(cell) ≥ h(receiver) + ε`. This is **isotonic regression on a tree**, solvable exactly in `O(n log n)` ([Pardalos & Xue 1999](https://unpaywall.org/10.1007%2FPL00009258)).
3. **Integer trick:** with `d` = edge count to outlet, set `g = h − ε·d`. Then only `g(cell) ≥ g(receiver)` remains. Rounding is monotonic and preserves this order. So `g` is rounded to millimeters and `h = g + ε·d`. Thus the result remains exact, integer, and deterministic. At 12.5-m cells, `ε = 1 mm` enforces at least `0.08 ‰` slope. That sits within the L8 range for main rivers (`0.05–1 ‰`).
4. **Result:** L1 and L9 hold by construction. L2 also holds because every cell has a lower receiver. Lakes are declared equality regions. **The actual metric is repair volume** (RMS, maximum, affected area). It measures how good a proposal was, whether it came from noise, Talus, TerraMind, or Fable.
5. **What this does not solve:** L3–L8—dominance of the main river, width from discharge, meander proportions, and valley form—remain the generator's job.

**Conflict with the specification:** per 105/L2, Priority-Flood may "check, but not silently repair". The projection would be a **declared generator step with reported repair volume**. That requires explicit sign-off from David or the specification owner.

## 4. Five Directions

### R1 · Spirit Level: Exact Hydrology Projection

- **Idea:** every heightfield, regardless of origin, is made valid by the projection from 3.1. Repair volume is the grade for the proposal.
- **Why new:** existing diffusion work only conditions on rivers. The search did not find the combination of exact tree-isotonic solver, existing-stock constants, and integer export.
- **Benefit:** enables any model to deliver game terrain in the first place. Also immediately benefits the procedural track.
- **Smallest trial (local, 1–2 days, CPU):** project the 12 export fields from x1 round 2 (sinks up to 6.548 m) and the 2 TerraMind tiles. Measure RMS, maximum, area with change > 0.5 m, and runtime at 161². Results go into a before/after plate with profiles.
- **Risk:** visible plateaus and steps; with large sinks, widespread interventions.
- **Discard if** outside declared water bodies more than 2 m or more than 5% of the area must be repaired and David spots the plate as "repaired". Or if the specification owner rejects declared repair in principle.

### R2 · Taste Model from David's Judgments

- **Idea:** David compares pairs of histories (parcel or landscape sequences) on his phone. A small model learns his judgment from them and serves as fitness for a quality-diversity search (MAP-Elites).
- **Why new:** preference emitters exist for levels, but not for adaptive-reuse histories. Moreover, the model does not learn mass taste, but **one** avant-garde signature.
- **Benefit:** the so-far purely human O1 judgment ("looks grown") becomes scalable. Search finds diversity instead of a single optimum.
- **Smallest trial (local, ~3 days plus 2× 30 min for David):** generate 40 histories of a district with the parcel grammar from 115 (E1–E3 are implemented) under 8 driver schedules. They are drawn uniformly: existing stock gray, new in color. David rates 60 pairs plus 15 repeats. First a **Bradley-Terry model on ~10 metrics** (EV6 irregularity, remodel count, A50, CV, commons share, vacancy), not yet a neural net.
- **Risk:** little data, mood swings, Goodhart (search exploits loopholes in the ranker).
- **Discard if** David agrees with himself on repeats less than 75% of the time or the model hits at most 60% on held-out pairs (chance: 50%). If that holds twice with revised metrics, his taste is not learnable with these features. Then David stays in the loop.

### R3 · Inverse Evolution: Intent Instead of Sliders

- **Idea:** a goal like "wide floodplain and two tributaries" or "old-town core with A50 ≈ 570 m², fringe belt on slope, ≥ 3% deconstruction" is translated into **driver schedules or generator parameters**, not pixels. A learned surrogate maps target → distribution over schedules.
- **Why new:** inverse procedural modeling exists for textures and forms; the search found nothing over histories. It is the consistent inversion of "evolution instead of plan": what is planned are the drivers, not the city.
- **Benefit:** starting cities emerge from intent. In the game this becomes a **policy compass**: it shows which driver change moves the city toward a player's goal. That is a mechanic SimCity does not have.
- **Smallest trial (local, CPU, ~1 week):** parcel grammar with 3 target metrics. Random search, CMA-ES, and a small amortized network (MLP trained on ~10,000 simulated pairs of schedule and metrics) are compared at **equal budget of generator calls**.
- **Risk:** the generator cannot reach the target at all (a gap in the generator, not an ML problem), or degenerate histories like "no events" hit the metrics.
- **Discard if** at equal budget the network is not better than CMA-ES, or if more than one third of hits are degenerate per R2 or David.

### R4 · Refiner with Engine Masks (The TerraMind Wish, Implemented Honestly)

- **Idea:** coarse procedural elevation, flow forest, floodplain and terrace intent, existing-stock and edit masks go in. Out come elevation residuals only inside the mask, followed by R1.
- **Why new:** sketch control already exists. New are the urban scale, existing-stock constants, hard projection, and the repair-volume metric. Novelty here is **medium**.
- **Benefit:** valley forms with more diversity than hand-written case rules deliver.
- **Smallest trial (GPU rental ~10–20 h, only after gate):** a conditional U-Net with 5–30M parameters on 128² tiles of real DEMs. Conditions are derived from the target as noisy pseudolabels. One arm uses the frozen TerraMind-tiny encoder, one does not. Baseline is procedural detail plus R1.
- **Risk:** data effort exceeds model effort. Target and condition can leak into each other (see `terrain-forschung-erweitert`, Concept A).
- **Discard if** David does not prefer the result in at least 65% of 20 blind pairs or repair volume is not below baseline. The TerraMind arm is discarded if it fails to beat the arm without encoder.

### R5 · Local Learned Event Operator on the Carrier Graph

- **Idea:** a Graph-NCA learns from a slow teacher (Landlab or own process rule) the local effect of events like flooding, bar migration, or landslide. Its proposals run through ② to ④.
- **Why new:** a Graph-NCA is grid-agnostic and has a provable radius of effect. Thus it fits Vision and EV8 exactly. The search did not find it as an event operator for landscape and city.
- **Benefit:** the same event logic would then also work for processes too expensive or too hard to formulate as rules.
- **Smallest trial (CPU, ~1 week):** a single process on a Voronoi carrier, 200 short sequences. Compare teacher, persistence, and simple smoothing after 10 and 100 steps.
- **Risk:** long-term drift and errors introduced by the teacher. R5 has its greatest payoff only once x2–x5 are in place.
- **Discard if** after 100 steps the model is worse than persistence or mass error exceeds 5%.

|                      | Novelty       | Benefit for Game               | Cost                | Startable                       |
| -------------------- | ------------- | ------------------------------ | ------------------- | ------------------------------- |
| R1 Spirit Level      | medium–high   | prerequisite for everything    | 1–2 days CPU        | **now**                         |
| R2 Taste Model       | high          | O1 scalable, diversity         | ~3 days + 1 h David | **now**                         |
| R3 Inverse Evolution | **very high** | authoring tool + game mechanic | ~1 week CPU         | parcels now, landscape after x1 |
| R4 Refiner           | medium        | form diversity                 | GPU rental          | after x1 and R1                 |
| R5 Graph-NCA         | high          | late event dynamics            | weeks               | after x2–x5                     |

## 5. Recommendation: Ordering and Interplay with Fable

**Fable in parallel, starting now.** R1 and R2 do not need valid terrain. R3 (landscape), R4, and R5, by contrast, need a passing x1 generator as baseline and data source. Sequencing Fable later would block the AI track. Sequencing Fable earlier would make R1 arrive too late, even though it can directly help Fable.

**What Fable's loose brief should contain** (offers, not mandates):

1. **River graph first, terrain by construction** ([Génevaux 2013](https://hal.archives-ouvertes.fr/hal-01339224)) instead of noise around a river.
2. **The projection from R1** as an allowed, declared step, provided David or the specification owner approves it. Its repair volume must appear in the report.
3. **A shared export contract** with elevations in Int32 mm, flow forest, masks, event log, and hashes. Both tracks benefit from this.
4. New unseen seeds, no calibration on 1/19/45, 73/101/137, and 211/307/419.

**Sequence:**

| When      | Procedural Track                                 | AI Track                                                                                           |
| --------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Week 1    | Fable: x1 fresh, loose                           | R1 on the x1 fields from round 2 and the TerraMind tiles. R2 data collection with parcel histories |
| Gate A    | x1 passed, David's verdict "looks real"          | R1 repair volume acceptable; R2 ranker ≥ 65%                                                       |
| Weeks 2–3 | x2–x3 (water bodies as events, terrain coupling) | R3 on parcels, then on landscape parameters                                                        |
| Gate B    | —                                                | Does procedural plus R1 yield too little form diversity? **Only then** GPU rental for R4           |
| later     | x4–x5                                            | R5                                                                                                 |

**What should be paused now:** further pursuing fine-tuning or TerraMind's tokenizer path, and any GPU rental before Gate B. The Lab remains a learning environment and testbed for R1.

**One sentence for the outlook:** the strongest combination is **Fable's generator, bound by the spirit level, steered by David's taste model, and operable in reverse via driver schedules**. That would create a toolbox that does not yet exist, without a single neural net ruling the game.

---

Executed: reading the named documents and the sidequest thread, nine brief web searches. Abstracts and summaries were inspected, no full texts. No code, no model execution, no measurement. Runtime and quality statements are hypotheses.
