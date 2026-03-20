/**
 * BB(6) Candidate Designer
 *
 * Uses structural principles from our BB(2)-(5) analysis to design
 * candidate 6-state Busy Beaver machines.
 *
 * Design principles (from our research):
 *   1. Two sweeper states (self-loops on read-1, opposite directions)
 *   2. Gap-makers (transitions that write 0)
 *   3. Reluctant halter (halt on read-0 in a rare state)
 *   4. Erasure chain (ACE-like cascade)
 *   5. Boundary events that create more than they erase
 *
 * Architecture templates:
 *   A: "Extended BB(5)" — add a 6th state to deepen the erasure chain
 *   B: "Double loop" — two counter mechanisms at different scales
 *   C: "Enhanced sweeper" — more complex boundary processing
 */

const NUM_STATES = 6;
const HALT = NUM_STATES;
const STATE_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'H'];

// ── Fast Simulator ───────────────────────────────────────────────────

function createTable(transitions) {
  const stateMap = {};
  STATE_NAMES.forEach((n, i) => stateMap[n] = i);
  const moveMap = { 'L': 0, 'R': 1 };
  const table = new Uint8Array(NUM_STATES * 2 * 3);
  for (const [state, read, write, move, next] of transitions) {
    const idx = stateMap[state] * 2 + read;
    table[idx * 3] = write;
    table[idx * 3 + 1] = moveMap[move];
    table[idx * 3 + 2] = stateMap[next];
  }
  return table;
}

function simulate(table, maxSteps, verbose = false) {
  const TAPE_SIZE = 131072;
  const tape = new Uint8Array(TAPE_SIZE);
  let head = Math.floor(TAPE_SIZE / 2);
  let state = 0, steps = 0, onesCount = 0;
  let minHead = head, maxHead = head;

  // Sampling for long runs
  const sampleInterval = Math.max(1, Math.floor(maxSteps / 1000));
  const samples = [];
  let prevOnes = 0;
  let maxOnes = 0;
  let crashes = 0;

  // State distribution
  const stateCounts = new Float64Array(NUM_STATES);

  while (steps < maxSteps) {
    const symbol = tape[head];
    const idx = (state * 2 + symbol) * 3;
    const write = table[idx], move = table[idx + 1], next = table[idx + 2];

    stateCounts[state]++;

    if (tape[head] === 0 && write === 1) onesCount++;
    if (tape[head] === 1 && write === 0) onesCount--;

    tape[head] = write;
    head += move === 1 ? 1 : -1;
    state = next;
    steps++;

    if (onesCount > maxOnes) maxOnes = onesCount;

    if (head < minHead) minHead = head;
    if (head > maxHead) maxHead = head;

    // Sample
    if (steps % sampleInterval === 0) {
      const delta = onesCount - prevOnes;
      if (delta < -10) crashes++;
      samples.push({ step: steps, ones: onesCount, delta });
      prevOnes = onesCount;
    }

    if (state === HALT) {
      return {
        halted: true, steps, ones: onesCount, maxOnes,
        tapeSpan: maxHead - minHead + 1, crashes, samples, stateCounts,
      };
    }

    if (head < 2 || head > TAPE_SIZE - 3) {
      return { halted: false, reason: 'tape_overflow', steps, ones: onesCount, maxOnes, crashes };
    }
  }

  return { halted: false, reason: 'step_limit', steps, ones: onesCount, maxOnes, crashes, samples, stateCounts };
}

// ── Motif Checker ────────────────────────────────────────────────────

