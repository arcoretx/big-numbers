/**
 * BB(6) Holdout Analysis
 *
 * Applies our research framework to the 1,214 undecided BB(6) machines
 * from the Busy Beaver Challenge.
 *
 * For each machine, we measure:
 *   1. Motif classification (sweepers, gap-makers, reluctant halter)
 *   2. Crash dynamics (crash count, interval ratios, loss fractions)
 *   3. Oscillator vs counter distinction (key novel contribution)
 *   4. State distribution and effective state count
 *   5. LZ complexity of state sequence
 *   6. Ones growth pattern (monotonic, sawtooth, chaotic)
 *
 * Classification goal: identify machines that are likely non-halting
 * oscillators (constant crash spacing) vs potential counters (geometric
 * crash spacing) vs translated cyclers (periodic tape).
 */

const fs = require('fs');

const NUM_STATES = 6;
const HALT = NUM_STATES;
const STATE_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'H'];
const STATE_MAP = {};
STATE_NAMES.forEach((n, i) => STATE_MAP[n] = i);

// ── Parse holdout format ─────────────────────────────────────────────
// Format: "1RB1RF_1RC---_1RD1LC_1LE1RF_1LC0LE_1RA0RA"
// Each group of 3 chars = write(0/1) + direction(L/R) + nextState(A-F)
// "---" = halt (undefined transition)

function parseHoldout(line) {
  const parts = line.trim().split('_');
  if (parts.length !== 6) return null;

  const table = new Uint8Array(NUM_STATES * 2 * 3);
  let haltCount = 0;

  for (let state = 0; state < 6; state++) {
    const pair = parts[state];
    // Each pair has two transitions: read-0 (first 3 chars) and read-1 (next 3 chars)
    for (let symbol = 0; symbol < 2; symbol++) {
      const offset = symbol * 3;
      const trans = pair.substring(offset, offset + 3);

      const idx = (state * 2 + symbol) * 3;

      if (trans === '---') {
        // Halt transition
        table[idx] = 1;      // write 1
        table[idx + 1] = 1;  // move R
        table[idx + 2] = HALT;
        haltCount++;
        continue;
      }

      table[idx] = parseInt(trans[0]);                        // write
      table[idx + 1] = trans[1] === 'R' ? 1 : 0;            // move
      table[idx + 2] = STATE_MAP[trans[2]];                   // next state
    }
  }

  return { table, haltCount, raw: line.trim() };
}

// ── Simulation with analysis ─────────────────────────────────────────

function analyse(table, maxSteps) {
  const TAPE_SIZE = 262144;  // 256K
  const tape = new Uint8Array(TAPE_SIZE);
  const CENTER = Math.floor(TAPE_SIZE / 2);
  let head = CENTER, state = 0, steps = 0, onesCount = 0;
  let maxOnes = 0, minHead = CENTER, maxHead = CENTER;

  const stateCounts = new Float64Array(NUM_STATES);

  // Crash tracking
  const CHECK_INTERVAL = 1000;
  let prevCheckOnes = 0;
  const crashes = [];
  let crashPeakOnes = 0;

  // State sequence sampling for LZ complexity
  const SAMPLE_INTERVAL = 100;
  const stateSamples = [];
  const MAX_SAMPLES = 10000;

  // Ones trajectory sampling
  const TRAJ_INTERVAL = Math.max(1, Math.floor(maxSteps / 500));
  const trajectory = [];

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

    // Crash detection
    if (steps % CHECK_INTERVAL === 0) {
      const delta = onesCount - prevCheckOnes;
      if (delta < -50) {
        crashes.push({ step: steps, ones: onesCount, peak: crashPeakOnes });
      }
      if (onesCount > crashPeakOnes) crashPeakOnes = onesCount;
      prevCheckOnes = onesCount;
    }

    // State sampling
    if (steps % SAMPLE_INTERVAL === 0 && stateSamples.length < MAX_SAMPLES) {
      stateSamples.push(state);
    }

    // Trajectory
    if (steps % TRAJ_INTERVAL === 0) {
      trajectory.push(onesCount);
    }

    if (state === HALT) {
      return {
        halted: true, steps, ones: onesCount, maxOnes, crashes,
        stateCounts, stateSamples, trajectory,
        tapeSpan: maxHead - minHead + 1,
      };
    }
    if (head < 2 || head > TAPE_SIZE - 3) {
      return {
        halted: false, reason: 'tape_overflow', steps, ones: onesCount, maxOnes,
        crashes, stateCounts, stateSamples, trajectory,
        tapeSpan: maxHead - minHead + 1,
      };
    }
  }

  return {
    halted: false, reason: 'step_limit', steps, ones: onesCount, maxOnes,
    crashes, stateCounts, stateSamples, trajectory,
    tapeSpan: maxHead - minHead + 1,
  };
}

