/**
 * BB(6) Structured Design — Erasure Chains That Create Rich Patterns
 *
 * Key insight from BB(5): the ACE erasure chain leaves `100100100...`
 * inside the ones region. This structured pattern acts as a counter
 * that determines the length of subsequent sweeps.
 *
 * Design goal: create 6-state machines whose erasure chains leave
 * RICHER internal patterns — multi-level structure that encodes
 * deeper counting, potentially yielding super-exponential growth.
 *
 * Approach:
 *   - B, D remain sweepers (fixed)
 *   - A, C, E, F form a 4-state erasure/boundary chain
 *   - The chain must leave non-trivial patterns inside the ones region
 *   - Early rejection of translated cyclers (periodic tape = boring)
 */

const NUM_STATES = 6;
const HALT = NUM_STATES;
const STATE_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'H'];

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

function simulate(table, maxSteps) {
  const TAPE_SIZE = 262144;
  const tape = new Uint8Array(TAPE_SIZE);
  const CENTER = Math.floor(TAPE_SIZE / 2);
  let head = CENTER, state = 0, steps = 0, onesCount = 0;
  let maxOnes = 0, minHead = CENTER, maxHead = CENTER;

  // State visit tracking
  const stateCounts = new Float64Array(NUM_STATES);
  const statesUsed = new Set();

  // Periodic tape detection (check every N steps)
  const CHECK_INTERVAL = 5000;
  let lastCheckOnes = 0;
  let stuckCount = 0;
  let crashes = 0;

  // Track tape complexity
  let maxTrigrams = 0;

  while (steps < maxSteps) {
    const symbol = tape[head];
    const idx = (state * 2 + symbol) * 3;
    const write = table[idx], move = table[idx + 1], next = table[idx + 2];

    stateCounts[state]++;
    statesUsed.add(state);

    if (tape[head] === 0 && write === 1) onesCount++;
    if (tape[head] === 1 && write === 0) onesCount--;
    tape[head] = write;
    head += move === 1 ? 1 : -1;
    state = next;
    steps++;

    if (onesCount > maxOnes) maxOnes = onesCount;
    if (head < minHead) minHead = head;
    if (head > maxHead) maxHead = head;

    // Periodic check: if ones grows linearly with no crashes,
    // it's likely a translated cycler
    if (steps % CHECK_INTERVAL === 0) {
      const delta = onesCount - lastCheckOnes;
      if (delta < -50) crashes++;

      // Detect translated cycler: constant growth rate, no crashes
      if (crashes === 0 && steps > 20000) {
        // Check if tape is periodic
        const span = maxHead - minHead;
        if (span > 100) {
          let isPeriodic = true;
          for (let period = 2; period <= 4; period++) {
            isPeriodic = true;
            for (let i = minHead + period; i <= maxHead - period; i++) {
              if (tape[i] !== tape[i - period]) { isPeriodic = false; break; }
            }
            if (isPeriodic) {
              return {
                halted: false, reason: 'translated_cycler', steps, ones: onesCount,
                maxOnes, crashes, stateCounts, statesUsed: statesUsed.size,
                period,
              };
            }
          }
        }
      }

      lastCheckOnes = onesCount;
    }

    if (state === HALT) {
      // Measure tape complexity at halt
      const trigrams = new Set();
      for (let i = minHead; i < maxHead - 2; i++) {
        trigrams.add(`${tape[i]}${tape[i+1]}${tape[i+2]}`);
      }

      return {
        halted: true, steps, ones: onesCount, maxOnes, crashes,
        stateCounts, statesUsed: statesUsed.size,
        tapeComplexity: trigrams.size,
        tapeSpan: maxHead - minHead,
      };
    }

    if (head < 2 || head > TAPE_SIZE - 3) {
      return {
        halted: false, reason: 'tape_overflow', steps, ones: onesCount,
        maxOnes, crashes, stateCounts, statesUsed: statesUsed.size,
      };
    }
  }

  // Measure tape complexity at end
  const trigrams = new Set();
  for (let i = minHead; i < maxHead - 2; i++) {
    trigrams.add(`${tape[i]}${tape[i+1]}${tape[i+2]}`);
  }

  return {
    halted: false, reason: 'step_limit', steps, ones: onesCount,
    maxOnes, crashes, stateCounts, statesUsed: statesUsed.size,
    tapeComplexity: trigrams.size,
  };
}

