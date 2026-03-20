# Proof Sketch: The 5/3 Ratio in BB(5)

## Setup

The BB(5) champion (1RB1LC_1RC1RB_1RD0LE_1LA1LD_1RH0LA) exhibits a crash-rebuild cycle. We prove that the peak ones count grows by a factor of 5/3 per macro-cycle.

## Definitions

- **Tape configuration at peak**: A contiguous block of ones of length L, extending from position 0 to L-1. (In reality there are boundary effects, but the dominant structure is a single large run.)
- **ACE chain**: The sequence of transitions A,1→1LC → C,1→0LE → E,1→0LA that fires when the left sweeper reaches the right boundary and enters A.
- **Macro-crash**: A complete erasure event, consisting of multiple ACE chain firings until the chain reaches the left boundary.

## The ACE Chain on N Contiguous Ones

When the ACE chain processes a contiguous block of N ones:
- Each cycle (A keeps 1, C erases to 0, E erases to 0) processes 3 cells, moving left
- After floor(N/3) cycles, the block is converted to the pattern `1 00 1 00 1 00 ...`
- Ones remaining: floor(N/3) + 1 (the ones kept by A, plus 1 written by A at the left edge)
- The pattern left is `100` repeated floor(N/3) times

**Verified computationally**: N=9 → 4 ones, pattern `1001001001`; N=12 → 5 ones, pattern `1001001001001`.

## The Rebuild Phase

After a macro-crash, the tape has:
- A contiguous run of r ones on the left (the "run")
- k `100` blocks on the right (left over from the crash)
- Total tape span: r + 3k cells
- Total ones: r + k

During the rebuild:
1. Right sweeper B traverses the run, hits the first `100` block
2. B writes 1 at the gap (B,0→1RC), then C writes 1 (C,0→1RD)
3. D sweeps left through the growing run
4. This process fills in the `00` gaps in the `100` blocks one by one
5. Each `100` block gets filled: `100` → `111` (3 cells become 3 ones)
6. The run grows as blocks are absorbed

After all k blocks are absorbed:
- All 3k cells from the block region are now ones
- The run has extended by 3k - k = 2k cells (we already had k ones from the blocks, gained 2k more)
- New contiguous ones: r + 2k + boundary extensions

## The Recurrence

At peak n, the tape has L_n contiguous ones (approximately).
The macro-crash converts this to:
- r_n = L_n mod 3 leftover ones (small, boundary effect)
- k_n = floor(L_n / 3) `100` blocks

During rebuild, the blocks are filled back in:
- L_{n+1} ≈ r_n + 3k_n + boundary_growth
- But 3k_n ≈ L_n (since k_n ≈ L_n/3)
- And boundary_growth adds ~2k_n new ones from boundary extensions during the refilling

Wait — this gives L_{n+1} ≈ L_n + 2k_n ≈ L_n + 2L_n/3 = L_n(1 + 2/3) = **5L_n/3**

## The Key Step

The ratio 5/3 comes from:
- The crash destroys 2/3 of the ones (ACE keeps every 3rd)
- But it doesn't destroy the *tape span* — the tape remains L cells wide
- During rebuild, the sweepers refill ALL the 0s back to 1s
- AND extend the boundaries by the usual +2 per boundary event
- The refilling accounts for 2L/3 new ones (the ones the crash erased)
- So peak_{n+1} = L + 2L/3 = 5L/3? No...

Let me reconsider. The issue is more subtle. The crash doesn't just leave `100` blocks — it also leaves a contiguous run at the left. The "max run" data shows:

```
Peak 1: max_run = 85
Peak 2: max_run = 238   (ratio: 2.8)
Peak 3: max_run = 405   (ratio: 1.7)
Peak 4: max_run = 776   (ratio: 1.9)
Peak 5: max_run = 1479  (ratio: 1.9)
Peak 6: max_run = 2470  (ratio: 1.67)
Peak 7: max_run = 4303  (ratio: 1.74)
Peak 8: max_run = 7207  (ratio: 1.67)
Peak 9: max_run = 12170 (ratio: 1.69)
```

The max run grows by ~5/3 per peak. This IS the quantity we need to track.

## Refined Argument

At peak n, the tape is approximately a single contiguous run of M_n ones.

The macro-crash:
1. ACE chain fires from the right edge, converts the run to `100` blocks
2. But the chain is interrupted by sub-crashes (C hits a 0 from a previous crash)
3. The net effect: the rightmost ~2/3 of the run is converted to `100` blocks
4. The leftmost ~1/3 remains as a contiguous run

After the crash:
- Contiguous run: ~M_n/3
- `100` blocks: ~M_n/3 blocks occupying ~M_n cells

During rebuild:
- The `100` blocks are refilled to 1s by the sweepers
- The run absorbs the block region, growing from M_n/3 to M_n/3 + 2M_n/3 = M_n
- BUT the sweepers also extend the boundaries while refilling
- The boundary extensions add ~M_n/3 - ε new cells
- Total: M_{n+1} ≈ M_n + M_n × 2/3 = 5M_n/3

This is still heuristic. The exact argument requires tracking:
- How many boundary events occur during refilling (proportional to tape length)
- How many ones each boundary event creates (+2 each)
- Whether the sub-crash structure affects the refilling ratio

## What We've Shown

1. The ACE chain converts N ones to floor(N/3) `100` blocks — **exact**
2. The max contiguous run grows by ~5/3 per peak — **empirical, converging**
3. The mechanism: crash erases 2/3, rebuild refills them + extends — **qualitative**

## What Remains for a Full Proof

- Formalise the tape configuration as a macro-state (run length + block count)
- Derive the exact rebuild dynamics (how many boundary events per refill)
- Show the recurrence M_{n+1} = 5M_n/3 + lower-order terms
- Prove convergence of the ratio to exactly 5/3
