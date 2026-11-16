# Data, Hardware, and Browser

As of 2026-11-12. Research and planning assumptions, no own benchmarks.

## Data Selection

**Own synthetic episodes first.** They provide full state, drivers, actions, and counter-probes. Generator revision, seed, draw sequence, units, and data provenance belong in the dataset. Define the train/test split before tuning. Separate entire episodes and generator families; individual grids of the same city are not an independent test. Own generation is only license-clear if embedded templates and source data are also cleared.

The strength is controlled coverage of rare interventions. The limitation is equally clear: a model cannot learn better development logic simply by copying the same cheap rule. Added value requires evaluated alternatives, an expensive teacher, or additional design judgments. Synthetic data does not replace validation outside its generator family.

[OpenStreetMap](https://www.openstreetmap.org/copyright) provides existing stock and morphology under ODbL. Observe attribution and obligations for derived databases. Neither automatically place all weights under ODbL nor blindly exempt them from all obligations. Assess training corpus and weights separately. Existing street networks are suitable for analyzing historical urban fabric, not as an unquestioned goal for the street-free future.

[Copernicus DEM](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM) is a surface model with vegetation and buildings, not a bare-earth terrain model. GLO-90 is a possible coarse starting point. Check product license, attribution, and concrete download access before use; portal access does not imply a uniform license across all products. Research found conflicting access notes on GLO-30; therefore no blanket availability assurance is made here.

[Sentinel-2 and Terms of Use](https://dataspace.copernicus.eu/terms-and-conditions) provide open observation data under their own Legal Notice. Clouds, resolution, and temporally varying capture conditions make consistent land-use labels difficult. Satellite imagery shows observed change; it does not provide clean counterfactuals for a new policy. Document scale, projection, vertical datum, and resampling for all geospatial data.

## Training and Costs

A small CNN or small autoencoder can be scoped for an initial trial on an available 8–12 GB GPU. This is a budget assumption, not a proven minimum requirement. Batch size, resolution, rollout length, and stored activations determine actual demand. For Talus, the author states 8 GB; InfiniteDiffusion states up to 24 GB for its training stages.

The checked [Runpod pricing page](https://www.runpod.io/pricing) lists roughly 0.50 USD/h (RTX 3090) and 0.89 USD/h (RTX 4090) for 24-GB cards. Re-check prices and availability before booking. An **assumed** budget of 10–40 GPU hours yields roughly 5–36 USD in pure GPU costs, plus storage and transfer. It is not a forecast of required training time. Run a short profiling pass first and extrapolate from there. Labor time, data preparation, and evaluation are likely to dominate the pilot more than pure GPU rental.

100M parameters already require roughly 200 MB at FP16 just for weights. Training additionally needs gradients, optimizer state, and activations. Few parameters guarantee neither fast training nor cheap inference: diffusion runs the same denoiser multiple times. LoRA reduces trainable parameters, but eliminates neither the base weights nor their inference cost.

## Inference on the Player's Machine

[ONNX Runtime Web](https://onnxruntime.ai/docs/get-started/with-javascript/web.html) offers WASM and GPU backends with differing operator coverage. Export first and verify a full forward pass before investing in longer training. WebGPU inference competes with three.js for resources. A Worker protects the main thread, but does not eliminate GPU contention. Measure model load, shader compilation, and first run separately from warm p95.

Transformers.js uses ONNX Runtime and simplifies supported transformers including tokenizers. For a custom CNN, ONNX directly is shorter. TensorFlow.js is a possible alternative with its own browser stack. WebNN offers additional hardware paths, but is not a mandatory baseline path for now due to browser/device dependencies. No blanket latency figure from a model card transfers to all player devices.

Define a test matrix before the pilot: one integrated-GPU laptop, one desktop, and one weaker device; record exact hardware, OS, browser, and backend for each. Measure download, peak RAM/VRAM, cold start, warm end-to-end latency, p95, and concurrent rendering load. Without WebGPU, a rule baseline or WASM execution must work. Generation between epochs may take significantly longer than an action during a running frame.

## Determinism Is a Contract

[PyTorch](https://docs.pytorch.org/docs/stable/notes/randomness.html) does not guarantee complete reproducibility across platforms and releases. For browsers, therefore: custom versioned random numbers, fixed sampling order, model hash, and backend version help with debugging, but do not guarantee identical float results. Quantization and argmax can still flip close decisions.

Define two separate goals: reproducible proposals on a fixed environment, and identical replay of accepted events across all supported environments. For replay, store full accepted actions, parameters, ordering, and execution version. Store static ML maps as canonical grids. The replay path must not require inference. Numerical execution of actions also continues to rely on the rules of the procedural core.
