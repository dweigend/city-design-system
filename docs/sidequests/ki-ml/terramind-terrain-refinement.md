# TerraMind for Structured Terrain Refinement

As of 2026-11-12. **Research and architecture proposal, no model sign-off.** Author: Codex; source verification by separate research agents, independent critique separately below. No training, no model inference, no paid jobs, and no large weight downloads. Only official documentation, code, model metadata, and existing server hardware were inspected. This report supplements the [extended terrain research](terrain-forschung-erweitert.md) without rewriting its historical findings.

## Decision

**TerraMind deserves a serious trial as a multimodal terrain prior. However, the first custom architecture should pair a metric terrain decoder with frozen TerraMind features.** In parallel, we test the existing generative DEM path without fine-tuning. Its reconstruction and control errors first decide whether its tokenizer is suitable for our task.

The sought product is an editor that generates multiple coherent landscape proposals from coarse elevation, directed water skeleton, land-use intent, and protected existing stock. The gain should lie in new, selectively modifiable valley forms, terraces, and transitions. Speed against cheap rules is not an admission criterion; ten seconds on M1 was not a technical mandate. Text is not a primary input.

Three serious variants:

1. **Prior plus custom decoder — recommendation for the structured pilot.** TerraMind tiny/small processes coarse DEM and optional real observation data. New engine channels pass through a small trained condition encoder. A custom spatial decoder generates elevation residuals and auxiliary fields; for multiple solutions, conditional diffusion rather than mere regression. This bypasses elevation losses of the existing DEM tokenizer. Whether TerraMind contributes more than a small CNN remains a hypothesis to be refuted.
2. **Evolve TerraMind generatively — conditional research option.** Existing generative transformer → DEM tokens → existing DEM diffusion decoder. New modality adapters and custom refinement training mediate engine intents. If tokenizer reconstruction already destroys river profiles, an input adapter will not suffice: decoder or tokenizer must be adapted or replaced.
3. **Terrain model with joint outputs — genuine alternative.** Fine-tune Talus or train a small custom joint decoder following the MESA idea; Terrain Diffusion remains the stronger existing alternative for large-scale real forms. TerraMind is adopted only if its prior demonstrates design or controllability added value under identical data and conditions.

## What Is Actually Published

