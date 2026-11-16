# Terrain: Executable Pilot Plan

As of 2026-11-12. **Proposal, no implementation and no author sign-off.** Network parameters, MACs, and grid sizes are recounted; five small contract examples were executed with Bun 1.4.2. No training, ONNX export, or M1 browser benchmark was run. Synthesis: GPT-6 Astra; sub-research: twice GPT-6.1 Sol for HF/network, once Sol for browser/costs, Gemini 3.8 Flash for hydrology. Independent final critique by a separate Gemini 3.8 Flash agent: first draft rejected; findings and corrections appear at the end. Independent re-verification by another Gemini 3.8 Flash agent completed: no new blockers, Phase 1 (B0/T) startable as a plan; ML and GPU costs remain bound to the open gates. Both reviewers ran the contract examples themselves with Bun.

## Decision

**Build a valid base surface and deterministic form filter directly in TypeScript first and measure in the browser. Train ML only if this direct path misses the time budget, form quality convinces, and a CNN smoke test predicts a measurable speed advantage.** Starting network: 15,681 parameters, one pass, 1.594 billion conv MACs for the entire 16-m stage. Its job is narrow: approximate the slope form of the same deterministic teacher if computing it proves too expensive. The proposed 128-step filter may already be cheap enough; then ML drops out completely. It does not determine river course, floodplain, terrace position, tributaries, or outlets. A neural network is not deployed as a repair for the rejected base landscapes in [Research 107](../../research/107-landschaft-stadt-evolution.md).

The fallback plan is the same verified base surface without ML, with deterministic cross-sections and at most representational detail. If even this base surface fails hydrology, **no** variant is approved. Talus serves at most later as an offline shape comparison; no existing HF checkpoint qualifies here as a ready-made hydrological browser generator. Four NFEs, U-Net, and CFG are omitted from this first phase.

**Budget:** warm end-to-end p95 ≤10 s on Apple M1 base, 8 GB unified memory, in browser. This is a new load/generation budget for 4.096 km, **not a replacement** for the 50 ms landscape requirement on 2 km / 12.5 m in [105, Z1](../../research/105-kriterien-landschaft-stadt.md) or the interactive budgets from [100](../../research/100-zielkriterien-kern.md). Offline Python is for training/export only; the game generator stays TypeScript with ONNX Runtime Web. CPU/GPU bit-exactness of neural inference is not promised; accepted elevations are saved for replay.

## 1. Scale and Concrete Data Contracts

| Stage             | Carrier and World Size                              | Role / Explicit Limit                                                                                                        |
| ----------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Region            | 256² **cell centers**, 8,192 m × 8,192 m, 32 m/cell | Coarse relief, watersheds, external catchment; rivers additionally as vector graph. No hydrological proof for narrow creeks. |
| Play area         | central 4,096 m × 4,096 m, 256² centers, 16 m/cell  | Network input and residual. The matching regional crop contains only 128² cells; upscaling creates no new measurement data.  |
| Final terrain     | 1,024² cells, **1,025² vertices**, 4 m spacing      | Canonical quantized elevation, collision surface, hydrology, and mesh. 1,024 vertices would span only 4,092 m.               |
| Comparison window | central 2 km window, 1 km evaluation inside         | Check existing L1–L11 from 105 here; additionally report global errors across the full 4.096 km area.                        |

Coordinates: `x` east, `y` north, `z` up; meters/radians. Cell center `origin + (i+0.5)*spacing`; vertices `origin + i*4`. Every final cell has the fixed diagonal NW→SE. Elevation queries evaluate barycentrically on these triangles. Final runoff uses **the same six mesh neighbors**, not the two extra D8 diagonals. This is a proposed discrete drainage contract, not a full shallow-water simulation.