// ── Motif detection ──────────────────────────────────────────────────

function detectMotifs(table) {
  const sweepers = [];
  const gapMakers = [];
  let haltState = -1, haltSymbol = -1;

  for (let s = 0; s < NUM_STATES; s++) {
    for (let sym = 0; sym < 2; sym++) {
      const idx = (s * 2 + sym) * 3;
      const write = table[idx], move = table[idx + 1], next = table[idx + 2];

      if (next === HALT) { haltState = s; haltSymbol = sym; }
      if (next === s && write === 1) sweepers.push({ state: s, symbol: sym, dir: move === 1 ? 'R' : 'L' });
      if (write === 0 && sym === 1) gapMakers.push(s);
    }
  }

  return {
    sweepers,
    gapMakers,
    haltState,
    haltSymbol,
    reluctantHalter: haltSymbol === 0,
    dualSweep: sweepers.length >= 2 && sweepers.some(s => s.dir === 'R') && sweepers.some(s => s.dir === 'L'),
    sweeperCount: sweepers.length,
    gapMakerCount: gapMakers.length,
  };
}

// ── Crash interval analysis (oscillator vs counter) ──────────────────

function classifyCrashDynamics(crashes) {
  if (crashes.length < 5) return { type: 'insufficient_data', crashCount: crashes.length };

  const intervals = [];
  for (let i = 1; i < crashes.length; i++) {
    intervals.push(crashes[i].step - crashes[i - 1].step);
  }

  // Compute interval ratios
  const ratios = [];
  for (let i = 1; i < intervals.length; i++) {
    if (intervals[i - 1] > 0) ratios.push(intervals[i] / intervals[i - 1]);
  }

  if (ratios.length < 3) return { type: 'insufficient_data', crashCount: crashes.length };

  // Use last 20% of ratios for classification
  const lateStart = Math.floor(ratios.length * 0.8);
  const lateRatios = ratios.slice(lateStart);
  const avgRatio = lateRatios.reduce((a, b) => a + b, 0) / lateRatios.length;
  const ratioStdDev = Math.sqrt(lateRatios.reduce((a, r) => a + (r - avgRatio) ** 2, 0) / lateRatios.length);

  // Loss fractions
  const lossFracs = crashes.filter(c => c.peak > 0).map(c => (c.peak - c.ones) / c.peak);
  const lateLoss = lossFracs.slice(Math.floor(lossFracs.length * 0.8));
  const avgLoss = lateLoss.length > 0 ? lateLoss.reduce((a, b) => a + b, 0) / lateLoss.length : 0;

  // Classification
  let type;
  if (avgRatio > 1.1 && ratioStdDev < 0.3) {
    type = 'counter';       // geometric spacing → counter-like (BB(5) behavior!)
  } else if (Math.abs(avgRatio - 1.0) < 0.15 && ratioStdDev < 0.3) {
    type = 'oscillator';    // constant spacing → oscillator
  } else if (ratioStdDev > 0.5) {
    type = 'chaotic';       // irregular spacing
  } else {
    type = 'unknown';
  }

  return {
    type,
    crashCount: crashes.length,
    avgIntervalRatio: avgRatio,
    ratioStdDev,
    avgLossFraction: avgLoss,
  };
}

// ── LZ complexity ────────────────────────────────────────────────────

function lzComplexity(samples) {
  if (samples.length < 10) return 1.0;
  const seen = new Set();
  let count = 0, current = '';
  for (const s of samples) {
    current += s;
    if (!seen.has(current)) {
      seen.add(current);
      count++;
      current = '';
    }
  }
  if (current.length > 0) count++;
  return count / samples.length;
}

// ── Growth pattern classification ────────────────────────────────────

