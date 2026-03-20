/**
 * BB(5) Recurrence Verification
 *
 * Three independent checks:
 *   1. Capture tape at EXACT crash onset (not sampled) — verify 25 blocks
 *   2. Count boundary events during each rebuild phase
 *   3. Cross-check: M+28 = peak ones exactly?
 *
 * Goal: confirm M_{n+1} = (5/3)M_n + 50 and explain WHY (2/3)M extra ones
 */

const HALT = 5;
const STATE_NAMES = ['A', 'B', 'C', 'D', 'E', 'H'];

const bb5 = new Uint8Array([
  1, 1, 1,    1, 0, 2,  // A: 0→1RB  1→1LC
  1, 1, 2,    1, 1, 1,  // B: 0→1RC  1→1RB
  1, 1, 3,    0, 0, 4,  // C: 0→1RD  1→0LE
  1, 0, 0,    1, 0, 3,  // D: 0→1LA  1→1LD
  1, 1, 5,    0, 0, 0,  // E: 0→1RH  1→0LA
]);

const TAPE_SIZE = 65536;
const CENTER = Math.floor(TAPE_SIZE / 2);
const tape = new Uint8Array(TAPE_SIZE);
let head = CENTER, state = 0, steps = 0, onesCount = 0;

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║   BB(5) RECURRENCE VERIFICATION                        ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

// ── Track exact macro-crash boundaries ───────────────────────────────
// A macro-crash starts when ones first drops from an all-time high.
// It ends when ones starts rising again to a new all-time high.

let allTimeHigh = 0;
let inCrash = false;
let crashStartStep = 0;

// Boundary event counting between crashes
let boundaryEvents = 0;  // count of non-sweeper transitions
let rightBoundaryEvents = 0;  // B,0→1RC or C,0→1RD
let leftBoundaryEvents = 0;   // D,0→1LA
let aceChainFirings = 0;      // C,1→0LE (start of erasure)

const macroCycles = []; // complete crash-rebuild cycles
let currentCycle = {
  buildBoundaryEvents: 0,
  buildRightBoundary: 0,
  buildLeftBoundary: 0,
  buildSteps: 0,
};

function analyseTapeExact() {
  let minH = TAPE_SIZE, maxH = 0;
  for (let i = 0; i < TAPE_SIZE; i++) {
    if (tape[i]) { if (i < minH) minH = i; if (i > maxH) maxH = i; }
  }

  // Find runs
  const runs = [];
  let runStart = -1, maxRun = 0;
  for (let i = minH; i <= maxH + 1; i++) {
    const v = i <= maxH ? tape[i] : 0;
    if (v === 1 && runStart === -1) runStart = i;
    if (v === 0 && runStart !== -1) {
      const len = i - runStart;
      runs.push(len);
      if (len > maxRun) maxRun = len;
      runStart = -1;
    }
  }

  // Count 100 blocks
  let blocks = 0;
  for (let i = minH; i <= maxH - 2; i++) {
    if (tape[i] === 1 && tape[i + 1] === 0 && tape[i + 2] === 0) blocks++;
  }

  let ones = 0;
  for (let i = minH; i <= maxH; i++) ones += tape[i];

  // Extract full tape string (trimmed)
  let tapeStr = '';
  for (let i = minH; i <= maxH; i++) tapeStr += tape[i];

  return { ones, maxRun, blocks, runs, span: maxH - minH + 1, tapeStr, minH, maxH };
}

// ── Run with precise tracking ────────────────────────────────────────

const MAX_STEPS = 48_000_000;
let prevState = -1;

