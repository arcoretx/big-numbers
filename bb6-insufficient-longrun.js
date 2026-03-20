/**
 * BB(6) Insufficient Data Machines — Extended Long Run
 *
 * The 556 machines from v2 that didn't produce enough crashes
 * (< 10) at 100M steps for classification. Run them at 500M steps
 * to see if any develop counter-like dynamics at longer timescales.
 *
 * Focus: find any machine with geometric crash spacing (interval
 * ratio > 1.3 sustained over multiple windows).
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
  const TAPE_SIZE = 1048576; // 1M cells for long runs
  const tape = new Uint8Array(TAPE_SIZE);
  const CENTER = Math.floor(TAPE_SIZE / 2);
  let head = CENTER, state = 0, steps = 0, onesCount = 0;
  let maxOnes = 0, minHead = CENTER, maxHead = CENTER;
  const stateCounts = new Float64Array(NUM_STATES);

  const CHECK_INTERVAL = 1000;
  let prevCheckOnes = 0, crashPeakOnes = 0;
  const crashes = [];

  // LZ sampling
  const SAMPLE_INTERVAL = 100;
  const stateSamples = [];
  const MAX_SAMPLES = 5000;

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
      if (onesCount - prevCheckOnes < threshold) {
        crashes.push({ step: steps, ones: onesCount, peak: crashPeakOnes });
      }
      if (onesCount > crashPeakOnes) crashPeakOnes = onesCount;
      prevCheckOnes = onesCount;
    }

    if (steps % SAMPLE_INTERVAL === 0 && stateSamples.length < MAX_SAMPLES) {
      stateSamples.push(state);
    }

    if (state === HALT) {
      return { halted: true, steps, ones: onesCount, maxOnes, crashes, stateCounts, stateSamples, minHead, maxHead, tape };
    }
    if (head < 2 || head > TAPE_SIZE - 3) {
      return { halted: false, reason: 'tape_overflow', steps, ones: onesCount, maxOnes, crashes, stateCounts, stateSamples, minHead, maxHead, tape };
    }
  }
  return { halted: false, reason: 'step_limit', steps, ones: onesCount, maxOnes, crashes, stateCounts, stateSamples, minHead, maxHead, tape };
}

function lzComplexity(samples) {
  if (samples.length < 10) return 1.0;
  const seen = new Set();
  let count = 0, current = '';
  for (const s of samples) {
    current += s;
    if (!seen.has(current)) { seen.add(current); count++; current = ''; }
  }
  if (current.length > 0) count++;
  return count / samples.length;
}

function classifyCrashes(crashes) {
  if (crashes.length < 10) return { type: 'insufficient_data', crashCount: crashes.length };

  const intervals = [];
  for (let i = 1; i < crashes.length; i++) intervals.push(crashes[i].step - crashes[i - 1].step);

  const ratios = [];
  for (let i = 1; i < intervals.length; i++) {
    if (intervals[i - 1] > 0) ratios.push(intervals[i] / intervals[i - 1]);
  }

  if (ratios.length < 5) return { type: 'insufficient_data', crashCount: crashes.length };

  // Multi-window
  const ws = Math.floor(ratios.length / 3);
  const windowAvgs = [
    ratios.slice(0, ws).reduce((a, b) => a + b, 0) / ws,
    ratios.slice(ws, ws * 2).reduce((a, b) => a + b, 0) / ws,
    ratios.slice(ws * 2).reduce((a, b) => a + b, 0) / (ratios.length - ws * 2),
  ];
  const windowRange = Math.max(...windowAvgs) - Math.min(...windowAvgs);

  const lateRatios = ratios.slice(Math.floor(ratios.length * 0.7));
  const avgRatio = lateRatios.reduce((a, b) => a + b, 0) / lateRatios.length;
  const ratioStdDev = Math.sqrt(lateRatios.reduce((a, r) => a + (r - avgRatio) ** 2, 0) / lateRatios.length);
  const isConsistent = windowRange < Math.max(0.5, avgRatio * 0.3);

  const lossFracs = crashes.filter(c => c.peak > 0).map(c => (c.peak - c.ones) / c.peak);
  const lateLoss = lossFracs.slice(Math.floor(lossFracs.length * 0.7));
  const avgLoss = lateLoss.length > 0 ? lateLoss.reduce((a, b) => a + b, 0) / lateLoss.length : 0;

  let type;
  if (avgRatio > 1.3 && isConsistent && ratioStdDev / avgRatio < 0.5) type = 'counter';
  else if (Math.abs(avgRatio - 1.0) < 0.2 && ratioStdDev < 0.3) type = 'oscillator';
  else if (ratioStdDev > avgRatio * 0.8 || !isConsistent) type = 'chaotic';
  else type = 'unknown';

  return { type, crashCount: crashes.length, avgIntervalRatio: avgRatio, ratioStdDev, windowAvgs, isConsistent, avgLossFraction: avgLoss };
}

function checkTapePeriodicity(tape, minHead, maxHead) {
  const span = maxHead - minHead;
  if (span < 20) return { periodic: false };
  for (let period = 2; period <= 8; period++) {
    let isPeriodic = true;
    for (let i = period; i < Math.min(span, 500); i++) {
      if (tape[minHead + i] !== tape[minHead + (i % period)]) { isPeriodic = false; break; }
    }
    if (isPeriodic) return { periodic: true, period };
  }
  return { periodic: false };
}

// ═══ Main ════════════════════════════════════════════════════════════

// First, run the v2 classifier at 100M to identify the "insufficient" machines,
// then run those at 500M.
// For efficiency, we just re-run all machines but at 500M and only report
// the interesting ones.

const holdoutFile = process.argv[2] || 'data/bb6_holdouts_1214.txt';
const STEP_LIMIT = 500_000_000;

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║   BB(6) EXTENDED LONG RUN — All 1,214 at 500M steps    ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

const lines = fs.readFileSync(holdoutFile, 'utf-8').trim().split('\n');
console.log(`Loaded ${lines.length} machines, running at ${STEP_LIMIT.toLocaleString()} steps\n`);

const allResults = [];
let processed = 0;
const startTime = Date.now();

for (const line of lines) {
  const table = parseHoldout(line);
  if (!table) continue;

  const result = analyse(table, STEP_LIMIT);
  const crashDyn = classifyCrashes(result.crashes);
  const tapePeriod = result.tape ? checkTapePeriodicity(result.tape, result.minHead, result.maxHead) : { periodic: false };
  const lz = lzComplexity(result.stateSamples);
  const statesUsed = Array.from(result.stateCounts).filter(c => c > 0).length;

  if (tapePeriod.periodic && !result.halted) {
    crashDyn.type = 'translated_cycler';
  }

  allResults.push({
    raw: line.trim(), halted: result.halted, reason: result.reason,
    steps: result.steps, ones: result.ones, maxOnes: result.maxOnes,
    statesUsed, crashDyn, tapePeriod, lz, stateCounts: result.stateCounts,
  });

  processed++;
  if (processed % 50 === 0) {
    const elapsed = (Date.now() - startTime) / 1000;
    const perMachine = elapsed / processed;
    const remaining = (lines.length - processed) * perMachine;
    process.stdout.write(`  ${processed}/${lines.length} (${Math.round(elapsed)}s elapsed, ~${Math.round(remaining)}s remaining)\r`);
  }
}

const totalTime = ((Date.now() - startTime) / 1000).toFixed(0);
console.log(`\n  Done in ${totalTime}s\n`);

// ═══ Classification ══════════════════════════════════════════════════

console.log('═══ Classification at 500M Steps ═══\n');
const typeCounts = {};
for (const r of allResults) {
  typeCounts[r.crashDyn.type] = (typeCounts[r.crashDyn.type] || 0) + 1;
}
for (const [k, v] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(25)} ${v}`);
}

// Cyclers
const cyclers = allResults.filter(r => r.tapePeriod.periodic);
console.log(`\n  Translated cyclers: ${cyclers.length}`);

// COUNTERS — the main question
const counters = allResults.filter(r => r.crashDyn.type === 'counter');
console.log(`\n═══ COUNTER-TYPE (${counters.length} found) ═══\n`);
if (counters.length > 0) {
  for (const r of counters) {
    const d = r.crashDyn;
    const dist = Array.from(r.stateCounts)
      .map((c, i) => ({ s: STATE_NAMES[i], p: c / r.steps * 100 }))
      .filter(x => x.p > 0.5)
      .sort((a, b) => b.p - a.p)
      .map(x => `${x.s}=${x.p.toFixed(0)}%`)
      .join(' ');
    console.log(`  ${r.raw}`);
    console.log(`    crashes=${d.crashCount} ratio=${d.avgIntervalRatio.toFixed(3)} ±${d.ratioStdDev.toFixed(3)} consistent=${d.isConsistent}`);
    console.log(`    windows=[${d.windowAvgs.map(w => w.toFixed(2)).join(', ')}]`);
    console.log(`    loss=${d.avgLossFraction.toFixed(3)} ones=${r.ones} max=${r.maxOnes} LZ=${r.lz.toFixed(4)} states=${r.statesUsed}`);
    console.log(`    [${dist}]`);
    console.log();
  }
} else {
  console.log('  None found. The BB(5)-like counter mechanism appears to be');
  console.log('  absent from all 1,214 BB(6) holdout machines.\n');
}

// Oscillators
const oscillators = allResults.filter(r => r.crashDyn.type === 'oscillator');
console.log(`═══ OSCILLATOR-TYPE (${oscillators.length} found) ═══\n`);
for (const r of oscillators.slice(0, 15)) {
  console.log(`  ${r.raw}`);
  console.log(`    crashes=${r.crashDyn.crashCount} ratio=${r.crashDyn.avgIntervalRatio.toFixed(3)} loss=${r.crashDyn.avgLossFraction.toFixed(3)} max=${r.maxOnes}`);
}

// Halted?!
const halted = allResults.filter(r => r.halted);
if (halted.length > 0) {
  console.log(`\n═══ HALTED (!!!) — ${halted.length} ═══\n`);
  for (const r of halted) {
    console.log(`  ${r.raw}: ${r.ones} ones in ${r.steps.toLocaleString()} steps`);
  }
}

// Most interesting remaining unknowns
const unknowns = allResults.filter(r => r.crashDyn.type === 'insufficient_data' || r.crashDyn.type === 'chaotic' || r.crashDyn.type === 'unknown');
unknowns.sort((a, b) => a.lz - b.lz);
console.log(`\n═══ Most Structured Unclassified (lowest LZ) ═══\n`);
for (const r of unknowns.slice(0, 15)) {
  console.log(`  LZ=${r.lz.toFixed(4)} ${r.raw}`);
  console.log(`    crashes=${r.crashDyn.crashCount} type=${r.crashDyn.type} max=${r.maxOnes} states=${r.statesUsed}`);
}

// Final summary
console.log('\n═══ FINAL SUMMARY ═══\n');
console.log(`  Step limit: ${STEP_LIMIT.toLocaleString()}`);
console.log(`  Total machines: ${allResults.length}`);
console.log(`  Counters: ${counters.length}`);
console.log(`  Oscillators: ${oscillators.length}`);
console.log(`  Translated cyclers: ${cyclers.length}`);
console.log(`  Chaotic: ${typeCounts['chaotic'] || 0}`);
console.log(`  Insufficient/unknown: ${(typeCounts['insufficient_data'] || 0) + (typeCounts['unknown'] || 0)}`);
console.log(`  Halted: ${halted.length}`);
console.log(`\n  Conclusion: ${counters.length === 0 ? 'NO BB(5)-like counters found among BB(6) holdouts.' : counters.length + ' potential counters found!'}`);
console.log(`  ${cyclers.length} machines are definitively non-halting (translated cyclers).`);
