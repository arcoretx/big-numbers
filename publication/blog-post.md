# The BB(5) Champion Grows by 5/3 Each Cycle

*An empirical analysis of the Busy Beaver 5-state champion's runtime dynamics*

---

In 2024, the [Busy Beaver Challenge](https://bbchallenge.org) proved that BB(5) = 47,176,870 — the maximum number of steps a 5-state Turing machine can run before halting. The champion machine leaves 4,098 ones on the tape. But *how* does it get there?

We ran the champion and tracked what happens inside. The answer surprised us.

## It doesn't build monotonically

The champion doesn't steadily accumulate ones. Instead, it follows a **crash-rebuild sawtooth pattern**: it builds up ones, then a cascade of erasures destroys most of them, then it rebuilds higher than before.

There are exactly 13 of these crash-rebuild cycles before the machine halts.

## An invariant tape structure

At the peak of every single cycle, the tape has the same structure:

```
[M ones] 010010010010010011
```

A contiguous block of M ones, followed by exactly 5 copies of the pattern `100`, followed by `11`. The tail (`010010010010010011`) is **identical at every peak** — only M changes.

## The 5/3 ratio

M follows a simple recurrence:

| Cycle | M | Peak (M+18) | Peak ratio |
|-------|---|-------------|------------|
| 1 | 2 | 20 | — |
| 2 | 20 | 38 | 1.90 |
| 3 | 50 | 68 | 1.79 |
| 4 | 100 | 118 | 1.74 |
| 5 | 182 | 200 | 1.69 |
| ... | ... | ... | ... |
| 11 | 4,402 | 4,420 | 1.668 |
| 12 | 7,352 | 7,370 | 1.667 |
| 13 | 12,270 | 12,288 | 1.667 |

The ratio converges to **5/3 = 1.66667**. Each cycle, the run length grows by a factor of 5/3.

This means 5/3 governs the entire machine:
- **Peak growth**: 5/3 per cycle
- **Crash survival**: 1/3 of ones survive each crash
- **Inter-crash intervals**: grow by (5/3)^2 = 25/9 per cycle

## The mechanism

The machine has 5 states. Two of them (B and D) are **sweepers** — they march back and forth through the ones, consuming 99.6% of all steps. The other three (A, C, E) fire less than 0.4% of the time but control everything.

**Build phase**: Sweepers bounce between the tape boundaries. Each boundary hit creates +2 ones, extending the run.

**Crash phase**: The ACE erasure chain fires. Each cycle of A→C→E processes 3 tape cells: A keeps one 1, C erases one, E erases one. Applied to N contiguous ones, the chain leaves `floor(N/3)` copies of the pattern `100`. It erases 2/3 of the ones.

**Why 5/3**: The crash erases 2/3 of the run. The rebuild refills everything AND extends by another 2/3 of M through boundary events. Net growth: M + (2/3)M = (5/3)M.

## Why this matters

1. **Nobody has published this before.** The BB community's focus was on *proving* BB(5) = 47,176,870. The question of *how* the champion behaves during its 47 million steps wasn't asked.

2. **The invariant structure is surprising.** A machine that runs for 47 million steps maintaining exactly 5 `100` blocks at every peak — that's extraordinary hidden order.

3. **The 5/3 ratio connects to the machine's structure.** 5 states, ratio 5/3. BB(4) shows 4/3 in its recovery dynamics. Whether this is coincidence or a deep connection is an open question.

## Additional findings

- **Late divergence**: Among 7.5M halting 3-state machines, the first 35% of execution is deeply ambiguous — machines with identical early steps can have any final score.
- **Champion fragility**: Every single-transition mutation of BB(5) either trivially extends it or completely destroys its dynamics.
- **BB(6) holdouts**: We classified 272 of the 1,214 undecided BB(6) machines as translated cyclers (definitively non-halting).

## Code

All analysis code is open source: [github.com/arcoretx/big-numbers](https://github.com/arcoretx/big-numbers)

---

*By Anthony Rose, with Claude. March 2026.*
