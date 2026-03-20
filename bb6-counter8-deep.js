/**
 * BB(6) Counter #8 Deep Dive
 *
 * Machine: 1RB0LA_1RC---_1RD1LC_1LC1RE_1LA1RF_0RB0RD
 * From our 500M run: ratio=2.63, 337 crashes, max 242 ones, loss=0.48
 *
 * This was the only holdout that maintained BB(5)-like geometric
 * crash spacing. Let's understand exactly what it's doing.
 *
 * Table:
 *   A: 0→1RB  1→0LA
 *   B: 0→1RC  1→---  (HALT on B,1!)
 *   C: 0→1RD  1→1LC
 *   D: 0→1LC  1→1RE
 *   E: 0→1LA  1→1RF
 *   F: 0→0RB  1→0RD
 */

const NUM_STATES = 6;
const HALT = NUM_STATES;
const STATE_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'H'];
const STATE_MAP = {};
STATE_NAMES.forEach((n, i) => STATE_MAP[n] = i);

function parseHoldout(line) {
  const parts = line.trim().split('_');
  const table = new Uint8Array(NUM_STATES * 2 * 3);
  for (let state = 0; state < 6; state++) {
    const pair = parts[state];
    for (let symbol = 0; symbol < 2; symbol++) {
      const trans = pair.substring(symbol * 3, symbol * 3 + 3);
      const idx = (state * 2 + symbol) * 3;
      if (trans === '---') {
        table[idx] = 1; table[idx + 1] = 1; table[idx + 2] = HALT;
        continue;
      }
      table[idx] = parseInt(trans[0]);
      table[idx + 1] = trans[1] === 'R' ? 1 : 0;
      table[idx + 2] = STATE_MAP[trans[2]];
    }
  }
  return table;
}

const machine = parseHoldout('1RB0LA_1RC---_1RD1LC_1LC1RE_1LA1RF_0RB0RD');

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║   BB(6) COUNTER #8 — Deep Dive                        ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

console.log('Table:');
console.log('  A: 0→1RB  1→0LA    (gap-maker on read-1!)');
console.log('  B: 0→1RC  1→HALT');
console.log('  C: 0→1RD  1→1LC    (left sweeper on 1s)');
console.log('  D: 0→1LC  1→1RE');
console.log('  E: 0→1LA  1→1RF');
console.log('  F: 0→0RB  1→0RD    (double gap-maker!)\n');

console.log('Motifs:');
console.log('  Sweeper:  C,1→1LC (left sweep through 1s)');
console.log('  Gap-makers: A,1→0LA, F,0→0RB, F,1→0RD (three!)');
console.log('  Halt: B,1 (reluctant — must encounter a 1 in state B)\n');

// ── Detailed trace: first 500 steps ──────────────────────────────────

const TAPE_SIZE = 4096;
const CENTER = Math.floor(TAPE_SIZE / 2);
let tape = new Uint8Array(TAPE_SIZE);
let head = CENTER, state = 0, steps = 0, onesCount = 0;

console.log('═══ First 200 Steps (detailed trace) ═══\n');

for (let i = 0; i < 200; i++) {
  const symbol = tape[head];
  const idx = (state * 2 + symbol) * 3;
  const write = machine[idx], move = machine[idx + 1], next = machine[idx + 2];

  // Show tape
  let tapeStr = '';
  for (let j = head - 15; j <= head + 15; j++) {
    if (j === head) tapeStr += `[${tape[j]}]`;
    else tapeStr += tape[j];
  }

  const action = (symbol === 0 && write === 1) ? '+' : (symbol === 1 && write === 0) ? '-' : '=';
  console.log(`  ${String(steps).padStart(4)}: ${STATE_NAMES[state]},${symbol}→${write}${machine[idx+1]===1?'R':'L'}${STATE_NAMES[next]} ${action} | ${tapeStr} | ones=${onesCount}`);

  if (tape[head] === 0 && write === 1) onesCount++;
  if (tape[head] === 1 && write === 0) onesCount--;
  tape[head] = write;
  head += move === 1 ? 1 : -1;
  state = next;
  steps++;

  if (state === HALT) { console.log(`  *** HALTED at step ${steps}! ***`); break; }
}