function printResult(name, r) {
  const status = r.halted
    ? `HALTED ${r.ones} ones, ${r.steps.toLocaleString()} steps`
    : `${r.reason} at ${r.steps.toLocaleString()} steps (ones=${r.ones}, max=${r.maxOnes})`;
  const dist = Array.from(r.stateCounts)
    .map((c, i) => ({ s: STATE_NAMES[i], p: c / r.steps * 100 }))
    .filter(x => x.p > 0.1)
    .sort((a, b) => b.p - a.p)
    .map(x => `${x.s}=${x.p.toFixed(0)}%`)
    .join(' ');
  const complexity = r.tapeComplexity ? ` tape-3grams=${r.tapeComplexity}` : '';
  console.log(`  ${name}`);
  console.log(`    ${status} crashes=${r.crashes} states_used=${r.statesUsed}${complexity}`);
  console.log(`    [${dist}]`);
}

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║   BB(6) STRUCTURED DESIGN — Rich Erasure Patterns      ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

const STEP_LIMIT = 50_000_000;

// ═══ Hand-designed candidates ════════════════════════════════════════

console.log('═══ Hand-Designed Candidates ═══\n');

// BB(5)'s erasure: =A -C -E =A -C -E ...  (period 3, leaves 100100100)
// Goal: make the chain period 4+ using F, leaving richer patterns

