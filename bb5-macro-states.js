/**
 * BB(5) Macro-State Analysis
 *
 * Track the tape configuration as a macro-state:
 *   (M, k) where M = max contiguous run, k = number of 100 blocks
 *
 * Capture this at every macro-crash boundary to derive the exact
 * recurrence relation.
 *
 * Key insight from previous analysis: the tape at each peak is
 * NOT all 1s — it's a large run M plus k leftover 100 blocks.
 * The crash cascade processes the run in multiple passes.
 */

const HALT = 5;
const bb5 = new Uint8Array([
  1, 1, 1,    1, 0, 2,
  1, 1, 2,    1, 1, 1,
  1, 1, 3,    0, 0, 4,
  1, 0, 0,    1, 0, 3,
  1, 1, 5,    0, 0, 0,
]);

const TAPE_SIZE = 65536;
const CENTER = Math.floor(TAPE_SIZE / 2);
const tape = new Uint8Array(TAPE_SIZE);
let head = CENTER, state = 0, steps = 0, onesCount = 0;

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║   BB(5) MACRO-STATE RECURRENCE                         ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

// ── Track macro-crashes precisely ────────────────────────────────────
// A "macro-crash" = all consecutive crash events at the same peak level
// We detect when the peak level changes to identify macro-crash boundaries

let currentPeak = 0;
let prevOnes = 0;
let macroCrashes = [];
let currentMacroCrash = null;

function analyseTape() {
  let minH = TAPE_SIZE, maxH = 0;
  for (let i = 0; i < TAPE_SIZE; i++) {
    if (tape[i]) { if (i < minH) minH = i; if (i > maxH) maxH = i; }
  }
  if (minH > maxH) return { ones: 0, maxRun: 0, blocks100: 0, runs: [], span: 0 };

  // Find runs of 1s
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

  return { ones, maxRun, blocks100: blocks, runs, span: maxH - minH + 1 };
}

// ── Run and capture at macro-crash boundaries ────────────────────────

const CHECK_INTERVAL = 100;
const MAX_STEPS = 48_000_000;

// Capture tape state at each ones-peak (just before first drop)
let risingPhase = true;
let peakInfo = null;

// Better approach: capture state when ones count first drops below
// a threshold after reaching a new maximum
let lastMaxOnes = 0;
let capturedPeak = false;

// Track at finer resolution: capture state at local maxima
const peakCaptures = []; // tape state at each unique peak level

while (steps < MAX_STEPS) {
  const symbol = tape[head];
  const idx = (state * 2 + symbol) * 3;
  const write = bb5[idx], move = bb5[idx + 1], next = bb5[idx + 2];

  if (tape[head] === 0 && write === 1) onesCount++;
  if (tape[head] === 1 && write === 0) onesCount--;

  tape[head] = write;
  head += move === 1 ? 1 : -1;
  state = next;
  steps++;

  // Detect when we reach a new all-time high and then start dropping
  if (onesCount > lastMaxOnes) {
    lastMaxOnes = onesCount;
    capturedPeak = false;
  }

  if (!capturedPeak && onesCount < lastMaxOnes - 50) {
    // We just passed a peak — capture the tape state
    const info = analyseTape();
    info.peakOnes = lastMaxOnes;
    info.step = steps;

    // Only record if this is a genuinely new peak level
    // (not a sub-crash within the same macro-crash)
    const lastPeak = peakCaptures.length > 0 ? peakCaptures[peakCaptures.length - 1].peakOnes : 0;
    if (lastMaxOnes > lastPeak * 1.2) {  // at least 20% higher = new macro-crash
      peakCaptures.push(info);
    }

    capturedPeak = true;
  }

  if (state === HALT) break;
}

console.log(`Ran ${steps.toLocaleString()} steps\n`);
console.log(`Captured ${peakCaptures.length} macro-crash peaks\n`);

// ── Display macro-state at each peak ─────────────────────────────────

console.log('═══ Macro-State at Each Peak ═══\n');
console.log('  #  | Peak  | Max Run | 100-blks | Span  | Run/Peak | Blk/Peak | Runs summary');
console.log('  ───┼───────┼─────────┼──────────┼───────┼──────────┼──────────┼─────────────');

for (let i = 0; i < peakCaptures.length; i++) {
  const p = peakCaptures[i];
  const runRatio = (p.maxRun / p.peakOnes).toFixed(3);
  const blkRatio = (p.blocks100 / p.peakOnes).toFixed(3);

  // Summarize runs: show the big run + count of small runs
  const bigRuns = p.runs.filter(r => r > 5);
  const smallRuns = p.runs.filter(r => r <= 5);
  const runSummary = bigRuns.length > 0
    ? `[${bigRuns.join(',')}] + ${smallRuns.length} small`
    : `${p.runs.length} runs`;

  console.log(`  ${String(i + 1).padStart(2)} | ${String(p.peakOnes).padStart(5)} | ${String(p.maxRun).padStart(7)} | ${String(p.blocks100).padStart(8)} | ${String(p.span).padStart(5)} | ${runRatio.padStart(8)} | ${blkRatio.padStart(8)} | ${runSummary}`);
}