function classifyGrowth(trajectory) {
  if (trajectory.length < 10) return 'unknown';

  let increases = 0, decreases = 0, flat = 0;
  for (let i = 1; i < trajectory.length; i++) {
    if (trajectory[i] > trajectory[i - 1]) increases++;
    else if (trajectory[i] < trajectory[i - 1]) decreases++;
    else flat++;
  }

  const total = trajectory.length - 1;
  if (decreases === 0) return 'monotonic';
  if (decreases / total < 0.05) return 'near_monotonic';
  if (decreases / total > 0.3 && increases / total > 0.3) return 'oscillating';
  return 'sawtooth';
}

// ═══ Main ════════════════════════════════════════════════════════════

const holdoutFile = process.argv[2] || 'data/bb6_holdouts_1214.txt';
const STEP_LIMIT = parseInt(process.argv[3]) || 10_000_000;

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║   BB(6) HOLDOUT ANALYSIS — Applying Our Framework      ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

const lines = fs.readFileSync(holdoutFile, 'utf-8').trim().split('\n');
console.log(`Loaded ${lines.length} holdout machines`);
console.log(`Step limit: ${STEP_LIMIT.toLocaleString()}\n`);

const results = [];
let processed = 0;

for (const line of lines) {
  const parsed = parseHoldout(line);
  if (!parsed) continue;

  const motifs = detectMotifs(parsed.table);
  const result = analyse(parsed.table, STEP_LIMIT);
  const crashDyn = classifyCrashDynamics(result.crashes);
  const lz = lzComplexity(result.stateSamples);
  const growth = classifyGrowth(result.trajectory);

  const statesUsed = Array.from(result.stateCounts).filter(c => c > 0).length;
  const dominantStates = Array.from(result.stateCounts)
    .map((c, i) => ({ s: STATE_NAMES[i], p: c / result.steps * 100 }))
    .sort((a, b) => b.p - a.p)
    .filter(x => x.p > 1);

  results.push({
    raw: parsed.raw,
    halted: result.halted,
    reason: result.reason,
    steps: result.steps,
    ones: result.ones,
    maxOnes: result.maxOnes,
    tapeSpan: result.tapeSpan,
    statesUsed,
    motifs,
    crashDyn,
    lz,
    growth,
    dominantStates,
  });

  processed++;
  if (processed % 100 === 0) {
    process.stdout.write(`  ${processed}/${lines.length} analysed...\r`);
  }
}

console.log(`  ${processed} machines analysed.\n`);

// ═══ Classification Summary ══════════════════════════════════════════

console.log('═══ Outcome Distribution ═══\n');
const outcomes = {};
for (const r of results) {
  const key = r.halted ? 'halted' : r.reason;
  outcomes[key] = (outcomes[key] || 0) + 1;
}
for (const [k, v] of Object.entries(outcomes).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(20)} ${v}`);
}

// Crash dynamics classification
console.log('\n═══ Crash Dynamics Classification ═══\n');
const crashTypes = {};
for (const r of results) {
  crashTypes[r.crashDyn.type] = (crashTypes[r.crashDyn.type] || 0) + 1;
}
for (const [k, v] of Object.entries(crashTypes).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(25)} ${v} machines`);
}

