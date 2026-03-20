/**
 * BB(6) Mutation Search
 *
 * Start from BB(5)'s proven crash-rebuild dynamics and systematically
 * mutate one transition at a time, wiring in state F.
 *
 * Strategy:
 *   1. Take BB(5)'s 10 transitions as the base
 *   2. For each transition, try replacing it with alternatives that
 *      involve state F
 *   3. Also add F's own two transitions (F,0 and F,1)
 *   4. Test each candidate for crash dynamics
 *
 * BB(5) base:
 *   A: 0→1RB  1→1LC     (boundary + chain entry)
 *   B: 0→1RC  1→1RB     (right sweeper)
 *   C: 0→1RD  1→0LE     (boundary + eraser)
 *   D: 0→1LA  1→1LD     (left boundary + left sweeper)
 *   E: 0→1RH  1→0LA     (halt + eraser)
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
  let maxOnes = 0;
  const stateCounts = new Float64Array(NUM_STATES);
  let crashes = 0, prevCheckOnes = 0;
  const CHECK_INTERVAL = 5000;

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

    if (steps % CHECK_INTERVAL === 0) {
      if (onesCount - prevCheckOnes < -50) crashes++;
      prevCheckOnes = onesCount;
    }

    if (state === HALT) {
      return {
        halted: true, steps, ones: onesCount, maxOnes, crashes, stateCounts,
        statesUsed: stateCounts.filter(c => c > 0).length,
      };
    }
    if (head < 2 || head > TAPE_SIZE - 3) {
      return {
        halted: false, reason: 'tape_overflow', steps, ones: onesCount,
        maxOnes, crashes, stateCounts,
        statesUsed: stateCounts.filter(c => c > 0).length,
      };
    }
  }
  return {
    halted: false, reason: 'step_limit', steps, ones: onesCount,
    maxOnes, crashes, stateCounts,
    statesUsed: stateCounts.filter(c => c > 0).length,
  };
}

// BB(5) base transitions
const BB5_BASE = [
  ['A', 0, 1, 'R', 'B'],
  ['A', 1, 1, 'L', 'C'],
  ['B', 0, 1, 'R', 'C'],
  ['B', 1, 1, 'R', 'B'],
  ['C', 0, 1, 'R', 'D'],
  ['C', 1, 0, 'L', 'E'],
  ['D', 0, 1, 'L', 'A'],
  ['D', 1, 1, 'L', 'D'],
  ['E', 0, 1, 'R', 'H'],
  ['E', 1, 0, 'L', 'A'],
];

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║   BB(6) MUTATION SEARCH — Evolving BB(5)               ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

const STEP_LIMIT = 50_000_000;

// ═══ Strategy 1: Redirect one BB(5) transition to F ══════════════════
// For each of the 10 BB(5) transitions, try changing its next-state to F
// Then add F,0 and F,1 transitions (with all reasonable options)

console.log('═══ Strategy 1: Redirect one transition to F ═══\n');

const fTransitionOptions = [];
for (const write of [0, 1]) {
  for (const move of ['L', 'R']) {
    for (const next of ['A', 'B', 'C', 'D', 'E', 'H']) {
      fTransitionOptions.push([write, move, next]);
    }
  }
}

const allResults = [];
let totalTested = 0;

for (let mutIdx = 0; mutIdx < BB5_BASE.length; mutIdx++) {
  const original = BB5_BASE[mutIdx];
  const origStr = `${original[0]},${original[1]}→${original[2]}${original[3]}${original[4]}`;

  // Redirect this transition's next-state to F
  const mutated = [...original];
  mutated[4] = 'F';
  const mutStr = `${mutated[0]},${mutated[1]}→${mutated[2]}${mutated[3]}F`;

  // Try all combinations of F,0 and F,1
  for (const [w0, m0, n0] of fTransitionOptions) {
    for (const [w1, m1, n1] of fTransitionOptions) {
      const transitions = BB5_BASE.map((t, i) => i === mutIdx ? mutated : [...t]);
      transitions.push(['F', 0, w0, m0, n0]);
      transitions.push(['F', 1, w1, m1, n1]);

      const table = createTable(transitions);
      const result = simulate(table, STEP_LIMIT);
      totalTested++;

      allResults.push({
        ...result,
        mutation: `${origStr} → ${mutStr}`,
        f0: `F,0→${w0}${m0}${n0}`,
        f1: `F,1→${w1}${m1}${n1}`,
        transitions,
      });
    }
  }

  process.stdout.write(`  Mutation ${mutIdx + 1}/10 done (${totalTested} tested)\r`);
}

console.log(`\n  Total tested: ${totalTested.toLocaleString()}\n`);

// ═══ Strategy 2: Insert F into existing chain ════════════════════════
// Instead of redirecting, ADD F as an intermediary
// e.g., A,1→1LC becomes A,1→1LF, F,?→?C

console.log('═══ Strategy 2: Insert F as intermediary ═══\n');

// For each transition A→X, try A→F, F→X with variations
for (let mutIdx = 0; mutIdx < BB5_BASE.length; mutIdx++) {
  const original = BB5_BASE[mutIdx];
  const [oState, oSym, oWrite, oMove, oNext] = original;

  // Redirect to F, keeping same write and move
  const mutated = [oState, oSym, oWrite, oMove, 'F'];

  // F should eventually reach the original target (oNext)
  // Try: F reads the next cell and decides
  for (const [w0, m0] of [[0, 'L'], [0, 'R'], [1, 'L'], [1, 'R']]) {
    for (const [w1, m1] of [[0, 'L'], [0, 'R'], [1, 'L'], [1, 'R']]) {
      // F,0 goes to original target or halt
      for (const n0 of [oNext, 'H', 'A', 'E']) {
        // F,1 goes somewhere that maintains the chain
        for (const n1 of [oNext, 'A', 'C', 'E']) {
          const transitions = BB5_BASE.map((t, i) => i === mutIdx ? mutated : [...t]);
          transitions.push(['F', 0, w0, m0, n0]);
          transitions.push(['F', 1, w1, m1, n1]);

          const table = createTable(transitions);
          const result = simulate(table, STEP_LIMIT);
          totalTested++;

          allResults.push({
            ...result,
            mutation: `Insert F: ${oState},${oSym}→${oWrite}${oMove}F`,
            f0: `F,0→${w0}${m0}${n0}`,
            f1: `F,1→${w1}${m1}${n1}`,
            transitions,
          });
        }
      }
    }
  }

  process.stdout.write(`  Insert ${mutIdx + 1}/10 done (${totalTested.toLocaleString()} total)\r`);
}

console.log(`\n  Total tested: ${totalTested.toLocaleString()}\n`);

// ═══ Analysis ════════════════════════════════════════════════════════

// Separate results
const halted = allResults.filter(r => r.halted);
const stepLimit = allResults.filter(r => r.reason === 'step_limit');
const overflow = allResults.filter(r => r.reason === 'tape_overflow');

console.log('═══ Results Summary ═══\n');
console.log(`  Halted:        ${halted.length.toLocaleString()}`);
console.log(`  Step limit:    ${stepLimit.length.toLocaleString()}`);
console.log(`  Tape overflow: ${overflow.length.toLocaleString()}`);

// Best halted by ones
halted.sort((a, b) => b.ones - a.ones);
console.log('\n═══ Top 15 Halted (by ones) ═══\n');
for (const r of halted.slice(0, 15)) {
  const dist = Array.from(r.stateCounts)
    .map((c, i) => ({ s: STATE_NAMES[i], p: c / r.steps * 100 }))
    .filter(x => x.p > 0.1)
    .sort((a, b) => b.p - a.p)
    .map(x => `${x.s}=${x.p.toFixed(0)}%`)
    .join(' ');
  console.log(`  ${r.ones} ones, ${r.steps.toLocaleString()} steps, ${r.crashes} crashes, ${r.statesUsed} states`);
  console.log(`    Mutation: ${r.mutation}`);
  console.log(`    ${r.f0}  ${r.f1}`);
  console.log(`    [${dist}]`);
}

// Most interesting: step-limit machines WITH crashes (= extended BB(5) dynamics)
const withCrashes = stepLimit.filter(r => r.crashes > 0);
withCrashes.sort((a, b) => b.crashes - a.crashes || b.maxOnes - a.maxOnes);
console.log(`\n═══ Step-Limit Machines WITH Crashes (${withCrashes.length} found) ═══\n`);
for (const r of withCrashes.slice(0, 15)) {
  const dist = Array.from(r.stateCounts)
    .map((c, i) => ({ s: STATE_NAMES[i], p: c / r.steps * 100 }))
    .filter(x => x.p > 0.1)
    .sort((a, b) => b.p - a.p)
    .map(x => `${x.s}=${x.p.toFixed(0)}%`)
    .join(' ');
  console.log(`  max ${r.maxOnes} ones (current: ${r.ones}), ${r.crashes} crashes, ${r.statesUsed} states`);
  console.log(`    Mutation: ${r.mutation}`);
  console.log(`    ${r.f0}  ${r.f1}`);
  console.log(`    [${dist}]`);
}

// Machines that use all 6 states and have crashes
const sixStateCrash = allResults.filter(r => r.statesUsed === 6 && r.crashes > 0);
sixStateCrash.sort((a, b) => b.crashes - a.crashes || b.maxOnes - a.maxOnes);
console.log(`\n═══ 6-State Machines WITH Crashes (${sixStateCrash.length} found) ═══\n`);
for (const r of sixStateCrash.slice(0, 15)) {
  const status = r.halted
    ? `HALTED ${r.ones} ones, ${r.steps.toLocaleString()} steps`
    : `${r.reason} (ones=${r.ones}, max=${r.maxOnes})`;
  const dist = Array.from(r.stateCounts)
    .map((c, i) => ({ s: STATE_NAMES[i], p: c / r.steps * 100 }))
    .filter(x => x.p > 0.1)
    .sort((a, b) => b.p - a.p)
    .map(x => `${x.s}=${x.p.toFixed(0)}%`)
    .join(' ');
  console.log(`  ${status}, ${r.crashes} crashes`);
  console.log(`    Mutation: ${r.mutation}`);
  console.log(`    ${r.f0}  ${r.f1}`);
  console.log(`    [${dist}]`);
}

// Best halted that use 6 states
const sixStateHalted = halted.filter(r => r.statesUsed === 6);
sixStateHalted.sort((a, b) => b.ones - a.ones);
console.log(`\n═══ Best 6-State Halted Machines (${sixStateHalted.length} found) ═══\n`);
for (const r of sixStateHalted.slice(0, 10)) {
  const dist = Array.from(r.stateCounts)
    .map((c, i) => ({ s: STATE_NAMES[i], p: c / r.steps * 100 }))
    .filter(x => x.p > 0.1)
    .sort((a, b) => b.p - a.p)
    .map(x => `${x.s}=${x.p.toFixed(0)}%`)
    .join(' ');
  console.log(`  ${r.ones} ones, ${r.steps.toLocaleString()} steps, ${r.crashes} crashes`);
  console.log(`    Mutation: ${r.mutation}`);
  console.log(`    ${r.f0}  ${r.f1}`);
  console.log(`    [${dist}]`);
  // Print full table
  for (const [s, sym, w, m, n] of r.transitions) {
    process.stdout.write(`    ${s},${sym}→${w}${m}${n}  `);
    if (sym === 1) console.log();
  }
  console.log();
}
