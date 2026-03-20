/**
 * BB(4) Deep Phase Analysis
 *
 * We can't enumerate 4-state machines (25.6 billion) but we CAN
 * run detailed analysis on the BB(4) champion and compare its
 * phase structure to the patterns found in 3-state machines.
 *
 * Prediction from 3-state data:
 *   Optimal ratio: ~40% setup, ~25% amplification, ~35% cleanup
 *   Should have 2-3 cycle repetitions
 *   Should be a "reluctant halter"
 */

let HALT = 4;
const STATE_NAMES = ['A', 'B', 'C', 'D', 'H'];

function createMachine(transitions) {
  // Convert human-readable format to flat table
  const stateMap = { 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'H': 4 };
  const moveMap = { 'L': 0, 'R': 1 };
  const table = new Uint8Array(HALT * 2 * 3);
  for (const [state, read, write, move, next] of transitions) {
    const idx = stateMap[state] * 2 + read;
    table[idx * 3] = write;
    table[idx * 3 + 1] = moveMap[move];
    table[idx * 3 + 2] = stateMap[next];
  }
  return table;
}

function run(table, maxSteps) {
  const tape = new Uint8Array(512);
  let head = 256;
  let state = 0;
  let steps = 0;
  let minHead = head, maxHead = head;

  const stateSeq = new Uint8Array(maxSteps + 1);
  const headSeq = new Int16Array(maxSteps + 1);    // track head position
  const tapeOnesSeq = new Uint16Array(maxSteps + 1); // track ones count over time

  // Count ones incrementally
  let onesCount = 0;

  while (steps < maxSteps) {
    const symbol = tape[head];
    const idx = state * 2 + symbol;
    const write = table[idx * 3];
    const move = table[idx * 3 + 1];
    const next = table[idx * 3 + 2];

    stateSeq[steps] = state;
    headSeq[steps] = head - 256; // normalize to start at 0
    tapeOnesSeq[steps] = onesCount;

    // Update ones count
    if (tape[head] === 0 && write === 1) onesCount++;
    if (tape[head] === 1 && write === 0) onesCount--;

    tape[head] = write;
    head += move === 1 ? 1 : -1;
    state = next;
    steps++;

    if (head < minHead) minHead = head;
    if (head > maxHead) maxHead = head;

    if (state === HALT) {
      tapeOnesSeq[steps] = onesCount;
      return { halted: true, steps, ones: onesCount, stateSeq, headSeq, tapeOnesSeq };
    }
  }
  return { halted: false, steps, ones: onesCount, stateSeq, headSeq, tapeOnesSeq };
}

// ── Phase detection (enhanced for longer traces) ─────────────────────

function detectPhases(stateSeq, totalSteps) {
  if (totalSteps < 4) {
    return { setup: totalSteps, amplification: 0, cleanup: 0, cycleLen: 0, cycleCount: 0, pattern: '' };
  }

  let bestCycleLen = 0, bestCycleCount = 0, bestCycleStart = 0;

  for (let cycleLen = 2; cycleLen <= Math.min(totalSteps / 2, 50); cycleLen++) {
    for (let start = 0; start <= totalSteps - cycleLen * 2; start++) {
      let count = 0;
      let pos = start;
      while (pos + cycleLen <= totalSteps) {
        let match = true;
        for (let j = 0; j < cycleLen; j++) {
          if (stateSeq[pos + j] !== stateSeq[start + j]) { match = false; break; }
        }
        if (!match) break;
        count++;
        pos += cycleLen;
      }
      if (count >= 2 && count * cycleLen > bestCycleCount * bestCycleLen) {
        bestCycleLen = cycleLen;
        bestCycleCount = count;
        bestCycleStart = start;
      }
    }
  }

  if (bestCycleCount >= 2) {
    const setup = bestCycleStart;
    const amplification = bestCycleLen * bestCycleCount;
    const cleanup = totalSteps - setup - amplification;
    const pattern = Array.from(stateSeq.slice(bestCycleStart, bestCycleStart + bestCycleLen))
      .map(s => STATE_NAMES[s]).join('');
    return { setup, amplification, cleanup, cycleLen: bestCycleLen, cycleCount: bestCycleCount, pattern };
  }

  return { setup: totalSteps, amplification: 0, cleanup: 0, cycleLen: 0, cycleCount: 0, pattern: '' };
}

// ── Also detect NESTED cycles ────────────────────────────────────────
// Look for cycles at multiple scales — the amplification itself
// might contain sub-cycles