// ── Recurrence analysis ──────────────────────────────────────────────

console.log('\n═══ Recurrence Ratios ═══\n');

if (peakCaptures.length >= 2) {
  console.log('  Peak ratios (peak_{n+1}/peak_n):');
  for (let i = 1; i < peakCaptures.length; i++) {
    const r = peakCaptures[i].peakOnes / peakCaptures[i - 1].peakOnes;
    console.log(`    ${i + 1}/${i}: ${peakCaptures[i].peakOnes} / ${peakCaptures[i - 1].peakOnes} = ${r.toFixed(6)}`);
  }

  console.log('\n  Max-run ratios (M_{n+1}/M_n):');
  for (let i = 1; i < peakCaptures.length; i++) {
    const r = peakCaptures[i].maxRun / peakCaptures[i - 1].maxRun;
    console.log(`    ${i + 1}/${i}: ${peakCaptures[i].maxRun} / ${peakCaptures[i - 1].maxRun} = ${r.toFixed(6)}`);
  }

  console.log('\n  Block-count ratios (k_{n+1}/k_n):');
  for (let i = 1; i < peakCaptures.length; i++) {
    if (peakCaptures[i - 1].blocks100 > 0) {
      const r = peakCaptures[i].blocks100 / peakCaptures[i - 1].blocks100;
      console.log(`    ${i + 1}/${i}: ${peakCaptures[i].blocks100} / ${peakCaptures[i - 1].blocks100} = ${r.toFixed(6)}`);
    }
  }

  // The key relationship: how do M and k relate?
  console.log('\n  M + 3k vs span (should be close):');
  for (let i = 0; i < peakCaptures.length; i++) {
    const p = peakCaptures[i];
    const predicted = p.maxRun + 3 * p.blocks100;
    console.log(`    Peak ${i + 1}: M=${p.maxRun}, 3k=${3 * p.blocks100}, M+3k=${predicted}, span=${p.span}, diff=${p.span - predicted}`);
  }
}

// ── The ACE chain effect on the max run ──────────────────────────────

console.log('\n═══ ACE Chain: Max Run → Blocks ═══\n');
console.log('After the crash, the max run is consumed by the ACE chain.');
console.log('How many blocks does each max run produce?\n');

for (let i = 0; i < peakCaptures.length; i++) {
  const p = peakCaptures[i];
  const expectedBlocks = Math.floor(p.maxRun / 3);
  console.log(`  Peak ${i + 1}: maxRun=${p.maxRun} → expected floor(M/3)=${expectedBlocks}, actual blocks=${p.blocks100}`);
}

// ── The rebuild: how does M grow? ────────────────────────────────────

console.log('\n═══ Rebuild Dynamics ═══\n');
console.log('Between crashes, the max run M grows. How?\n');
console.log('Hypothesis: M_{n+1} = M_n + 2*k_n (refill all 100-blocks)\n');

for (let i = 1; i < peakCaptures.length; i++) {
  const prev = peakCaptures[i - 1];
  const curr = peakCaptures[i];
  const predicted = prev.maxRun + 2 * prev.blocks100;
  const actual = curr.maxRun;
  const diff = actual - predicted;
  const ratio = actual / predicted;
  console.log(`  ${i}→${i + 1}: M_prev=${prev.maxRun}, k_prev=${prev.blocks100}, predicted M + 2k = ${predicted}, actual M = ${actual}, diff=${diff}, ratio=${ratio.toFixed(4)}`);
}

// ── Alternative: track (M, k) through crash and rebuild ──────────────

console.log('\n═══ (M, k) State Transitions ═══\n');
console.log('  Crash:   (M, k) → (M - floor(M/3)*3, k + floor(M/3))');
console.log('         = (M mod 3, k + floor(M/3))');
console.log('  Rebuild: (r, k_total) → (r + 2*k_total + boundary, 0)');
console.log('         where boundary ~ proportional to rebuilt tape\n');

for (let i = 0; i < peakCaptures.length; i++) {
  const p = peakCaptures[i];
  // After crash:
  const r = p.maxRun % 3;
  const k_after = p.blocks100; // blocks after the full cascade
  const M_next = i + 1 < peakCaptures.length ? peakCaptures[i + 1].maxRun : '?';
  const k_next = i + 1 < peakCaptures.length ? peakCaptures[i + 1].blocks100 : '?';

  // What M would be if we just refill k blocks (M = r + 3k, since each 100→111)
  const M_if_refill = p.maxRun + 2 * k_after;  // the run absorbs the blocks

  console.log(`  After crash ${i + 1}:`);
  console.log(`    (M=${p.maxRun}, k=${k_after}) at peak=${p.peakOnes}`);
  console.log(`    If rebuild just refills: M_new = ${p.maxRun} + 2*${k_after} = ${M_if_refill}`);
  console.log(`    Actual next M = ${M_next}`);
  if (typeof M_next === 'number') {
    console.log(`    Extra growth beyond refill: ${M_next - M_if_refill}`);
    console.log(`    Ratio actual/refill: ${(M_next / M_if_refill).toFixed(4)}`);
  }
  console.log();
}
