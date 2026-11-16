# Models, Frameworks, and Three Experiments

As of 2026-11-12. All experiment budgets are proposals. No models executed locally.

## Concrete Models with Model Cards

| Model                                                             | Size, License, Data                                                                                                                           | Assessment                                                                                                                                |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [Talus](https://huggingface.co/osfv/talus)                        | 23M parameters; Apache-2.0; 45,000 own procedural 64² heightmaps. FP32 file 93 MB, FP16 ONNX 47 MB.                                           | Directly suitable for terrain experiment. Conditions on type and metrics, not arbitrary sketches. Browser demo exists, not measured here. |
| [DDPM CIFAR-10](https://huggingface.co/google/ddpm-cifar10-32)    | Approx. 35.7M parameters; Apache-2.0; CIFAR-10, unconditional 32² RGB images. Computed approx. 143 MB FP32 weights.                           | Architecture and training reference, not a sensible ready-made terrain checkpoint.                                                        |
| [SmolLM2-135M](https://huggingface.co/HuggingFaceTB/SmolLM2-135M) | 135M parameters; Apache-2.0; 2 trillion tokens, including FineWeb-Edu, DCLM, and The Stack. Computed 270 MB FP16 or 135 MB INT8 weights only. | Plausible for language, unnecessary ballast for a few spatial events. Not a trained city model.                                           |

For NCA, graph diffusion, and custom VAE dynamics, an architecture is not a universal checkpoint. Parameter count depends on our configuration. Missing model cards and unclear weight licenses are adoption blockers. A code license does not automatically cover data and weights.

**Stack:** PyTorch for training and ONNX export. [Diffusers](https://huggingface.co/docs/diffusers/training/unconditional_training) provides U-Net, schedulers, and training examples. DDIM or few flow-matching steps are acceleration candidates, not quality guarantees. LoRA/PEFT pays off for a suitable larger pretrained model; for a small custom CNN, full training is often the simpler starting point. JAX is an alternative for vectorized simulation, not a necessary second stack. For graphs, PyTorch Geometric provides suitable building blocks; check dynamic graph operators for ONNX exportability before larger training.

## A · Propose Events

**Hypothesis:** a small CNN with global context channels can supply better candidates at the same search budget. Input: use, age, density, protection, risk, supply, and regional demand. Output: scores for convert, densify, deconstruct, vacate, and retain. Model size initially 0.1–1M parameters; framework: [PyTorch via Diffusers training environment](https://huggingface.co/docs/diffusers/training/unconditional_training), without diffusion requirement.

**Data:** initially 1,000 synthetic episodes of 100 steps each as a working approach. Score candidates through multi-step search rather than merely copying previous rule decisions. Define upfront an intelligible score from demand fulfillment, existing-stock retention, and risk avoidance. Hold out entire seeds, episodes, and one driver family. Four executable examples first: influx, flood, protection rule, demand decline.

**Hardware/Effort:** available 8–12 GB GPU as starting assumption; 5–8 person-days given finished data export. CPU inference in browser first. Target: ≤4 MB weights, ≤50 ms p95 for preprocessing, inference, and validation in a Worker on a pre-named integrated-GPU laptop. Measure cold start separately.

**Success:** across 100 unseen episodes of 100 steps, satisfy all tested invariants, replay identical without inference; at least 10% better predefined score at equal search budget or 2× faster with at most 5% score loss. Baselines: rules and simple candidate search. Report rejections, no-ops, and use cycles separately; randomly ordered author evaluation supplementary only.

**Abort:** no advantage after two clearly bounded training variants; missing simulator contract; frequent rejection or exclusively trivial retention. At most three proposal attempts, then rule fallback.

## B · Controllable Terrain

**Hypothesis:** [Talus](https://huggingface.co/osfv/talus) increases the rate of usable landscapes at equal candidate budget. Test pretrained inference first with type, relief, and water share. Do not assume fine-tuning; arbitrary river masks would be a later separate training task.

**Data:** 30 predefined target profiles, four candidates each from Talus and procedural baseline. Same world dimensions and elevation ranges. Specify river/floodplain criteria from Research 105 explicitly before comparison. Check final heightfields hydrologically; no model evaluation from images alone.

**Hardware/Effort:** existing weights, CPU or 8 GB GPU per model author; 2–4 person-days. Offline first, thus no player download.

**Success:** at least 20 percentage points higher acceptance across all hard terrain checks and separate author judgment. Report generation time, post-processing time, and control deviation in full.

**Abort:** no advantage, predominant repair, or river course insufficiently controllable. Then use existing model only as shape reference; keep noise and deterministic construction.

## C · Forecast Macro Consequences

**Hypothesis:** a small autoencoder with conditioned latent transition can pre-rank candidates faster than full rollouts. Continuous VAE latents first, VQ/transformer only upon proven bottleneck. Framework: PyTorch; export via [ONNX Runtime](https://onnxruntime.ai/docs/get-started/with-javascript/web.html). Methodological link: [ABM surrogates](https://arxiv.org/abs/2501.11057).

**Data:** augment episodes from A with at least eight alternative actions per identical initial state along with exact reference rollouts; keep all branches of the same initial scenario in the same split. States aggregated as 16² fields for use, vacancy, density, and risk. Additional inputs: driver schedule and actions. Train on multiple forecast horizons. Test against persistence and linear transition; hold out entire scenario families. No state adoption from the decoder.

**Hardware/Effort:** 8–12 GB GPU as planning assumption; 5–8 person-days given existing episodes. Factor in data generation cost.

**Success:** at least 3× faster candidate scoring including encoding and exact verification of selected candidates, and at least 0.8 median Spearman rank correlation within the candidate group per initial state against exact scoring; additionally at most 5% normalized selection loss versus the best exact-scored candidate; normalized forecast error over 20 steps ≤10% of the pre-fixed field scale. Additionally check 100-step rollouts for drift and run full rollouts for selected candidates.

**Abort:** fails to beat persistence/linear model, errors flip candidate ranking, or compression removes decisive local information. Fall back to exact simulation in unknown driver regimes. Forecast performance does not prove real policy causality.