// ── Long run with crash tracking ─────────────────────────────────────

console.log('\n═══ Long Run Analysis (1B steps) ═══\n');

tape = new Uint8Array(65536);
head = Math.floor(65536 / 2);
state = 0; steps = 0; onesCount = 0;
let maxOnes = 0;

const crashes = [];
const CHECK_INTERVAL = 500;
let prevCheckOnes = 0, crashPeakOnes = 0;
const stateCounts = new Float64Array(NUM_STATES);
const transCounts = new Map();

const MAX_STEPS = 1_000_000_000;

while (steps < MAX_STEPS) {
  const symbol = tape[head];
  const idx = (state * 2 + symbol) * 3;
  const write = machine[idx], move = machine[idx + 1], next = machine[idx + 2];

  stateCounts[state]++;
  const tKey = `${STATE_NAMES[state]},${symbol}→${write}${move===1?'R':'L'}${STATE_NAMES[next]}`;
  transCounts.set(tKey, (transCounts.get(tKey) || 0) + 1);

  if (tape[head] === 0 && write === 1) onesCount++;
  if (tape[head] === 1 && write === 0) onesCount--;
  tape[head] = write;
  head += move === 1 ? 1 : -1;
  state = next;
  steps++;

  if (onesCount > maxOnes) maxOnes = onesCount;

  if (steps % CHECK_INTERVAL === 0) {
    if (onesCount - prevCheckOnes < -20) {
      crashes.push({ step: steps, ones: onesCount, peak: crashPeakOnes });
    }
    if (onesCount > crashPeakOnes) crashPeakOnes = onesCount;
    prevCheckOnes = onesCount;
  }

  if (steps % 200_000_000 === 0) {
    process.stdout.write(`  ${(steps/1e6).toFixed(0)}M steps, ones=${onesCount}, max=${maxOnes}, crashes=${crashes.length}\r`);
  }

  if (state === HALT) {
    console.log(`\n  *** HALTED at step ${steps.toLocaleString()} with ${onesCount} ones! ***`);
    break;
  }
  if (head < 2 || head > 65534) {
    console.log(`\n  Tape overflow at step ${steps.toLocaleString()}`);
    break;
  }
}

if (state !== HALT && head >= 2 && head <= 65534) {
  console.log(`\n  Step limit at ${steps.toLocaleString()}`);
}

console.log(`\n  Final: ${onesCount} ones, max ${maxOnes}`);
console.log(`  Crashes: ${crashes.length}`);

// State distribution
const total = steps;
const dist = Array.from(stateCounts)
  .map((c, i) => `${STATE_NAMES[i]}=${(c/total*100).toFixed(1)}%`)
  .join(' ');
console.log(`  States: ${dist}`);

// Transitions
console.log('\n  Transition frequencies:');
const sorted = Array.from(transCounts.entries()).sort((a,b) => b[1]-a[1]);
for (const [t, c] of sorted) {
  console.log(`    ${t.padEnd(15)} ${(c/total*100).toFixed(2)}%`);
}