function checkMotifs(table) {
  const motifs = {};
  const sweepers = [];
  const gapMakers = [];
  let haltState = -1, haltSymbol = -1;

  for (let state = 0; state < NUM_STATES; state++) {
    for (let symbol = 0; symbol < 2; symbol++) {
      const idx = (state * 2 + symbol) * 3;
      const write = table[idx], move = table[idx + 1], next = table[idx + 2];

      if (next === HALT) {
        haltState = state;
        haltSymbol = symbol;
      }
      if (next === state && write === 1) {
        sweepers.push({ state, symbol, dir: move === 1 ? 'R' : 'L' });
      }
      if (write === 0 && symbol === 1) {
        gapMakers.push({ state, symbol });
      }
    }
  }

  motifs.sweepers = sweepers;
  motifs.gapMakers = gapMakers;
  motifs.haltState = haltState;
  motifs.haltSymbol = haltSymbol;
  motifs.reluctantHalter = haltSymbol === 0;  // halt on 0 is "reluctant" from blank tape
  motifs.hasOppositeSweepers = sweepers.length >= 2 &&
    sweepers.some(s => s.dir === 'R') && sweepers.some(s => s.dir === 'L');

  return motifs;
}

// ── Pretty Print ─────────────────────────────────────────────────────

function printMachine(table, name) {
  console.log(`\n  ${name}:`);
  for (let state = 0; state < NUM_STATES; state++) {
    let row = `    ${STATE_NAMES[state]}: `;
    for (let symbol = 0; symbol < 2; symbol++) {
      const idx = (state * 2 + symbol) * 3;
      const w = table[idx];
      const m = table[idx + 1] === 1 ? 'R' : 'L';
      const n = STATE_NAMES[table[idx + 2]];
      row += `${symbol}→${w}${m}${n}  `;
    }
    console.log(row);
  }
}

function printResult(result, name) {
  if (result.halted) {
    console.log(`  ${name}: HALTED — ${result.ones} ones in ${result.steps.toLocaleString()} steps (max ones: ${result.maxOnes}, crashes: ${result.crashes})`);
  } else {
    console.log(`  ${name}: ${result.reason} after ${result.steps.toLocaleString()} steps (ones: ${result.ones}, max: ${result.maxOnes}, crashes: ${result.crashes})`);
  }

  // State distribution
  if (result.stateCounts) {
    const total = result.steps;
    const dist = Array.from(result.stateCounts).map((c, i) =>
      `${STATE_NAMES[i]}=${(c / total * 100).toFixed(1)}%`
    ).join(' ');
    console.log(`    State dist: ${dist}`);
  }
}

// ── Template A: Extended BB(5) ───────────────────────────────────────
// Keep BB(5) core, add F to deepen the erasure/counter mechanism
// BB(5): A→B→C→D sweep, ACE erasure chain
// Idea: F extends the chain: A-C-E becomes A-C-E-F or A-C-F-E