while (steps < MAX_STEPS) {
  const symbol = tape[head];
  const idx = (state * 2 + symbol) * 3;
  const write = bb5[idx], move = bb5[idx + 1], next = bb5[idx + 2];

  // Count boundary events (non-sweeper transitions)
  const isSweeper = (state === 1 && symbol === 1) || (state === 3 && symbol === 1);
  if (!isSweeper && !inCrash) {
    currentCycle.buildBoundaryEvents++;
    if (state === 1 && symbol === 0) currentCycle.buildRightBoundary++;  // B,0→1RC
    if (state === 2 && symbol === 0) currentCycle.buildRightBoundary++;  // C,0→1RD
    if (state === 3 && symbol === 0) currentCycle.buildLeftBoundary++;   // D,0→1LA
  }

  if (tape[head] === 0 && write === 1) onesCount++;
  if (tape[head] === 1 && write === 0) onesCount--;

  tape[head] = write;
  head += move === 1 ? 1 : -1;
  state = next;
  steps++;

  // Detect macro-crash onset: ones drops from all-time high
  if (onesCount > allTimeHigh) {
    allTimeHigh = onesCount;
    if (inCrash) {
      // Crash ended, new build phase starting
      inCrash = false;
    }
  }

  if (!inCrash && onesCount < allTimeHigh - 10) {
    // Crash starting
    const info = analyseTapeExact();

    // Record the completed build phase
    currentCycle.peakOnes = allTimeHigh;
    currentCycle.peakMaxRun = info.maxRun;  // approximate — tape already changed slightly
    currentCycle.peakBlocks = info.blocks;
    currentCycle.peakStep = steps;
    currentCycle.peakInfo = info;

    macroCycles.push({ ...currentCycle });

    // Reset for next cycle
    currentCycle = {
      buildBoundaryEvents: 0,
      buildRightBoundary: 0,
      buildLeftBoundary: 0,
      buildSteps: 0,
    };

    inCrash = true;
    crashStartStep = steps;
  }

  if (!inCrash) {
    currentCycle.buildSteps++;
  }

  if (state === HALT) break;
}

console.log(`Ran ${steps.toLocaleString()} steps, captured ${macroCycles.length} macro-cycles\n`);

// ── Verification 1: Is the block count really constant? ──────────────

console.log('═══ Verification 1: Block Count Constancy ═══\n');
console.log('  Cycle | Peak Ones | Max Run | Blocks | M+28=Peak? | Span | M+78=Span?');
console.log('  ──────┼───────────┼─────────┼────────┼────────────┼──────┼───────────');

for (let i = 0; i < macroCycles.length; i++) {
  const c = macroCycles[i];
  const mPlus28 = c.peakMaxRun + 28;
  const mPlus78 = c.peakMaxRun + 78;
  const peakCheck = mPlus28 === c.peakOnes ? 'YES' : `NO (${c.peakOnes - c.peakMaxRun})`;
  const spanCheck = Math.abs(mPlus78 - c.peakInfo.span) <= 2 ? 'YES' : `NO (${c.peakInfo.span - c.peakMaxRun})`;

  console.log(`  ${String(i + 1).padStart(4)}  | ${String(c.peakOnes).padStart(9)} | ${String(c.peakMaxRun).padStart(7)} | ${String(c.peakBlocks).padStart(6)} | ${peakCheck.padEnd(10)} | ${String(c.peakInfo.span).padStart(4)} | ${spanCheck}`);
}

const allBlockCounts = macroCycles.map(c => c.peakBlocks);
const uniqueBlocks = [...new Set(allBlockCounts)];
console.log(`\n  Unique block counts: ${JSON.stringify(uniqueBlocks)}`);
console.log(`  Block count is ${uniqueBlocks.length === 1 ? 'CONSTANT ✓' : 'NOT constant ✗'}`);

// ── Verification 2: Boundary events per rebuild ──────────────────────

console.log('\n═══ Verification 2: Boundary Events per Rebuild ═══\n');
console.log('  Cycle | Build Steps   | Boundary Events | Right | Left  | Events/M  | 2*Events/M');
console.log('  ──────┼───────────────┼─────────────────┼───────┼───────┼───────────┼───────────');

for (let i = 0; i < macroCycles.length; i++) {
  const c = macroCycles[i];
  const M = c.peakMaxRun;
  const eventsPerM = M > 0 ? (c.buildBoundaryEvents / M).toFixed(4) : 'N/A';
  const twoEventsPerM = M > 0 ? (2 * c.buildBoundaryEvents / M).toFixed(4) : 'N/A';

  console.log(`  ${String(i + 1).padStart(4)}  | ${String(c.buildSteps.toLocaleString()).padStart(13)} | ${String(c.buildBoundaryEvents).padStart(15)} | ${String(c.buildRightBoundary).padStart(5)} | ${String(c.buildLeftBoundary).padStart(5)} | ${String(eventsPerM).padStart(9)} | ${String(twoEventsPerM).padStart(9)}`);
}

