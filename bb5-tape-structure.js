/**
 * BB(5) Tape Structure Analysis
 *
 * What makes BB(5)'s tape non-periodic?
 * Why does the machine behave differently on each pass?
 *
 * Key question: what does the tape look like at boundary events,
 * and how does its structure change between passes?
 */

const HALT = 5;
const STATE_NAMES = ['A', 'B', 'C', 'D', 'E', 'H'];

const bb5 = new Uint8Array([
  1, 1, 1,    1, 0, 2,  // A: 0→1RB  1→1LC
  1, 1, 2,    1, 1, 1,  // B: 0→1RC  1→1RB  (right sweeper)
  1, 1, 3,    0, 0, 4,  // C: 0→1RD  1→0LE  (eraser)
  1, 0, 0,    1, 0, 3,  // D: 0→1LA  1→1LD  (left sweeper)
  1, 1, 5,    0, 0, 0,  // E: 0→1RH  1→0LA  (eraser + halt)
]);

const TAPE_SIZE = 4096;
const CENTER = Math.floor(TAPE_SIZE / 2);
const tape = new Uint8Array(TAPE_SIZE);
let head = CENTER, state = 0, steps = 0, onesCount = 0;

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║   BB(5) TAPE STRUCTURE — WHY NON-PERIODIC?             ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

// ── Capture tape snapshots at boundary events ────────────────────────
// A "boundary event" = any non-sweeper transition

const snapshots = [];
let sweepCount = 0;
let lastBoundaryStep = 0;

const MAX_STEPS = 5000;

while (steps < MAX_STEPS) {
  const symbol = tape[head];
  const idx = (state * 2 + symbol) * 3;
  const write = bb5[idx], move = bb5[idx + 1], next = bb5[idx + 2];

  const isSweeper = (state === 1 && symbol === 1) || (state === 3 && symbol === 1);

  if (tape[head] === 0 && write === 1) onesCount++;
  if (tape[head] === 1 && write === 0) onesCount--;

  // Capture snapshot at each non-sweeper transition
  if (!isSweeper) {
    // Find tape extent
    let minP = CENTER, maxP = CENTER;
    for (let i = 0; i < TAPE_SIZE; i++) {
      if (tape[i]) { if (i < minP) minP = i; if (i > maxP) maxP = i; }
    }

    // Capture the tape content as a string
    let tapeStr = '';
    for (let i = minP - 1; i <= maxP + 1; i++) {
      if (i === head) tapeStr += `[${tape[i]}]`;
      else tapeStr += tape[i];
    }

    snapshots.push({
      step: steps,
      state: STATE_NAMES[state],
      symbol,
      write,
      move: move === 1 ? 'R' : 'L',
      next: STATE_NAMES[next],
      ones: onesCount,
      head: head - CENTER,
      tape: tapeStr,
      sweepsSince: sweepCount,
      creating: symbol === 0 && write === 1,
      erasing: symbol === 1 && write === 0,
    });

    sweepCount = 0;
  } else {
    sweepCount++;
  }

  tape[head] = write;
  head += move === 1 ? 1 : -1;
  state = next;
  steps++;

  if (state === HALT) { console.log(`HALTED at step ${steps}`); break; }
}

// ── Show boundary events with tape context ───────────────────────────

console.log('═══ Boundary Events with Tape Context (first 80) ═══\n');
console.log('Each line shows a non-sweeper transition and the tape state.\n');

for (let i = 0; i < Math.min(80, snapshots.length); i++) {
  const s = snapshots[i];
  const action = s.erasing ? 'ERASE' : s.creating ? 'CREATE' : 'keep ';
  const sweepNote = s.sweepsSince > 0 ? ` (after ${s.sweepsSince} sweep steps)` : '';
  console.log(`  #${String(i + 1).padStart(3)} step=${String(s.step).padStart(5)} ${s.state},${s.symbol}→${s.write}${s.move}${s.next} [${action}] ones=${String(s.ones).padStart(3)}${sweepNote}`);
  console.log(`        ${s.tape}`);
}

// ── Analyse tape patterns between boundary events ────────────────────

console.log('\n═══ Tape Pattern Analysis ═══\n');

// Extract just the tape content (without head markers) at each snapshot
function cleanTape(tapeStr) {
  return tapeStr.replace(/\[|\]/g, '');
}

// Look for runs and patterns
function analysePattern(tapeStr) {
  const clean = cleanTape(tapeStr);
  // Count runs
  let runs = 0, maxRun = 0, currentRun = 1;
  for (let i = 1; i < clean.length; i++) {
    if (clean[i] === clean[i - 1]) {
      currentRun++;
    } else {
      if (currentRun > maxRun) maxRun = currentRun;
      runs++;
      currentRun = 1;
    }
  }
  runs++;
  if (currentRun > maxRun) maxRun = currentRun;

  // Check if it's periodic
  let periodicity = 'none';
  for (let period = 1; period <= clean.length / 2; period++) {
    let isPeriodic = true;
    for (let i = period; i < clean.length; i++) {
      if (clean[i] !== clean[i % period]) { isPeriodic = false; break; }
    }
    if (isPeriodic) { periodicity = `period-${period}`; break; }
  }

  // Count unique substrings of length 3
  const trigrams = new Set();
  for (let i = 0; i < clean.length - 2; i++) {
    trigrams.add(clean.slice(i, i + 3));
  }

  return { runs, maxRun, periodicity, uniqueTrigrams: trigrams.size, length: clean.length };
}