function templateA_variants() {
  const variants = [];

  // Base: BB(5) structure with F inserted into the erasure chain
  // B,D are sweepers. ACE is the old chain. F is new.

  // Variant A1: F inserted between E and A in erasure chain
  // Old chain: C,1→0LE, E,1→0LA (erase, erase, back to A)
  // New chain: C,1→0LE, E,1→0LF, F,1→0LA (three erasures per cycle!)
  variants.push({
    name: 'A1: Triple erasure chain (C→E→F→A)',
    transitions: [
      ['A', 0, 1, 'R', 'B'], ['A', 1, 1, 'L', 'C'],
      ['B', 0, 1, 'R', 'C'], ['B', 1, 1, 'R', 'B'],  // right sweeper
      ['C', 0, 1, 'R', 'D'], ['C', 1, 0, 'L', 'E'],  // eraser 1
      ['D', 0, 1, 'L', 'A'], ['D', 1, 1, 'L', 'D'],  // left sweeper
      ['E', 0, 1, 'R', 'H'], ['E', 1, 0, 'L', 'F'],  // eraser 2 → F (was → A)
      ['F', 0, 1, 'L', 'A'], ['F', 1, 0, 'L', 'A'],  // eraser 3 → A (halt moved to E,0)
    ],
  });

  // Variant A2: F as alternate boundary handler
  variants.push({
    name: 'A2: F as alternate boundary (deeper counter)',
    transitions: [
      ['A', 0, 1, 'R', 'B'], ['A', 1, 1, 'L', 'C'],
      ['B', 0, 1, 'R', 'C'], ['B', 1, 1, 'R', 'B'],
      ['C', 0, 1, 'R', 'D'], ['C', 1, 0, 'L', 'E'],
      ['D', 0, 1, 'L', 'A'], ['D', 1, 1, 'L', 'D'],
      ['E', 0, 1, 'L', 'F'], ['E', 1, 0, 'L', 'A'],  // E,0 → F instead of halt
      ['F', 0, 1, 'R', 'H'], ['F', 1, 1, 'R', 'B'],  // F,0 = halt, F,1 = restart sweep
    ],
  });

  // Variant A3: F creates a second level counter
  variants.push({
    name: 'A3: F as second counter level',
    transitions: [
      ['A', 0, 1, 'R', 'B'], ['A', 1, 1, 'L', 'C'],
      ['B', 0, 1, 'R', 'C'], ['B', 1, 1, 'R', 'B'],
      ['C', 0, 1, 'R', 'D'], ['C', 1, 0, 'L', 'E'],
      ['D', 0, 1, 'L', 'A'], ['D', 1, 1, 'L', 'D'],
      ['E', 0, 1, 'R', 'F'], ['E', 1, 0, 'L', 'A'],  // E,0 goes to F
      ['F', 0, 1, 'R', 'H'], ['F', 1, 0, 'L', 'C'],  // F,1 re-enters erasure at C
    ],
  });

  // Variant A4: Different erasure chain topology
  variants.push({
    name: 'A4: Branching erasure (C→E or C→F)',
    transitions: [
      ['A', 0, 1, 'R', 'B'], ['A', 1, 1, 'L', 'C'],
      ['B', 0, 1, 'R', 'C'], ['B', 1, 1, 'R', 'B'],
      ['C', 0, 1, 'R', 'D'], ['C', 1, 0, 'L', 'E'],
      ['D', 0, 1, 'L', 'F'], ['D', 1, 1, 'L', 'D'],  // D,0 → F instead of A
      ['E', 0, 1, 'R', 'H'], ['E', 1, 0, 'L', 'A'],
      ['F', 0, 1, 'R', 'A'], ['F', 1, 1, 'L', 'C'],  // F creates + redirects
    ],
  });

  return variants;
}

// ── Template B: Double Loop ──────────────────────────────────────────
// Two counter mechanisms at different scales
// Inner loop: fast oscillation. Outer loop: slow carry.

function templateB_variants() {
  const variants = [];

  // B1: B,E sweep. ACD inner counter. F outer counter.
  variants.push({
    name: 'B1: Dual-scale counter (ACD inner, F outer)',
    transitions: [
      ['A', 0, 1, 'R', 'B'], ['A', 1, 1, 'L', 'C'],
      ['B', 0, 1, 'R', 'C'], ['B', 1, 1, 'R', 'B'],  // right sweeper
      ['C', 0, 1, 'L', 'D'], ['C', 1, 0, 'L', 'F'],  // C,1 → F (outer counter)
      ['D', 0, 1, 'R', 'E'], ['D', 1, 0, 'R', 'A'],
      ['E', 0, 1, 'L', 'A'], ['E', 1, 1, 'L', 'E'],  // left sweeper
      ['F', 0, 1, 'R', 'H'], ['F', 1, 0, 'L', 'A'],  // F: outer counter + halt
    ],
  });

  // B2: Interleaved counters
  variants.push({
    name: 'B2: Interleaved counters (ACE + BDF)',
    transitions: [
      ['A', 0, 1, 'R', 'B'], ['A', 1, 1, 'L', 'C'],
      ['B', 0, 1, 'L', 'D'], ['B', 1, 1, 'R', 'B'],  // right sweeper
      ['C', 0, 1, 'R', 'D'], ['C', 1, 0, 'L', 'E'],
      ['D', 0, 1, 'R', 'E'], ['D', 1, 1, 'L', 'D'],  // left sweeper
      ['E', 0, 1, 'L', 'F'], ['E', 1, 0, 'L', 'A'],
      ['F', 0, 1, 'R', 'H'], ['F', 1, 0, 'R', 'C'],  // F recycles into C's chain
    ],
  });

  return variants;
}

