# Big Numbers

An exploration of big numbers, infinity, and the Busy Beaver problem. Part interactive scrolling website, part computational research toolkit.

## Project Overview

This project has two components:

### 1. "The Scale of Big" — Interactive Website

A scrolling website that takes you on a journey through increasingly large numbers. Built with vanilla HTML/CSS/JS.

**Files:** `index.html`, `style.css`, `main.js`, `entries.js`, `visualizations.js`

### 2. Busy Beaver Research Toolkit

A suite of tools for analysing the Busy Beaver function and its structural properties. Built in Node.js.

## Busy Beaver Toolkit

### Quick Start

```bash
# Interactive playground — experiment with Turing machines
node bb-play.js

# Run the simulator and see BB(1)-(4) champions
node bb-simulator.js

# Enumerate all 2-state or 3-state machines (3-state takes ~22s)
node bb-enumerate.js 2 100
node bb-enumerate.js 3 200

# Deep amplification analysis on all 3-state machines (~8s)
node bb-amplification.js 3 200

# Nesting depth and compression analysis (~8s)
node bb-nesting.js 3 200

# BB(4) detailed phase and crash analysis
node bb4-analysis.js
node bb4-crashes.js

# BB(5) champion analysis (~3s for 47M steps)
node bb5-analysis.js
node bb5-crashes.js
node bb5-constants.js
node bb5-why-five-thirds.js
node bb5-tape-structure.js

# BB(6) candidate design and analysis
node bb6-designer.js         # initial candidate templates
node bb6-refine.js           # B2 counter architecture refinement
node bb6-b2-deep.js          # deep analysis of B2 (translated cycler)
node bb6-structured.js       # structured design with rich erasure patterns
node bb6-mutate.js           # systematic BB(5) mutation search
node bb6-crashmonster.js     # 500M-step long runs of top candidates
```

### Tools

| File | Purpose |
|------|---------|
| `bb-simulator.js` | Core Turing machine simulator with BB(1)-(4) champions |
| `bb-play.js` | Interactive CLI playground for defining and running machines |
| `bb-enumerate.js` | Brute-force enumeration with motif detection and phase analysis |
| `bb-amplification.js` | Deep analysis of amplification patterns across all halting machines |
| `bb-nesting.js` | Recursive nesting depth measurement and LZ compression analysis |
| `bb4-analysis.js` | BB(4) champion phase decomposition and nested cycle detection |
| `bb4-crashes.js` | BB(4) oscillation patterns and n/3 hypothesis testing |
| `bb5-analysis.js` | BB(5) champion multi-resolution analysis (47M steps) |
| `bb5-crashes.js` | BB(5) crash event detection and transition frequency analysis |
| `bb5-constants.js` | Mathematical constant extraction from BB(5) crash dynamics |
| `bb5-why-five-thirds.js` | Mechanistic explanation of the 5/3 growth ratio |
| `bb5-tape-structure.js` | Why BB(5)'s tape is non-periodic (`100100100...` pattern) |
| `bb6-designer.js` | BB(6) candidate design using motif framework |
| `bb6-refine.js` | B2 counter architecture refinement and variants |
| `bb6-b2-deep.js` | Deep analysis revealing B2 as a translated cycler |
| `bb6-structured.js` | Design candidates with rich erasure patterns |
| `bb6-mutate.js` | Systematic single-transition mutation of BB(5) |
| `bb6-crashmonster.js` | 500M-step analysis of top crash-producing mutations |

## Research Findings

### Motif Taxonomy

We identified four structural motifs that appear in BB champion machines, detectable from their transition tables:

- **Sweeper** — A self-loop that writes 1s, marching in one direction (e.g., `B,1 -> 1RB`)
- **Transporter** — A self-loop that preserves symbols, crossing existing data
- **Gap-maker** — A transition that writes 0, creating structure for sweepers to fill
- **Reluctant halter** — The halt transition only triggers on read-1, making it harder to reach from a blank tape

**Finding:** All BB(2)-(5) champions share gap-maker + sweeper + reluctant-halter. The reluctant-halter motif is the strongest single predictor of performance.

### Phase Decomposition

BB machine execution decomposes into **setup**, **amplification**, and **cleanup** phases.

Validated across 7.5M halting 3-state machines:
- Only 2.5% of machines show detectable amplification
- Those machines produce **1.7x more ones** on average
- **100% of machines reaching the maximum score (6 ones) have amplification**
- Optimal amplification fraction is 20-30% of execution (not higher)

### Nesting Depth

Amplification can be nested (cycles within cycles). Depth predicts performance:

| Depth | Count | Avg Ones | vs Depth 0 |
|-------|-------|----------|------------|
| 0 | 7,382,448 | 0.750 | 1.0x |
| 1 | 189,152 | 1.262 | 1.7x |
| 2 | 240 | 2.300 | 3.1x |

