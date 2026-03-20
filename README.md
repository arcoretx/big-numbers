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

## Open Questions

1. Can the 5/3 ratio be proven exactly from the BB(5) transition table?
2. Does BB(6) show a 6/3 = 2 ratio? (BB(6) is unknown)
3. Is there a general theory connecting n-state machines to n/3 growth ratios?
4. Where exactly between BB(6) and BB(7910) does the ZFC independence boundary lie?
5. Can the motif/phase/nesting framework predict BB champion properties for higher state counts?

## License

MIT