// ── Template C: Collatz-inspired ─────────────────────────────────────
// Machines that implement Collatz-like functions on tape data
// These are known to produce enormous BB values

function templateC_variants() {
  const variants = [];

  // C1: Modified Collatz — if tape section is "even" do one thing, "odd" another
  variants.push({
    name: 'C1: Collatz-like branching',
    transitions: [
      ['A', 0, 1, 'R', 'B'], ['A', 1, 0, 'L', 'E'],
      ['B', 0, 1, 'R', 'C'], ['B', 1, 1, 'R', 'B'],
      ['C', 0, 1, 'L', 'D'], ['C', 1, 1, 'R', 'F'],
      ['D', 0, 1, 'L', 'A'], ['D', 1, 1, 'L', 'D'],
      ['E', 0, 1, 'R', 'H'], ['E', 1, 0, 'L', 'A'],
      ['F', 0, 1, 'L', 'C'], ['F', 1, 0, 'R', 'A'],
    ],
  });

  // C2: Three-way branch based on tape pattern
  variants.push({
    name: 'C2: Three-way Collatz',
    transitions: [
      ['A', 0, 1, 'R', 'B'], ['A', 1, 1, 'L', 'D'],
      ['B', 0, 1, 'L', 'C'], ['B', 1, 1, 'R', 'B'],
      ['C', 0, 1, 'R', 'A'], ['C', 1, 0, 'L', 'E'],
      ['D', 0, 1, 'R', 'F'], ['D', 1, 1, 'L', 'D'],
      ['E', 0, 1, 'L', 'F'], ['E', 1, 0, 'L', 'A'],
      ['F', 0, 1, 'R', 'H'], ['F', 1, 1, 'R', 'C'],
    ],
  });

  return variants;
}

// ── Template D: Guided random search ─────────────────────────────────
// Fix the skeleton (sweepers + halt), randomize the wiring

function templateD_random(count) {
  const variants = [];
  const moves = ['L', 'R'];
  const states = STATE_NAMES.slice(0, NUM_STATES);

  for (let i = 0; i < count; i++) {
    const transitions = [];

    // Fix: B is right sweeper, D is left sweeper
    // Fix: F,0 is halt (reluctant halter)
    for (let s = 0; s < NUM_STATES; s++) {
      for (let sym = 0; sym < 2; sym++) {
        const sName = STATE_NAMES[s];

        if (sName === 'B' && sym === 1) {
          transitions.push(['B', 1, 1, 'R', 'B']);  // right sweeper
          continue;
        }
        if (sName === 'D' && sym === 1) {
          transitions.push(['D', 1, 1, 'L', 'D']);  // left sweeper
          continue;
        }
        if (sName === 'F' && sym === 0) {
          transitions.push(['F', 0, 1, 'R', 'H']);  // halt
          continue;
        }

        // For read-0 transitions, strongly prefer writing 1 (boundary extension)
        const write = sym === 0 ? (Math.random() < 0.9 ? 1 : 0) : (Math.random() < 0.3 ? 0 : 1);
        const move = moves[Math.floor(Math.random() * 2)];

        // For next state, avoid going to halt except through F
        let next;
        do {
          next = states[Math.floor(Math.random() * states.length)];
        } while (next === 'H');

        transitions.push([sName, sym, write, move, next]);
      }
    }

    variants.push({ name: `D-random-${i + 1}`, transitions });
  }

  return variants;
}

// ── Run all templates ────────────────────────────────────────────────

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║       BB(6) CANDIDATE DESIGNER                         ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

const allVariants = [
  ...templateA_variants(),
  ...templateB_variants(),
  ...templateC_variants(),
];

const STEP_LIMIT = 10_000_000;

console.log(`Testing ${allVariants.length} designed candidates + 500 guided random (limit: ${STEP_LIMIT.toLocaleString()} steps)\n`);

console.log('═══ Designed Candidates ═══\n');

const results = [];