// ── Verification 3: Does 2 * left_boundary_events = extra growth? ────

console.log('\n═══ Verification 3: Boundary Events → Extra Growth ═══\n');
console.log('  Each D,0→1LA boundary event creates +1 one at the left edge.');
console.log('  Each B,0→1RC + C,0→1RD pair creates +2 ones at the right edge.');
console.log('  Hypothesis: total new ones from boundaries = extra growth\n');

console.log('  Cycle | M_n    | M_{n+1} | Growth | -50 (blocks) | Extra  | Left BEs | Right BEs | BE ones | Match?');
console.log('  ──────┼────────┼─────────┼────────┼──────────────┼────────┼──────────┼───────────┼─────────┼───────');

for (let i = 0; i < macroCycles.length - 1; i++) {
  const c = macroCycles[i];
  const next = macroCycles[i + 1];
  const growth = next.peakMaxRun - c.peakMaxRun;
  const extra = growth - 50;  // subtract fixed block refill
  const beOnes = c.buildLeftBoundary + 2 * c.buildRightBoundary;  // ones created by boundary events
  // Actually, boundary events during the BUILD phase of cycle i produce
  // the ones that appear at peak i. We need the BUILD phase of cycle i+1
  // to explain the growth from peak i to peak i+1.
  const nextBE = next.buildLeftBoundary + 2 * next.buildRightBoundary;
  const match = Math.abs(extra - nextBE) < 10 ? 'YES' : `diff=${extra - nextBE}`;

  console.log(`  ${String(i + 1).padStart(4)}  | ${String(c.peakMaxRun).padStart(6)} | ${String(next.peakMaxRun).padStart(7)} | ${String(growth).padStart(6)} | ${String(50).padStart(12)} | ${String(extra).padStart(6)} | ${String(next.buildLeftBoundary).padStart(8)} | ${String(next.buildRightBoundary).padStart(9)} | ${String(nextBE).padStart(7)} | ${match}`);
}

// ── Verification 4: Check the exact tape pattern ─────────────────────

console.log('\n═══ Verification 4: Exact Tape Pattern at First 3 Peaks ═══\n');
for (let i = 0; i < Math.min(3, macroCycles.length); i++) {
  const c = macroCycles[i];
  const ts = c.peakInfo.tapeStr;
  console.log(`  Peak ${i + 1} (ones=${c.peakOnes}, M=${c.peakMaxRun}, blocks=${c.peakBlocks}):`);
  if (ts.length <= 200) {
    console.log(`    ${ts}`);
  } else {
    console.log(`    ${ts.substring(0, 80)}...${ts.substring(ts.length - 80)}`);
  }
  console.log(`    Runs: [${c.peakInfo.runs.join(', ')}]`);
  console.log();
}

// ── The proof argument ───────────────────────────────────────────────

console.log('═══ Proof Summary ═══\n');

if (macroCycles.length >= 3) {
  const lateRatios = [];
  for (let i = Math.max(1, macroCycles.length - 4); i < macroCycles.length; i++) {
    lateRatios.push(macroCycles[i].peakOnes / macroCycles[i - 1].peakOnes);
  }
  const avgRatio = lateRatios.reduce((a, b) => a + b, 0) / lateRatios.length;

  console.log(`  1. Block count is constant: ${uniqueBlocks.length === 1 ? 'VERIFIED ✓' : 'NOT VERIFIED ✗'} (always ${uniqueBlocks[0]})`);
  console.log(`  2. Peak ratio converges to 5/3: ${Math.abs(avgRatio - 5/3) < 0.01 ? 'VERIFIED ✓' : 'NOT VERIFIED ✗'} (latest: ${avgRatio.toFixed(6)})`);
  console.log(`  3. Recurrence M_{n+1} = (5/3)M_n + 50: see table above`);
  console.log(`  4. Extra growth = (2/3)M from boundary events: see verification 3`);
}
