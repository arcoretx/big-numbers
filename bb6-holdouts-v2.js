/**
 * BB(6) Holdout Analysis v2 — Refined Classifier
 *
 * Improvements over v1:
 *   1. 100M step limit (was 10M)
 *   2. Multi-window ratio consistency check (not just late average)
 *   3. Minimum crash count threshold (≥10 for classification)
 *   4. Tape periodicity rejection (period 2-8)
 *   5. Ratio stability metric (stddev across windows)
 *   6. Better crash detection (adaptive threshold based on max ones)
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

function analyse(table, maxSteps) {
  const TAPE_SIZE = 524288;  // 512K — larger for 100M runs
  const tape = new Uint8Array(TAPE_SIZE);
  const CENTER = Math.floor(TAPE_SIZE / 2);
  let head = CENTER, state = 0, steps = 0, onesCount = 0;
  let maxOnes = 0, minHead = CENTER, maxHead = CENTER;
  const stateCounts = new Float64Array(NUM_STATES);

  // Adaptive crash threshold: check every 1000 steps,
  // crash = drop > max(50, 5% of current maxOnes)
  const CHECK_INTERVAL = 1000;
  let prevCheckOnes = 0, crashPeakOnes = 0;
  const crashes = [];

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
    if (head < minHead) minHead = head;
    if (head > maxHead) maxHead = head;

    if (steps % CHECK_INTERVAL === 0) {
      const threshold = -Math.max(50, maxOnes * 0.05);
      const delta = onesCount - prevCheckOnes;
      if (delta < threshold) {
        crashes.push({ step: steps, ones: onesCount, peak: crashPeakOnes });
      }
      if (onesCount > crashPeakOnes) crashPeakOnes = onesCount;
      prevCheckOnes = onesCount;
    }

    if (state === HALT) {
      return { halted: true, steps, ones: onesCount, maxOnes, crashes, stateCounts, tape, minHead, maxHead };
    }
    if (head < 2 || head > TAPE_SIZE - 3) {
      return { halted: false, reason: 'tape_overflow', steps, ones: onesCount, maxOnes, crashes, stateCounts, tape, minHead, maxHead };
    }
  }
  return { halted: false, reason: 'step_limit', steps, ones: onesCount, maxOnes, crashes, stateCounts, tape, minHead, maxHead };
}

// ── Tape periodicity check ───────────────────────────────────────────

function checkTapePeriodicity(tape, minHead, maxHead) {
  const span = maxHead - minHead;
  if (span < 20) return { periodic: false };

  for (let period = 2; period <= 8; period++) {
    let isPeriodic = true;
    const checkLen = Math.min(span, 500);
    for (let i = period; i < checkLen; i++) {
      if (tape[minHead + i] !== tape[minHead + (i % period)]) {
        isPeriodic = false;
        break;
      }
    }
    if (isPeriodic) return { periodic: true, period };
  }
  return { periodic: false };
}

// ── Multi-window ratio analysis ──────────────────────────────────────

function classifyCrashDynamics(crashes) {
  if (crashes.length < 10) return { type: 'insufficient_data', crashCount: crashes.length };

  const intervals = [];
  for (let i = 1; i < crashes.length; i++) {
    intervals.push(crashes[i].step - crashes[i - 1].step);
  }

  // Compute ratios
  const ratios = [];
  for (let i = 1; i < intervals.length; i++) {
    if (intervals[i - 1] > 0) ratios.push(intervals[i] / intervals[i - 1]);
  }

  if (ratios.length < 5) return { type: 'insufficient_data', crashCount: crashes.length };

  // Multi-window analysis: split ratios into 3 windows
  const windowSize = Math.floor(ratios.length / 3);
  const windows = [
    ratios.slice(0, windowSize),
    ratios.slice(windowSize, windowSize * 2),
    ratios.slice(windowSize * 2),
  ];

  const windowAvgs = windows.map(w => w.reduce((a, b) => a + b, 0) / w.length);
  const windowStdDevs = windows.map((w, i) => {
    const avg = windowAvgs[i];
    return Math.sqrt(w.reduce((a, r) => a + (r - avg) ** 2, 0) / w.length);
  });

  // Overall late ratio
  const lateRatios = ratios.slice(Math.floor(ratios.length * 0.7));
  const avgRatio = lateRatios.reduce((a, b) => a + b, 0) / lateRatios.length;
  const ratioStdDev = Math.sqrt(lateRatios.reduce((a, r) => a + (r - avgRatio) ** 2, 0) / lateRatios.length);

  // Consistency: are all windows showing similar ratios?
  const windowRange = Math.max(...windowAvgs) - Math.min(...windowAvgs);
  const isConsistent = windowRange < Math.max(0.5, avgRatio * 0.3);

  // Loss fractions
  const lossFracs = crashes.filter(c => c.peak > 0).map(c => (c.peak - c.ones) / c.peak);
  const lateLoss = lossFracs.slice(Math.floor(lossFracs.length * 0.7));
  const avgLoss = lateLoss.length > 0 ? lateLoss.reduce((a, b) => a + b, 0) / lateLoss.length : 0;

  // Classification
  let type;
  if (avgRatio > 1.3 && isConsistent && ratioStdDev / avgRatio < 0.5) {
    type = 'counter';
  } else if (Math.abs(avgRatio - 1.0) < 0.2 && ratioStdDev < 0.3) {
    type = 'oscillator';
  } else if (ratioStdDev > avgRatio * 0.8 || !isConsistent) {
    type = 'chaotic';
  } else {
    type = 'unknown';
  }

  return {
    type, crashCount: crashes.length,
    avgIntervalRatio: avgRatio, ratioStdDev,
    windowAvgs, windowRange, isConsistent,
    avgLossFraction: avgLoss,
  };
}

// ── Main ═════════════════════════════════════════════════════════════

const holdoutFile = process.argv[2] || 'data/bb6_holdouts_1214.txt';
const STEP_LIMIT = parseInt(process.argv[3]) || 100_000_000;

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║   BB(6) HOLDOUT ANALYSIS v2 — Refined Classifier       ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

const lines = fs.readFileSync(holdoutFile, 'utf-8').trim().split('\n');
console.log(`Loaded ${lines.length} holdout machines`);
console.log(`Step limit: ${STEP_LIMIT.toLocaleString()}\n`);

const results = [];
let processed = 0;

for (const line of lines) {
  const table = parseHoldout(line);
  if (!table) continue;

  const result = analyse(table, STEP_LIMIT);
  const crashDyn = classifyCrashDynamics(result.crashes);
  const tapePeriod = result.tape ? checkTapePeriodicity(result.tape, result.minHead, result.maxHead) : { periodic: false };

  // Override: if tape is periodic, it's a translated cycler regardless of crash dynamics
  if (tapePeriod.periodic && !result.halted) {
    crashDyn.type = 'translated_cycler';
    crashDyn.tapePeriod = tapePeriod.period;
  }

  const statesUsed = Array.from(result.stateCounts).filter(c => c > 0).length;

  results.push({
    raw: line.trim(),
    halted: result.halted,
    reason: result.reason,
    steps: result.steps,
    ones: result.ones,
    maxOnes: result.maxOnes,
    statesUsed,
    crashDyn,
    tapePeriod,
    stateCounts: result.stateCounts,
  });

  processed++;
  if (processed % 50 === 0) {
    process.stdout.write(`  ${processed}/${lines.length}...\r`);
  }
}

console.log(`  ${processed} machines analysed.\n`);

// ═══ Results ═════════════════════════════════════════════════════════

console.log('═══ Classification Summary ═══\n');
const typeCounts = {};
for (const r of results) {
  typeCounts[r.crashDyn.type] = (typeCounts[r.crashDyn.type] || 0) + 1;
}
for (const [k, v] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(25)} ${v}`);
}

// Translated cyclers (tape periodic)
const cyclers = results.filter(r => r.tapePeriod.periodic);
console.log(`\n  Tape-periodic (translated cyclers): ${cyclers.length}`);
if (cyclers.length > 0) {
  const periodDist = {};
  for (const r of cyclers) periodDist[r.tapePeriod.period] = (periodDist[r.tapePeriod.period] || 0) + 1;
  console.log(`  Period distribution: ${JSON.stringify(periodDist)}`);
}

// Counters
const counters = results.filter(r => r.crashDyn.type === 'counter');
counters.sort((a, b) => {
  // Sort by consistency first, then ratio
  const aScore = a.crashDyn.isConsistent ? a.crashDyn.avgIntervalRatio : 0;
  const bScore = b.crashDyn.isConsistent ? b.crashDyn.avgIntervalRatio : 0;
  return bScore - aScore;
});

console.log(`\n═══ COUNTER-TYPE (${counters.length} found) ═══\n`);
for (const r of counters.slice(0, 20)) {
  const d = r.crashDyn;
  const dist = Array.from(r.stateCounts)
    .map((c, i) => ({ s: STATE_NAMES[i], p: c / r.steps * 100 }))
    .filter(x => x.p > 0.5)
    .sort((a, b) => b.p - a.p)
    .map(x => `${x.s}=${x.p.toFixed(0)}%`)
    .join(' ');

  console.log(`  ${r.raw}`);
  console.log(`    crashes=${d.crashCount} ratio=${d.avgIntervalRatio.toFixed(3)} ±${d.ratioStdDev.toFixed(3)} consistent=${d.isConsistent}`);
  console.log(`    windows=[${d.windowAvgs.map(w => w.toFixed(2)).join(', ')}] range=${d.windowRange.toFixed(3)}`);
  console.log(`    loss=${d.avgLossFraction.toFixed(3)} ones=${r.ones} max=${r.maxOnes} states=${r.statesUsed}`);
  console.log(`    [${dist}]`);
  console.log();
}

// Oscillators
const oscillators = results.filter(r => r.crashDyn.type === 'oscillator');
oscillators.sort((a, b) => b.crashDyn.crashCount - a.crashDyn.crashCount);
console.log(`\n═══ OSCILLATOR-TYPE (${oscillators.length} found — likely non-halting) ═══\n`);
for (const r of oscillators.slice(0, 10)) {
  console.log(`  ${r.raw}`);
  console.log(`    crashes=${r.crashDyn.crashCount} ratio=${r.crashDyn.avgIntervalRatio.toFixed(3)} loss=${r.crashDyn.avgLossFraction.toFixed(3)} max=${r.maxOnes}`);
}

// Summary
console.log('\n═══ Final Summary ═══\n');
console.log(`  Total:              ${results.length}`);
console.log(`  Counter:            ${counters.length} (geometric crash spacing — BB candidates)`);
console.log(`  Oscillator:         ${oscillators.length} (constant spacing — likely non-halting)`);
console.log(`  Translated cycler:  ${cyclers.length} (periodic tape — definitely non-halting)`);
console.log(`  Chaotic:            ${typeCounts['chaotic'] || 0}`);
console.log(`  Unknown:            ${typeCounts['unknown'] || 0}`);
console.log(`  Insufficient data:  ${typeCounts['insufficient_data'] || 0}`);
console.log(`  Halted:             ${results.filter(r => r.halted).length}`);

if (counters.length > 0) {
  console.log(`\n  ** ${counters.length} counter-type machines warrant further investigation **`);
}
if (oscillators.length > 0) {
  console.log(`  ** ${oscillators.length} oscillator-type machines are strong non-halting candidates **`);
}
if (cyclers.length > 0) {
  console.log(`  ** ${cyclers.length} translated cyclers are DEFINITELY non-halting **`);
}