**Graph before raster:** stable node/edge IDs; directed acyclic graph with one sink per connected component. Edge holds polyline in meters, arc length, bed profile, water profile, drainage area `areaM2`, full bed width `widthM`, bank/floodplain intervals, and terrace elevation. Confluences share bed and water level. Main river explicitly receives `externalAreaM2`; local raster does not replace a large catchment. Pilot anchor `Aref=60e9 m²`, `wref=220 m`, `w=wref*sqrt(A/Aref)`; this is a **design assumption** following hydraulic geometry, not a universal empirical width formula. Discharge Q would be determined separately in m³/s from effective precipitation in m/s; do not equate area and Q. Scientific link: [Leopold & Maddock](https://pubs.usgs.gov/pp/0252/report.pdf), implementation idea [Génevaux et al.](https://doi.org/10.1145/2461912.2461996).

One single width contract governs bed, water, floodplain, and their checks. Bed width is full width; floodplain width is the **sum of both flat, dry normal-profile intervals excluding bed and embankments**. This conservative clarification of L7 prevents a wide deep bed from counting as flat floodplain. For `w=220 m`: ≥330 m flat floodplain per side, cross slope <1%, terrace 3–15 m above. At bends/confluences, evaluate only unambiguously assignable normal profiles and report their coverage; missing profiles are not a pass. Main river slope 0.05–1 ‰, tributaries 0.3–5%, width ratio ≥5, at most six open tributaries in the 2 km window; these bounds come from [105, L1–L9](../../research/105-kriterien-landschaft-stadt.md), not from a trained model.

### Network Input: Exactly Twelve Channels

Shared elevation anchor `zRef` is the declared main outlet; **no per-map or per-tile min/max normalization**. All fields arise from base/graph, never from target terrain. Regions provide the outer halo. Non-finite values, undeclared outlets, and elevations outside the pilot range are rejected before inference.

| Channel | Input Before Normalization                                 | Unit → Network Range                                               |
| ------- | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| 0       | `baseHeight-zRef`                                          | m /128; pilot range −128…128 m, otherwise OOD                      |
| 1, 2    | central derivatives of base along x/y                      | m/m; clip to ±0.5, then /0.5                                       |
| 3       | signed distance to nearest graph edge                      | m; clip ±1,024, then /1,024                                        |
| 4       | accumulated area of base receiver incl. external catchment | m²; `log1p(A)/log1p(1e11)`, clip [0,1]                             |
| 5, 6    | direction to base receiver                                 | normalized x/y vector; outlet (0,0)                                |
| 7       | bed reference of assigned graph edge minus zRef            | m /128; base value if no edge assigned                             |
| 8       | full bed width of assigned edge                            | m /256; clip [0,1]; over-width flagged OOD                         |
| 9       | editable mask M                                            | [0,1], see below                                                   |
| 10      | regional relief at world point minus zRef                  | m /128; same anchor                                                |
| 11      | deterministic initial detail of teacher                    | [−1,1], hash of seed and 256 m world grid, bilinearly interpolated |
| Output  | linear residual channel r                                  | dimensionless; externally `8m * clip(r,−1,1)`                      |

`M` is **zero in bed, bank, entire floodplain, lakes, and protected connections**, rising outside over 128 m via smoothstep to one. Unlike the early hydrology draft, there is no blanket "sink-free" ±10 cm in the floodplain. Zero masks protect only their zone. For all other cells, the final check remains mandatory.

**Reconstruction:** evaluate analytical base directly at the 4 m vertex; upscale only the 16 m residual bilinearly and recompute the protection mask at the vertex: `z = base4m + M4m * bilinear(delta16m)`. No bicubic overshoot and no post-hoc elevation noise. At the outer border, `M` is zero in the 128 m strip; the residual may be clamped-extended there. Neighboring maps require identical region/graph data. Fine river cross-sections come from vector geometry, **not from learned 4 m super-resolution**. The neural RF sees at most 480 m between outermost centers; kilometer-scale meanders must already be right.

## 2. Network, Halo, Export, and Recounted Budget

NCHW `[1,12,160,160]` float32; all convs with bias, `stride=1`, `groups=1`. Stem `Conv3×3(12,W,pad1)→ReLU`. For `d` in `[1,2,4]`: `x←ReLU(x + Conv3×3(W,W,pad=d,dilation=d)(ReLU(Conv3×3(W,W,pad=d,dilation=d)(x))))`. Head `Conv1×1(W,1)` linear. No normalization, attention, pooling, or resize in the model. Crop `[16:144,16:144]` outside the graph, clamp, and assemble.

| Variant                      | Parameters incl. Bias | FP32 Weights | Conv MACs/Tile | Conv MACs/4 Tiles |
| ---------------------------- | --------------------: | -----------: | -------------: | ----------------: |
| A, W=16, start               |                15,681 |     62,724 B |    398,540,800 |     1,594,163,200 |
| B, W=24, only on quality gap |                33,889 |    135,556 B |    863,232,000 |     3,452,928,000 |

Reproducible calculation: `P=9*12*W+54*W²+8*W+1`; `MAC=160²*(9*12*W+54*W²+W)`. A: stem 1,744 parameters, six inner convs 2,320 each, head 17. One MAC is a multiply-accumulate, not a FLOP. Per tile, A adds 2,892,800 bias additions, 1,228,800 skip additions, and 2,867,200 ReLU evaluations. This was recounted with stdlib Python; no FLOP→seconds inference.

Radius `1+2*(1+2+4)=15`, RF31; **Halo 16 suffices for exactly one pass**. Four 160² inputs for a 256² core area mean 56.25% halo overhead. Global field values and normalization are identical across all tiles. Reference test: full field versus four tiles and tile origins shifted by eight cells; max elevation error ≤1 mm before quantization, no extra hydrology failures. Blending is not planned. Across four sequentially fed-back network steps, radius would grow up to 60; Halo 16 would no longer cover it. A CNN on 1,024² detail cells would need 64 such tiles and 25.507 G-MAC at A, not four.

**Export contract:** ONNX ai.onnx opset 17, IR 8, static shapes; exactly 8 Conv, 3 Add, 7 Relu. Export either explicitly from weights with `onnx.helper` or PyTorch followed by verification of this operator inventory. `onnx.checker`, shape inference, and CPU reference comparison are mandatory; 100 stored inputs, error physically in meters, no NaNs, re-check all hydro-relevant decisions on exported terrain. FP32 first; FP16 is not a necessary weight optimization for 61.25 KiB. [ONNX Conv](https://onnx.ai/onnx/operators/onnx__Conv.html#conv-11) describes dilation/padding; Microsoft lists operator families in the [WebGPU catalog](https://github.com/microsoft/onnxruntime/blob/main/js/web/docs/webgpu-operators.md). The concrete ORT version/route and `d=4` must still run for real.

One tile concurrently: input 1,228,800 B, one W16 feature field 1,638,400 B, output 102,400 B. Logical liveness with three feature fields and weights: 6,309,124 B; all graph tensors without reuse: 29,246,724 B. **Neither is an ORT peak.** Arena, packing, workspace, copies, and browser are excluded. Final elevation Int32 mm needs 4,202,500 B; 12 full 256² input channels FP32 need 3,145,728 B. Target limits: additional ML allocation ≤128 MiB, entire additional terrain pipeline ≤256 MiB in known CPU/GPU buffers; process memory separate. Maximum graph segments for the pilot 1,024; distance/profile queries via spatial index, no vertex-against-all-edges segment test.

## 3. What Is Actually Usable from Hugging Face

Public API/card/file checks succeeded, although HF CLI and connected search tools were unavailable. No large weights downloaded. The following revisions are researched pins, not locally executed models.

| Repo / Pinned Revision                                                                                                                                                                                                                               | Real Artifacts, Rights, Data                                                                                                                                                                                                                                     | Decision                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| [osfv/talus](https://huggingface.co/osfv/talus/tree/7a1331046c99010296feb8907de8776a9886a2d3), `7a1331046c99010296feb8907de8776a9886a2d3`                                                                                                            | 23M per author; `talus-3.pt`, `talus-3.1.pt`; `onnx/talus-3.fp16.onnx` 46,752,215 B, `onnx/talus-3.onnx` 92,981,245 B. Code and weights explicitly Apache-2.0. 64² at 4,096 m, 64 m/cell, 1,200 m elevation scale; 45,000 own procedural training maps per card. | Only prioritized **offline comparison**; no hydro-labeled training data published. No matching 16 m residual pretraining. |
| [nlightcho/ddpm-ema-heightmap-512-10m](https://huggingface.co/nlightcho/ddpm-ema-heightmap-512-10m/tree/04dc097acb22a056519168fb59a6d889b9ce757e), `04dc097acb22a056519168fb59a6d889b9ce757e`                                                        | `unet/diffusion_pytorch_model.bin` 43.94 MB; 512², 1→1, channels 32/64/64/64/128/256. CC-BY-NC-4.0. Provenance, metric normalization, and hydro missing; parameters not recounted.                                                                               | Not a product pilot; "10m" in the name is not a data contract.                                                            |
| [Millennium-Nova/terrafusion-heightmap-vae](https://huggingface.co/Millennium-Nova/terrafusion-heightmap-vae/tree/baac424c79b40f914152779c4d0acf0f9a124a4d), `baac424c79b40f914152779c4d0acf0f9a124a4d`                                              | `diffusion_pytorch_model.safetensors` 334.62 MB, 83,649,253 parameters from metadata; 512², 4 latent channels. CC-BY-NC-4.0; training/elevation contract missing.                                                                                                | VAE alone not a generator; exclude.                                                                                       |
| [fgheorghe/terrain-generator](https://huggingface.co/fgheorghe/terrain-generator/tree/776181abddd469b950e8cc5c0e9d9469f80693e4), `776181abddd469b950e8cc5c0e9d9469f80693e4`                                                                          | `unet/diffusion_pytorch_model.bin` 454.87 MB; 256², 3→3 channels. BSD-3-Clause-Clear per card metadata. Training repo processes USGS JPGs; metric back-calculation/data rights not fully documented.                                                             | Large unconditional image model, no ONNX/hydro contract.                                                                  |
| [xandergos/TerrainDiffusion-Diffusion-Coarse-128A](https://huggingface.co/xandergos/TerrainDiffusion-Diffusion-Coarse-128A/tree/2bfdd4b7efc33201a7b7b6d4627573a86403adb9), `2bfdd4b7efc33201a7b7b6d4627573a86403adb9`                                | 2,798,912 parameters, 11.20 MB, MIT. Coarse elevation/climate stage only; full 30 m pipeline with additional weights approx. 1.138 GB FP32.                                                                                                                      | Small intermediate building block, not a small complete replacement.                                                      |
| [silviaarellano/heightmaps](https://huggingface.co/datasets/silviaarellano/heightmaps/tree/c9edfe05a41811021c11f67c368f96b8a21a063c), `c9edfe05a41811021c11f67c368f96b8a21a063c`                                                                     | 652 PNGs, 1.525 GB; inspected PNG header 1081²/16-bit gray. MIT metadata, but provenance/georeferencing/elevation scale missing.                                                                                                                                 | No metric training contract, no hydro labels.                                                                             |
| [SmonkingSheep/Erosion_heightmaps](https://huggingface.co/datasets/SmonkingSheep/Erosion_heightmaps/tree/049a47aba71a3f404d3d574b9b0d68810e540c53), `049a47aba71a3f404d3d574b9b0d68810e540c53`                                                       | Only `README.md`, `.gitattributes`; CC-BY-NC-SA-4.0.                                                                                                                                                                                                             | No data present.                                                                                                          |
| [novaia/world-heightmaps-256px](https://huggingface.co/datasets/novaia/world-heightmaps-256px/tree/dab53d058515eab5a07e63db45aea6a18b55f4f9), `dab53d058515eab5a07e63db45aea6a18b55f4f9`                                                             | 58 Parquet shards, 13.411 GB; 573,995 samples per card. `heightmap,latitude,longitude`, Apache-2.0 metadata, source SRTM. Generated with `plt.imsave` without preserved elevation calibration.                                                                   | Form reference conceivable; no reconstructible metric elevations or hydro labels. Check data source rights separately.    |
| [scholarly360/terrain_generation_from_sketch_for_game_assets](https://huggingface.co/datasets/scholarly360/terrain_generation_from_sketch_for_game_assets/tree/e1bd1ca92779c1501c2eccc39082aeaf7346dfc7), `e1bd1ca92779c1501c2eccc39082aeaf7346dfc7` | `train.parquet` 1.101 GB, `test.parquet` 209.92 MB; `sketch,org`, sample 400². Original sample is an RGB terrain photo with shadows, not a documented DEM. Apache-2.0 metadata.                                                                                  | Exclude for sketch→metric terrain.                                                                                        |

Talus download contract for a later comparison: `onnx/talus-3.fp16.onnx` SHA256 `9d6a60ccf47917327bf9aa67245ca0f2e183dfca04ada4bbb6fc251a6cb6fa13`, plus `onnx/talus-3.json` and `onnx/talus-3.prior.bin` from the same HF revision. The [sampler metadata](https://huggingface.co/osfv/talus/blob/7a1331046c99010296feb8907de8776a9886a2d3/onnx/talus-3.json) lists 50 DDIM steps, Guidance 2, eta 0; no clearance for the browser budget. Talus 3.1 has no ONNX of its own there. [Code pin `c4581e1ddf39941bbea246a8f720d67202f8358c`](https://github.com/osfv/talus/tree/c4581e1ddf39941bbea246a8f720d67202f8358c) now offers inpainting, `--preserve-mask`, `--layout`, and neighbor tiles: **sampler hard constraints**, not learned hydrology semantics. That corrects the blanket restriction of earlier sidequest texts. EMA weights allow initialization, not full training resume without optimizer state. A code license replaces neither data provenance nor a missing binary data license.

## 4. Teacher, Training, and at Most Two Variants

**Train no weights before the base passes L1–L9 on all development scenes and the randomly initialized export executes in the target browser.** The teacher must deliver a visible improvement over the cheap base; otherwise the network unnecessarily learns a cheap rule. That Research 107 has not yet delivered this base surface is the main starting gap.

**Directly executable comparison T, not yet proven a slow teacher:** at 16 m first `h=base+0.25m*M*detail`, where `detail` comes from the 256 m world grid specified above. The earlier 8 m cell-noise initialization is dropped: it can blow through the projection bound before useful form emergence. First project once, then 128 Jacobi steps of slope diffusion on the fixed mesh neighbor graph: `h'=h+0.15*M*(mean(neighborHeights)-h)`. Protected points stay strictly base. Use outer halo and fixed region boundary values; T runs on the entire 8,192 m region at 16 m, i.e., 512² centers, with fixed boundary values; the central 256² field and its 16-cell halo are cropped out. Four training tiles are crops of **one** solution, never separate teacher runs. CNN radius 15 only approximates this potentially nonlocal process; validation must show whether the twelve context channels suffice for it.

Project before the first and after every subsequent step in **outlet→source order** on the previously verified base receiver tree: first clamp every proposal to `[base-8m*M,base+8m*M]`; free point `h[v]=max(h'[v],h[receiver]+dropMin[v])`, `dropMin=min(max(baseDrop,0),0.001m)`. Base flats use their outlet-directed rank without an artificial minimum slope. If projection exceeds the upper bound or a protected edge violates the contract, reject the episode. This masked bound is necessary so the target remains representable by `8m*M*clip(r)` at all. The base receiver tree for the teacher must be descending/flat on the base without artificial lifting; a base with diagnostically permitted micro-sinks can pass B0, but is **not a suitable teacher input**.

Log projection volume and maximum cumulative lift per vertex **including initial projection**. >5% rejected development regions or >0.5 m cumulative projection on >5% of free area in a region → discard T, zero training costs. No exception for initialization merely to game the gate. The new bounded, correlated excitation has not yet been tested on the real generator. The filter is not a physical erosion simulation and not automatically nicer than B0.

**Cost-effectiveness gate before dataset production:** measure T and B0 on the same 60 development cases in the real M1 browser with full reconstruction/hydrology. If T fits warm within 10 s and its form is preferred, deploy T directly and end this ML effort. If T lacks quality gain, stop as well. Only if T misses the total budget and measured filter time is the bottleneck, deploy the randomly initialized CNN path as a cost probe. Condition: CNN kernel time including packing/readback ≤50% of T filter time and total forecast ≤10 s. Re-measure later for trained weights. Do not artificially bloat T to 10,000 iterations to justify ML.

The teacher sees the same twelve inputs, in particular the initial detail. No hidden randomness in the target, otherwise L1 averages away incompatible forms. Terrain classes: asymmetric river valley, terrace with tributary, confluence; each class with both flat and steep hinterland. Protected paleochannel possible as declared existing stock; no claim of simulated genesis. Coast, delta, true endorheic lakes, and elevation spans >256 m are initially OOD and rejected.

**Data:** 12,000 whole regions, split 9,600 train / 1,200 validation / 1,200 blind test by region ID before tile generation. Additionally 200 unseen OOD regions (very tight confluence, boundary meander, nearly flat hinterland), whose families are completely absent from train/val. Variants of the same graph and neighboring crops stay in the same split. Seeds come from separate namespaces `train/val/blind/ood` with hash version in the manifest; training seed `20261112`. Hash blind manifest before training and open only after selection. Seeds already seen in 107 are not blind tests.

File format: JSONL manifest with `regionId,split,seed,graphVersion,teacherVersion,originM,spacingM,zRefM,normalizationVersion,sha256`; binary little-endian `input.f32` `[12,288,288]` with true 16-cell outer halo, `targetDelta.f32` `[1,256,256]`, `baseHeight.f32`, `receiver.i32`, `protected.u8`, graph JSON, and declared outlets/lakes. Four 160² training patches per region, central 128² loss region. M is input channel 9; target is the already masked delta. For the 4 m teacher check, form `rawDelta=targetDelta/M` where `M>0`, else `0`; then use the same reconstruction path as in the browser. Do not multiply an already masked delta by M a second time. Thanks to the `8m·M` bound, `rawDelta` stays bounded. Lossless compression optional, no PNG min-max images. Before GPU start, check file sizes/hashes, finite values, normalization inversion, and final 4 m hydrology of all target regions. If this fails, do not filter silently: report rejection rate per class and apply the teacher gate.

Loss on the core; elevation error on free points, gradient terms including mask transitions, using means instead of resolution-dependent sums:

- `Lheight = mean(abs((zPred-zTeacher)/8m))`.
- `Lslope = mean(abs(∇zPred-∇zTeacher)/0.1)`; derivatives with actual 16 m spacing.
- `Lroute = mean(relu((zPred[receiver]-zPred[v]+dropMin[v])/1m)^2)` on the **fixed** base receiver tree, no differentiated D8 recomputation.
- `Lprotected = mean((1-M)*r²)` on all core points stabilizes unobserved raw residuals; this is not a hydrology guarantee.
- `L = Lheight + 0.25*Lslope + 2*Lroute + 0.001*Lprotected`; `zPred=base+8m*M*clip(r,−1,1)`. No local-minimum loss as a substitute for global sink checking. Initialize head to zero initially so starting output is base.

**Run recipe:** PyTorch, AdamW, LR 0.001, betas `(0.9, 0.999)`, `weight_decay` 0.0001, `gradient_clip` 1; 500 steps linear warmup, then cosine down to 0.00001. Batch 16 individual 160² patches; on OOM, batch 8×2 accumulation so effective batch remains 16. Max 30,000 updates for A. B with W24 only if A underfits teacher while hydrology and runtime have sufficient headroom; same split/loss/seed, max 30,000 updates. No third network, no hyperparameter sweep, no CFG, no diffusion distillation. FP32 first; training AMP only after numerical comparison, no parallel model trial.

Every 100 updates: training loss, throughput, VRAM; every 1,000: full val loss, elevation MAE/p95 in m, slope error, clipping fraction, and 200 fixed full 4 m exports with L1–L9. Every 5,000: entire val set; checkpoint selection only under hard hydro conditions, then lowest val elevation error. Save learning curves as CSV and plot of step as well as GPU time against train/val components, hydro rejection rate, and clipping. Stop after 5,000 updates if no ≥10% advantage in free elevation MAE over `delta=0` and no downward val trend; also stop after three val points without improvement. These bounds are pilot decisions, not known learning curves.

**Cost cap 50 USD, plan only:** re-check current [Runpod prices](https://www.runpod.io/pricing) before booking; maximum approved all-in GPU rate for this calculation 1 USD/h. 42 USD compute + 5 USD storage + 3 USD reserve. Compute: at most 2 h environment/export/pilot, 20 h A, 20 h B; unused time is not spent on extra variants. After 200 warmup and 1,000 measurement updates, compute `projectedHours=remainingSteps*medianStepSeconds/3600 + evalHours`. If a run does not fit in its 20 h share or total cost projection does not stay under 50 USD: stop and report, do not automatically pick a pricier GPU. Data prep before rental start; export checkpoints and terminate instance/volumes at the end. No cloud job was created.

## 5. Final Hydrology, Baselines, and Acceptance

Quantize elevations to 1 mm before domain decisions; keep reference elevation separately so FP32 does not have to carry large absolute elevations. Save accepted Int32 elevations, graph, seed, model hash, normalization/backend version, and validator version. Restoration reads this grid and runs no inference. Quantization alone does **not** guarantee identical results on different GPUs; [PyTorch](https://docs.pytorch.org/docs/stable/notes/randomness.html) also limits its reproducibility.

Validator on the final quantized mesh, after reconstruction and before publication:

1. Check river centerline at triangle crossings and with at most 2 m sample spacing on export elevation: no rise >1 cm; additionally slope bands over 100 m main river and 20 m tributary. Water surface and bed separately; lake/sea water is not terrain elevation.
2. Priority-Flood as a **diagnostic copy**, only declared boundary sites as outlets. Sink depth = filled minus exported elevation; threshold from 105: every sink ≥0.5 m needs a declared lake with area, water level, and outlet. No covert tightening to 1 mm, no silent repair. [Barnes et al.](https://arxiv.org/abs/1511.04463) provides the algorithm reference.
3. L9 as **catchment/storage contract**: every cell receives exactly one declared terminal outlet and an acyclic receiver on the Priority-Flood diagnostic field. Micro-sinks <0.5 m may be virtually filled up to overflow for this; original elevations stay unchanged, storage depth/volume are tracked explicitly. This denotes runoff **after filling**, not a downhill dry path through a sink. Visible water bodies must not adopt these virtual rises: L1 on the exported terrain still applies to them. Break flats with outlet distance/ID tiebreak. Larger sinks require declared lakes; lake surface and underwater bed remain separate. Phase 1 rejects true lakes/OOD. This clarification of 105-L9 is a contract proposal, not an already accepted relaxation.
4. Check widths, true normal profiles, drainage areas, tributary count/connection, and regionally measured meander proportions. Do not generate water class from every accumulation gully; 0.5 km² creek threshold is an assumption from 105 to be tested. Do not adopt an untested universal `A*S²` law.
5. On error, exactly **one** fallback to already verified base; no re-sampling and no adaptive repair loop. If base also fails or acceptance limit is exceeded: error result instead of faulty map. Fallback rate and both check times count toward E2E.

Compare on identical graphs and seeds: B0 verified base; B1 same cheap seed-detail path without teacher diffusion; T direct form filter / conditional teacher; A, optionally B. B1 is subject to the same checks and may fail. First 60 paired, blinded layouts (20 per class) with complete plates of hillshade, contours, main/secondary water, catchments, normal and longitudinal profiles. Author scores pairwise without method labels. Advantage only if ≥40/60 ML outputs are preferred over B0 **and** no hard rule worsens; ties count as no win. In addition, CNN core including packing/readback ≥2× faster than T filter on the same device; full ML chain ≤10 s and faster than full T chain. Do not hide shared base/check costs. If T itself passes ≤10 s, the direct TS path takes precedence and no training occurs. Model failure/fallback on >5% of the 1,200 blind regions → discard ML. All published maps must pass hard checks; a silent fallback is not an ML success. 0 observed errors is only sample evidence.

## 6. Browser Measurement on M1: Export First, Then Training

Available here: Linux x86_64 on measurement host, Bun 1.4.2, Python; `torch`, `onnx`, `numpy` missing in active Python. Playwright MCP is discoverable. **No M1 run was executed; an accessible M1 device is not verified.** No installation in the project. A Linux or native MPS result would not substitute as evidence. The steps below are a measurement brief, not a measurement claim.

Starting pin `onnxruntime-web@1.31.1`, FP32, static export. Record package integrity, JS/WASM SHA, and model hash in the measurement manifest. Default import with explicit WebGPU EP as JSEP measurement route; do not swap the `/webgpu` route unchecked: Microsoft currently documents a [migration with differing operator/profiling coverage](https://github.com/microsoft/onnxruntime/blob/main/docs/design/onnxruntime_web_jsep_to_webgpu_ep_migration.md). Confirm pin/route mapping before smoke test against the actually installed package. No silent WASM fallback counted as "WebGPU passed".

Measurement harness outside the product, HTTPS or localhost, dedicated Worker with ONNX directly inside; no WebGPU proxy-worker assumption. One persistently loaded model, four tiles sequentially; no inference per render frame. Read back GPU output completely before validation starts. [ORT WebGPU guide](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html) explains GPU buffers and readback. Diagnose with operator profiling in a separate run; for E2E turn profiling off, timer around the entire job. [ORT diagnostics](https://onnxruntime.ai/docs/tutorials/web/performance-diagnosis.html) separates CPU and GPU times; do not invent missing GPU timestamps.

1. **Fix device:** MacBook Air/Pro M1 base, 8 GB; document actual GPU core count, macOS/Chrome version, AC power, low-power mode, thermal/throttling state. Check `navigator.gpu`, adapter info/features, and hardware adapter. Actually open Secure Context and WebGPU session. Safari optional separately, not a replacement for the named Chrome sign-off.
2. **Numerics before timing:** randomly initialized network plus 100 frozen inputs against CPU ONNX, NaN/halo/`d=4` test. Check trained model the same way later. Hash parity of saved restoration separate from float comparison. Do not report a performance profile with all-zero weights as final training performance.
3. **Warm:** session/shaders ready, five full warmups; then 100 pre-fixed distinct seeds, unchanged session. Start `performance.now()` before graph/base/input build, end after readback, reconstruction, quantization, global hydrology, any fallback, and upload/first rendered result. Record CPU Worker end and visible result separately. `p95=sortedSample[index94]`, median in addition; do not strip outliers.
4. **Cold:** 30 fresh browser processes/profiles, no HTTP/shader/model caches; fixed local serving or explicit 100 Mbit/s / 20 ms network profile. Measure navigation to first accepted visible terrain, `p95=index28`. Download, session creation, shader/first inference, and total duration separately. Proposed target cold p95 ≤20 s; warm target ≤10 s is the core requirement. Explicitly label cold-cache runs with warm OS cache as such.
5. **Scene/Load:** two series, empty preview and fixed three.js scene at 1280×800, DPR 1, fixed camera path, and fixed data hash; for the mandatory series, 100,000 simple instances plus terrain are built as reproducible load. Report idle frame time before inference. If the scene alone exceeds budget, do not blame interference on the CNN. After series start, 15 min continuous run for thermal counter-probe; no picking the faster series. Fallback measurement without WebGPU separately.
6. **Memory/Interaction:** document `byteLength`/GPU buffer accounting, DevTools/OS process peaks, and memory pressure; do not double-count GPU/unified memory. JS heap alone does not suffice. Count watchdog/device loss, swap growth, and long main-thread tasks. Long Task API starts at 50 ms and therefore cannot prove a 4 ms limit; use dedicated task/frame traces for 100-Z8.

Proposed sub-time allocation within the 10 s budget: graph/base/input 1.5 s, four inferences + readback 2.5 s, reconstruction 1.5 s, hydrology 3 s, upload/reserve 1.5 s. These are **not measured times**; do not sum sub-p95s into a final p95. If even the random network + full base/check exceeds the warm budget, do not start training. Options within the existing design: real bottleneck measurement first, buffer reuse, and spatial index; no additional network family. No adapter, device loss, ML >128 MiB, pipeline >256 MiB known buffers, or warm p95 >10 s after one bounded optimization step → stop ML path; measure base separately.

## 7. Five Executable Contract Examples

The block below runs standalone with Bun, with no product imports. It was executed here; it is a **small check-oracle draft**, not a finished generator and not an integration-test sign-off. The quadratic queue sort is for 25 points only, explicitly not the 1,025² production algorithm. The examples cover positive and negative expectations. Before a public implementation contract, these examples must be accepted by the domain owner and executed against the real pipeline.

```ts
import assert from 'node:assert/strict';
// Small independent check oracle: production solver and network are intentionally absent.
const width = (a: number) => 220 * Math.sqrt(a / 60e9);
const downhill = (z: number[]) => z.slice(1).every((v, i) => v - z[i] <= 0.01);
const flatWidth = (runs: [number, number, number][]) =>
	runs.filter(([, , slope]) => Math.abs(slope) < 0.01).reduce((n, [a, b]) => n + b - a, 0);
function flood(z: number[], n: number, outlets: number[]) {
	const h = z.slice(),
		parent = new Int32Array(z.length).fill(-1),
		seen = new Set(outlets);
	const q = outlets.map((i) => [h[i], i]);
	while (q.length) {
		q.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
		const [level, i] = q.shift()!;
		const x = i % n,
			y = Math.floor(i / n);
		// Mesh: every quad diagonal from NW to SE; no phantom D8 edges.
		for (const [dx, dy] of [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1],
			[1, -1],
			[-1, 1]
		]) {
			const xx = x + dx,
				yy = y + dy,
				j = yy * n + xx;
			if (xx < 0 || yy < 0 || xx >= n || yy >= n || seen.has(j)) continue;
			seen.add(j);
			parent[j] = i;
			h[j] = Math.max(z[j], level);
			q.push([h[j], j]);
		}
	}
	return { h, parent, depth: Math.max(...h.map((v, i) => v - z[i])) };
}
// 1: External catchment, scale, positive and negative river probe.
assert.equal(width(60e9), 220);
assert(width(60e9 + 16e6) > 220);
assert(downhill([45, 44.825, 44.58]));
assert(!downhill([45, 45.02, 44.58]));
assert(Math.abs((45 - 44.825) / 500 - 0.00035) < 1e-12);
// 2: Two separate floodplain intervals; bed does NOT count as flat floodplain.
assert.equal(
	flatWidth([
		[-440, -110, 0.003],
		[110, 440, 0.003]
	]),
	660
);
assert(
	flatWidth([
		[-440, -110, 0.003],
		[110, 440, 0.003]
	]) >=
		3 * 220
);
assert(
	flatWidth([
		[-439, -110, 0.003],
		[110, 440, 0.003]
	]) <
		3 * 220
);
assert.equal(
	flatWidth([
		[-440, -110, 0.012],
		[110, 440, 0.003]
	]),
	330
);
// 3: Protected bed does not prove sink-freedom next door.
const base = Array(25).fill(10),
	mask = Array(25).fill(1),
	residual = Array(25).fill(0);
mask[12] = 0;
residual[12] = -8;
residual[6] = -2;
const z = base.map((v, i) => v + mask[i] * residual[i]);
assert.equal(z[12], base[12]);
assert.equal(flood(z, 5, [24]).depth, 2);
// 4: No silent filling; lake needs declared area AND outlet.
const f = flood(z, 5, [24]);
assert.equal(z[6], 8);
assert.equal(f.h[6], 10);
const allowedLake = new Set([6]);
assert(f.h.every((v, i) => v - z[i] < 0.5 || allowedLake.has(i)));
assert(!f.h.every((v, i) => v - z[i] < 0.5));
const shallow = base.slice();
shallow[6] = 9.95;
const shallowRoute = flood(shallow, 5, [24]);
assert(shallowRoute.depth > 0.049 && shallowRoute.depth < 0.051);
assert(shallowRoute.depth < 0.5);
assert.equal(shallow[6], 9.95);
assert.notEqual(flood(Array(4).fill(10), 2, [0]).parent[3], 0);
const plateau = flood(base, 5, [24]);
for (let i = 0; i < 25; i++) {
	let j = i,
		steps = 0;
	while (j !== 24 && steps++ < 25) j = plateau.parent[j];
	assert.equal(j, 24);
}
// 5: Exact extent, shared tile centers, and stored replay.
assert.equal(1024 * 4, 4096);
assert.equal((1024 - 1) * 4, 4092);
const worldX = (tile: number, index: number) => (tile * 128 + index - 16 + 0.5) * 16;
assert.equal(worldX(0, 144), worldX(1, 16));
const mm = Int32Array.from([45, 44.825, 44.58], (v) => Math.round(v * 1000));
assert.deepEqual(new Int32Array(mm.buffer.slice(0)), mm);
console.log('5 contract examples incl. negative probes passed');
```

## 8. Next Three Executable Actions

1. **Contract and base, zero GPU costs:** implement the five examples in an isolated TS harness against a graph/cross-section generator; check L1–L9 on full 4.096 km outputs and 2 km windows. Version region/graph/masks. Show all 60 development cases, judge teacher against base. If the foundation fails: report instead of training.
2. **Export and M1 gate:** in a separate temporary training environment, build the layer sequence above, recount parameters, and export static ONNX. Measure with pinned ORT and real full terrain checking on base M1; verify export parity and halo. Missing M1 device remains a concrete blocker. Measure B0 and T directly first; if T ≤10 s, no training. Generate/freeze the dataset only after passing the cost-effectiveness gate.
3. **Bounded training pilot:** generate teacher regions and verify independently; only upon passing the cost-effectiveness gate execute the described 1,000-step cost pilot and A, and B if warranted. Blind test, author comparison, and independent export/hydrology review decide delivery. No automatic entry into urban build-out, diffusion, or larger models.

## Critique Status and Open Verification

Adopted from sub-research: evaluate HF files instead of search hits; exact RF instead of blanket halo; external catchment and shared width contract; separate browser backends. Corrected against the Gemini hydrology draft: 1 mm sink tolerance contradicted 105 (0.5 m), small masked residuals do not guarantee sink-freedom, a local min-loss misses flat multi-cell sinks, bicubic reconstruction can overshoot, lake surface is not lake bed. Its floodplain example had only 460 m for a required 540 m and would rightly have failed; here stand both positive **and** negative executed examples.

Open: valid base surface plus teacher quality; actual export/operator path; M1 access and browser measurement; GPU throughput/costs; blind/author verdict. No training recommended yet before the first two gates pass. Existing sidequest files remain unchanged; this plan refines the terrain branch and does not rewrite their historical statements.

### Independent Final Critique and Decisions

Gemini 3.8 Flash rejected the first draft and ran the five examples itself with Bun. Adopted: NW→SE neighbors at `y=north` were wrong in code; corrected and supplemented with a negative probe. The teacher had been called "slow" without measurement; T-direct is now a mandatory comparison **before** training and the preferred path if it meets the budget. The 8 m excitation could force large initial projections; replaced with 0.25 m on the 256 m grid, without hiding initialization checking costs. Targets are additionally bounded to `8m·M`. L9 now separates diagnostic catchments/temporary storage from visible water bodies on original elevations. A small raw-output regularizer complements the mask contract.

Not adopted: from a simplified Linux Bun loop and a 2.5 s **budget allocation** neither an M1 browser factor of 10–30 nor the fundamental impossibility of fast CNN inference follows. Likewise, "all maps inevitably have micro-sinks" and "training takes only minutes" are unsubstantiated. The review scripts used simplified test surfaces, not a full pipeline. Unmonitored output pixels in this NFE1 network do not flow back into neighbor pixels as outputs; shared features receive gradients from free outputs. Mask boundaries remain a sensible test, but the claimed inevitable instability is not proven. Architecture/MAC/halo math was confirmed by the reviewer. These objections do not alter the conservative decision: **base and direct T comparison first; training remains conditional.**

Final re-verification confirmed all six correction areas and reported no new blockers. This is a **plan review**, not sign-off of a generator or model. M1 access is not verified here; runtime, teacher quality, and training benefit remain open. Executed: stdlib Python network calculation, five TS contract examples including negative probes, and Prettier on this file. No product code modified, therefore no application build or browser UI test; no training, no cloud job, no commit or push.
