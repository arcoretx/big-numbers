/**
 * BB(4) Crash / Ratio Analysis
 *
 * Testing the "n/3 hypothesis": does BB(4) show ratios related to 4/3?
 *
 * BB(4) only runs 107 steps, so we won't see the same macro-scale crash
 * dynamics as BB(5). But we can look for:
 *   - Ones oscillation patterns and their ratios
 *   - Local peak/trough ratios
 *   - Any growth constants in the ones trajectory
 */

const HALT = 4;
const STATE_NAMES = ['A', 'B', 'C', 'D', 'H'];

function createTable(transitions) {
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

const bb4 = createTable([
  ['A', 0, 1, 'R', 'B'], ['A', 1, 1, 'L', 'B'],
  ['B', 0, 1, 'L', 'A'], ['B', 1, 0, 'L', 'C'],
  ['C', 0, 1, 'R', 'H'], ['C', 1, 1, 'L', 'D'],
  ['D', 0, 1, 'R', 'D'], ['D', 1, 0, 'R', 'A'],
]);

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║       BB(4) — TESTING n/3 HYPOTHESIS                   ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

console.log('Prediction: if BB(5) is governed by 5/3, BB(4) might show 4/3\n');
console.log(`4/3 = ${(4/3).toFixed(8)}`);
console.log(`(4/3)² = ${(16/9).toFixed(8)}`);
console.log(`1 - 1/(4/3) = 1 - 3/4 = ${(1 - 3/4).toFixed(8)} (predicted loss fraction?)\n`);

// ── Run with full tracking ───────────────────────────────────────────

const tape = new Uint8Array(512);
let head = 256, state = 0, steps = 0, onesCount = 0;

const trajectory = []; // full step-by-step ones count

while (steps < 200) {
  const symbol = tape[head];
  const idx = (state * 2 + symbol) * 3;
  const write = bb4[idx], move = bb4[idx + 1], next = bb4[idx + 2];

  if (tape[head] === 0 && write === 1) onesCount++;
  if (tape[head] === 1 && write === 0) onesCount--;

  trajectory.push({
    step: steps,
    ones: onesCount,
    state: STATE_NAMES[state],
    symbol,
    write,
    move: bb4[idx + 1] === 1 ? 'R' : 'L',
    next: STATE_NAMES[next],
    head: head - 256,
    erasing: tape[head] === 1 && write === 0,
    creating: tape[head] === 0 && write === 1,
  });

  tape[head] = write;
  head += move === 1 ? 1 : -1;
  state = next;
  steps++;

  if (state === HALT) break;
}

trajectory.push({ step: steps, ones: onesCount, state: 'HALT' });

console.log(`Total steps: ${steps}, Final ones: ${onesCount}\n`);

// ── Find local peaks and troughs in the ones count ───────────────────

console.log('═══ Full Ones Trajectory ═══\n');
console.log('  Step | Ones | State | Action     | Head');
console.log('  ─────┼──────┼───────┼────────────┼─────');

const peaks = [];
const troughs = [];

for (let i = 0; i < trajectory.length; i++) {
  const t = trajectory[i];
  let marker = '';
  if (i > 0 && i < trajectory.length - 1) {
    const prev = trajectory[i - 1].ones;
    const next = trajectory[i + 1].ones;
    if (t.ones > prev && t.ones > next) { marker = ' ← PEAK'; peaks.push(t); }
    if (t.ones < prev && t.ones < next) { marker = ' ← TROUGH'; troughs.push(t); }
  }
  const action = t.erasing ? 'ERASE' : t.creating ? 'CREATE' : t.state === 'HALT' ? 'HALT' : 'neutral';
  console.log(`  ${String(t.step).padStart(4)} | ${String(t.ones).padStart(4)} | ${(t.state || '').padStart(5)} | ${action.padEnd(10)} | ${String(t.head || '').padStart(4)}${marker}`);
}

// ── Analyse peaks and troughs ────────────────────────────────────────

console.log('\n═══ Local Peaks ═══\n');
for (let i = 0; i < peaks.length; i++) {
  console.log(`  Peak ${i + 1}: step ${peaks[i].step}, ${peaks[i].ones} ones`);
}

console.log('\n═══ Local Troughs ═══\n');
for (let i = 0; i < troughs.length; i++) {
  console.log(`  Trough ${i + 1}: step ${troughs[i].step}, ${troughs[i].ones} ones`);
}

// ── Peak/trough ratios ───────────────────────────────────────────────

console.log('\n═══ Ratio Analysis ═══\n');

if (peaks.length >= 2) {
  console.log('  Successive peak ratios:');
  for (let i = 1; i < peaks.length; i++) {
    const r = peaks[i].ones / peaks[i - 1].ones;
    console.log(`    Peak ${i + 1} / Peak ${i}: ${peaks[i].ones} / ${peaks[i - 1].ones} = ${r.toFixed(6)}`);
  }
}

// Look for peak-to-trough ratios (survival fractions)
console.log('\n  Peak-to-following-trough ratios (survival):');
for (let i = 0; i < peaks.length; i++) {
  // Find next trough after this peak
  const nextTrough = troughs.find(t => t.step > peaks[i].step);
  if (nextTrough) {
    const survival = nextTrough.ones / peaks[i].ones;
    const loss = 1 - survival;
    console.log(`    Peak ${i + 1} (${peaks[i].ones}) → Trough (${nextTrough.ones}): survival = ${survival.toFixed(6)}, loss = ${loss.toFixed(6)}`);
  }
}

// Trough to next peak (recovery multiplier)
console.log('\n  Trough-to-next-peak ratios (recovery):');
for (let i = 0; i < troughs.length; i++) {
  const nextPeak = peaks.find(p => p.step > troughs[i].step);
  if (nextPeak) {
    const recovery = nextPeak.ones / troughs[i].ones;
    console.log(`    Trough ${i + 1} (${troughs[i].ones}) → Peak (${nextPeak.ones}): recovery = ${recovery.toFixed(6)}`);
  }
}

// ── Drop events (where ones decrease) ────────────────────────────────

console.log('\n═══ Ones-Decrease Events ═══\n');
let dropEvents = [];
for (let i = 1; i < trajectory.length; i++) {
  if (trajectory[i].ones < trajectory[i - 1].ones) {
    dropEvents.push({
      step: trajectory[i].step,
      from: trajectory[i - 1].ones,
      to: trajectory[i].ones,
      drop: trajectory[i - 1].ones - trajectory[i].ones,
      state: trajectory[i].state,
      transition: `${trajectory[i].state},${trajectory[i].symbol}→${trajectory[i].write}${trajectory[i].move}${trajectory[i].next}`,
    });
  }
}

console.log(`  Total drops: ${dropEvents.length} out of ${steps} steps\n`);
console.log('  Step | From | To | Drop | Transition');
console.log('  ─────┼──────┼────┼──────┼──────────────');
for (const d of dropEvents) {
  console.log(`  ${String(d.step).padStart(4)} | ${String(d.from).padStart(4)} | ${String(d.to).padStart(2)} | ${String(d.drop).padStart(4)} | ${d.transition}`);
}

// ── Erasure analysis ─────────────────────────────────────────────────

console.log('\n═══ Which Transitions Erase? ═══\n');
const eraserCounts = {};
const creatorCounts = {};
for (const t of trajectory) {
  if (t.erasing) {
    const key = `${t.state},${t.symbol}→${t.write}${t.move}${t.next}`;
    eraserCounts[key] = (eraserCounts[key] || 0) + 1;
  }
  if (t.creating) {
    const key = `${t.state},${t.symbol}→${t.write}${t.move}${t.next}`;
    creatorCounts[key] = (creatorCounts[key] || 0) + 1;
  }
}

console.log('  Erasing transitions (write 0 on a 1):');
for (const [trans, count] of Object.entries(eraserCounts)) {
  console.log(`    ${trans}: ${count} times`);
}
console.log('\n  Creating transitions (write 1 on a 0):');
for (const [trans, count] of Object.entries(creatorCounts)) {
  console.log(`    ${trans}: ${count} times`);
}

// ── Test specific 4/3 predictions ────────────────────────────────────

console.log('\n═══ Testing 4/3 Predictions ═══\n');
console.log('  Key ratios to check against 4/3 = 1.3333:');

// All interesting ratios from the data
const interestingRatios = [];
for (let i = 1; i < peaks.length; i++) {
  interestingRatios.push({ name: `peak${i+1}/peak${i}`, value: peaks[i].ones / peaks[i-1].ones });
}
for (let i = 0; i < peaks.length; i++) {
  const nextTrough = troughs.find(t => t.step > peaks[i].step);
  if (nextTrough) {
    interestingRatios.push({ name: `trough_after_p${i+1}/peak${i+1}`, value: nextTrough.ones / peaks[i].ones });
  }
}
for (let i = 0; i < troughs.length; i++) {
  const nextPeak = peaks.find(p => p.step > troughs[i].step);
  if (nextPeak) {
    interestingRatios.push({ name: `peak_after_t${i+1}/trough${i+1}`, value: nextPeak.ones / troughs[i].ones });
  }
}

// Add ratio of final ones to max peak
const maxPeak = Math.max(...peaks.map(p => p.ones));
interestingRatios.push({ name: 'final/maxPeak', value: onesCount / maxPeak });

const targets = [
  { name: '4/3', value: 4/3 },
  { name: '3/4', value: 3/4 },
  { name: '1/3', value: 1/3 },
  { name: '2/3', value: 2/3 },
  { name: '(4/3)²', value: 16/9 },
  { name: '5/3', value: 5/3 },
  { name: '1/4', value: 1/4 },
  { name: 'sqrt(4/3)', value: Math.sqrt(4/3) },
];

for (const ratio of interestingRatios) {
  let bestMatch = targets[0];
  let bestDiff = Infinity;
  for (const t of targets) {
    const diff = Math.abs(ratio.value - t.value);
    if (diff < bestDiff) { bestDiff = diff; bestMatch = t; }
  }
  console.log(`  ${ratio.name.padEnd(30)} = ${ratio.value.toFixed(6)}  (closest: ${bestMatch.name} = ${bestMatch.value.toFixed(6)}, diff = ${bestDiff.toFixed(6)})`);
}