for (const variant of allVariants) {
  const table = createTable(variant.transitions);
  const motifs = checkMotifs(table);
  const result = simulate(table, STEP_LIMIT);

  printMachine(table, variant.name);
  console.log(`    Motifs: ${motifs.hasOppositeSweepers ? 'dual-sweep' : 'NO dual-sweep'}, ` +
    `${motifs.gapMakers.length} gap-makers, ` +
    `${motifs.reluctantHalter ? 'reluctant-halt' : 'eager-halt'}`);
  printResult(result, '  Result');
  console.log();

  results.push({ ...result, name: variant.name, motifs });
}

// ── Guided random search ─────────────────────────────────────────────

console.log('═══ Guided Random Search (500 candidates) ═══\n');

const randomVariants = templateD_random(500);
const randomResults = [];

for (const variant of randomVariants) {
  const table = createTable(variant.transitions);
  const motifs = checkMotifs(table);
  const result = simulate(table, STEP_LIMIT);
  randomResults.push({ ...result, name: variant.name, transitions: variant.transitions, motifs });
}

// Sort by ones (halted first, then by ones)
randomResults.sort((a, b) => {
  if (a.halted && !b.halted) return -1;
  if (!a.halted && b.halted) return 1;
  if (a.halted && b.halted) return b.ones - a.ones;
  return b.maxOnes - a.maxOnes;
});

const haltedRandom = randomResults.filter(r => r.halted);
const nonHaltedRandom = randomResults.filter(r => !r.halted);

console.log(`  Halted: ${haltedRandom.length} / 500`);
console.log(`  Non-halted: ${nonHaltedRandom.length} (${nonHaltedRandom.filter(r => r.reason === 'tape_overflow').length} tape overflow, ${nonHaltedRandom.filter(r => r.reason === 'step_limit').length} step limit)\n`);

if (haltedRandom.length > 0) {
  console.log('  Top 10 halted (by ones):');
  for (const r of haltedRandom.slice(0, 10)) {
    console.log(`    ${r.ones} ones, ${r.steps.toLocaleString()} steps, ${r.crashes} crashes`);
    // Print transition table
    for (const [s, sym, w, m, n] of r.transitions) {
      process.stdout.write(`      ${s},${sym}→${w}${m}${n}  `);
      if (sym === 1) console.log();
    }
  }
}

// Show most interesting non-halted (highest maxOnes = potentially powerful)
console.log('\n  Top 10 non-halted (by max ones — potential champions if they halt):');
const interesting = nonHaltedRandom
  .filter(r => r.reason === 'step_limit')
  .sort((a, b) => b.maxOnes - a.maxOnes);

for (const r of interesting.slice(0, 10)) {
  console.log(`    max ${r.maxOnes} ones (current: ${r.ones}), ${r.crashes} crashes, ${r.reason}`);
  if (r.stateCounts) {
    const total = r.steps;
    const dominant = Array.from(r.stateCounts)
      .map((c, i) => ({ state: STATE_NAMES[i], pct: c / total * 100 }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3)
      .map(s => `${s.state}=${s.pct.toFixed(0)}%`)
      .join(' ');
    console.log(`      States: ${dominant}`);
  }
}

// ── Summary ──────────────────────────────────────────────────────────

console.log('\n═══ Overall Summary ═══\n');
const allResults = [...results, ...randomResults];
const allHalted = allResults.filter(r => r.halted).sort((a, b) => b.ones - a.ones);

if (allHalted.length > 0) {
  console.log(`  Best halting machine: ${allHalted[0].ones} ones in ${allHalted[0].steps.toLocaleString()} steps`);
  console.log(`  Name: ${allHalted[0].name}`);
} else {
  console.log('  No machines halted within the step limit.');
}

const mostOnes = allResults.sort((a, b) => b.maxOnes - a.maxOnes)[0];
console.log(`\n  Highest max-ones seen: ${mostOnes.maxOnes} (${mostOnes.halted ? 'halted' : mostOnes.reason})`);
console.log(`  Name: ${mostOnes.name}`);
