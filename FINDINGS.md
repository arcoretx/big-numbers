# The 5/3 Ratio: Crash Dynamics of the BB(5) Champion

## Summary

The BB(5) Busy Beaver champion (1RB1LC_1RC1RB_1RD0LE_1LA1LD_1RH0LA) executes 47,176,870 steps and leaves 4,098 ones on the tape. We present the first detailed empirical analysis of this machine's runtime dynamics, revealing that its behaviour is governed by a single ratio — **5/3** — that manifests in three converging constants:

| Constant | Converged Value | Relation to 5/3 |
|----------|----------------|-----------------|
| Peak growth ratio | 5/3 ≈ 1.667 | Direct |
| Survival fraction | 1/3 ≈ 0.333 | 1/(5/3 + 2/3) |
| Inter-crash interval ratio | 25/9 ≈ 2.778 | (5/3)^2 |

## The Crash-Rebuild Pattern

The BB(5) champion does not build ones monotonically. Instead, it exhibits **8 crash events** where the ones count drops dramatically before rebuilding:

| Crash | Start Step | Peak Ones | Trough | Loss % |
|-------|-----------|-----------|--------|--------|
| 1 | 35,000 | 335 | 183 | 45.4% |
| 2 | 99,000 | 563 | 263 | 53.3% |
| 3 | 280,000 | 947 | 389 | 58.9% |
| 4 | 785,000 | 1,585 | 593 | 62.6% |
| 5 | 2,190,000 | 2,647 | 945 | 64.3% |
| 6 | 6,098,000 | 4,417 | 1,537 | 65.2% |
| 7 | 16,963,000 | 7,367 | 2,525 | 65.7% |
| 8 | 47,164,000 | 12,285 | 4,098 | 66.6% |

The crashes follow geometric progressions:
- Each crash occurs **25/9 ≈ 2.778× later** than the previous one
- Each peak is **5/3× higher** than the previous peak
- Each crash destroys approximately **2/3 of the ones**, converging toward exactly 2/3

## Mechanism: Boundary Events and the ACE Erasure Chain

The machine spends 99.6% of its time in two transitions:
- **B,1 → 1RB** (right sweeper, 50% of all steps)
- **D,1 → 1LD** (left sweeper, 50% of all steps)

States A, C, and E fire <0.4% of the time but control the macro-dynamics entirely.

### Normal operation (between crashes)

When a sweeper hits the boundary of the ones region, it triggers a **boundary event**:
- `+B +C`: right boundary hit → extends boundary, creates 2 ones
- `+D +A`: left boundary hit → extends boundary, creates 2 ones

These are pure building events with zero erasure.

### Crash events

When the machine reaches a **macro-boundary** (determined by the tape's internal structure), it triggers the **ACE erasure chain**:

```
C reads 1 → writes 0, moves L, enters E    (−1 one)
E reads 1 → writes 0, moves L, enters A    (−1 one)
A reads 1 → writes 1, moves L, enters C    (no net change)
C reads 1 → writes 0, moves L, enters E    (−1 one)
... repeats until A hits a 0 ...
```

Each `=A −C −E` cycle erases 2 ones. The chain propagates leftward through the existing ones until A encounters a 0 and restarts the build cycle.

### The tape structure

The erasure chain leaves a signature pattern on the tape: **`100100100...`** — the digit sequence `100` repeated. This pattern acts as a **counter register**:
- More `100` blocks = longer until the next crash
- Each crash adds more `100` blocks
- The number of `100` blocks grows by a factor related to 5/3 each cycle

This is why the inter-crash intervals grow geometrically: the "counter" gets larger each cycle, and the machine must traverse the entire counter before the next crash triggers.

## The 5/3 Ratio Explained

The 5/3 ratio emerges from the boundary event accounting:

During a build phase between crashes, the machine performs ~N boundary events, each creating +2 ones. The number of boundary events is proportional to the tape length (the sweepers must traverse the full tape).

During a crash, the ACE chain erases ones proportional to the current tape content. The ratio of building-to-erasure is determined by the transition graph structure: 5 states, of which 3 (A, C, E) participate in the erasure chain, and the specific wiring creates a net balance where each rebuild cycle produces 5/3× the previous peak.

## Cross-BB Comparison

| BB(n) | Strategy | Peak growth | Crash interval | Loss fraction |
|-------|----------|------------|----------------|---------------|
| BB(2) | Flat bounce | N/A | N/A | N/A |
| BB(3) | Simple cycle | N/A | N/A | N/A |
| BB(4) | Nested oscillation | 3/2 | N/A | 1/peak |
| BB(5) | Crash-rebuild counter | 5/3 | (5/3)^2 = 25/9 | → 2/3 |

BB(4) shows 4/3 in its first trough-to-peak recovery ratio, suggesting a possible pattern where n-state machines exhibit dynamics related to n/3. However, BB(4) does not have crash-rebuild dynamics — it has gentle ±1 oscillations with rare macro-level jumps. The crash-rebuild counter is a qualitative innovation of BB(5).

## Relationship to the Oscillator/Counter Distinction

Not all machines with crash dynamics are productive counters. We identified a critical distinction:

- **Counters** (like BB(5)): crashes are **geometrically spaced** (growing intervals). The tape structure encodes a counter register that determines the spacing. These machines do exponentially more work between successive crashes.

- **Oscillators**: crashes are **constantly spaced** (ratio ≈ 1.0). The machine is trapped in a steady-state cycle of build-and-destroy. It never escapes to longer timescales.

This distinction is detectable computationally and appears to be a novel classification heuristic for undecided Turing machines.

## Methods

All analysis was performed by direct simulation in JavaScript (Node.js). The BB(5) champion was run for its full 47,176,870 steps. Crash events were detected by monitoring the ones count at 1,000-step intervals and flagging drops exceeding 100 ones. Boundary events were identified by tracking non-sweeper transitions (any transition other than B,1→1RB or D,1→1LD). Tape snapshots were captured at boundary events and crash events for structural analysis. LZ compression was used as an independent measure of state sequence structure.

All code is available at [github.com/arcoretx/big-numbers](https://github.com/arcoretx/big-numbers).
