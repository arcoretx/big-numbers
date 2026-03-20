/**
 * BB(6) Refinement — Focus on promising architectures
 *
 * Key findings from first round:
 *   - B2 (interleaved counters) hit 2^15+1 ones = genuine binary counter
 *   - A2/A3 replicated BB(5) exactly — F state unused
 *   - Halting machines halt too fast, non-halting don't halt
 *
 * Strategy: Take the B2 architecture and systematically vary the
 * halt-adjacent transitions to find variants that halt after longer runs.
 * Also: explore the tape-overflow machines with larger tapes.
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
  const TAPE_SIZE = 524288;  // 512K — larger tape
  const tape = new Uint8Array(TAPE_SIZE);
  let head = Math.floor(TAPE_SIZE / 2);
  let state = 0, steps = 0, onesCount = 0;
  let maxOnes = 0, crashes = 0, prevCheckOnes = 0;

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
    if (steps % 10000 === 0) {
      if (onesCount - prevCheckOnes < -100) crashes++;
      prevCheckOnes = onesCount;
    }

    if (state === HALT) {
      return { halted: true, steps, ones: onesCount, maxOnes, crashes, stateCounts };
    }
    if (head < 2 || head > TAPE_SIZE - 3) {
      return { halted: false, reason: 'tape_overflow', steps, ones: onesCount, maxOnes, crashes, stateCounts };
    }
  }
  return { halted: false, reason: 'step_limit', steps, ones: onesCount, maxOnes, crashes, stateCounts };
}

function printResult(name, result) {
  const status = result.halted ? `HALTED ${result.ones} ones in ${result.steps.toLocaleString()} steps` :
    `${result.reason} after ${result.steps.toLocaleString()} steps (ones: ${result.ones}, max: ${result.maxOnes})`;
  const dist = Array.from(result.stateCounts || [])
    .map((c, i) => ({ s: STATE_NAMES[i], p: c / result.steps * 100 }))
    .filter(x => x.p > 0.01)
    .sort((a, b) => b.p - a.p)
    .map(x => `${x.s}=${x.p.toFixed(1)}%`)
    .join(' ');
  console.log(`  ${name}: ${status} crashes=${result.crashes} [${dist}]`);
}

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║       BB(6) REFINEMENT                                 ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

const STEP_LIMIT = 50_000_000;

// ═══ 1. B2 variants — the binary counter that hit 2^15 ══════════════

console.log('═══ 1. B2 Variants (binary counter architecture) ═══\n');
console.log('Base B2 hit 2^15+1 = 32769 ones. Systematically varying halt-adjacent transitions.\n');

// B2 base:
// A: 0→1RB  1→1LC
// B: 0→1LD  1→1RB  (right sweeper)
// C: 0→1RD  1→0LE
// D: 0→1RE  1→1LD  (left sweeper)
// E: 0→1LF  1→0LA
// F: 0→1RH  1→0RC

// Vary F,1 (what happens when F reads a 1 — this controls the "carry" mechanism)
const f1Options = [
  ['F', 1, 0, 'R', 'C'], // original
  ['F', 1, 0, 'L', 'C'],
  ['F', 1, 0, 'R', 'A'],
  ['F', 1, 0, 'L', 'A'],
  ['F', 1, 0, 'R', 'E'],
  ['F', 1, 0, 'L', 'E'],
  ['F', 1, 1, 'R', 'C'],
  ['F', 1, 1, 'L', 'C'],
  ['F', 1, 1, 'R', 'A'],
  ['F', 1, 1, 'L', 'A'],
  ['F', 1, 1, 'R', 'E'],
  ['F', 1, 1, 'L', 'E'],
  ['F', 1, 0, 'R', 'B'],
  ['F', 1, 0, 'L', 'B'],
  ['F', 1, 1, 'R', 'B'],
  ['F', 1, 1, 'L', 'B'],
  ['F', 1, 0, 'R', 'D'],
  ['F', 1, 0, 'L', 'D'],
  ['F', 1, 1, 'R', 'D'],
  ['F', 1, 1, 'L', 'D'],
  ['F', 1, 0, 'R', 'F'],
  ['F', 1, 0, 'L', 'F'],
  ['F', 1, 1, 'R', 'F'],
  ['F', 1, 1, 'L', 'F'],
];

const b2Base = [
  ['A', 0, 1, 'R', 'B'], ['A', 1, 1, 'L', 'C'],
  ['B', 0, 1, 'L', 'D'], ['B', 1, 1, 'R', 'B'],
  ['C', 0, 1, 'R', 'D'], ['C', 1, 0, 'L', 'E'],
  ['D', 0, 1, 'R', 'E'], ['D', 1, 1, 'L', 'D'],
  ['E', 0, 1, 'L', 'F'], ['E', 1, 0, 'L', 'A'],
  ['F', 0, 1, 'R', 'H'],
];

for (const f1 of f1Options) {
  const transitions = [...b2Base, f1];
  const table = createTable(transitions);
  const result = simulate(table, STEP_LIMIT);
  const f1Str = `F,1→${f1[2]}${f1[3]}${f1[4]}`;
  printResult(`B2[${f1Str}]`, result);
}

// ═══ 2. Also vary E,0 (the halt-adjacent transition) ═════════════════

console.log('\n═══ 2. B2 with E,0 variations (halt path) ═══\n');

// Instead of E,0→1LF, try sending E,0 elsewhere and put halt on F differently
const e0Options = [
  { e0: ['E', 0, 1, 'L', 'F'], f0: ['F', 0, 1, 'R', 'H'], name: 'original' },
  { e0: ['E', 0, 1, 'R', 'F'], f0: ['F', 0, 1, 'R', 'H'], name: 'E0→1RF' },
  { e0: ['E', 0, 1, 'L', 'F'], f0: ['F', 0, 1, 'L', 'H'], name: 'F0→1LH' },
  { e0: ['E', 0, 0, 'L', 'F'], f0: ['F', 0, 1, 'R', 'H'], name: 'E0→0LF' },
  { e0: ['E', 0, 1, 'R', 'A'], f0: ['F', 0, 1, 'R', 'H'], name: 'E0→1RA (skip F)' },
  { e0: ['E', 0, 1, 'L', 'C'], f0: ['F', 0, 1, 'R', 'H'], name: 'E0→1LC (loop back)' },
];

for (const opt of e0Options) {
  const transitions = [
    ['A', 0, 1, 'R', 'B'], ['A', 1, 1, 'L', 'C'],
    ['B', 0, 1, 'L', 'D'], ['B', 1, 1, 'R', 'B'],
    ['C', 0, 1, 'R', 'D'], ['C', 1, 0, 'L', 'E'],
    ['D', 0, 1, 'R', 'E'], ['D', 1, 1, 'L', 'D'],
    opt.e0, ['E', 1, 0, 'L', 'A'],
    opt.f0, ['F', 1, 0, 'R', 'C'],
  ];
  const table = createTable(transitions);
  const result = simulate(table, STEP_LIMIT);
  printResult(`B2[${opt.name}]`, result);
}

// ═══ 3. Extended BB(5) — actually making F participate ═══════════════

console.log('\n═══ 3. Making F actually participate in BB(5) dynamics ═══\n');
console.log('Key insight: A2/A3 replicated BB(5) because F was never reached.\n');
console.log('Fix: ensure the main execution path passes through F.\n');

// The trick: make D,0 go to F instead of A
// This forces the machine through F every time the left sweeper
// hits a boundary — F becomes part of the main loop

const extendedVariants = [
  {
    name: 'E1: D,0→F, F bridges to A (F is left-boundary handler)',
    transitions: [
      ['A', 0, 1, 'R', 'B'], ['A', 1, 1, 'L', 'C'],
      ['B', 0, 1, 'R', 'C'], ['B', 1, 1, 'R', 'B'],
      ['C', 0, 1, 'R', 'D'], ['C', 1, 0, 'L', 'E'],
      ['D', 0, 1, 'L', 'F'], ['D', 1, 1, 'L', 'D'],  // D,0 → F (was A)
      ['E', 0, 1, 'R', 'H'], ['E', 1, 0, 'L', 'A'],
      ['F', 0, 1, 'R', 'A'], ['F', 1, 1, 'L', 'A'],  // F always → A
    ],
  },
  {
    name: 'E2: D,0→F, F adds extra write before A',
    transitions: [
      ['A', 0, 1, 'R', 'B'], ['A', 1, 1, 'L', 'C'],
      ['B', 0, 1, 'R', 'C'], ['B', 1, 1, 'R', 'B'],
      ['C', 0, 1, 'R', 'D'], ['C', 1, 0, 'L', 'E'],
      ['D', 0, 1, 'L', 'F'], ['D', 1, 1, 'L', 'D'],
      ['E', 0, 1, 'R', 'H'], ['E', 1, 0, 'L', 'A'],
      ['F', 0, 1, 'L', 'A'], ['F', 1, 0, 'R', 'A'],  // F,1 erases (gap-maker)
    ],
  },
  {
    name: 'E3: F in erasure chain (A→C→E→F→A)',
    transitions: [
      ['A', 0, 1, 'R', 'B'], ['A', 1, 1, 'L', 'C'],
      ['B', 0, 1, 'R', 'C'], ['B', 1, 1, 'R', 'B'],
      ['C', 0, 1, 'R', 'D'], ['C', 1, 0, 'L', 'E'],
      ['D', 0, 1, 'L', 'A'], ['D', 1, 1, 'L', 'D'],
      ['E', 0, 1, 'L', 'F'], ['E', 1, 0, 'L', 'F'],  // E always → F
      ['F', 0, 1, 'R', 'H'], ['F', 1, 0, 'L', 'A'],  // F,1 erases, F,0 halts
    ],
  },
  {
    name: 'E4: F as second erasure chain entry point',
    transitions: [
      ['A', 0, 1, 'R', 'B'], ['A', 1, 1, 'L', 'F'],  // A,1 → F (was C)
      ['B', 0, 1, 'R', 'C'], ['B', 1, 1, 'R', 'B'],
      ['C', 0, 1, 'R', 'D'], ['C', 1, 0, 'L', 'E'],
      ['D', 0, 1, 'L', 'A'], ['D', 1, 1, 'L', 'D'],
      ['E', 0, 1, 'R', 'H'], ['E', 1, 0, 'L', 'A'],
      ['F', 0, 1, 'L', 'C'], ['F', 1, 0, 'L', 'E'],  // F bridges into the chain
    ],
  },
  {
    name: 'E5: F as right-boundary extender',
    transitions: [
      ['A', 0, 1, 'R', 'B'], ['A', 1, 1, 'L', 'C'],
      ['B', 0, 1, 'R', 'F'], ['B', 1, 1, 'R', 'B'],  // B,0 → F (was C)
      ['C', 0, 1, 'R', 'D'], ['C', 1, 0, 'L', 'E'],
      ['D', 0, 1, 'L', 'A'], ['D', 1, 1, 'L', 'D'],
      ['E', 0, 1, 'R', 'H'], ['E', 1, 0, 'L', 'A'],
      ['F', 0, 1, 'R', 'C'], ['F', 1, 1, 'R', 'C'],  // F adds extra boundary extension
    ],
  },
  {
    name: 'E6: A→F→C chain (F intercepts erasure entry)',
    transitions: [
      ['A', 0, 1, 'R', 'B'], ['A', 1, 1, 'L', 'F'],  // A,1 → F
      ['B', 0, 1, 'R', 'C'], ['B', 1, 1, 'R', 'B'],
      ['C', 0, 1, 'R', 'D'], ['C', 1, 0, 'L', 'E'],
      ['D', 0, 1, 'L', 'A'], ['D', 1, 1, 'L', 'D'],
      ['E', 0, 1, 'R', 'H'], ['E', 1, 0, 'L', 'A'],
      ['F', 0, 1, 'R', 'C'], ['F', 1, 1, 'L', 'C'],  // F → C (adds a step before erasure)
    ],
  },
  {
    name: 'E7: Dual erasure chains (CEA + CFA)',
    transitions: [
      ['A', 0, 1, 'R', 'B'], ['A', 1, 1, 'L', 'C'],
      ['B', 0, 1, 'R', 'C'], ['B', 1, 1, 'R', 'B'],
      ['C', 0, 1, 'R', 'D'], ['C', 1, 0, 'L', 'F'],  // C,1 → F (was E)
      ['D', 0, 1, 'L', 'A'], ['D', 1, 1, 'L', 'D'],
      ['E', 0, 1, 'R', 'H'], ['E', 1, 0, 'L', 'A'],  // E still has halt
      ['F', 0, 1, 'L', 'E'], ['F', 1, 0, 'L', 'A'],  // F erases, F,0 → E (can halt)
    ],
  },
];

for (const v of extendedVariants) {
  const table = createTable(v.transitions);
  const result = simulate(table, STEP_LIMIT);
  printResult(v.name, result);
}

// ═══ 4. Massive guided random with our best architecture ═════════════

console.log('\n═══ 4. Guided Random on B2 Architecture (2000 variants) ═══\n');

const moves = ['L', 'R'];
const states = STATE_NAMES.slice(0, NUM_STATES);
let bestHalted = null;
let bestNonHalted = null;
let haltedCount = 0;
let totalTested = 0;

for (let i = 0; i < 2000; i++) {
  // Fix: B right sweeper, D left sweeper, F,0 = halt
  // Vary everything else but with structural biases
  const transitions = [];

  for (let s = 0; s < NUM_STATES; s++) {
    for (let sym = 0; sym < 2; sym++) {
      const sName = STATE_NAMES[s];

      // Fixed transitions
      if (sName === 'B' && sym === 1) { transitions.push(['B', 1, 1, 'R', 'B']); continue; }
      if (sName === 'D' && sym === 1) { transitions.push(['D', 1, 1, 'L', 'D']); continue; }
      if (sName === 'F' && sym === 0) { transitions.push(['F', 0, 1, 'R', 'H']); continue; }

      // Bias: read-0 transitions mostly write 1
      const write = sym === 0 ? 1 : (Math.random() < 0.4 ? 0 : 1);
      const move = moves[Math.floor(Math.random() * 2)];

      // Bias: prefer transitions that create interesting state flow
      // Avoid self-loops on non-sweeper states
      let next;
      do {
        next = states[Math.floor(Math.random() * states.length)];
      } while (next === sName && sName !== 'B' && sName !== 'D');

      transitions.push([sName, sym, write, move, next]);
    }
  }

  const table = createTable(transitions);
  const result = simulate(table, STEP_LIMIT);
  totalTested++;

  if (result.halted) {
    haltedCount++;
    if (!bestHalted || result.ones > bestHalted.ones) {
      bestHalted = { ...result, transitions };
    }
  } else if (result.reason === 'step_limit') {
    if (!bestNonHalted || result.maxOnes > bestNonHalted.maxOnes) {
      bestNonHalted = { ...result, transitions };
    }
  }

  if (totalTested % 500 === 0) {
    process.stdout.write(`  ${totalTested} tested, ${haltedCount} halted...\r`);
  }
}

console.log(`  Tested: ${totalTested}, Halted: ${haltedCount}\n`);

if (bestHalted) {
  console.log(`  Best halted: ${bestHalted.ones} ones in ${bestHalted.steps.toLocaleString()} steps`);
  for (const [s, sym, w, m, n] of bestHalted.transitions) {
    process.stdout.write(`    ${s},${sym}→${w}${m}${n}  `);
    if (sym === 1) console.log();
  }
}

if (bestNonHalted) {
  console.log(`\n  Best non-halted: max ${bestNonHalted.maxOnes} ones (current: ${bestNonHalted.ones}), ${bestNonHalted.crashes} crashes`);
  for (const [s, sym, w, m, n] of bestNonHalted.transitions) {
    process.stdout.write(`    ${s},${sym}→${w}${m}${n}  `);
    if (sym === 1) console.log();
  }
  if (bestNonHalted.stateCounts) {
    const total = bestNonHalted.steps;
    const dist = Array.from(bestNonHalted.stateCounts)
      .map((c, i) => ({ s: STATE_NAMES[i], p: c / total * 100 }))
      .filter(x => x.p > 0.01)
      .sort((a, b) => b.p - a.p)
      .map(x => `${x.s}=${x.p.toFixed(1)}%`)
      .join(' ');
    console.log(`    State dist: ${dist}`);
  }
}
