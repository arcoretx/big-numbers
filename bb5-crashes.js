/**
 * BB(5) Crash Mechanism Analysis
 *
 * Zooms into the crash events where the ones count drops dramatically.
 * For each crash, captures:
 *   - Tape snapshots before, during, and after
 *   - State distribution shift
 *   - Head position trajectory
 *   - What triggers the crash (which transition fires differently?)
 *   - How the tape structure changes
 */

const HALT = 5;
const STATE_NAMES = ['A', 'B', 'C', 'D', 'E', 'H'];

function createTable(transitions) {
  const stateMap = { 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'H': 5 };
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

const bb5 = createTable([
  ['A', 0, 1, 'R', 'B'], ['A', 1, 1, 'L', 'C'],
  ['B', 0, 1, 'R', 'C'], ['B', 1, 1, 'R', 'B'],
  ['C', 0, 1, 'R', 'D'], ['C', 1, 0, 'L', 'E'],
  ['D', 0, 1, 'L', 'A'], ['D', 1, 1, 'L', 'D'],
  ['E', 0, 1, 'R', 'H'], ['E', 1, 0, 'L', 'A'],
]);

// ── Run with crash detection ─────────────────────────────────────────

const TAPE_SIZE = 65536;
const TAPE_CENTER = Math.floor(TAPE_SIZE / 2);
const tape = new Uint8Array(TAPE_SIZE);
let head = TAPE_CENTER;
let state = 0;
let steps = 0;
let onesCount = 0;
let minHead = head, maxHead = head;

// Track ones at fine resolution to detect crashes
const FINE_INTERVAL = 1000;
let prevOnes = 0;
let prevFineOnes = 0;

// Crash detection parameters
const CRASH_THRESHOLD = -100;  // ones drop of 100+ in 1000 steps = crash
const crashes = [];
let inCrash = false;
let crashStart = 0;
let crashPeakOnes = 0;

// Capture detailed state around crashes
// We'll identify crash regions first, then re-run with detailed capture

// First pass: find crash locations
console.log('Pass 1: Detecting crash locations...\n');

const onesTimeline = [];  // [step, ones] at FINE_INTERVAL
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

  if (head < minHead) minHead = head;
  if (head > maxHead) maxHead = head;

  if (steps % FINE_INTERVAL === 0) {
    const delta = onesCount - prevFineOnes;
    onesTimeline.push({ step: steps, ones: onesCount, delta, head: head - TAPE_CENTER, state });

    if (delta < CRASH_THRESHOLD && !inCrash) {
      inCrash = true;
      crashStart = steps - FINE_INTERVAL;
      crashPeakOnes = prevFineOnes;
    }

    if (inCrash && delta >= 0) {
      // Crash ended
      crashes.push({
        start: crashStart,
        end: steps,
        peakOnes: crashPeakOnes,
        troughOnes: onesCount,
        loss: crashPeakOnes - onesCount,
        duration: steps - crashStart,
      });
      inCrash = false;
    }

    prevFineOnes = onesCount;
  }

  if (state === HALT) break;
  if (head < 2 || head > TAPE_SIZE - 3) { console.log('tape overflow'); break; }
}

console.log(`Total steps: ${steps.toLocaleString()}, Final ones: ${onesCount}\n`);

// Close any open crash
if (inCrash) {
  crashes.push({ start: crashStart, end: steps, peakOnes: crashPeakOnes, troughOnes: onesCount, loss: crashPeakOnes - onesCount, duration: steps - crashStart });
}

// ── Report crash events ──────────────────────────────────────────────

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║           BB(5) CRASH ANALYSIS                         ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

console.log(`Found ${crashes.length} crash events (threshold: ${CRASH_THRESHOLD} ones per ${FINE_INTERVAL} steps)\n`);

console.log('═══ All Crash Events ═══\n');
console.log('  #  | Start Step     | Duration      | Peak Ones | Trough | Loss   | Loss %');
console.log('  ───┼────────────────┼───────────────┼───────────┼────────┼────────┼───────');
for (let i = 0; i < crashes.length; i++) {
  const c = crashes[i];
  const lossPct = (c.loss / c.peakOnes * 100).toFixed(1);
  console.log(`  ${String(i + 1).padStart(2)} | ${String(c.start.toLocaleString()).padStart(14)} | ${String(c.duration.toLocaleString()).padStart(13)} | ${String(c.peakOnes).padStart(9)} | ${String(c.troughOnes).padStart(6)} | ${String(c.loss).padStart(6)} | ${lossPct}%`);
}

// ── Crash pattern analysis ───────────────────────────────────────────

console.log('\n═══ Crash Pattern Analysis ═══\n');

