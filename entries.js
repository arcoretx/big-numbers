const ENTRIES = [
    // ── PHASE: Numbers you can write down ──────────────────────────
    {
        type: "phase",
        title: "Numbers You Can Write Down",
        desc: "Familiar territory. You could fit these on paper.",
        phase: "mundane"
    },
    {
        name: "A million",
        value: "1,000,000",
        category: "mundane",
        description: "A million seconds is about 11.5 days. You could count to a million in a couple weeks if you didn't sleep.",
        funFact: "A stack of a million dollar bills would be about 360 feet tall — roughly the Statue of Liberty.",
        interactive: "millionDots"
    },
    {
        name: "A billion",
        value: "1,000,000,000",
        category: "mundane",
        description: "A billion seconds is about 31.7 years. If you started counting one number per second at birth, you'd hit a billion in your early thirties. The jump from million to billion is the jump from \"a lot of money\" to \"more money than you could spend in a lifetime.\"",
        funFact: "A billion is a thousand millions. Humans are bad at feeling this difference."
    },
    {
        name: "Atoms in your body",
        value: "~7 × 10²⁸",
        approx: "70,000,000,000,000,000,000,000,000,000",
        category: "mundane",
        description: "About 7 octillion atoms make up a human body. Mostly hydrogen, oxygen, and carbon. Each one has been inside multiple stars."
    },
    {
        name: "Atoms in the observable universe",
        value: "~10⁸⁰",
        category: "large",
        description: "Everything you can see, every galaxy, every star, every grain of sand — all of it adds up to roughly 10⁸⁰ atoms. This number will seem quaint very soon.",
        funFact: "This is sometimes used as a benchmark for \"physically meaningful\" numbers. We're about to leave physical meaning behind."
    },
    {
        name: "Googol",
        value: "10¹⁰⁰",
        category: "large",
        description: "A 1 followed by 100 zeros. Larger than the number of atoms in the observable universe. Coined by a 9-year-old (Milton Sirotta), nephew of mathematician Edward Kasner, who asked him to make up a name for a really big number.",
        funFact: "Google is named after this number (misspelled). The company liked the idea of organizing a googol of information."
    },
    {
        name: "Shannon Number",
        value: "~10¹²⁰",
        category: "large",
        description: "An estimate of the number of possible chess games. Claude Shannon calculated it in 1950. There are more possible chess games than atoms in the universe — by a factor of 10⁴⁰.",
        funFact: "And yet computers now play chess better than any human who has ever lived."
    },
    {
        name: "Possible games of Go",
        value: "~10⁷⁰⁰",
        category: "large",
        description: "Go has a 19×19 board and simple rules, but the number of possible games is so large it makes the Shannon Number look like a rounding error. This is why Go resisted AI so much longer than chess.",
        funFact: "10⁷⁰⁰ is not just \"bigger\" than 10¹²⁰ — it's 10⁵⁸⁰ times bigger. That ratio is itself incomprehensibly large."
    },
    {
        name: "Googolplex",
        value: "10^(10¹⁰⁰)",
        category: "large",
        description: "10 raised to the power of a googol. A 1 followed by a googol zeros. You could not write this number out even if you used every particle in the universe as a digit.",
        viz: "Writing one digit per atom:\n\nAtoms in universe:  10⁸⁰\nDigits in googolplex: 10¹⁰⁰\n\nYou'd need 10²⁰ universes worth of atoms\njust to write the number down.",
        funFact: "If you could somehow write a digit every Planck time (5.39 × 10⁻⁴⁴ seconds), and started at the Big Bang, you'd have written about 10⁶¹ digits. Not even close."
    },

    // ── PHASE: Numbers you can't write down ────────────────────────
    {
        type: "phase",
        title: "Numbers You Can't Write Down",
        desc: "Normal notation fails here. We need new ways to even talk about these.",
        phase: "enormous"
    },
    {
        name: "Knuth's Up-Arrow Notation",
        value: "A new language for bigness",
        category: "enormous",
        description: "Regular exponentiation (a^b) isn't enough. Donald Knuth invented arrows to describe faster-growing operations. Each arrow represents a level of repeated application:",
        interactive: "arrowExplorer",
        funFact: "Each new arrow doesn't just make things bigger — it makes the previous growth rate look like standing still."
    },
    {
        name: "Graham's Number",
        value: "g₆₄",
        category: "enormous",
        description: "Start with 3 ↑↑↑↑ 3 — already unimaginably large. Call that g₁. Now use g₁ as the number of arrows between two 3s. That's g₂. Repeat this process 64 times. The final result is Graham's Number.",
        viz: "g₁ = 3 ↑↑↑↑ 3\ng₂ = 3 ↑↑↑...↑↑↑ 3   (g₁ arrows)\ng₃ = 3 ↑↑↑...↑↑↑ 3   (g₂ arrows)\n...\ng₆₄ = Graham's Number\n\nEach step is not \"a bit bigger.\"\nEach step uses the PREVIOUS number\nas the DEFINITION of how fast to grow.",
        funFact: "Graham's Number was once the largest number ever used in a serious mathematical proof. Its last 500 digits are known (they stabilize), but almost nothing else about it is. It ends in 7."
    },
    {
        name: "TREE(3)",
        value: "Incomprehensibly larger than Graham's Number",
        category: "enormous",
        description: "Consider a game: you plant trees using at most 3 colors for the nodes. Rule: tree k has at most k nodes, and no earlier tree can be \"embedded\" in a later one. How long can you keep going? TREE(1) = 1. TREE(2) = 3. TREE(3) is a number so large that Graham's Number is essentially zero by comparison.",
        viz: "TREE(1) = 1\nTREE(2) = 3\nTREE(3) = a number that dwarfs\n          Graham's Number so completely\n          that no tower of arrows,\n          no matter how tall,\n          can reach it.\n\nThe function grows faster than anything\nin the fast-growing hierarchy below Γ₀.",
        funFact: "The mathematician Harvey Friedman, who discovered this, specifically designed it to be a natural-sounding theorem with an unimaginably large answer. The rules are simple enough for a child. The answer breaks mathematics."
    },
    {
        name: "SCG(13)",
        value: "Even TREE(3) is nothing",
        category: "enormous",
        description: "The Simple Subcubic Graph number. Related to graph theory — how long can a sequence of graphs be under certain embedding rules? SCG(13) makes TREE(3) look like a rounding error, in the same way TREE(3) makes Graham's Number look like nothing.",
        funFact: "We're running out of ways to say \"bigger.\" Each of these numbers doesn't just exceed the last — it exceeds it by more than all previous gaps combined."
    },

    // ── PHASE: The uncomputable frontier ────────────────────────────
    {
        type: "phase",
        title: "The Uncomputable Frontier",
        desc: "These numbers exist, but no algorithm can ever compute them. Not because we're not clever enough — because computation itself has limits.",
        phase: "incomputable"
    },
    {
        name: "Busy Beaver — BB(3)",
        value: "21 steps, 6 ones",
        category: "incomputable",
        description: "The Busy Beaver function BB(n) asks: what's the most steps a Turing machine with n states can take before halting? Watch a 3-state Busy Beaver run — it writes 6 ones in 21 steps, then halts. This is the maximum possible for 3 states.",
        interactive: "busyBeaverTape",
        funFact: "This tiny machine is doing something provably maximal — no 3-state machine can run longer and still halt."
    },
    {
        name: "BB(5)",
        value: "47,176,870",
        category: "incomputable",
        description: "BB(5) was only pinned down in 2024 by a mass collaboration of mathematicians and computer scientists called the Busy Beaver Challenge. It required proving that every single 5-state Turing machine either halts or loops — all 88 million+ of them.",
        viz: "BB(1) = 1\nBB(2) = 6\nBB(3) = 21\nBB(4) = 107\nBB(5) = 47,176,870\nBB(6) = ? (≥ 10↑↑15)\nBB(7) = ?\n...\n\nEach step gets dramatically harder\nto determine. Not harder to compute —\nharder to KNOW.",
        funFact: "The jump from BB(4) = 107 to BB(5) ≈ 47 million is dramatic. The jump to BB(6) is incomparably worse."
    },
    {
        name: "BB(6)",
        value: "≥ 10 ↑↑ 15",
        category: "incomputable",
        description: "We only have lower bounds. One 6-state Turing machine is known to run for at least 10↑↑15 steps (a tower of 10s fifteen levels high). The actual value of BB(6) could be vastly larger. We may never know it.",
        funFact: "The jump from BB(5) ≈ 47 million to BB(6) ≥ 10↑↑15 is where the Busy Beaver function starts to show its true nature. It's not just growing fast — it's growing faster than any computable function."
    },
    {
        name: "BB(748)",
        value: "Independent of ZFC",
        category: "incomputable",
        description: "This is where mathematics itself breaks. A 748-state Turing machine can be constructed that halts if and only if ZFC (the standard foundations of mathematics) is inconsistent. So determining BB(748) would require proving whether mathematics itself is consistent — which Gödel showed is impossible from within the system.",
        viz: "To know BB(748), you would need to know\nif standard mathematics is consistent.\n\nGödel's Second Incompleteness Theorem:\nNo consistent system can prove\nits own consistency.\n\nSo BB(748) is forever unknowable\n(from within ZFC).",
        funFact: "748 is not special — it's just the current best bound for embedding a ZFC consistency check. The actual threshold where BB becomes independent of ZFC might be much lower."
    },
    {
        name: "Rayo's Number",
        value: "Rayo(10¹⁰⁰)",
        category: "incomputable",
        description: "The largest number definable in first-order set theory using at most a googol symbols. Invented by Agustín Rayo in a \"Big Number Duel\" at MIT in 2007. His opponent, Adam Elga, had written a large number. Rayo defined a function and applied it to a googol, winning the duel by an unfathomable margin.",
        funFact: "Rayo's Number is not just uncomputable — it's not even definable by any \"natural\" fast-growing function. It transcends the entire framework of recursive function theory."
    },

    // ── PHASE: Infinity begins ──────────────────────────────────────
    {
        type: "phase",
        title: "Infinity Begins",
        desc: "Everything before was finite. Now we cross the threshold — and discover that infinity itself has structure.",
        phase: "infinite"
    },
    {
        name: "ℵ₀ (Aleph-null)",
        value: "The smallest infinity",
        category: "infinite",
        description: "The size of the natural numbers: 1, 2, 3, 4, ... This is \"countable\" infinity. Remarkably, the even numbers, the integers, the rational numbers, and even the algebraic numbers all have this same size. You can line them all up one-to-one with the naturals.",
        interactive: "hilbertHotel",
        funFact: "Hilbert's Hotel: a hotel with infinitely many rooms, all full, can always fit more guests. One more guest? Everyone shifts up one room. Infinitely many new guests? Everyone moves to double their room number, freeing all odd rooms."
    },
    {
        name: "The Continuum — 2^ℵ₀",
        value: "The size of the real numbers",
        category: "infinite",
        description: "Cantor proved that the real numbers are strictly larger than the naturals using his diagonal argument. Given any list of real numbers, you can always construct a new one not on the list by differing from the nth number in its nth digit. The reals are \"uncountably\" infinite.",
        interactive: "cantorDiagonal",
        funFact: "This proof requires no computation, no formula — just a clever argument. Cantor published it in 1891 and it scandalized mathematics."
    },
    {
        name: "The Continuum Hypothesis",
        value: "Is there anything between ℵ₀ and 2^ℵ₀?",
        category: "infinite",
        description: "Cantor's first conjecture: there is no set whose size is strictly between the natural numbers and the real numbers. In 1940, Gödel showed you can't disprove it. In 1963, Cohen showed you can't prove it. It is independent of ZFC — undecidable not because we're not smart enough, but because the axioms genuinely don't determine the answer.",
        funFact: "This was the first of Hilbert's 23 problems in 1900 — the most famous unsolved problems in mathematics. Its \"solution\" was that it has no solution."
    },
    {
        name: "ℶ₂ (Beth-two)",
        value: "2^(2^ℵ₀)",
        category: "infinite",
        description: "The power set of the reals — the set of ALL subsets of the real numbers. This is strictly larger than the reals. Every time you take a power set, you jump to a genuinely bigger infinity. The Beth numbers climb this ladder: ℶ₀ = ℵ₀, ℶ₁ = 2^ℵ₀, ℶ₂ = 2^ℶ₁, ...",
        interactive: "powerSet",
        funFact: "ℶ₂ is the number of possible topologies on the real line, and roughly the number of possible functions from ℝ to ℝ."
    },
    {
        name: "ℵ_ω (Aleph-omega)",
        value: "The first limit cardinal",
        category: "infinite",
        description: "ℵ₁, ℵ₂, ℵ₃, ... each is the next bigger infinity. But what comes after ALL of them? ℵ_ω — the first cardinal you can't reach by just taking successors. It's the limit of the sequence. And then there's ℵ_{ω+1}, ℵ_{ω+2}, ... and ℵ_{ω·2}, and ℵ_{ω²}, and ℵ_{ω^ω}, and...",
        funFact: "The subscripts themselves are ordinal numbers, and ordinals have their own dizzying hierarchy. The indexing system is itself infinite."
    },

    // ── PHASE: Large Cardinals ─────────────────────────────────────
    {
        type: "phase",
        title: "Large Cardinals",
        desc: "Infinities so large that their existence cannot be proven from the standard axioms. Each one is a leap of faith — and each one, if it exists, implies all the smaller ones do too.",
        phase: "large-cardinal"
    },
    {
        name: "Inaccessible Cardinals",
        value: "Can't be reached from below",
        category: "large-cardinal",
        description: "An inaccessible cardinal κ is so large that you can't reach it by any combination of the operations available in ZFC. Not by taking power sets, not by taking unions, not by any construction. The universe of sets below κ is itself a complete model of ZFC — a \"universe within the universe.\"",
        funFact: "If an inaccessible cardinal exists, it proves that ZFC is consistent — but Gödel showed ZFC can't prove its own consistency. So ZFC can't prove inaccessibles exist. You have to add them as an axiom."
    },
    {
        name: "Mahlo Cardinals",
        value: "Inaccessibles all the way down",
        category: "large-cardinal",
        description: "A Mahlo cardinal is so large that the set of inaccessible cardinals below it is \"stationary\" — in a precise sense, there are inaccessibles everywhere below it. Being inaccessible is the baseline, and a Mahlo cardinal is inaccessible on top of that.",
        funFact: "Named after Paul Mahlo, who studied them in 1911 — before even Gödel's incompleteness theorems."
    },
    {
        name: "Measurable Cardinals",
        value: "Admits a non-trivial measure",
        category: "large-cardinal",
        description: "A measurable cardinal supports a special kind of \"measure\" — a way to say which subsets are \"large\" and which are \"small\" that is consistent and non-trivial. Their existence implies the consistency of everything below them and has consequences for the structure of the real number line.",
        funFact: "Measurable cardinals were the first large cardinals shown to have consequences for \"ordinary\" mathematics — they affect what's true about sets of real numbers."
    },
    {
        name: "Woodin Cardinals",
        value: "Named for the living mathematician",
        category: "large-cardinal",
        description: "Hugh Woodin showed that if there are infinitely many Woodin cardinals, then all \"projective\" sets of reals are well-behaved (Lebesgue measurable, have the Baire property, etc.). These cardinals are an essential tool in modern set theory and connect large cardinal axioms to concrete facts about the real numbers.",
        funFact: "Woodin himself has proposed the \"Ultimate L\" program — an attempt to find a definitive model of set theory that resolves the Continuum Hypothesis. The project is ongoing."
    },
    {
        name: "Rank-into-Rank Cardinals",
        value: "Near the edge of consistency",
        category: "large-cardinal",
        description: "These are defined by the existence of \"elementary embeddings\" — structure-preserving maps from a level of the set-theoretic universe into itself. They sit near the very top of the large cardinal hierarchy, just below known inconsistency.",
        funFact: "Mathematicians are not fully certain these are consistent. They might break everything. But no contradiction has been found, and they have beautiful consequences if they do exist."
    },
    {
        name: "Kunen's Inconsistency",
        value: "The ceiling",
        category: "large-cardinal",
        description: "In 1971, Kenneth Kunen proved that certain kinds of elementary embeddings simply cannot exist (assuming the Axiom of Choice). This is the \"here be dragons\" sign at the top of the large cardinal hierarchy — the boundary between what might be true and what definitely isn't.",
        interactive: "cardinalTower",
        funFact: "Beyond Kunen's boundary, we don't get \"bigger infinities.\" We get contradictions. The mathematical universe has a ceiling — or at least, a ceiling we can see from here."
    },

    // ── PHASE: The End ─────────────────────────────────────────────
    {
        type: "phase",
        title: "The view from here",
        desc: "You scrolled through numbers that can't be written, can't be computed, and can't be proven to exist. And we've only scratched the surface.",
        phase: "end"
    },
    {
        name: "What we've traversed",
        value: "",
        category: "mundane",
        description: "From a million — a number you could count on a long weekend — to the boundary of mathematical consistency. Each phase broke the rules of the phase before it. Notation, computation, provability, existence itself — each has a ceiling, and each ceiling reveals a bigger room above it.",
        funFact: "The question isn't whether bigger things exist. The question is whether \"exist\" still means what you think it means."
    }
];