function detectNestedCycles(stateSeq, totalSteps) {
  const cycles = [];

  for (let cycleLen = 2; cycleLen <= Math.min(totalSteps / 2, 50); cycleLen++) {
    for (let start = 0; start <= totalSteps - cycleLen * 2; start++) {
      let count = 0;
      let pos = start;
      while (pos + cycleLen <= totalSteps) {
        let match = true;
        for (let j = 0; j < cycleLen; j++) {
          if (stateSeq[pos + j] !== stateSeq[start + j]) { match = false; break; }
        }
        if (!match) break;
        count++;
        pos += cycleLen;
      }
      if (count >= 2) {
        const coverage = count * cycleLen;
        const pattern = Array.from(stateSeq.slice(start, start + cycleLen))
          .map(s => STATE_NAMES[s]).join('');

        // Only keep if this is a genuinely different cycle (not subsumed)
        const dominated = cycles.some(c =>
          c.start <= start &&
          c.start + c.coverage >= start + coverage &&
          c.cycleLen !== cycleLen
        );

        if (!dominated) {
          cycles.push({ start, cycleLen, count, coverage, pattern });
        }
      }
    }
  }

  // Sort by coverage (largest first), then by start position
  cycles.sort((a, b) => b.coverage - a.coverage || a.start - b.start);

  // Deduplicate: keep only unique (start, cycleLen) pairs among top results
  const seen = new Set();
  return cycles.filter(c => {
    const key = `${c.start}-${c.cycleLen}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 15);
}

// ── BB(4) Champion ───────────────────────────────────────────────────

const bb4 = createMachine([
  ['A', 0, 1, 'R', 'B'],
  ['A', 1, 1, 'L', 'B'],
  ['B', 0, 1, 'L', 'A'],
  ['B', 1, 0, 'L', 'C'],
  ['C', 0, 1, 'R', 'H'],
  ['C', 1, 1, 'L', 'D'],
  ['D', 0, 1, 'R', 'D'],
  ['D', 1, 0, 'R', 'A'],
]);

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║           BB(4) CHAMPION — PHASE ANALYSIS              ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

// Print the transition table
console.log('Transition table:');
console.log('  A,0 → 1RB    A,1 → 1LB');
console.log('  B,0 → 1LA    B,1 → 0LC');
console.log('  C,0 → 1RH    C,1 → 1LD');
console.log('  D,0 → 1RD    D,1 → 0RA\n');

// Check motifs
console.log('Static motifs:');
console.log('  Gap-maker:       YES (B,1 writes 0; D,1 writes 0)');
console.log('  Sweeper:         YES (D,0 → 1RD — marches right writing 1s)');
console.log('  Reluctant halter: YES (halt is C,0 — requires reading a 0 in state C)');
console.log('  Transporter:     NO');
console.log();

const result = run(bb4, 200);
console.log(`Result: ${result.ones} ones in ${result.steps} steps\n`);

// Full state sequence
const fullSeq = Array.from(result.stateSeq.slice(0, result.steps))
  .map(s => STATE_NAMES[s]).join('');
console.log('Full state sequence:');
console.log(`  ${fullSeq}\n`);

// Phase analysis
const phases = detectPhases(result.stateSeq, result.steps);
console.log('═══ Primary Phase Decomposition ═══\n');
if (phases.cycleCount > 0) {
  const setupPct = (phases.setup / result.steps * 100).toFixed(1);
  const ampPct = (phases.amplification / result.steps * 100).toFixed(1);
  const cleanPct = (phases.cleanup / result.steps * 100).toFixed(1);

  console.log(`  Setup:          ${phases.setup} steps (${setupPct}%)`);
  console.log(`  Amplification:  ${phases.amplification} steps (${ampPct}%) — ${phases.cycleCount}× cycle "${phases.pattern}" (len ${phases.cycleLen})`);
  console.log(`  Cleanup:        ${phases.cleanup} steps (${cleanPct}%)`);

  console.log('\n  Comparison to 3-state optimal ratios:');
  console.log('               3-state optimal    BB(4) actual');
  console.log(`  Setup:       ~40%               ${setupPct}%`);
  console.log(`  Amplify:     ~25%               ${ampPct}%`);
  console.log(`  Cleanup:     ~35%               ${cleanPct}%`);
} else {
  console.log('  No simple repeating cycle detected!');
}

// Nested cycle analysis
console.log('\n═══ All Detected Cycles (nested structure) ═══\n');
const nested = detectNestedCycles(result.stateSeq, result.steps);
console.log('  Start | Len | Reps | Coverage | Pattern');
console.log('  ──────┼─────┼──────┼──────────┼────────');
for (const c of nested) {
  console.log(`  ${String(c.start).padStart(5)} | ${String(c.cycleLen).padStart(3)} | ${String(c.count).padStart(4)} | ${String(c.coverage).padStart(8)} | ${c.pattern}`);
}

// Ones-over-time analysis
console.log('\n═══ Ones Count Over Time ═══\n');
console.log('  Step | Ones | State | Head | Phase');
console.log('  ─────┼──────┼───────┼──────┼──────');
const phaseLabels = [];
for (let i = 0; i < result.steps; i++) {
  let label = '';
  if (phases.cycleCount > 0) {
    if (i < phases.setup) label = 'setup';
    else if (i < phases.setup + phases.amplification) {
      const cycleNum = Math.floor((i - phases.setup) / phases.cycleLen) + 1;
      label = `amp #${cycleNum}`;
    } else label = 'cleanup';
  }
  const state = STATE_NAMES[result.stateSeq[i]];
  const head = result.headSeq[i];
  const ones = result.tapeOnesSeq[i];
  console.log(`  ${String(i).padStart(4)} | ${String(ones).padStart(4)} | ${state.padStart(5)} | ${String(head).padStart(4)} | ${label}`);
}
console.log(`  ${String(result.steps).padStart(4)} | ${String(result.tapeOnesSeq[result.steps]).padStart(4)} | ${'HALT'.padStart(5)} |      |`);

// Head position range over time
console.log('\n═══ Head Movement Visualization ═══\n');
const minPos = Math.min(...Array.from(result.headSeq.slice(0, result.steps)));
const maxPos = Math.max(...Array.from(result.headSeq.slice(0, result.steps)));
const range = maxPos - minPos;

for (let i = 0; i < result.steps; i++) {
  const pos = result.headSeq[i] - minPos;
  const state = STATE_NAMES[result.stateSeq[i]];
  const bar = '.'.repeat(pos) + state + '.'.repeat(range - pos);
  const ones = result.tapeOnesSeq[i];
  console.log(`  ${String(i).padStart(3)} |${bar}| ${ones} ones`);
}