const handDesigned = [
  {
    // Chain: A→C→F→E→A (4-state chain instead of 3)
    // C erases, F keeps, E erases → leaves `10010` per cycle?
    name: 'H1: 4-state chain A→C→F→E (C,E erase, F keeps)',
    transitions: [
      ['A', 0, 1, 'R', 'B'], ['A', 1, 1, 'L', 'C'],
      ['B', 0, 1, 'R', 'C'], ['B', 1, 1, 'R', 'B'],
      ['C', 0, 1, 'R', 'D'], ['C', 1, 0, 'L', 'F'],  // C erases → F
      ['D', 0, 1, 'L', 'A'], ['D', 1, 1, 'L', 'D'],
      ['E', 0, 1, 'R', 'H'], ['E', 1, 0, 'L', 'A'],  // E erases → A
      ['F', 0, 1, 'L', 'E'], ['F', 1, 1, 'L', 'E'],  // F keeps → E (always)
    ],
  },
  {
    // Chain: A→C→E→F→A (F at the end, erases too)
    // Three erasers! Pattern: `10000` per cycle?
    name: 'H2: Triple eraser A→C→E→F (C,E,F all erase)',
    transitions: [
      ['A', 0, 1, 'R', 'B'], ['A', 1, 1, 'L', 'C'],
      ['B', 0, 1, 'R', 'C'], ['B', 1, 1, 'R', 'B'],
      ['C', 0, 1, 'R', 'D'], ['C', 1, 0, 'L', 'E'],
      ['D', 0, 1, 'L', 'A'], ['D', 1, 1, 'L', 'D'],
      ['E', 0, 1, 'R', 'H'], ['E', 1, 0, 'L', 'F'],  // E → F
      ['F', 0, 1, 'L', 'A'], ['F', 1, 0, 'L', 'A'],  // F erases → A (halt on E,0)
    ],
  },
  {
    // F BRANCHES: on read-1 goes to E (erasure), on read-0 goes to A (restart)
    // This means F reads the existing pattern and decides whether to continue erasing
    name: 'H3: F branches on tape content (content-dependent erasure)',
    transitions: [
      ['A', 0, 1, 'R', 'B'], ['A', 1, 1, 'L', 'C'],
      ['B', 0, 1, 'R', 'C'], ['B', 1, 1, 'R', 'B'],
      ['C', 0, 1, 'R', 'D'], ['C', 1, 0, 'L', 'F'],  // C erases → F
      ['D', 0, 1, 'L', 'A'], ['D', 1, 1, 'L', 'D'],
      ['E', 0, 1, 'R', 'H'], ['E', 1, 0, 'L', 'A'],
      ['F', 0, 1, 'L', 'A'], ['F', 1, 0, 'L', 'E'],  // F,0→restart, F,1→continue erasing
    ],
  },
  {
    // F reads previous crash pattern and branches
    // If F sees a 0 (from a previous crash), it does something different
    // than if it sees a 1 (fresh territory)
    name: 'H4: F reads crash history (0→restart sweep, 1→erase deeper)',
    transitions: [
      ['A', 0, 1, 'R', 'B'], ['A', 1, 1, 'L', 'C'],
      ['B', 0, 1, 'R', 'C'], ['B', 1, 1, 'R', 'B'],
      ['C', 0, 1, 'R', 'D'], ['C', 1, 0, 'L', 'E'],
      ['D', 0, 1, 'L', 'A'], ['D', 1, 1, 'L', 'D'],
      ['E', 0, 1, 'R', 'H'], ['E', 1, 0, 'L', 'F'],  // E erases → F
      ['F', 0, 1, 'R', 'B'], ['F', 1, 0, 'L', 'A'],  // F,0→sweep right (hit old pattern!), F,1→erase+restart
    ],
  },
  {
    // Variant: F,0 goes to C instead of B (re-enters erasure)
    name: 'H5: F,0 re-enters erasure (double-depth on old patterns)',
    transitions: [
      ['A', 0, 1, 'R', 'B'], ['A', 1, 1, 'L', 'C'],
      ['B', 0, 1, 'R', 'C'], ['B', 1, 1, 'R', 'B'],
      ['C', 0, 1, 'R', 'D'], ['C', 1, 0, 'L', 'E'],
      ['D', 0, 1, 'L', 'A'], ['D', 1, 1, 'L', 'D'],
      ['E', 0, 1, 'R', 'H'], ['E', 1, 0, 'L', 'F'],
      ['F', 0, 1, 'L', 'C'], ['F', 1, 0, 'L', 'A'],  // F,0→re-enter C chain!
    ],
  },
  {
    // A,1 goes to F instead of C. F is the chain entry.
    // Chain: A→F→C→E→A with F branching
    name: 'H6: F as chain entry, branches before erasing',
    transitions: [
      ['A', 0, 1, 'R', 'B'], ['A', 1, 1, 'L', 'F'],  // A→F (not C)
      ['B', 0, 1, 'R', 'C'], ['B', 1, 1, 'R', 'B'],
      ['C', 0, 1, 'R', 'D'], ['C', 1, 0, 'L', 'E'],
      ['D', 0, 1, 'L', 'A'], ['D', 1, 1, 'L', 'D'],
      ['E', 0, 1, 'R', 'H'], ['E', 1, 0, 'L', 'A'],
      ['F', 0, 1, 'L', 'E'], ['F', 1, 0, 'L', 'C'],  // F,0→E (may halt), F,1→C (erase chain)
    ],
  },
  {
    // D,0 goes to F. F handles left boundary differently from A.
    // Creates asymmetry: right boundary → normal (A,B,C), left boundary → F path
    name: 'H7: Asymmetric boundaries (D,0→F, different left-boundary logic)',
    transitions: [
      ['A', 0, 1, 'R', 'B'], ['A', 1, 1, 'L', 'C'],
      ['B', 0, 1, 'R', 'C'], ['B', 1, 1, 'R', 'B'],
      ['C', 0, 1, 'R', 'D'], ['C', 1, 0, 'L', 'E'],
      ['D', 0, 1, 'L', 'F'], ['D', 1, 1, 'L', 'D'],  // D,0→F (not A)
      ['E', 0, 1, 'R', 'H'], ['E', 1, 0, 'L', 'A'],
      ['F', 0, 1, 'R', 'A'], ['F', 1, 0, 'R', 'C'],  // F,0→extend+A, F,1→erase+C
    ],
  },
  {
    // B,0 goes to F instead of C. F handles right boundary.
    name: 'H8: F handles right boundary (B,0→F)',
    transitions: [
      ['A', 0, 1, 'R', 'B'], ['A', 1, 1, 'L', 'C'],
      ['B', 0, 1, 'R', 'F'], ['B', 1, 1, 'R', 'B'],  // B,0→F
      ['C', 0, 1, 'R', 'D'], ['C', 1, 0, 'L', 'E'],
      ['D', 0, 1, 'L', 'A'], ['D', 1, 1, 'L', 'D'],
      ['E', 0, 1, 'R', 'H'], ['E', 1, 0, 'L', 'A'],
      ['F', 0, 1, 'R', 'D'], ['F', 1, 0, 'L', 'C'],  // F,0→D (start left sweep), F,1→erase+enter C chain
    ],
  },
  {
    // Both boundaries go through F: D,0→F and B,0→F
    name: 'H9: F is universal boundary handler',
    transitions: [
      ['A', 0, 1, 'R', 'B'], ['A', 1, 1, 'L', 'C'],
      ['B', 0, 1, 'R', 'F'], ['B', 1, 1, 'R', 'B'],  // B,0→F
      ['C', 0, 1, 'R', 'D'], ['C', 1, 0, 'L', 'E'],
      ['D', 0, 1, 'L', 'F'], ['D', 1, 1, 'L', 'D'],  // D,0→F
      ['E', 0, 1, 'R', 'H'], ['E', 1, 0, 'L', 'A'],
      ['F', 0, 1, 'L', 'A'], ['F', 1, 0, 'R', 'C'],  // F,0→A (extend), F,1→erase+C
    ],
  },
  {
    // Inspired by BB(5) exactly but with F splitting the E role
    // E handles one branch, F handles the other
    name: 'H10: Split-E design (E,1→F, F,1→A, both erase)',
    transitions: [
      ['A', 0, 1, 'R', 'B'], ['A', 1, 1, 'L', 'C'],
      ['B', 0, 1, 'R', 'C'], ['B', 1, 1, 'R', 'B'],
      ['C', 0, 1, 'R', 'D'], ['C', 1, 0, 'L', 'E'],
      ['D', 0, 1, 'L', 'A'], ['D', 1, 1, 'L', 'D'],
      ['E', 0, 1, 'L', 'A'], ['E', 1, 0, 'R', 'F'],  // E,0→extend, E,1→F (erase rightward!)
      ['F', 0, 1, 'R', 'H'], ['F', 1, 0, 'L', 'A'],  // F,0→halt, F,1→erase left
    ],
  },
];