// Are crashes periodic?
if (crashes.length >= 2) {
  console.log('  Inter-crash intervals:');
  for (let i = 1; i < crashes.length; i++) {
    const interval = crashes[i].start - crashes[i - 1].start;
    const ratio = i >= 2 ? (crashes[i].start - crashes[i - 1].start) / (crashes[i - 1].start - crashes[i - 2].start) : 'N/A';
    console.log(`    Crash ${i} → ${i + 1}: ${interval.toLocaleString()} steps ${typeof ratio === 'number' ? `(ratio: ${ratio.toFixed(2)}x)` : ''}`);
  }

  console.log('\n  Loss progression:');
  for (let i = 0; i < crashes.length; i++) {
    const c = crashes[i];
    console.log(`    Crash ${i + 1}: lost ${c.loss} ones (${(c.loss / c.peakOnes * 100).toFixed(1)}% of peak)`);
  }

  // Are losses growing?
  if (crashes.length >= 2) {
    const lossRatios = [];
    for (let i = 1; i < crashes.length; i++) {
      lossRatios.push(crashes[i].loss / crashes[i - 1].loss);
    }
    if (lossRatios.length > 0) {
      const avgRatio = lossRatios.reduce((a, b) => a + b, 0) / lossRatios.length;
      console.log(`\n  Average loss growth ratio: ${avgRatio.toFixed(2)}x per crash`);
    }
  }
}

// ── Detailed zoom into each major crash ──────────────────────────────

console.log('\n═══ Detailed Timeline Around Each Major Crash ═══\n');

// Show fine-grained ones timeline around each crash
for (let ci = 0; ci < Math.min(crashes.length, 5); ci++) {
  const c = crashes[ci];
  console.log(`  --- Crash ${ci + 1}: step ${c.start.toLocaleString()} ---`);
  console.log(`  Peak: ${c.peakOnes} ones → Trough: ${c.troughOnes} ones (lost ${c.loss})\n`);

  // Find timeline entries around this crash
  const windowStart = c.start - 200000;
  const windowEnd = c.end + 200000;
  const relevantEntries = onesTimeline.filter(e => e.step >= windowStart && e.step <= windowEnd);

  // Sample ~30 entries from this window
  const sampleRate = Math.max(1, Math.floor(relevantEntries.length / 30));
  console.log('  Step          | Ones   | Δ/1K   | Head     | Phase');
  console.log('  ──────────────┼────────┼────────┼──────────┼──────');
  for (let i = 0; i < relevantEntries.length; i += sampleRate) {
    const e = relevantEntries[i];
    let phase = '';
    if (e.step < c.start) phase = 'building';
    else if (e.step < c.end) phase = e.delta < -50 ? 'CRASHING' : 'recovering';
    else phase = 'rebuilding';
    console.log(`  ${String(e.step.toLocaleString()).padStart(14)} | ${String(e.ones).padStart(6)} | ${String(e.delta >= 0 ? '+' + e.delta : e.delta).padStart(6)} | ${String(e.head).padStart(8)} | ${phase}`);
  }
  console.log();
}

// ── Transition analysis around crashes ───────────────────────────────
// Re-run a small window around the first major crash to see which
// transitions fire during the crash

console.log('═══ Transition Frequency: Normal vs Crash ═══\n');
console.log('(Re-running around first major crash for transition analysis...)\n');

// Reset and re-run
tape.fill(0);
head = TAPE_CENTER;
state = 0;
steps = 0;
onesCount = 0;

const firstCrash = crashes[0];
const analyzeStart = firstCrash.start - 50000;
const analyzeEnd = firstCrash.end + 50000;

// Transition counters
const normalTransitions = new Map();  // before crash
const crashTransitions = new Map();   // during crash
const recoveryTransitions = new Map(); // after crash

while (steps < analyzeEnd + 1) {
  const symbol = tape[head];
  const idx = (state * 2 + symbol) * 3;
  const write = bb5[idx], move = bb5[idx + 1], next = bb5[idx + 2];

  if (tape[head] === 0 && write === 1) onesCount++;
  if (tape[head] === 1 && write === 0) onesCount--;

  // Count transitions in different phases
  if (steps >= analyzeStart) {
    const transKey = `${STATE_NAMES[state]},${symbol}→${write}${bb5[idx + 1] === 1 ? 'R' : 'L'}${STATE_NAMES[next]}`;
    if (steps < firstCrash.start) {
      normalTransitions.set(transKey, (normalTransitions.get(transKey) || 0) + 1);
    } else if (steps < firstCrash.end) {
      crashTransitions.set(transKey, (crashTransitions.get(transKey) || 0) + 1);
    } else {
      recoveryTransitions.set(transKey, (recoveryTransitions.get(transKey) || 0) + 1);
    }
  }

  tape[head] = write;
  head += move === 1 ? 1 : -1;
  state = next;
  steps++;

  if (state === HALT) break;
  if (head < 2 || head > TAPE_SIZE - 3) break;
}

// Show transition frequencies
const allTrans = new Set([...normalTransitions.keys(), ...crashTransitions.keys(), ...recoveryTransitions.keys()]);

const normalTotal = Array.from(normalTransitions.values()).reduce((a, b) => a + b, 0);
const crashTotal = Array.from(crashTransitions.values()).reduce((a, b) => a + b, 0);
const recoveryTotal = Array.from(recoveryTransitions.values()).reduce((a, b) => a + b, 0);