// Sample tape at key moments
const keyMoments = [1, 5, 10, 20, 30, 40, 50, 60, 70, 80];
console.log('  Snapshot | Tape len | Runs | Max run | Periodicity | Unique 3-grams');
console.log('  ─────────┼──────────┼──────┼─────────┼─────────────┼───────────────');
for (const idx of keyMoments) {
  if (idx > snapshots.length) break;
  const s = snapshots[idx - 1];
  const analysis = analysePattern(s.tape);
  console.log(`  ${String(idx).padStart(7)}  | ${String(analysis.length).padStart(8)} | ${String(analysis.runs).padStart(4)} | ${String(analysis.maxRun).padStart(7)} | ${analysis.periodicity.padEnd(11)} | ${String(analysis.uniqueTrigrams).padStart(13)}`);
}

// ── Critical question: what do erasure events do to the tape? ────────

console.log('\n═══ Erasure Impact on Tape Structure ═══\n');
console.log('Showing tape BEFORE and AFTER each erasure event:\n');

let eraseCount = 0;
for (let i = 0; i < snapshots.length && eraseCount < 15; i++) {
  const s = snapshots[i];
  if (s.erasing) {
    eraseCount++;
    console.log(`  Erase #${eraseCount} at step ${s.step}: ${s.state},${s.symbol}→${s.write}${s.move}${s.next}`);
    console.log(`    Before: ${s.tape}`);
    // The "after" is approximately the next snapshot's tape
    if (i + 1 < snapshots.length) {
      console.log(`    After:  ${snapshots[i + 1].tape}`);
      // Highlight what changed
      const before = cleanTape(s.tape);
      const after = cleanTape(snapshots[i + 1].tape);
      if (before.length === after.length) {
        let diff = '    Diff:   ';
        for (let j = 0; j < before.length; j++) {
          diff += before[j] === after[j] ? '·' : after[j];
        }
        console.log(diff);
      }
    }
    console.log();
  }
}

// ── The key insight: what patterns does D see when it sweeps left? ───

console.log('═══ What D Sees During Left Sweeps ═══\n');
console.log('D sweeps left through 1s. What happens when D hits a 0?\n');

// Re-run and track what D encounters
tape.fill(0);
head = CENTER; state = 0; steps = 0; onesCount = 0;

const dBoundaryEvents = [];

while (steps < 5000) {
  const symbol = tape[head];
  const idx = (state * 2 + symbol) * 3;
  const write = bb5[idx], move = bb5[idx + 1], next = bb5[idx + 2];

  // Track when D hits a 0 (left boundary)
  if (state === 3 && symbol === 0) {
    // What does the tape look like around D's position?
    let context = '';
    for (let i = head - 5; i <= head + 15; i++) {
      if (i === head) context += `[${tape[i]}]`;
      else context += (i >= 0 && i < TAPE_SIZE) ? tape[i] : '?';
    }
    dBoundaryEvents.push({
      step: steps,
      head: head - CENTER,
      ones: onesCount,
      context,
    });
  }

  if (tape[head] === 0 && write === 1) onesCount++;
  if (tape[head] === 1 && write === 0) onesCount--;
  tape[head] = write;
  head += move === 1 ? 1 : -1;
  state = next;
  steps++;
  if (state === HALT) break;
}

console.log('  D left-boundary hits:');
console.log('  Step  | Head   | Ones | Tape context (around D)');
console.log('  ──────┼────────┼──────┼────────────────────────');
for (const e of dBoundaryEvents.slice(0, 30)) {
  console.log(`  ${String(e.step).padStart(5)} | ${String(e.head).padStart(6)} | ${String(e.ones).padStart(4)} | ${e.context}`);
}

// ── Compare with B2's tape ───────────────────────────────────────────

console.log('\n═══ BB(5) vs B2: The Critical Difference ═══\n');
console.log('  B2 tape at step 100:  ...10101010101010101010...');
console.log('  Pattern: perfectly periodic (period 2). Machine always');
console.log('  sees the same local structure. No branching ever happens.');
console.log();
console.log('  BB(5) tape evolves NON-periodically because:');
console.log('  1. The ACE erasure chain writes 0s INTO the ones region');
console.log('  2. These 0s create "holes" that sweepers encounter');
console.log('  3. When a sweeper hits a hole, it triggers boundary processing');
console.log('  4. Boundary processing may create MORE holes or fill OLD holes');
console.log('  5. This feedback loop prevents periodicity');
console.log();
console.log('  Design principle for BB(6):');
console.log('  The machine must create INTERNAL STRUCTURE within its');
console.log('  ones region — not just extend boundaries. The erasure');
console.log('  chain must leave marks that the sweepers later react to');
console.log('  differently, creating content-dependent branching.');