Independently confirmed by LZ compression ratio: more compressible state sequences correlate with higher scores.

### Cross-BB Structural Progression

| BB(n) | Ones | Steps | Strategy | Nesting | LZ Complexity |
|-------|------|-------|----------|---------|---------------|
| BB(2) | 4 | 6 | Flat bounce | Depth 1 | ~0.50 |
| BB(3) | 6 | 14 | Simple sweep cycle | Depth 1 | ~0.55 |
| BB(4) | 13 | 107 | Nested cycles | Depth 2 | ~0.30 |
| BB(5) | 4,098 | 47,176,870 | Crash-rebuild sawtooth | Multi-scale | 0.0005 |

### BB(5) Crash Dynamics

BB(5) exhibits 8 crash events where the ones count drops dramatically, then rebuilds. The crashes follow precise mathematical patterns:

- **Survival fraction** converges to **1/3** (each crash destroys ~2/3 of ones)
- **Peak growth ratio** converges to **5/3** (each peak is 5/3 of the previous)
- **Inter-crash interval ratio** converges to **25/9 = (5/3)^2**
- All three constants derive from a single base ratio of **5/3**

### 5/3 Mechanism

The 5/3 ratio emerges from the boundary event structure:

- **Normal operation:** Alternating `+D+A` and `+B+C` boundary events, each creating exactly +2 ones, zero erasure
- **Crash events:** Triggered at macro-boundaries. States A, C, E form an erasure chain (`=A -C -E` repeated) that propagates through existing ones. The chain length roughly doubles each crash.
- **States B and D** are sweepers (50% of all time each). States A, C, E are structural glue firing <1% of the time, but they control the macro-dynamics.

### n/3 Connection

BB(4) shows 4/3 in its first trough-to-peak recovery ratio. This suggests a possible general pattern where n-state machines exhibit dynamics related to n/3, though the dynamics evolve qualitatively:

- BB(3): Monotonic building (no crashes)
- BB(4): Gentle +/- 1 oscillations with rare macro jumps
- BB(5): Full crash-rebuild cycles

### Tape Non-Periodicity (Design Principle)

BB(5)'s tape is non-periodic because the ACE erasure chain leaves a structured `100100100...` pattern *inside* the ones region. This internal structure causes sweepers to encounter different local contexts on each pass, creating content-dependent branching. In contrast, trivial machines (like our B2 candidate) create periodic tapes (`101010...`) where the machine never branches differently — these are disguised translated cyclers.

**Design principle:** BB candidates must create *internal structure* within the ones region, not just extend boundaries. The erasure chain must leave marks that sweepers later react to differently.

### BB(6) Design Exploration

We explored three approaches to designing BB(6) candidates:

1. **Hand-designed architectures** — Templates based on our motif framework (sweepers + gap-makers + reluctant halters). Most either halted too quickly or ran forever as translated cyclers.

2. **Guided random search** — 5,000+ structurally constrained random machines. Found no machines with crash dynamics — all were either quick halters or monotonic builders.

3. **BB(5) mutation search** — Systematically mutated each of BB(5)'s 10 transitions to route through a 6th state F. Tested 8,320 candidates. Key findings:
   - Mutations that insert F as a pass-through produce "BB(5)+1" machines (4,099 ones) where F doesn't meaningfully participate
   - Mutations to **sweeper transitions** (B,1 or D,1) create "crash monsters" with 3,736-4,948 crashes (vs BB(5)'s 8) and qualitatively different dynamics
   - 500M-step long runs revealed these crash monsters are **oscillators, not counters** — crashes occur at constant intervals (ratio 1.0), not geometric intervals like BB(5)'s 2.78x

**Key insight:** BB(5)'s genius is the *geometric spacing* between crashes, not the crashes themselves. The `100100100...` tape pattern acts as a counter register, and each crash is a "carry" that resets part of it. Our mutations broke the counter aspect while keeping the crash aspect, producing ergodic oscillators instead of productive counters.

**Implication for BB(6):** A genuine improvement requires a machine whose 6th state creates a *deeper counter* — one where crashes are geometrically spaced with a ratio larger than BB(5)'s 25/9, yielding super-exponential growth.

## Open Questions

1. Can the 5/3 ratio be proven exactly from the BB(5) transition table?
2. Can a 6-state machine implement a counter-of-counters yielding doubly-exponential growth?
3. Is there a general theory connecting n-state machines to n/3 growth ratios?
4. Where exactly between BB(6) and BB(7,910) does the ZFC independence boundary lie?
5. What tape patterns would a "counter-of-counters" leave? Can we design the pattern first and reverse-engineer the transitions?
6. Can our oscillator/counter distinction be used as a filter in the BB(5) holdout classification project?

## License

MIT
