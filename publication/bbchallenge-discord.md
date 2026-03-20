# Message for bbchallenge Discord

---

**Subject: Empirical analysis of BB(5) champion dynamics — the 5/3 ratio**

Hi all — I've been doing an empirical analysis of the BB(5) champion's runtime dynamics and found some results I haven't seen published elsewhere. Sharing here in case they're useful or already known.

**Main finding:** The tape at every macro-crash peak has an exact invariant form:

```
[M ones] 010010010010010011
```

The 18-cell tail (5 copies of `100` plus `11`) is constant across all 13 macro-crash cycles. Only M changes, following the recurrence:

**M_{n+1} ≈ (5/3) × M_n**

Verified to 4 decimal places by cycle 13. The M values are: 2, 20, 50, 100, 182, 320, 550, 932, 1570, 2632, 4402, 7352, 12270.

**The mechanism:** The ACE chain converts N contiguous ones to floor(N/3) copies of `100` (erasing 2/3). The rebuild phase refills everything and adds ~(2/3)M extra ones through boundary extensions. Net: (5/3)M.

**Consequences:**
- Peak growth ratio → 5/3
- Crash survival → 1/3
- Inter-crash interval ratio → (5/3)^2 = 25/9

**Open problem:** Prove that the boundary event count during rebuild produces exactly (2/3)M extra ones in the limit.

**Other findings from the same analysis:**
- Applied snapshot-based cycle detection to all 1,214 BB(6) holdouts. Detected repeating (state, tape_window) configurations in **1,106 machines**: 312 simple loops (head_delta=0, bounded tape) and 794 translated cyclers (nonzero head_delta). However, ~370 of the "translated cyclers" have very small head deltas and need stronger verification. Happy to share the full list and discuss methodology.
- The BB(5) champion is extraordinarily fragile — all 8,320 single-transition mutations either give a trivial +1 extension or completely destroy the counter dynamics.

Note: I'm not sure if these holdout machines have already been classified by more sophisticated methods that I'm not aware of. Our cycle detection uses a 60-cell tape window snapshot at 100-step intervals, with double or triple verification. Please let me know if this approach has known failure modes in this context.

Full write-up and code: https://github.com/arcoretx/big-numbers

I'm aware of the Collatz-like function on the wiki page and Pascal Michel's configuration analysis C(3k) → C(5k+6), and that the 5/3 ratio is implicit in these. What I haven't seen documented is the phenomenological side: the invariant tape pattern (5 fixed `100` blocks at every peak), the crash dynamics as a sawtooth with explicitly converging constants (5/3, 1/3, 25/9), or the connection between the Collatz coefficients and these empirical dynamics. Also: the bbchallenge space-time diagram presumably shows the sawtooth visually, but has anyone written up the quantitative analysis? Happy to be pointed to prior work.

---
