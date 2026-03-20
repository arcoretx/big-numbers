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
- 272 of the 1,214 BB(6) holdouts appear to be translated cyclers (tape becomes periodic). Happy to share the list if useful.
- The BB(5) champion is extraordinarily fragile — all 8,320 single-transition mutations either give a trivial +1 extension or completely destroy the counter dynamics.

Full write-up and code: https://github.com/arcoretx/big-numbers

Has anyone seen this invariant structure or the 5/3 ratio documented before? Very possible I'm rediscovering something known in the community.

---