// Growth pattern
console.log('\n═══ Growth Pattern Distribution ═══\n');
const growthTypes = {};
for (const r of results) {
  growthTypes[r.growth] = (growthTypes[r.growth] || 0) + 1;
}
for (const [k, v] of Object.entries(growthTypes).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(20)} ${v}`);
}

// Motif distribution
console.log('\n═══ Motif Distribution ═══\n');
let dualSweepCount = 0, reluctantCount = 0;
const gapMakerDist = {};
const sweeperDist = {};
for (const r of results) {
  if (r.motifs.dualSweep) dualSweepCount++;
  if (r.motifs.reluctantHalter) reluctantCount++;
  gapMakerDist[r.motifs.gapMakerCount] = (gapMakerDist[r.motifs.gapMakerCount] || 0) + 1;
  sweeperDist[r.motifs.sweeperCount] = (sweeperDist[r.motifs.sweeperCount] || 0) + 1;
}
console.log(`  Dual sweep:       ${dualSweepCount} (${(dualSweepCount / results.length * 100).toFixed(1)}%)`);
console.log(`  Reluctant halter: ${reluctantCount} (${(reluctantCount / results.length * 100).toFixed(1)}%)`);
console.log(`  Gap-maker counts: ${JSON.stringify(gapMakerDist)}`);
console.log(`  Sweeper counts:   ${JSON.stringify(sweeperDist)}`);

// ═══ Most interesting machines ═══════════════════════════════════════

// COUNTERS — the holy grail (geometric crash spacing like BB(5))
const counters = results.filter(r => r.crashDyn.type === 'counter');
counters.sort((a, b) => b.crashDyn.avgIntervalRatio - a.crashDyn.avgIntervalRatio);

console.log(`\n═══ COUNTER-TYPE Machines (geometric crash spacing) — ${counters.length} found ═══\n`);
for (const r of counters.slice(0, 20)) {
  const dist = r.dominantStates.map(x => `${x.s}=${x.p.toFixed(0)}%`).join(' ');
  console.log(`  ${r.raw}`);
  console.log(`    ratio=${r.crashDyn.avgIntervalRatio.toFixed(3)} stddev=${r.crashDyn.ratioStdDev.toFixed(3)} crashes=${r.crashDyn.crashCount} loss=${r.crashDyn.avgLossFraction.toFixed(3)}`);
  console.log(`    ones=${r.ones} max=${r.maxOnes} LZ=${r.lz.toFixed(4)} growth=${r.growth} states=${r.statesUsed}`);
  console.log(`    [${dist}]`);
  console.log();
}

// OSCILLATORS with high crash counts
const oscillators = results.filter(r => r.crashDyn.type === 'oscillator');
oscillators.sort((a, b) => b.crashDyn.crashCount - a.crashDyn.crashCount);

console.log(`\n═══ OSCILLATOR-TYPE Machines (constant crash spacing) — ${oscillators.length} found ═══\n`);
console.log('  (Top 10 by crash count — likely non-halting)\n');
for (const r of oscillators.slice(0, 10)) {
  const dist = r.dominantStates.map(x => `${x.s}=${x.p.toFixed(0)}%`).join(' ');
  console.log(`  ${r.raw}`);
  console.log(`    crashes=${r.crashDyn.crashCount} ratio=${r.crashDyn.avgIntervalRatio.toFixed(3)} loss=${r.crashDyn.avgLossFraction.toFixed(3)}`);
  console.log(`    ones=${r.ones} max=${r.maxOnes} LZ=${r.lz.toFixed(4)} [${dist}]`);
}

// LZ complexity extremes
results.sort((a, b) => a.lz - b.lz);
console.log('\n═══ Most Compressible (lowest LZ — most structured) ═══\n');
for (const r of results.slice(0, 10)) {
  const dist = r.dominantStates.slice(0, 3).map(x => `${x.s}=${x.p.toFixed(0)}%`).join(' ');
  console.log(`  LZ=${r.lz.toFixed(4)} ${r.raw}`);
  console.log(`    crashes=${r.crashDyn.crashCount} type=${r.crashDyn.type} max=${r.maxOnes} [${dist}]`);
}

// Machines that halted (!)
const halted = results.filter(r => r.halted);
if (halted.length > 0) {
  console.log(`\n═══ HALTED MACHINES (!!!) — ${halted.length} found ═══\n`);
  for (const r of halted) {
    console.log(`  ${r.raw}`);
    console.log(`    ${r.ones} ones in ${r.steps.toLocaleString()} steps`);
  }
}

// Summary statistics
console.log('\n═══ Summary ═══\n');
console.log(`  Total machines:    ${results.length}`);
console.log(`  Counter-type:      ${counters.length} (potential BB candidates — geometric crash spacing)`);
console.log(`  Oscillator-type:   ${oscillators.length} (likely non-halting — constant crash spacing)`);
console.log(`  Chaotic:           ${(crashTypes['chaotic'] || 0)}`);
console.log(`  Insufficient data: ${(crashTypes['insufficient_data'] || 0)} (need longer runs)`);
console.log(`  Halted:            ${halted.length}`);
if (counters.length > 0) {
  console.log(`\n  ** Counter-type machines are the most interesting — they show`);
  console.log(`     BB(5)-like dynamics and are the strongest BB(6) candidates **`);
}
