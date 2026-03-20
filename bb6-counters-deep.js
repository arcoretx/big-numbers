/**
 * BB(6) Counter-Type Holdouts — Deep Analysis
 *
 * The 9 machines from our holdout analysis that show geometric crash
 * spacing (counter-like dynamics). These are the most interesting
 * BB(6) candidates.
 *
 * Run each for 500M steps with detailed crash tracking to:
 *   1. Confirm the geometric ratio holds over longer runs
 *   2. Measure the converged ratio and compare to n/3 = 2
 *   3. Look for the 100100100... tape pattern signature
 *   4. Determine if any might halt
 */

const fs = require('fs');

const NUM_STATES = 6;
const HALT = NUM_STATES;
const STATE_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'H'];
const STATE_MAP = {};
STATE_NAMES.forEach((n, i) => STATE_MAP[n] = i);

function parseHoldout(line) {
  const parts = line.trim().split('_');
  if (parts.length !== 6) return null;
  const table = new Uint8Array(NUM_STATES * 2 * 3);
  for (let state = 0; state < 6; state++) {
    const pair = parts[state];
    for (let symbol = 0; symbol < 2; symbol++) {
      const offset = symbol * 3;
      const trans = pair.substring(offset, offset + 3);
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

function deepAnalyse(name, table, maxSteps) {
  const TAPE_SIZE = 1048576;
  const tape = new Uint8Array(TAPE_SIZE);
  const CENTER = Math.floor(TAPE_SIZE / 2);
  let head = CENTER, state = 0, steps = 0, onesCount = 0;
  let maxOnes = 0, minHead = CENTER, maxHead = CENTER;
  const stateCounts = new Float64Array(NUM_STATES);

  // Crash tracking
  const CHECK_INTERVAL = 1000;
  let prevCheckOnes = 0, crashPeakOnes = 0;
  const crashes = [];

  // Transition counting
  const transCounts = new Map();

  console.log(`\n═══ ${name} ═══\n`);

  // Print table
  for (let s = 0; s < NUM_STATES; s++) {
    let row = `  ${STATE_NAMES[s]}: `;
    for (let sym = 0; sym < 2; sym++) {
      const idx = (s * 2 + sym) * 3;
      const w = table[idx];
      const m = table[idx + 1] === 1 ? 'R' : 'L';
      const n = STATE_NAMES[table[idx + 2]];
      row += `${sym}→${w}${m}${n}  `;
    }
    console.log(row);
  }
  console.log();

  while (steps < maxSteps) {
    const symbol = tape[head];
    const idx = (state * 2 + symbol) * 3;
    const write = table[idx], move = table[idx + 1], next = table[idx + 2];
    stateCounts[state]++;

    // Transition counting
    const tKey = `${STATE_NAMES[state]},${symbol}→${write}${move === 1 ? 'R' : 'L'}${STATE_NAMES[next]}`;
    transCounts.set(tKey, (transCounts.get(tKey) || 0) + 1);

    if (tape[head] === 0 && write === 1) onesCount++;
    if (tape[head] === 1 && write === 0) onesCount--;
    tape[head] = write;
    head += move === 1 ? 1 : -1;
    state = next;
    steps++;

    if (onesCount > maxOnes) maxOnes = onesCount;
    if (head < minHead) minHead = head;
    if (head > maxHead) maxHead = head;

    if (steps % CHECK_INTERVAL === 0) {
      const delta = onesCount - prevCheckOnes;
      if (delta < -50) {
        crashes.push({ step: steps, ones: onesCount, peak: crashPeakOnes });
      }
      if (onesCount > crashPeakOnes) crashPeakOnes = onesCount;
      prevCheckOnes = onesCount;
    }

    if (steps % 100_000_000 === 0) {
      process.stdout.write(`  ${(steps / 1e6).toFixed(0)}M steps, ones=${onesCount}, max=${maxOnes}, crashes=${crashes.length}\r`);
    }

    if (state === HALT) {
      console.log(`  *** HALTED at step ${steps.toLocaleString()} with ${onesCount} ones! ***`);
      break;
    }
    if (head < 2 || head > TAPE_SIZE - 3) {
      console.log(`  Tape overflow at step ${steps.toLocaleString()}, ones=${onesCount}`);
      break;
    }
  }

  if (state !== HALT && head >= 2 && head <= TAPE_SIZE - 3) {
    console.log(`  Step limit at ${steps.toLocaleString()}`);
  }

  // Results
  const total = steps;
  console.log(`\n  Final: ${onesCount} ones, max ${maxOnes}, tape span ${maxHead - minHead + 1}`);
  console.log(`  Crashes: ${crashes.length}`);

  // State distribution
  const dist = Array.from(stateCounts)
    .map((c, i) => ({ s: STATE_NAMES[i], p: c / total * 100 }))
    .filter(x => x.p > 0.1)
    .sort((a, b) => b.p - a.p);
  console.log(`  States: ${dist.map(x => `${x.s}=${x.p.toFixed(1)}%`).join(' ')}`);

  // Top transitions
  const sortedTrans = Array.from(transCounts.entries()).sort((a, b) => b[1] - a[1]);
  console.log(`\n  Top transitions:`);
  for (const [t, c] of sortedTrans.slice(0, 8)) {
    console.log(`    ${t.padEnd(15)} ${(c / total * 100).toFixed(1)}%`);
  }

  // Crash analysis
  if (crashes.length >= 3) {
    console.log(`\n  Crash details:`);

    // Show all crashes if <= 30, otherwise first/last 10
    const toShow = crashes.length <= 30 ? crashes :
      [...crashes.slice(0, 10), null, ...crashes.slice(-10)];

    console.log('  Step          | Peak     | Ones     | Loss     | Loss %');
    console.log('  ──────────────┼──────────┼──────────┼──────────┼───────');
    for (const c of toShow) {
      if (c === null) { console.log(`  ... (${crashes.length - 20} more) ...`); continue; }
      const loss = c.peak - c.ones;
      const lossPct = c.peak > 0 ? (loss / c.peak * 100).toFixed(1) : '?';
      console.log(`  ${String(c.step.toLocaleString()).padStart(14)} | ${String(c.peak).padStart(8)} | ${String(c.ones).padStart(8)} | ${String(loss).padStart(8)} | ${lossPct}%`);
    }

    // Interval analysis
    const intervals = [];
    for (let i = 1; i < crashes.length; i++) {
      intervals.push(crashes[i].step - crashes[i - 1].step);
    }

    if (intervals.length >= 2) {
      const ratios = [];
      for (let i = 1; i < intervals.length; i++) {
        if (intervals[i - 1] > 0) ratios.push(intervals[i] / intervals[i - 1]);
      }

      console.log('\n  Interval ratios:');
      for (let i = 0; i < ratios.length; i++) {
        console.log(`    Interval ${i + 2}/${i + 1}: ${intervals[i + 1].toLocaleString()} / ${intervals[i].toLocaleString()} = ${ratios[i].toFixed(4)}`);
      }

      if (ratios.length >= 2) {
        const lateRatios = ratios.slice(-Math.min(3, ratios.length));
        const avgRatio = lateRatios.reduce((a, b) => a + b, 0) / lateRatios.length;
        console.log(`\n  Late average ratio: ${avgRatio.toFixed(6)}`);
        console.log(`  2.0 (= 6/3):        diff ${(avgRatio - 2.0).toFixed(6)}`);
        console.log(`  2.78 (= BB5 ratio):  diff ${(avgRatio - 2.78).toFixed(6)}`);
        console.log(`  5/3 (= 1.667):       diff ${(avgRatio - 5/3).toFixed(6)}`);
      }

      // Peak growth
      const peakGrowths = [];
      for (let i = 1; i < crashes.length; i++) {
        if (crashes[i - 1].peak > 0) peakGrowths.push(crashes[i].peak / crashes[i - 1].peak);
      }
      if (peakGrowths.length >= 2) {
        const latePG = peakGrowths.slice(-Math.min(3, peakGrowths.length));
        const avgPG = latePG.reduce((a, b) => a + b, 0) / latePG.length;
        console.log(`\n  Late peak growth: ${avgPG.toFixed(6)}`);
      }

      // Loss fraction trend
      const lossFs = crashes.filter(c => c.peak > 0).map(c => (c.peak - c.ones) / c.peak);
      if (lossFs.length >= 2) {
        const lateL = lossFs.slice(-Math.min(3, lossFs.length));
        const avgL = lateL.reduce((a, b) => a + b, 0) / lateL.length;
        console.log(`  Late loss fraction: ${avgL.toFixed(6)} (BB5 converges to 0.667)`);
      }
    }
  } else {
    console.log(`\n  Only ${crashes.length} crashes — need longer run for ratio analysis`);
  }

  // Tape structure snapshot
  console.log('\n  Tape structure around head:');
  let tapeStr = '';
  const snapStart = Math.max(minHead, head - 40);
  const snapEnd = Math.min(maxHead, head + 40);
  for (let i = snapStart; i <= snapEnd; i++) {
    if (i === head) tapeStr += `[${tape[i]}]`;
    else tapeStr += tape[i];
  }
  console.log(`    ${tapeStr}`);

  // Check for periodic patterns in tape
  const tapeRegion = [];
  for (let i = minHead; i <= Math.min(minHead + 200, maxHead); i++) {
    tapeRegion.push(tape[i]);
  }
  const tapeString = tapeRegion.join('');
  for (let period = 2; period <= 10; period++) {
    let isPeriodic = true;
    for (let i = period; i < tapeRegion.length; i++) {
      if (tapeRegion[i] !== tapeRegion[i % period]) { isPeriodic = false; break; }
    }
    if (isPeriodic) {
      console.log(`    Tape is periodic with period ${period}: "${tapeString.substring(0, period)}" repeated`);
      break;
    }
  }

  // Unique trigrams in tape
  const trigrams = new Set();
  for (let i = minHead; i < maxHead - 2; i++) {
    trigrams.add(`${tape[i]}${tape[i + 1]}${tape[i + 2]}`);
  }
  console.log(`    Unique 3-grams in tape: ${trigrams.size}`);
}

// ═══ The 9 counter-type machines ═════════════════════════════════════

const counterMachines = [
  '1RB---_0RC1RC_1RD0LE_1RE0RB_1LF0RA_1LC1LF',
  '1RB0RE_0RC0RA_1LD0RF_1LA0LD_1RA0LC_0RD---',
  '1RB1RE_0RC---_1RD0RD_1LE0LF_1RA0LD_1LC1RB',
  '1RB0LF_1RC0RA_0RD0RB_1LE0RF_1LB0LE_1LE---',
  '1RB1LC_0RC0RB_1LD0LA_1LE---_1LF0LA_1LA0LB',
  '1RB---_1LC0RA_1LD0LC_1RE0RF_0RB0RD_1RD0LB',
  '1RB1LC_1LC0RE_1LA0LD_1LA1LE_1LF0RA_0LB---',
  '1RB0LA_1RC---_1RD1LC_1LC1RE_1LA1RF_0RB0RD',
  '1RB1LE_0RC0LF_1LD0RE_0LA0RB_1LF0RD_0LB---',
];

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║   BB(6) COUNTER-TYPE HOLDOUTS — 500M Step Deep Run     ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log(`\nRunning ${counterMachines.length} counter-type machines for 500M steps each.\n`);

const STEP_LIMIT = 500_000_000;

for (let i = 0; i < counterMachines.length; i++) {
  const raw = counterMachines[i];
  const table = parseHoldout(raw);
  if (!table) { console.log(`Failed to parse: ${raw}`); continue; }
  deepAnalyse(`Counter #${i + 1}: ${raw}`, table, STEP_LIMIT);
}