console.log('  Transition      | Normal (pre-crash) | During Crash     | Recovery');
console.log('  ────────────────┼────────────────────┼──────────────────┼──────────────────');
for (const trans of Array.from(allTrans).sort()) {
  const n = normalTransitions.get(trans) || 0;
  const c = crashTransitions.get(trans) || 0;
  const r = recoveryTransitions.get(trans) || 0;
  const nPct = normalTotal ? (n / normalTotal * 100).toFixed(1) : '0';
  const cPct = crashTotal ? (c / crashTotal * 100).toFixed(1) : '0';
  const rPct = recoveryTotal ? (r / recoveryTotal * 100).toFixed(1) : '0';
  console.log(`  ${trans.padEnd(16)} | ${String(n).padStart(8)} (${nPct.padStart(5)}%) | ${String(c).padStart(8)} (${cPct.padStart(5)}%) | ${String(r).padStart(8)} (${rPct.padStart(5)}%)`);
}

// ── Key insight: which transitions are ERASING ones? ─────────────────

console.log('\n═══ Ones-Destroying Transitions ═══\n');
console.log('These transitions write 0 where there was a 1 (net -1 per firing):');
console.log();

// C,1 → 0LE  and  E,1 → 0LA  are the two transitions that write 0
// C,1 → 0LE: reads a 1, writes 0, goes left, enters E
// E,1 → 0LA: reads a 1, writes 0, goes left, enters A

const erasers = ['C,1→0LE', 'E,1→0LA'];
for (const trans of erasers) {
  const n = normalTransitions.get(trans) || 0;
  const c = crashTransitions.get(trans) || 0;
  const r = recoveryTransitions.get(trans) || 0;
  const nRate = normalTotal ? (n / normalTotal * 100).toFixed(2) : '0';
  const cRate = crashTotal ? (c / crashTotal * 100).toFixed(2) : '0';
  const rRate = recoveryTotal ? (r / recoveryTotal * 100).toFixed(2) : '0';
  console.log(`  ${trans}:`);
  console.log(`    Normal:   ${n.toLocaleString().padStart(8)} firings (${nRate}% of all transitions)`);
  console.log(`    Crash:    ${c.toLocaleString().padStart(8)} firings (${cRate}%)`);
  console.log(`    Recovery: ${r.toLocaleString().padStart(8)} firings (${rRate}%)`);
  console.log();
}

// ── What about the ones-CREATING transitions? ────────────────────────

console.log('═══ Ones-Creating Transitions ═══\n');
console.log('These transitions write 1 where there was a 0 (net +1 per firing):');
console.log();

// All transitions that write 1 when reading 0
const creators = ['A,0→1RB', 'B,0→1RC', 'C,0→1RD', 'D,0→1LA', 'E,0→1RH'];
for (const trans of creators) {
  if (trans === 'E,0→1RH') continue; // this is the halt transition, very rare
  const n = normalTransitions.get(trans) || 0;
  const c = crashTransitions.get(trans) || 0;
  const r = recoveryTransitions.get(trans) || 0;
  const nRate = normalTotal ? (n / normalTotal * 100).toFixed(2) : '0';
  const cRate = crashTotal ? (c / crashTotal * 100).toFixed(2) : '0';
  const rRate = recoveryTotal ? (r / recoveryTotal * 100).toFixed(2) : '0';
  console.log(`  ${trans}:`);
  console.log(`    Normal:   ${n.toLocaleString().padStart(8)} firings (${nRate}%)`);
  console.log(`    Crash:    ${c.toLocaleString().padStart(8)} firings (${cRate}%)`);
  console.log(`    Recovery: ${r.toLocaleString().padStart(8)} firings (${rRate}%)`);
  console.log();
}

// ── Net creation rate ────────────────────────────────────────────────

console.log('═══ Net Ones Balance ═══\n');

function netBalance(transMap, total) {
  let created = 0, destroyed = 0;
  for (const trans of creators) {
    created += transMap.get(trans) || 0;
  }
  for (const trans of erasers) {
    destroyed += transMap.get(trans) || 0;
  }
  return { created, destroyed, net: created - destroyed };
}

const normalBalance = netBalance(normalTransitions, normalTotal);
const crashBalance = netBalance(crashTransitions, crashTotal);
const recoveryBalance = netBalance(recoveryTransitions, recoveryTotal);

console.log(`  Normal:    +${normalBalance.created.toLocaleString()} created, -${normalBalance.destroyed.toLocaleString()} destroyed = net ${normalBalance.net >= 0 ? '+' : ''}${normalBalance.net.toLocaleString()}`);
console.log(`  Crash:     +${crashBalance.created.toLocaleString()} created, -${crashBalance.destroyed.toLocaleString()} destroyed = net ${crashBalance.net >= 0 ? '+' : ''}${crashBalance.net.toLocaleString()}`);
console.log(`  Recovery:  +${recoveryBalance.created.toLocaleString()} created, -${recoveryBalance.destroyed.toLocaleString()} destroyed = net ${recoveryBalance.net >= 0 ? '+' : ''}${recoveryBalance.net.toLocaleString()}`);
