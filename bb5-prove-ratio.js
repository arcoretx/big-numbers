/**
 * BB(5) — Proving the 5/3 Ratio
 *
 * Step 1: Establish the exact recurrence relation empirically.
 *   - Count `100` blocks on the tape before and after each crash
 *   - Track the tape configuration at each crash boundary
 *   - Derive the function f(n) where n' = f(n)
 *
 * Step 2: Understand the build phase analytically.
 *   - Starting from a tape with n `100` blocks, how many ones does
 *     the machine build before the next crash?
 *   - How many `100` blocks does the crash leave?
 *
 * Step 3: Prove the recurrence.
 *
 * Key mechanism (from our analysis):
 *   - ACE chain processes 3 positions per cycle: A keeps, C erases, E erases
 *   - From a block of N ones, chain leaves ceil(N/3) ones in pattern `100`
 *   - The chain halts when C reads 0 (→ restart) or E reads 0 (→ HALT)
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
console.log('║   PROVING THE 5/3 RATIO                                ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

// ── Step 1: Run and capture tape snapshots at each crash ─────────────

console.log('═══ Step 1: Tape Configuration at Each Crash ═══\n');

const CHECK_INTERVAL = 100;
let prevOnes = 0, peakOnes = 0;
const crashSnapshots = [];

function countBlocks(tape, minH, maxH) {
  // Count `100` blocks (or `001` depending on direction)
  let blocks100 = 0;
  for (let i = minH; i <= maxH - 2; i++) {
    if (tape[i] === 1 && tape[i + 1] === 0 && tape[i + 2] === 0) blocks100++;
  }

  // Count contiguous runs of 1s
  const runs = [];
  let runStart = -1;
  for (let i = minH; i <= maxH; i++) {
    if (tape[i] === 1 && runStart === -1) runStart = i;
    if ((tape[i] === 0 || i === maxH) && runStart !== -1) {
      const len = (tape[i] === 1 ? i + 1 : i) - runStart;
      if (len > 0) runs.push(len);
      runStart = -1;
    }
  }

  // Count total ones
  let ones = 0;
  for (let i = minH; i <= maxH; i++) ones += tape[i];

  // Extract tape pattern as string
  let pattern = '';
  for (let i = minH; i <= maxH; i++) pattern += tape[i];
  // Trim leading/trailing zeros
  pattern = pattern.replace(/^0+/, '').replace(/0+$/, '');

  return { blocks100, ones, runs, pattern };
}

const MAX_STEPS = 48_000_000;

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

  if (onesCount > peakOnes) peakOnes = onesCount;

  // Detect crash: significant ones drop
  if (steps % CHECK_INTERVAL === 0) {
    if (onesCount - prevOnes < -50) {
      // Find tape extent
      let minH = CENTER, maxH = CENTER;
      for (let i = 0; i < TAPE_SIZE; i++) {
        if (tape[i]) { if (i < minH) minH = i; if (i > maxH) maxH = i; }
      }

      const info = countBlocks(tape, minH - 1, maxH + 1);

      crashSnapshots.push({
        step: steps,
        onesAtCrash: onesCount,
        peakBefore: peakOnes,
        blocks100: info.blocks100,
        ones: info.ones,
        runs: info.runs,
        pattern: info.pattern.length <= 200 ? info.pattern : info.pattern.substring(0, 100) + '...' + info.pattern.substring(info.pattern.length - 100),
        tapeSpan: maxH - minH + 1,
      });
    }
    prevOnes = onesCount;
  }

  if (state === HALT) break;
}

console.log(`Ran ${steps.toLocaleString()} steps, captured ${crashSnapshots.length} crash snapshots\n`);

// Show each crash with tape analysis
console.log('  #  | Step          | Peak  | Ones  | 100-blocks | Runs          | Tape span');
console.log('  ───┼───────────────┼───────┼───────┼────────────┼───────────────┼──────────');
for (let i = 0; i < crashSnapshots.length; i++) {
  const c = crashSnapshots[i];
  const runsStr = c.runs.length <= 8
    ? c.runs.join(',')
    : c.runs.slice(0, 4).join(',') + '...' + c.runs.slice(-4).join(',');
  console.log(`  ${String(i + 1).padStart(2)} | ${String(c.step.toLocaleString()).padStart(13)} | ${String(c.peakBefore).padStart(5)} | ${String(c.ones).padStart(5)} | ${String(c.blocks100).padStart(10)} | ${runsStr.padEnd(13)} | ${c.tapeSpan}`);
}

// ── Step 2: Analyse the `100` block count across crashes ─────────────

console.log('\n═══ Step 2: 100-Block Recurrence ═══\n');

if (crashSnapshots.length >= 2) {
  console.log('  Crash | 100-blocks | Ratio to prev | Peak ones | Ratio to prev');
  console.log('  ──────┼────────────┼───────────────┼───────────┼──────────────');
  for (let i = 0; i < crashSnapshots.length; i++) {
    const c = crashSnapshots[i];
    const blockRatio = i > 0 ? (c.blocks100 / crashSnapshots[i - 1].blocks100).toFixed(4) : 'N/A';
    const peakRatio = i > 0 ? (c.peakBefore / crashSnapshots[i - 1].peakBefore).toFixed(4) : 'N/A';
    console.log(`  ${String(i + 1).padStart(4)}  | ${String(c.blocks100).padStart(10)} | ${String(blockRatio).padStart(13)} | ${String(c.peakBefore).padStart(9)} | ${String(peakRatio).padStart(12)}`);
  }
}

// ── Step 3: Detailed tape pattern at each crash ──────────────────────

console.log('\n═══ Step 3: Tape Patterns at Crashes ═══\n');
for (let i = 0; i < Math.min(8, crashSnapshots.length); i++) {
  const c = crashSnapshots[i];
  console.log(`  Crash ${i + 1} (step ${c.step.toLocaleString()}):`);
  console.log(`    Tape: ${c.pattern}`);
  console.log(`    Runs of 1s: [${c.runs.join(', ')}]`);
  console.log(`    100-blocks: ${c.blocks100}`);
  console.log();
}

// ── Step 4: Analytical derivation ────────────────────────────────────

console.log('═══ Step 4: The ACE Chain Mathematics ═══\n');

console.log('The ACE erasure chain processes the tape in groups of 3:');
console.log('  A reads 1 → keeps it (writes 1, moves L)');
console.log('  C reads 1 → erases it (writes 0, moves L)');
console.log('  E reads 1 → erases it (writes 0, moves L)');
console.log();
console.log('From a contiguous block of N ones:');
console.log('  - floor(N/3) complete ACE cycles');
console.log('  - Erases 2*floor(N/3) ones');
console.log('  - Keeps floor(N/3) ones (every 3rd one, from right)');
console.log('  - Remainder: N mod 3 ones at the left edge');
console.log();

// Verify: apply the chain to blocks of different sizes
console.log('  Verification (what the chain does to blocks of N ones):');
console.log('  N ones → ones remaining → 100 blocks');
for (let N = 1; N <= 30; N++) {
  // Simulate the chain on a block of N ones
  const t = new Uint8Array(N + 4);
  for (let i = 2; i < N + 2; i++) t[i] = 1;  // N ones, padded with 0s
  let pos = N + 1;  // start at rightmost 1
  let chainState = 0;  // 0=A, 1=C, 2=E
  let terminated = false;
  let haltedChain = false;

  while (!terminated) {
    const sym = t[pos];
    if (chainState === 0) {  // A
      if (sym === 1) { t[pos] = 1; pos--; chainState = 1; }  // keep, go to C
      else { t[pos] = 1; terminated = true; }  // A reads 0: extend + restart
    } else if (chainState === 1) {  // C
      if (sym === 1) { t[pos] = 0; pos--; chainState = 2; }  // erase, go to E
      else { t[pos] = 1; terminated = true; }  // C reads 0: restart with D
    } else {  // E
      if (sym === 1) { t[pos] = 0; pos--; chainState = 0; }  // erase, go to A
      else { haltedChain = true; terminated = true; }  // E reads 0: HALT
    }
    if (pos < 0) terminated = true;
  }

  let remaining = 0;
  let blocks = 0;
  let pattern = '';
  for (let i = 0; i < t.length; i++) {
    remaining += t[i];
    pattern += t[i];
  }
  for (let i = 0; i < t.length - 2; i++) {
    if (t[i] === 1 && t[i + 1] === 0 && t[i + 2] === 0) blocks++;
  }
  pattern = pattern.replace(/^0+/, '').replace(/0+$/, '');

  const halt = haltedChain ? ' HALT!' : '';
  if (N <= 20 || N % 5 === 0) {
    console.log(`    N=${String(N).padStart(2)}: ${String(remaining).padStart(2)} ones, ${String(blocks).padStart(2)} blocks → ${pattern}${halt}`);
  }
}

// ── Step 5: The key relationship ─────────────────────────────────────

console.log('\n═══ Step 5: The Recurrence Relation ═══\n');

console.log('After a crash, the tape has some number of `100` blocks.');
console.log('During the rebuild phase:');
console.log('  1. Sweepers fill in the 0s between blocks');
console.log('  2. This creates larger contiguous runs of 1s');
console.log('  3. The next crash applies the ACE chain to these larger runs');
console.log('  4. Producing more `100` blocks');
console.log();
console.log('The question: if the tape has n `100` blocks after crash k,');
console.log('how many does it have after crash k+1?');
console.log();

// Measure the actual recurrence from our data
if (crashSnapshots.length >= 2) {
  const blockCounts = crashSnapshots.map(c => c.blocks100);
  const blockRatios = [];
  for (let i = 1; i < blockCounts.length; i++) {
    if (blockCounts[i - 1] > 0) blockRatios.push(blockCounts[i] / blockCounts[i - 1]);
  }

  console.log('  Empirical block ratios:');
  for (let i = 0; i < blockRatios.length; i++) {
    console.log(`    Crash ${i + 2}/${i + 1}: ${crashSnapshots[i + 1].blocks100} / ${crashSnapshots[i].blocks100} = ${blockRatios[i].toFixed(6)}`);
  }

  const lateRatios = blockRatios.slice(-3);
  const avg = lateRatios.reduce((a, b) => a + b, 0) / lateRatios.length;
  console.log(`\n  Late average block ratio: ${avg.toFixed(6)}`);
  console.log(`  5/3 =                     ${(5 / 3).toFixed(6)}`);
  console.log(`  Difference:               ${(avg - 5 / 3).toFixed(6)}`);
}

// ── Step 6: Why 5/3? ─────────────────────────────────────────────────

console.log('\n═══ Step 6: Why 5/3? The Argument ═══\n');

console.log('Claim: if the tape has n `100` blocks, the rebuild phase');
console.log('creates a contiguous block of (3n - 1) ones, which the');
console.log('next crash converts to floor((3n-1)/3) = (n - 1) + remaining');
console.log('`100` blocks... but this doesn\'t immediately give 5/3.');
console.log();
console.log('Let\'s check: what is the actual relationship between');
console.log('100-blocks and the peak ones count?');
console.log();

for (let i = 0; i < crashSnapshots.length; i++) {
  const c = crashSnapshots[i];
  const ratio = c.peakBefore / c.blocks100;
  console.log(`  Crash ${i + 1}: peak=${c.peakBefore}, blocks=${c.blocks100}, peak/blocks=${ratio.toFixed(4)}`);
}

console.log('\n  If peak ≈ k * blocks for some constant k, then:');
console.log('  peak_{n+1}/peak_n = blocks_{n+1}/blocks_n');
console.log('  So proving 5/3 for blocks proves it for peaks.');
console.log();

// More detailed: what does the tape look like between crashes?
// Let's capture tape snapshots at the PEAK (just before crash starts)
console.log('═══ Tape at Peak (just before crash) ═══\n');

// Re-run, capturing tape at peaks
tape.fill(0);
head = CENTER; state = 0; steps = 0; onesCount = 0;
peakOnes = 0;
let peakStep = 0;
const peakSnapshots = [];
let lastPeakOnes = 0;

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

  if (onesCount > peakOnes) {
    peakOnes = onesCount;
    peakStep = steps;
  }

  if (steps % CHECK_INTERVAL === 0) {
    if (onesCount - prevOnes < -50 && peakOnes > lastPeakOnes + 50) {
      // Capture the peak configuration (tape at peakStep is gone, but
      // current ones are close enough to the pattern)
      let minH = CENTER, maxH = CENTER;
      for (let i = 0; i < TAPE_SIZE; i++) {
        if (tape[i]) { if (i < minH) minH = i; if (i > maxH) maxH = i; }
      }

      // Count contiguous 1-runs at peak
      const runs = [];
      let runStart = -1;
      for (let i = minH - 1; i <= maxH + 1; i++) {
        if (tape[i] === 1 && runStart === -1) runStart = i;
        if ((tape[i] === 0 || i === maxH + 1) && runStart !== -1) {
          runs.push((tape[i] === 1 ? i + 1 : i) - runStart);
          runStart = -1;
        }
      }

      peakSnapshots.push({
        peakOnes,
        peakStep,
        runs: [...runs],
        maxRun: Math.max(...runs),
        tapeSpan: maxH - minH + 1,
      });
      lastPeakOnes = peakOnes;
    }
    prevOnes = onesCount;
  }

  if (state === HALT) break;
}

console.log('  Peak | Ones  | Max run | Runs of 1s');
console.log('  ─────┼───────┼─────────┼───────────');
for (let i = 0; i < peakSnapshots.length; i++) {
  const p = peakSnapshots[i];
  const runsStr = p.runs.length <= 10
    ? p.runs.join(', ')
    : p.runs.slice(0, 5).join(', ') + ', ... ' + p.runs.slice(-3).join(', ');
  console.log(`  ${String(i + 1).padStart(3)}  | ${String(p.peakOnes).padStart(5)} | ${String(p.maxRun).padStart(7)} | [${runsStr}]`);
}

if (peakSnapshots.length >= 2) {
  console.log('\n  Max run ratios:');
  for (let i = 1; i < peakSnapshots.length; i++) {
    const ratio = peakSnapshots[i].maxRun / peakSnapshots[i - 1].maxRun;
    console.log(`    Peak ${i + 1}/${i}: ${peakSnapshots[i].maxRun} / ${peakSnapshots[i - 1].maxRun} = ${ratio.toFixed(4)}`);
  }
}