for (const h of handDesigned) {
  const table = createTable(h.transitions);
  const result = simulate(table, STEP_LIMIT);
  printResult(h.name, result);
  console.log();
}

// ═══ Guided search with structural constraints ═══════════════════════

console.log('\n═══ Guided Search: Structurally Constrained (5000 candidates) ═══\n');

const moves = ['L', 'R'];
const allStates = STATE_NAMES.slice(0, NUM_STATES);

// Track results by category
const categories = {
  halted_interesting: [],   // halted, uses 5+ states, ones > 10
  halted_simple: [],        // halted, uses < 5 states
  step_limit: [],           // hit step limit (potentially interesting!)
  translated_cycler: 0,
  tape_overflow: 0,
};

const SEARCH_COUNT = 5000;
let tested = 0;

for (let i = 0; i < SEARCH_COUNT; i++) {
  // Fixed: B right sweeper, D left sweeper
  // Constraint: at least 2 gap-makers (write 0)
  // Constraint: halt on a read-0 transition (reluctant-ish)
  // Constraint: F must be reachable (at least one transition goes to F)

  const transitions = [];
  let gapMakers = 0;
  let fReachable = false;

  // Choose which state gets the halt (on read-0)
  const haltCandidates = ['E', 'F'];
  const haltState = haltCandidates[Math.floor(Math.random() * haltCandidates.length)];

  for (let s = 0; s < NUM_STATES; s++) {
    for (let sym = 0; sym < 2; sym++) {
      const sName = STATE_NAMES[s];

      // Fixed sweepers
      if (sName === 'B' && sym === 1) { transitions.push(['B', 1, 1, 'R', 'B']); continue; }
      if (sName === 'D' && sym === 1) { transitions.push(['D', 1, 1, 'L', 'D']); continue; }

      // Fixed halt
      if (sName === haltState && sym === 0) {
        transitions.push([sName, 0, 1, 'R', 'H']);
        continue;
      }

      // Generate transition
      let write, move, next;

      if (sym === 0) {
        // Read-0: almost always write 1 (boundary extension)
        write = Math.random() < 0.95 ? 1 : 0;
      } else {
        // Read-1: sometimes erase (gap-maker) — aim for 2-3 erasers
        write = Math.random() < 0.35 ? 0 : 1;
        if (write === 0) gapMakers++;
      }

      move = moves[Math.floor(Math.random() * 2)];

      // Next state: prefer creating paths through F
      const validStates = allStates.filter(s => s !== 'H');
      next = validStates[Math.floor(Math.random() * validStates.length)];
      if (next === 'F') fReachable = true;

      transitions.push([sName, sym, write, move, next]);
    }
  }

  // Ensure F is reachable: if not, force one transition to go to F
  if (!fReachable) {
    // Find a non-fixed transition and redirect to F
    const mutableIndices = transitions
      .map((t, idx) => ({ t, idx }))
      .filter(({ t }) => {
        if (t[0] === 'B' && t[1] === 1) return false;
        if (t[0] === 'D' && t[1] === 1) return false;
        if (t[0] === haltState && t[1] === 0) return false;
        return true;
      });
    if (mutableIndices.length > 0) {
      const pick = mutableIndices[Math.floor(Math.random() * mutableIndices.length)];
      transitions[pick.idx][4] = 'F';
    }
  }

  const table = createTable(transitions);
  const result = simulate(table, STEP_LIMIT);
  tested++;

  if (tested % 1000 === 0) {
    process.stdout.write(`  ${tested}/${SEARCH_COUNT} tested...\r`);
  }

  if (result.halted) {
    if (result.statesUsed >= 5 && result.ones > 10) {
      categories.halted_interesting.push({ ...result, transitions, name: `S-${i}` });
    } else {
      categories.halted_simple.push({ ...result, transitions, name: `S-${i}` });
    }
  } else if (result.reason === 'step_limit') {
    categories.step_limit.push({ ...result, transitions, name: `S-${i}` });
  } else if (result.reason === 'translated_cycler') {
    categories.translated_cycler++;
  } else {
    categories.tape_overflow++;
  }
}