// Crash details — all of them
if (crashes.length > 0 && crashes.length <= 100) {
  console.log('\n  All crash events:');
  console.log('  #   | Step          | Peak   | Ones   | Loss   | Loss %');
  console.log('  ────┼───────────────┼────────┼────────┼────────┼───────');
  for (let i = 0; i < crashes.length; i++) {
    const c = crashes[i];
    const loss = c.peak - c.ones;
    const lossPct = c.peak > 0 ? (loss/c.peak*100).toFixed(1) : '?';
    console.log(`  ${String(i+1).padStart(3)} | ${String(c.step.toLocaleString()).padStart(13)} | ${String(c.peak).padStart(6)} | ${String(c.ones).padStart(6)} | ${String(loss).padStart(6)} | ${lossPct}%`);
  }

  // Interval analysis
  if (crashes.length >= 3) {
    const intervals = [];
    for (let i = 1; i < crashes.length; i++) {
      intervals.push(crashes[i].step - crashes[i-1].step);
    }
    const ratios = [];
    for (let i = 1; i < intervals.length; i++) {
      if (intervals[i-1] > 0) ratios.push(intervals[i] / intervals[i-1]);
    }

    console.log('\n  Interval ratios:');
    for (let i = 0; i < ratios.length; i++) {
      console.log(`    ${i+2}/${i+1}: ${intervals[i+1].toLocaleString()} / ${intervals[i].toLocaleString()} = ${ratios[i].toFixed(4)}`);
    }

    if (ratios.length >= 3) {
      const late = ratios.slice(-Math.min(5, ratios.length));
      const avg = late.reduce((a,b) => a+b, 0) / late.length;
      console.log(`\n  Late average ratio: ${avg.toFixed(6)}`);
      console.log(`  BB(5) ratio (25/9): ${(25/9).toFixed(6)}`);
      console.log(`  Difference:         ${(avg - 25/9).toFixed(6)}`);
      console.log(`  6/3 = 2.0:          ${(avg - 2.0).toFixed(6)}`);
    }

    // Peak growth
    const peakGrowths = [];
    for (let i = 1; i < crashes.length; i++) {
      if (crashes[i-1].peak > 0) peakGrowths.push(crashes[i].peak / crashes[i-1].peak);
    }
    if (peakGrowths.length >= 2) {
      console.log('\n  Peak growth ratios:');
      for (let i = 0; i < peakGrowths.length; i++) {
        console.log(`    Peak ${i+2}/${i+1}: ${peakGrowths[i].toFixed(4)}`);
      }
      const latePG = peakGrowths.slice(-Math.min(5, peakGrowths.length));
      console.log(`  Late average: ${(latePG.reduce((a,b)=>a+b,0)/latePG.length).toFixed(6)}`);
    }

    // Loss fraction
    const lossFs = crashes.filter(c => c.peak > 0).map(c => (c.peak - c.ones) / c.peak);
    if (lossFs.length >= 2) {
      const lateL = lossFs.slice(-Math.min(5, lossFs.length));
      console.log(`\n  Late loss fraction: ${(lateL.reduce((a,b)=>a+b,0)/lateL.length).toFixed(6)}`);
    }
  }
} else if (crashes.length > 100) {
  console.log(`\n  ${crashes.length} crashes (showing first 20 and last 20):`);
  // abbreviated output
  const toShow = [...crashes.slice(0,20), null, ...crashes.slice(-20)];
  for (const c of toShow) {
    if (!c) { console.log('  ...'); continue; }
    const loss = c.peak - c.ones;
    console.log(`    step=${c.step.toLocaleString()} peak=${c.peak} ones=${c.ones} loss=${loss}`);
  }
}

// Tape snapshot
console.log('\n  Tape structure:');
let minH = 32768, maxH = 32768;
for (let i = 0; i < 65536; i++) { if (tape[i]) { if (i < minH) minH = i; if (i > maxH) maxH = i; }}
const tapeSpan = maxH - minH + 1;
console.log(`    Span: ${tapeSpan} cells`);

// Show tape around edges
let leftTape = '';
for (let i = Math.max(0, minH-2); i <= Math.min(minH+40, maxH); i++) leftTape += tape[i];
console.log(`    Left edge: ${leftTape}...`);

let rightTape = '';
for (let i = Math.max(minH, maxH-40); i <= Math.min(65535, maxH+2); i++) rightTape += tape[i];
console.log(`    Right edge: ...${rightTape}`);

// Unique trigrams
const trigrams = new Set();
for (let i = minH; i < maxH-2; i++) trigrams.add(`${tape[i]}${tape[i+1]}${tape[i+2]}`);
console.log(`    Unique 3-grams: ${trigrams.size}`);

// Check periodicity
for (let period = 2; period <= 10; period++) {
  let isPeriodic = true;
  for (let i = minH + period; i <= maxH; i++) {
    if (tape[i] !== tape[minH + ((i - minH) % period)]) { isPeriodic = false; break; }
  }
  if (isPeriodic) { console.log(`    PERIODIC with period ${period}`); break; }
}
