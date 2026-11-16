# Research: What Transfers

As of 2026-11-12. Condensed research; proposals, no own measurements.

## Terrain and Maps

[Talus](https://huggingface.co/osfv/talus) is the most immediate link: small conditional diffusion learns procedural heightmaps. Control variables include relief, slope, and water share. An arbitrary river sketch is not yet supported. Its published quality scores are author benchmarks against procedural references, not proof of real geomorphology.

[InfiniteDiffusion / Terrain Diffusion](https://github.com/xandergos/terrain-diffusion) addresses hierarchical, unbounded terrain generation consistent under random access. According to the training guide, stages fit in up to 24 GB VRAM. The repository is MIT-licensed; weights and DEM/climate sources must be checked separately. Seed-consistent crops do not imply proven bit-exactness across browser GPUs.

[Interactive Authoring of Terrain using Diffusion Models](https://pubs.cs.uct.ac.za/id/eprint/1583/) shows the more interesting interaction idea: style and feature sketches condition elevation data. For us, a multi-channel raster of river mask, protected area, relief target, and existing stock would make more sense than a text prompt. That is a proposed training design. Grid resolution, tile seams, and river gradient remain separate problems.

## Urban Structure and Local Rules

[DiGress](https://github.com/cvignac/DiGress) combines discrete graph diffusion with a graph transformer. Molecules and synthetic graphs are not ready-made city models. For a street-free city, adjacency, supply, and accessibility would be better targets than streets. Planarity, valid geometry, and stable IDs do not follow from plausible graph statistics. Full graph attention scales unfavorably; large city networks require hierarchy or local processing.

[GraphWalker](https://www.ijcai.org/proceedings/2025/702) generates street graphs from trajectories via latent diffusion. That is primarily reconstruction. The related [conditional road-grid diffusion](https://www.mdpi.com/2220-9964/13/6/203) demonstrates geospatially conditioned image generation. From a street image, however, a valid embedded graph does not follow automatically. Floor plans would analogously only be interesting as candidates for existing split grammars; this research does not recommend an adoptable checkpoint for that.

[Growing Neural Cellular Automata](https://distill.pub/2020/growing-ca/) learns small local update rules and demonstrates growth, persistence, and repair. This fits neighborhood effects, not directly policy or long-term quantity balances. Long-term stability must be trained and tested explicitly. For spatially global supply, the network needs additional context channels or multiple scales.

WFC already learns local pattern frequencies. [Space-Time WFC](https://ojs.aaai.org/index.php/AIIDE/article/view/31863) extends this to small solution trajectories. That is not proof that a neural network is needed. Hard compatibility rules remain attractive for modular typologies; global development requires additional objectives. Demonstrate utility over pattern catalog and constraints first.

## Macro Development and Hybrid Simulation

Urban-growth models frequently couple learned suitability fields with cellular automata. This learns spatial transition patterns, but historical land expansion is not an adequate model for adaptive reuse, deconstruction, and retaining existing stock. The future city requires those events explicitly in its data and action space.

[ML Surrogates for Agent-Based Transportation Models](https://arxiv.org/abs/2501.11057) is the stronger link to Agent Loom: simulator runs provide training data for a faster forecasting model. Such a model can pre-rank candidates; the exact simulator checks the best ones. It inherits simulator assumptions and may extrapolate poorly under new policy conditions.

A VAE compresses states continuously; a VQ model turns them into discrete codes for a transformer. Both can lose small relevant details. A latent transition must take drivers and actions as input. Reconstruction quality alone says nothing about good multi-step forecasts. Start with simple aggregated fields and linear transitions as baselines first.

[Genie (2024)](https://deepmind.google/research/publications/60474/) combines video tokenizer, latent actions, and dynamics with 11 billion parameters. This is an architectural example, not a statement about the latest Genie version. [GameNGen](https://gamengen.github.io/) learns DOOM frame sequences from agent-generated data and reports real-time on a TPU. Both demonstrate learned interaction. However, frame consistency does not replace addressable parcels, owners, balances, or decades of stable game history. For this design bible, a structured world model is the more fitting research question.