The inspected [TerraTorch registry](https://github.com/IBM/terratorch/blob/83c3a928416fcf97deed924cfb99a59a817730bf/terratorch/models/backbones/terramind/model/terramind_register.py) contains the four published **TerraMind 1.0** sizes, each as backbone, TiM, encoder-decoder, and generation path. No publicly documented TerraMind v2 family found. A paper "v2" is a manuscript revision, not a model release. The code also contains `v1_5_pretraining_*` statistics; no available 1.5 checkpoint follows from that. The documented 0.1 models are experimental and not publicly released.

| Model / Pinned Weights and Card                                                                                          | Encoder Size Class | Full Checkpoint: Tensor Values | Learned Portion, Excl. Fixed Position Tensors |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------ | -----------------------------: | --------------------------------------------: |
| [1.0 tiny](https://huggingface.co/ibm-esa-geospatial/TerraMind-1.0-tiny/tree/2b5ac0a3ed7dd7e922ccfd595b56607f342df343)   | ~8M                |                     52,941,504 |                                    52,067,520 |
| [1.0 small](https://huggingface.co/ibm-esa-geospatial/TerraMind-1.0-small/tree/960f7549bfe9d7a08946860042f83badd604c779) | ~30M               |                    126,026,880 |                                   124,278,912 |
| [1.0 base](https://huggingface.co/ibm-esa-geospatial/TerraMind-1.0-base/tree/fb96c70d0a5f68dcc44030b89cbfd8ec3fb0c67a)   | ~100M              |                    379,644,672 |                                   376,148,736 |
| [1.0 large](https://huggingface.co/ibm-esa-geospatial/TerraMind-1.0-large/tree/3ca567c5494310528269402a96ba4f13ceefc87c) | ~300M              |                    946,906,112 |                                   942,244,864 |

The full revision appears in each link. **Additional tokenizers including their decoders:**

| Modality / Pinned Artifact                                                                                                     | Tensor Values |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------: |
| [DEM](https://huggingface.co/ibm-esa-geospatial/TerraMind-1.0-Tokenizer-DEM/tree/aba0a5650a19eb82283e52ce59320c38c41f1e56)     |   286,316,821 |
| [S2L2A](https://huggingface.co/ibm-esa-geospatial/TerraMind-1.0-Tokenizer-S2L2A/tree/5a3f80664e0e701232c9526ca21eb7442a40f4be) |   289,290,693 |
| [S1RTC](https://huggingface.co/ibm-esa-geospatial/TerraMind-1.0-Tokenizer-S1RTC/tree/ea54d732d904c804b01e04cb5d85a462598bb9d0) |   286,587,173 |
| [S1GRD](https://huggingface.co/ibm-esa-geospatial/TerraMind-1.0-Tokenizer-S1GRD/tree/38937fd35012c2dcf81987b400cec725b5eb0466) |   286,587,173 |
| [NDVI](https://huggingface.co/ibm-esa-geospatial/TerraMind-1.0-Tokenizer-NDVI/tree/e1bd3b4d18023a7438221dbd6953e000cdc2dea5)   |   286,316,821 |
| [LULC](https://huggingface.co/ibm-esa-geospatial/TerraMind-1.0-Tokenizer-LULC/tree/af6b7c73a36994e25df156e793901969efe88ec9)   |   183,894,021 |

The [coordinate tokenizer](https://huggingface.co/ibm-esa-geospatial/TerraMind-1.0-Tokenizer-Coords/tree/b6664f494c2d79f9205525d2f3445413813214de) supplies a 576,318-byte configuration, not an additional neural checkpoint. The six image tokenizers total 1,618,992,702 tensor values including fixed positional parameters. Count from HTTP Range fetches of ZIP/`data.pkl` metadata using a restricted metadata reader; tensor payloads were not downloaded. Shared storage was counted once. This is own artifact inspection, not a model measurement.

**Separate licenses:** [TerraMind example code](https://github.com/IBM/terramind/blob/53d61da09213c2c3629931b6322f94cce617886a/LICENSE) and [TerraTorch](https://github.com/IBM/terratorch/blob/83c3a928416fcf97deed924cfb99a59a817730bf/LICENSE) are Apache-2.0; the linked model/tokenizer cards also declare Apache-2.0. [TerraMesh](https://huggingface.co/datasets/ibm-esa-geospatial/TerraMesh/blob/89a8597190983802e4a96ec3e54afe0cd3e51a6b/README.md), by contrast, is **CC-BY-SA-4.0**. The card cites among others SSL4EO-S12/CC-BY-4.0, MajorTOM-Core/CC-BY-SA-4.0, LULC/CC-BY-4.0, and Copernicus WorldDEM rights notices. "Everything Apache/open source" would be false. For own training data, source-data terms, attribution, and derived datasets remain to be cleared separately; weight metadata does not replace them.

**Counting method:** the full checkpoints and the actually loaded architecture are different quantities. Published encoder sizes omit decoder, modality embeddings, and tokenizers. For the budget decision, we conservatively count all required artifacts; for a later run, also log `sum(p.numel() for p in model.parameters())`, trainable parameters, and buffers separately. The registry can omit unused modules. Stored tensor values are therefore not an exact runtime parameter counter, and file bytes are not a VRAM benchmark.

### Architecture and Modalities

The pinned registry defines `tiny` with encoder/decoder depth 12/4, width 192, and 3 attention heads; `small` 12/6, 384, and 6; `base` 12/12, 768, and 12; `large` 24/24, 1024, and 16. 16×16 image patches yield 196 spatial tokens per image modality at 224². More modalities increase token count and thus attention cost; equal parameter count does not mean equal activation cost. These transformer decoders are distinct from the tokenizers' additional raster decoders. [Architecture definitions](https://github.com/IBM/terratorch/blob/83c3a928416fcf97deed924cfb99a59a817730bf/terratorch/models/backbones/terramind/model/terramind_register.py).

TerraMind connects raw image patches and discrete modality tokens in a jointly trained transformer. Pretraining masks or selects input and target tokens across modalities; the decoder learns target-token prediction with cross-entropy. Image generation then runs in two steps: tokens are generated iteratively, after which the respective modality decoder reconstructs a raster. The DEM tokenizer uses Finite Scalar Quantization and a diffusion decoder. More decoder steps are therefore extra model work, not a guaranteed elevation improvement. This is **not an end-to-end pretrained numerical super-resolution operator**. [Paper, Jakubik et al., ICCV 2025](https://arxiv.org/abs/2504.11171), [generation code](https://github.com/IBM/terratorch/blob/83c3a928416fcf97deed924cfb99a59a817730bf/terratorch/models/backbones/terramind/model/terramind_generation.py), [tokenizer code](https://github.com/IBM/terratorch/blob/83c3a928416fcf97deed924cfb99a59a817730bf/terratorch/models/backbones/terramind/tokenizer/vqvae.py).

| Modality                                                   | Existing Input Path                                                 | Existing Generative Output                                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| S2 L2A, S1 GRD, S1 RTC, DEM                                | Raw rasters with modality-specific patch embedding                  | Yes, via respective tokenizer                                                                                |
| S2 L1C, Sentinel RGB                                       | Raw rasters; RGB expects satellite RGB, not arbitrary render images | No dedicated L1C/RGB output path in the documented v1 registry; deriving RGB from generated L2A is different |
| LULC, NDVI                                                 | Pretrained tokenized; alternatively train new raw patch embedding   | Yes                                                                                                          |
| Coordinates                                                | Geographic coordinate tokens                                        | Yes; not game x/y coordinates                                                                                |
| Captions/Text                                              | Experimental 0.1 path                                               | Do not treat as an approved v1 text-to-terrain contract                                                      |
| River graph, drainage area, preserve mask, land-use intent | New channels/adapters and training data required                    | No ready hydrological or urban output heads                                                                  |

Source for the API boundary: [inspected TerraMind guide](https://github.com/IBM/terratorch/blob/83c3a928416fcf97deed924cfb99a59a817730bf/docs/guide/terramind.md). A training label such as flood, burn scar, or crop class does not become a generative modality merely because a segmentation head outputs it.

**Thinking-in-Modalities (TiM)** generates additional modality tokens as intermediate representations without running the heavy raster diffusion decoders, and feeds them to the subsequent downstream encoder. This can fill in missing observations from learned priors, but provides no new independent measurement. For our trial, switch TiM off initially: it increases cost and could merely feed elevation hallucinations back as seemingly corroborating context. [TiM implementation](https://github.com/IBM/terratorch/blob/83c3a928416fcf97deed924cfb99a59a817730bf/terratorch/models/backbones/terramind/model/terramind_tim.py).

**Already published limitation:** [Paper v5, §5.2/Table 3](https://arxiv.org/html/2504.11171v5#S5.SS2) reports for S2L2A→DEM **215.8 m MAE / 745.5 m RMSE**, despite SSIM 0.942; for S1GRD→DEM 163.0/320.8 m. Those are author measurements on that paper's generation task, not a measurement of our structured refinement. They show precisely why good visual structure does not prove elevation calibration. They do not rule out useful features or targeted fine-tuning. The [DEM tokenizer card](https://huggingface.co/ibm-esa-geospatial/TerraMind-1.0-Tokenizer-DEM/blob/aba0a5650a19eb82283e52ce59320c38c41f1e56/README.md) cites 15,360 FSQ codes and warns of additional hallucination with more decoding steps.

The distinction from [Prithvi-EO-2.0-300M](https://huggingface.co/ibm-nasa-geospatial/Prithvi-EO-2.0-300M) matters: Prithvi is a spatiotemporal MAE/ViT for multispectral observation with downstream tasks; it provides no comparable published any-to-any DEM generation path. TerraMind actually has that path. Neither EO benchmark gains nor pretty DEM images, however, prove metric or design suitability for us.

## Engine Contract: Intent Is Not Observation

Initially **224 × 224 cells**, horizontal spacing explicitly in meters, elevations in meters with named datum. The [TerraMesh card](https://huggingface.co/datasets/ibm-esa-geospatial/TerraMesh/blob/89a8597190983802e4a96ec3e54afe0cd3e51a6b/README.md) describes co-registered 10 m rasters, whereas the DEM source is WorldDEM-30. For integration, adopt this 10 m raster contract and georeferenced crop first; log information resolution and raster spacing separately. A Copernicus DEM resampled to a finer grid gains no new fine terrain information by doing so. Only a separate training run switches to, say, 8 or 16 m/cell. A 224² raster is not a scale specification without spatial extent.

| Engine Input         | Encoding for Our Pilot                                                                                                                 | Reuse / New Learning                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Coarse DEM           | Metric raster; antialiased coarsened elevation, back onto target grid; plus valid/invalid                                              | DEM patch embedding exists; artificially smoothed input is still a distribution shift |
| Directed river net   | Distance to channel in m, direction as two unit components, elevation anchors in m, valid direction/anchor masks; graph IDs separately | New condition branch; rasterization loses topology, validator reads original graph    |
| Hydrological fields  | `log1p(A / 1 m²)` for drainage area; precipitation with fixed time reference, boundary inflow separately                               | New normalized channels; do not confuse drainage area with actual discharge           |
| Land-use intent      | Own classes/shares for floodplain, terrace, vegetation, adaptation zone                                                                | Do not rename to observed LULC; own embedding branch                                  |
| Stock and protection | Before-DEM, preserve mask, edit mask, border strip; optional building/vegetation masks                                                 | Train fresh; unprotected cells are not automatically cleared for full reconstruction  |
| Region               | Real geographic context optional; game coordinates as own metric channel                                                               | Do not feed invented lat/lon into the pretrained coordinate tokenizer                 |

For the existing v1 DEM path, inspected code uses `z_norm = (z_m - 670.665) / 951.272`; generation with `standardize=True` inverts this transform again. That preserves a unit scale, but does not guarantee correct absolute elevations. No per-tile min-max: that would discard absolute elevation and comparable slope. Own channels get train-only statistics, fixed units, and NoData masks. [Normalization and inverse transform](https://github.com/IBM/terratorch/blob/83c3a928416fcf97deed924cfb99a59a817730bf/terratorch/models/backbones/terramind/model/terramind_generation.py), [statistics](https://github.com/IBM/terratorch/blob/83c3a928416fcf97deed924cfb99a59a817730bf/terratorch/models/backbones/terramind/model/terramind_register.py).

Local game elevation needs an explicit mapping: `z_geo_m = z_game_m + datum_offset_m`, where the offset comes from a fixed reference and is removed again after output. For fictional regions without geographic datum, use a documented synthetic elevation range in training; never report an offset estimated from the test target as successful calibration. The horizontal mapping stores origin, cell spacing, axis direction, and projection separately from the tensor.

Real city data describes **existing stock**, not a norm for the street-free future. EO priors might convey valley/vegetation relationships and large-scale transitions; they could equally reproduce today's infrastructure and surface artifacts. Satellite-derived DSM, vegetation-cleared DTM, and our playable terrain remain distinct quantities. Just as little is an observed river proof that every desired new river alignment is physically possible.

Output: elevation residual `Δz_m`, yielding proposal `z_before + Δz_m`, optional floodplain/terrace probability, and predicted drainage area. Preserve cells are copied verbatim from the before-state outside the network; the seam is checked afterward. On conflicting elevation anchors or a non-descending river profile, reject the proposal rather than silently reshaping it. Underfills, true sinks, and lakes need an explicit hydrological contract, not a blanket "fill all sinks".

The Python editor outputs canonical rasters plus hashes. Headless TypeScript/Bun validates and commits them via public actions; three.js projects the accepted state. Replay stores the accepted raster or complete delta, raster contract, inputs, model/code hash, and ordering, and requires no new inference. An identical seed alone does not guarantee identical results across devices. [PyTorch reproducibility](https://docs.pytorch.org/docs/stable/notes/randomness.html), [Procedural Principles](../../standards/PROCEDURAL_PRINCIPLES.md).

## What TerraTorch Provides — and What We Build

Present are registry, multimodal datamodules, encoder-decoder factory, downstream training, tokenizer reconstruction, and generative inference. The official flood/burn-scars/crop configs train other tasks. `terratorch fit` with a segmentation config does not prove trainable generative DEM super-resolution. For our refinement loss, matched before-intent-after data, and new condition channels, we need our own training code or a custom task extension.

### Recipe 1: Existing Reconstruction and Crossmodality

**Executable API template, not executed here.** In a separately set-up Python environment later: pin TerraTorch code to `83c3a928416fcf97deed924cfb99a59a817730bf`, example code to `53d61da09213c2c3629931b6322f94cce617886a`; the official setup states Python ≥3.11, TerraTorch ≥1.2.5, and `diffusers==0.30.0` for generation. Record dependencies afterward as an actually tested lock. Model and tokenizer downloads only selectively at the revisions above; with `pretrained=True`, the registry does not automatically load our research pins by default. Therefore pre-populate local HF cache from the pins or pin download resolution explicitly and verify offline. Do not simply download `main` and cite an old SHA in the report.

```python
import random
import torch
from terratorch.registry import FULL_MODEL_REGISTRY
from terratorch.models.backbones.terramind.model.terramind_register import (
    v1_pretraining_mean, v1_pretraining_std,
)

# dem_m: Float32 [B, 1, 224, 224], valid elevations in meters.
# s2: Float32 [B, 12, 224, 224], registered S2-L2A bands,
#     aligned to the same terrain; not a three.js RGB rendering.
device = 'cpu'  # Intentionally explicit; substitute verified backend name later.
random.seed(17)
torch.manual_seed(17)
mean = v1_pretraining_mean['tok_dem@224'][0]
std = v1_pretraining_std['tok_dem@224'][0]

# Execute sequentially so two full paths do not stay in RAM concurrently.
tokenizer = FULL_MODEL_REGISTRY.build(
    'terramind_v1_tokenizer_dem', pretrained=True,
).to(device).eval()
with torch.inference_mode():
    reconstructed_m = tokenizer(
        (dem_m.to(device) - mean) / std, timesteps=10,
    ) * std + mean
reconstructed_m = reconstructed_m.cpu()
del tokenizer

generator = FULL_MODEL_REGISTRY.build(
    'terramind_v1_tiny_generate',
    modalities=['S2L2A'], output_modalities=['DEM'],
    pretrained=True, standardize=True,
).to(device).eval()
with torch.inference_mode():
    generated_m = generator(s2.to(device), timesteps=10)['DEM']
```

The variables `dem_m`/`s2` come from a verified raster loader; this is not a complete data pipeline. First reproduce the [official reconstruction notebook](https://github.com/IBM/terramind/blob/53d61da09213c2c3629931b6322f94cce617886a/notebooks/terramind_tokenizer_reconstruction.ipynb) and the [generation notebook](https://github.com/IBM/terramind/blob/53d61da09213c2c3629931b6322f94cce617886a/notebooks/terramind_generation.ipynb) with their included examples. `timesteps` controls diffusion reconstruction; token decoding has its own schedule. Additional output modalities load additional tokenizers. CPU selection in the notebook is an intended code path, not a compatibility test passed here.

As a further toolkit-backed template, `PixelwiseRegressionTask` with `EncoderDecoderFactory`, `freeze_backbone=True`, a DEM backbone, `ReshapeTokensToImage(remove_cls_token=False)`, `LearnedInterpolateToPyramidal`, and `num_outputs=1` can serve. [Regression example](https://github.com/IBM/terratorch/blob/83c3a928416fcf97deed924cfb99a59a817730bf/examples/pixelwise_regression/pixelwise_regression_agb.yaml) and [task code](https://github.com/IBM/terratorch/blob/83c3a928416fcf97deed924cfb99a59a817730bf/terratorch/tasks/regression_tasks.py) document these building blocks, not a finished DEM recipe. Our datamodule, residual contract, and combined loss are missing from them.

For a DEM→DEM trial, set `modalities=['DEM']`. That is strictly a speculative OOD stress test with smoothed DEM, not an established refinement recipe and not a representative quality benchmark for the model family. We evaluate tokenizer information loss solely via DEM→tokens→DEM; new controllability via trained, held-out edit cases. The code takes image size from input and has no ready-made contract "preserve coarse anchor values exactly, physically increase resolution". Tiled generation exists, but replaces neither seam nor catchment checking.

### Recipe 2: Custom Structured Head

The [documented new modality](https://github.com/IBM/terratorch/blob/83c3a928416fcf97deed924cfb99a59a817730bf/docs/guide/terramind.md#new-modalities) can be initialized, for example, as `modalities=['DEM', {'ENGINE': C}]`. This creates a new patch embedding, not pretrained knowledge of those channels. Better kept separate for the first comparison:

```text
DEM_m → fixed v1 normalization → frozen TerraMind encoder → feature grid
Engine fields + z_before + masks → trained small condition encoder
Feature grid + condition + optional noise/timestep → custom spatial decoder
→ Δz_m + auxiliary fields → exact preserve step → independent validator
```

At 224² with 16-pixel patches, the feature grid has only **14 × 14 positions**. It is spatial context, not a directly resolved river bed. Token channels can encode information within a patch; neither complete loss of all detail nor its precise reconstructibility follows from that. The custom decoder therefore receives high-resolution skip connections from before-DEM, condition, and masks. These paths must also be available to the CNN baselines.

Start with **1–10M parameters** for a deterministic residual head as diagnostics. Then **20–60M** for a conditional stochastic joint decoder when multiple solutions are needed. These sizes are design budgets. Encoder features without gradients can be pre-cached provided DEM input and augmentation stay unchanged. Neither generative transformer decoder nor DEM tokenizer is needed for this path. By contrast, a custom raw ENGINE adapter inside the transformer requires running activations through its blocks even if their weights are frozen; a feature cache is not equivalent for that.

Keep training stages clearly separated:

- **Frozen features + head:** trains only condition branch/head; cheapest clean test of the prior. Regression output can smooth toward means, hence not the final word on generative form quality.
- **Selective backbone/decoder fine-tuning:** last encoder blocks or LoRA plus head if coarse DEM inputs differ markedly from EO data. LoRA saves optimizer state, not base weights or full forward work.
- **Generative modality adapter:** new input embeddings and crossmodal/masked-token training, old DEM token space fixed first. Plus metric loss after decoding; discrete sampling is not automatically differentiable. Teacher-forced token CE and a separately trainable raster decoder are a realistic start. Naively backpropagating through discrete codes is not a recipe.
- **Tokenizer/decoder fine-tuning:** only needed if reconstruction limits matter. Adapting decoder with fixed codes is less disruptive. Changing encoder/quantization alters token semantics; then old transformer logits no longer match without joint retraining. That is not a small LoRA change.

Loss proposal: robust elevation deviation in m; gradient deviation in m/m; descending profile along directed river edges with permitted lake/impoundment segments; coarse elevation consistency after downsampling; existing-stock/boundary error; auxiliary task for floodplain/terrace. Normalize each component by a fixed physical tolerance before weighting. Differentiable river losses are surrogates; actual connectivity and boundary drainage are checked by an independent hydrological validator. Under generative training, add the denoising/flow loss. Choose weights on validation, not post-hoc on the test dataset.

Data must provide **consistent triples upfront**: before-terrain, permitted intent, matching after-terrain. A random DEM plus arbitrary river sketch plus unchanged DEM as label teaches the model to ignore intents. Real DEMs supply natural forms; coarse elevations/river fields derived from them initially yield only reconstruction tasks. For interventions, additionally generate geometrically verified edits, richer simulations, and curated author variants. Document their limits: simulator bias, incomplete processes, DSM artifacts, no observed counterfactual for a future city. Not every better terrain must imitate a simulator; author ranking and multiple accepted variants per intent can broaden the design distribution.

## Hardware Without an Own Nvidia GPU

Inspected read-only on `measurement host`: Linux x86_64, Ryzen 9 8945HX, 16 cores/32 threads, roughly **20.7 GiB addressable RAM**; around 10 GiB available when checked, 8 GiB swap nearly full. PCI reports AMD Raphael; sysfs reports **2 GiB VRAM** and roughly 10.35 GiB GTT. GTT is paged system memory, not additional fast dedicated VRAM. `/dev/kfd` exists, but Torch is not installed in the queried Python. Determined via `uname`, `lscpu`, `free`, `lspci`, sysfs, and `importlib.util.find_spec`, without driver changes. No other GPU or external machine was assumed.

| Path        | Official Evidence                                                                                                                                            | Consequence for Full Pipeline                                                                                                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CPU/PyTorch | Official TerraMind notebooks choose CPU as fallback                                                                                                          | Plausible initial reconstruction smoke test after isolated setup later; not executed here. No throughput promise. On the currently loaded server only sequentially and after RAM check.                                            |
| AMD/ROCm    | [AMD compatibility matrix](https://rocm.docs.amd.com/en/latest/compatibility/compatibility-matrix.html) names concrete GPUs/APUs and OS versions             | Raphael/8945HX is not listed as a supported APU in the inspected matrix. Present KFD is not enough. No solid local GPU training route for this machine. On a supported AMD card, a complete smoke/backward test would be required. |
| Apple MPS   | [PyTorch MPS](https://docs.pytorch.org/docs/2.15/notes/mps.html); TerraMind notebooks have MPS device selection                                              | Official intended path, no fully documented matrix here or upstream for all tokenizers, dtypes, and training. IBM also cites a UNet BatchNorm fix / FCN fallback path. Apple device and RAM were not inspected.                    |
| MLX         | [Apple MLX](https://ml-explore.github.io/mlx/build/html/index.html) offers its own array/training stack                                                      | No official full TerraMind port found. Loading PyTorch weights alone ports neither tokenizer nor sampling and scheduler. Separate porting project.                                                                                 |
| Core ML     | [Apple conversion workflow](https://apple.github.io/coremltools/docs-guides/source/convert-pytorch-workflow.html) supports graph conversion with limitations | No verified full TerraMind export found. Control flow, discrete tokens, and diffusion loop must be implemented and checked separately; not an assumed training path.                                                               |
| Rented GPU  | Optional on supported CUDA or ROCm system                                                                                                                    | Portable container/environment recipe, data and checkpoints exportable; no vendor lock-in. No booking here.                                                                                                                        |

Operator check before training: FP32 as numerical reference; approve FP16/BF16 only after finite output, correct backward pass, and metric comparison. Attention may materialize intermediates instead of Flash kernels depending on backend; [PyTorch SDPA](https://docs.pytorch.org/docs/stable/generated/torch.nn.functional.scaled_dot_product_attention) explains different backends and FP32 intermediates in the math path. Include FSQ rounding/indexing, embeddings, Layer/Group/BatchNorm, interpolation, diffusion scheduler, and random numbers in the test. FFT is not an assumed primary operation for the described TerraMind path; if spectral losses or FNO are added, test separately. [PyTorch FFT](https://docs.pytorch.org/docs/2.15/generated/torch.fft.fft.html) lists restrictions for half FFT; an FFT demo proves neither MPS nor ROCm compatibility of the full chain. Silent CPU fallback is logged as a mixed path with time costs.

**Budget arithmetic, not a measurement:** `tiny` + full DEM tokenizer correspond to roughly 339.3M tensor values, `small` + DEM 412.3M, `base` + DEM 666.0M, `large` + DEM 1,233.2M. FP32 weights alone come to roughly 1.36/1.65/2.66/4.93 GB; FP16 arithmetically halves this part. `large` thus exceeds our preferred <1B chain. The full `tiny` chain with all six image tokenizers also exceeds 1B. For a pure DEM path, we do not load those other output decoders.

The feature path uses only the selected encoder and custom heads: roughly 8M/30M encoder plus 1–10M regression head or 20–60M generative decoder, plus condition encoder. That is clearly smaller, though not yet an exact-counted built graph. For training, Adam requires gradients, moments, optionally FP32 master weights, and activations alongside weights. Full training can require around 12–16 bytes per trained parameter for these persistent states alone; resolution, modalities, and decoder activations come on top. Few trainable parameters via LoRA are not a VRAM guarantee.

**Rental budget as self-imposed cap:** 24 GB class first for profiling; if demand does not fit, shrink architecture/batch or deliberately budget a larger tier. No claim that every path fits in 24 GB. As a calculation rate, at most 1.50 EUR per GPU hour, not a researched market quote: 2 h diagnostics, 12 h pilot, 24 h ablation yield 57 EUR compute budget; with a separately capped 15 EUR for storage/transfer, **72 EUR maximum initial rental ceiling**. If a concrete quote exceeds this assumption, re-plan. Check provider price, tax, minimum duration, cancellation, and data export before booking. All times are caps, not training-duration forecasts. Local CPU trials cost no GPU rental, but consume server time and labor time.

## Comparison That Can Change the Choice

| Variant                            | Why Take Seriously                                                                                                                                                                                                                  | Missing Capability / Limit                                                                                                                                                                                                                              |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TerraMind with custom head**     | Real DEM/SAR/optical context, multimodal fusion, and usable TerraTorch infrastructure                                                                                                                                               | EO knowledge could be oversized or irrelevant for purely structured inputs; new metric head and real edit data needed                                                                                                                                   |
| **Talus fine-tuning**              | Approx. 23M, spatial editing and preserve mechanics in code; [Earth fine-tune config](https://github.com/osfv/talus/blob/c4581e1ddf39941bbea246a8f720d67202f8358c/configs/train/talus4_earth64.yaml) with `train.init_from` present | Published 3/3.1 weights synthetic; new scale and natural forms must be learned. Earth config is not a verified Earth checkpoint                                                                                                                         |
| **Terrain Diffusion**              | Full Coarse/Base/Decoder hierarchy at approx. 284.4M; real terrain priors, true coarse→fine path                                                                                                                                    | New graph/protection conditioning and own hydrological contract. [Training](https://github.com/xandergos/terrain-diffusion/blob/e8dcb4b1a834ab2f6b1a6f5256ed7c9f2f3e8230/TRAINING.md) separates AE, encoding, and denoiser; count extra AE for training |
| **Custom MESA-like joint decoder** | Joint generation of corresponding fields can make terrain, floodplain, and terrace consistent                                                                                                                                       | [MESA](https://arxiv.org/html/2504.07210v2#S3.SS2) shares RGB VAE/latents; no ready metric engine pipeline. Train custom 20–60M model without adopting MESA weights or its research license                                                             |

For the third variant, the chains are concrete: **Talus** processes normalized elevation/noise and condition directly in the pixel U-Net (~23M, no extra VAE/text encoder), augmented by our adapter; **Terrain Diffusion 30m** uses Coarse ~2.8M → Base ~253.7M → Consistency Decoder ~27.9M, plus newly trained condition. Its additional autoencoder for generating training latents belongs in the training manifest and must be counted/profiled separately there; 284.4M applies to the published inference chain. A **custom joint pixel decoder** needs only the planned 20–60M denoiser and an approx. 1–5M condition encoder, no MESA VAE and no text encoder. Those are complete design roles, not yet built and measured models. Weights and detailed source pins of the alternatives are in the [preceding artifact inspection](terrain-forschung-erweitert.md#adoptable-starting-points).

The full MESA chain stands at roughly 1.32B tensor parameters and under a restricted research license per [preceding artifact inspection](terrain-forschung-erweitert.md#adoptable-starting-points). The proposal adopts the idea of joint outputs, not a supposedly small MESA version. Terrain Diffusion is closer to the target for the terrain contract than un-fine-tuned TerraMind; TerraMind's strength would be the extra multimodal context. Talus is the manageable fine-tuning counter-candidate. None of these advantages is reported as a result without comparison.

## Three Bounded PoCs

Define all grids and splits before training; split by regions/catchments and complete edit families, not neighboring tiles. A held-out fine-tuning test is not automatically independent from global TerraMesh pretraining. Check overlaps as far as possible by provenance and geography; disclose unknown pretraining overlap. Additionally mark and evaluate DSM→DTM and sensor switches separately; different sensor data alone does not prove geographic independence. Newly designed interventions and held-out edit families test new controllability even if the real origin site already appeared in pretraining. Profiling: exact hardware/OS/dependencies/hashes, cold start, 2 warmups, and 5 repeats; median and peak RAM/VRAM. For solid p95 later, at least 100 inference runs, not five. Measure encoder, tokenizer, sampling, transfer, and validation separately as well as end-to-end. Profile training pilot for 200 steps first, then extrapolate remaining time. Derive no quality result from these plans.

### 1 · Un-Fine-Tuned Reconstruction and Crossmodality

**Question:** is the existing DEM representation usable for our terrain scales, and does crossmodality deliver more than plausible appearance?

- **Input/Output:** 24 georeferenced, co-registered 224² crops, six terrain groups including flat floodplain, steep valleys, and existing stock. Keep native metadata/cell spacing; DEM in m, S2-L2A in original band values. First DEM→tokens→DEM, then S2→DEM as well as smoothed DEM→DEM. Evaluate the latter separately as a speculative OOD stress test, not as a model-family ranking. Four fixed seeds, decoder 1/10/25 steps; `tiny`, `small` only upon clear reason. No text input.
- **Data/Training:** no trained parameters. Small official examples for API smoke test; separate real DEM pairs for evaluation. Do not sell Copernicus resolution as DTM fine detail. Report elevation offset and relief distortion separately; elevations corrected post-hoc from ground truth only as a diagnostic, not a production-available variant.
- **Metrics:** MAE/RMSE in m, elevation bias, gradient error, river-profile violations, NoData/boundary behavior, and author evaluation at fixed scale. SSIM alone is not enough.
- **Planning budget:** 1–2 person-days; locally first only 2–4 tiles with at most 10 decoding steps and a 4 CPU-hour time cap. Full matrix only on a profiled GPU, optionally at most 2 GPU hours. These are upper bounds, not expected runtimes. Profiling decides how much of the matrix fits; untested cells remain open.
- **Abort:** NaNs, unacceptable memory load, or systematic losses on river profile/relief rule out the unmodified decoder for metric refinement. Working proposal for the first 10 m grid test: MAE >2 m or single profile reversal >1 m as warn/stop threshold for this use, confirm with domain owner before running; not a universal terrain quality metric. This does not end the feature path.

### 2 · Structured DEM Refinement Pilot

**Question:** can the model turn a coarse intent into multiple plausible, controllable terrain forms?

- **Input/Output:** 224² initially at 10 m/cell as explicit pilot contract, i.e., 2.24 km crop. Coarse DEM from 40/80 m low-pass, before-terrain, directed river rasters, land-use intent, and masks. Output 10 m DEM in m plus floodplain/terrace fields. Real 10 m DTM or suitable higher-resolution open data required; upscaling 30 m Copernicus creates no 10 m ground truth. If only 30 m data is available, switch entire contract to 30/120/240 m and evaluate separately.
- **Four executable cases before training starts:** widen floodplain at fixed outlet; terrace beside protected existing stock; modify local slope at fixed border; intentionally conflicting elevation anchors must be rejected. Acceptance cases with expected invariants, not a single desired pixel map.
- **Data:** initially 1,000–5,000 geographically separated pairs/triples, including a small manually verified edit set; at least 100 untouched test cases. The number is a working budget, not a guarantee of sufficient data. Multiple consistent intents/after-solutions per case, genuine no-ops, and impossible requests. Budget data production separately: 2–5 person-days given available raster access, otherwise re-plan.
- **Training:** `tiny` encoder frozen; 1–10M head/condition branch, AdamW starting at `lr=1e-3`, weight decay `1e-2`, effective batch 16 via accumulation, 2,000 steps. If control works, 20–60M stochastic joint decoder with `lr=1e-4`, at most another 8,000 steps, 10–30 sampling steps as search range. These values are initial hypotheses. Ambiguous requests must not be penalized as errors against a single reference: separate ground-truth error and distribution/author judgment.
- **Check:** identical input with changed intent must cause matching local change; preserve cells exact, boundary/river validation passed. Remove/swap intent and measure control response. Disclose post-processing costs and rejection rate. No scoring solely on the best seed.
- **Budget/Abort:** 3–5 further person-days implementation/evaluation, maximum 12 GPU hours including profiling. Stop if two pre-bounded variants ignore intents or almost all candidates require repair. If regression smooths, check generative variant; do not reject the entire family from a bad regression head. No run over budget without new planning.

### 3 · Independent Prior and Control Test

**Question:** does TerraMind justify its extra weight through design gain or new control?

- **Identical Inputs/Outputs:** exact cases, units, and held-out regions from PoC 2. At least 40 untouched intents, four fixed candidate seeds each, identical validators and renderings. No extra Sentinel data only for the preferred candidate; multimodal extra benefit is a separately named trial arm.
- **Arms:** custom small CNN/U-Net decoder without TerraMind; same TerraMind architecture randomly initialized with identical fine-tuning protocol; pretrained and frozen; optionally pretrained selectively unfrozen. A frozen random encoder is extra diagnostics, not a fair from-scratch main opponent. Train small CNNs in full. Plus Talus fine-tuning as terrain-prior reference. An additional cheap baseline replaces TerraMind features with a 14×14 low-pass/regional-descriptor grid under identical head and identical high-resolution skip connections; a comparable CNN bottleneck controls the architectural effect. Rank Terrain Diffusion directly only with identical scale/controllable input, otherwise separate form reference.
- **Control ablation:** same region with two intents, intent swapped/removed, region features removed or swapped between regions. This separates use of prior, mere DEM copying, and real control. On the multimodal arm, test with/without real SAR/optical to see whether a modality missing later in-game explains the entire gain.
- **Data/Training:** same split, same losses, and comparable tuning budget. First screen CNN, random TerraMind, frozen TerraMind, and Talus with one seed each; expand only the two strongest candidates to three training seeds total. Selective unfreezing of the encoder only as a separately budgeted follow-up if the freeze test shows benefit. Screening uses validation data exclusively; final test stays closed until selection. Report primarily equal data volume and bounded compute time, additionally learning curves by steps and consumed resources. Large and small models do not have the same cost at equal step counts. Maximum ablation rental 24 GPU hours; if insufficient, evaluate fewer arms cleanly rather than claiming equivalence.
- **Judgment:** another agent checks blind assignment, data leakage, metrics, and invariants; the author decides design preference. Randomly ordered comparisons with identical cameras, scale, and candidate count. Sought are coherent forms, legible transitions, and aptly responding edits. Report acceptance rate with uncertainty, diversity under equal intent, elevation fidelity, and control error separately.
- **Abort/Decision:** without recurring advantage across held-out regions and training seeds, remove TerraMind from the production path. It may remain as a research reference. A gain only on distant EO tasks or only after lots of extra data does not justify an engine dependency. Equal design quality with a smaller Talus/CNN model favors the smaller model; measurably new controllability, by contrast, justifies extra cost even without speedup.

## Open Decisions and Verification Status

Open are suitable licensed DTM data, tolerable elevation/river errors per scale, availability of real observation modalities in the later editor, and the actual full device path. These questions are answered by the three bounded trials, not by larger foundation model sizes.

**Independent critique:** Gemini 3.8 Flash reviewed the draft on 2026-11-12 and judged the core recommendation sound with limits. Incorporated are an explicitly context-only 14×14 feature grid with high-resolution skip connections, additional low-pass/CNN controls, sensor/pretraining overlap, staged ablations, a small CPU smoke test, and clear separation of the DEM→DEM OOD stress test from tokenizer reconstruction and trained refinement.

**Response to dissenting review statements:** we do not adopt the demanded switch to 30 m/cell: the TerraMesh card linked above and Paper §3 substantiate 10 m rasters despite a 30 m DEM source. A 10 m input therefore does not create the claimed blanket factor-3 scale shift. Genuine finer DTM information and smoothing remain distribution shifts nonetheless and are checked separately. The CPU seconds and 30–45 GPU hours cited in the review are unmeasured and are not adopted as findings. Nor does "all fine information is missing" follow solely from 14×14 tokens, since their channels can carry patch information. The review is independent critique, not experimental sign-off; a re-review of the incorporated clarifications was not executed.

Only this research file was created and formatted with Prettier. No changes to `src`, no installation in the project, and no commits. Model examples are source-checked templates, not executed tests. Build, `svelte-check`, unit tests, and browser were not run for this pure Markdown research. Temporary source/metadata copies were deleted upon completion.