console.log(`\n  Results:`);
console.log(`    Halted (interesting): ${categories.halted_interesting.length}`);
console.log(`    Halted (simple):      ${categories.halted_simple.length}`);
console.log(`    Step limit:           ${categories.step_limit.length}`);
console.log(`    Translated cycler:    ${categories.translated_cycler}`);
console.log(`    Tape overflow:        ${categories.tape_overflow}`);

// Show top interesting halted machines
categories.halted_interesting.sort((a, b) => b.ones - a.ones);
if (categories.halted_interesting.length > 0) {
  console.log('\n  Top 10 interesting halted machines (5+ states used, 10+ ones):');
  for (const r of categories.halted_interesting.slice(0, 10)) {
    printResult(r.name, r);
    for (const [s, sym, w, m, n] of r.transitions) {
      process.stdout.write(`      ${s},${sym}→${w}${m}${n}  `);
      if (sym === 1) console.log();
    }
    console.log();
  }
}

// Show top step-limit machines (most interesting for us)
categories.step_limit.sort((a, b) => b.crashes - a.crashes || b.maxOnes - a.maxOnes);
if (categories.step_limit.length > 0) {
  console.log('\n  Top 10 step-limit machines (by crashes, then max ones):');
  for (const r of categories.step_limit.slice(0, 10)) {
    printResult(r.name, r);
    for (const [s, sym, w, m, n] of r.transitions) {
      process.stdout.write(`      ${s},${sym}→${w}${m}${n}  `);
      if (sym === 1) console.log();
    }
    console.log();
  }
}
