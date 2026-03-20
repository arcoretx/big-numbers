/**
 * Deep Amplification Analysis
 *
 * Enumerates all 3-state machines and performs comprehensive phase
 * analysis on every halting machine. Asks:
 *
 *   1. Does having amplification predict higher scores?
 *   2. What's the optimal setup/amplification/cleanup ratio?
 *   3. Which cycle patterns are most productive?
 *   4. How does cycle length vs cycle count affect output?
 */

// ── Fast TM (copied from bb-enumerate.js for standalone use) ─────────

let HALT = 3;
let STATE_NAMES = ['A', 'B', 'C', 'H'];

function initStates(n) {
  HALT = n;
  STATE_NAMES = [];
  for (let i = 0; i < n; i++) STATE_NAMES.push(String.fromCharCode(65 + i));
  STATE_NAMES.push('H');
}

function fastRun(table, maxSteps) {
  const tape = new Uint8Array(256);
  let head = 128;
  let state = 0;
  let steps = 0;
  let minHead = head, maxHead = head;
  const stateSeq = new Uint8Array(maxSteps + 1);

  while (steps < maxSteps) {
    const symbol = tape[head];
    const idx = state * 2 + symbol;
    const write = table[idx * 3];
    const move = table[idx * 3 + 1];
    const next = table[idx * 3 + 2];

    stateSeq[steps] = state;
    tape[head] = write;
    head += move === 1 ? 1 : -1;
    state = next;
    steps++;

    if (head < minHead) minHead = head;
    if (head > maxHead) maxHead = head;

    if (state === HALT) {
      let ones = 0;
      for (let i = minHead; i <= maxHead; i++) ones += tape[i];
      return { halted: true, steps, ones, stateSeq };
    }
    if (head < 2 || head > 253) {
      return { halted: false, steps: 0, ones: 0, stateSeq };
    }
  }
  return { halted: false, steps: 0, ones: 0, stateSeq };
}

// ── Phase Detection (same as bb-enumerate.js) ────────────────────────

function detectPhases(stateSeq, totalSteps) {
  if (totalSteps < 4) {
    return { setup: totalSteps, amplification: 0, cleanup: 0, cycleLen: 0, cycleCount: 0, pattern: '' };
  }

  let bestCycleLen = 0, bestCycleCount = 0, bestCycleStart = 0;

  for (let cycleLen = 2; cycleLen <= Math.min(totalSteps / 2, 30); cycleLen++) {
    for (let start = 0; start <= totalSteps - cycleLen * 2; start++) {
      let count = 0;
      let pos = start;
      while (pos + cycleLen <= totalSteps) {
        let match = true;
        for (let j = 0; j < cycleLen; j++) {
          if (stateSeq[pos + j] !== stateSeq[start + j]) { match = false; break; }
        }
        if (!match) break;
        count++;
        pos += cycleLen;
      }
      if (count >= 2 && count * cycleLen > bestCycleCount * bestCycleLen) {
        bestCycleLen = cycleLen;
        bestCycleCount = count;
        bestCycleStart = start;
      }
    }
  }

  if (bestCycleCount >= 2) {
    const setup = bestCycleStart;
    const amplification = bestCycleLen * bestCycleCount;
    const cleanup = totalSteps - setup - amplification;
    const pattern = Array.from(stateSeq.slice(bestCycleStart, bestCycleStart + bestCycleLen))
      .map(s => STATE_NAMES[s]).join('');
    return { setup, amplification, cleanup, cycleLen: bestCycleLen, cycleCount: bestCycleCount, pattern };
  }

  return { setup: totalSteps, amplification: 0, cleanup: 0, cycleLen: 0, cycleCount: 0, pattern: '' };
}

// ── Main Analysis ────────────────────────────────────────────────────

function analyse(numStates, maxSteps) {
  initStates(numStates);
  const nextStates = numStates + 1;
  const numEntries = numStates * 2;
  const optionsPerEntry = 2 * 2 * nextStates;
  const totalMachines = Math.pow(optionsPerEntry, numEntries);

  console.log(`\nAnalysing amplification patterns in ${numStates}-state machines...`);
  console.log(`Total machines: ${totalMachines.toLocaleString()}\n`);

  // ── Accumulators ─────────────────────────────────────────────────

  // 1. With vs without amplification
  let withAmp = { count: 0, totalOnes: 0, totalSteps: 0, maxOnes: 0, maxSteps: 0 };
  let withoutAmp = { count: 0, totalOnes: 0, totalSteps: 0, maxOnes: 0, maxSteps: 0 };

  // 2. By amplification fraction (bucketed into 10% bands)
  const ampFractionBuckets = {};
  for (let i = 0; i <= 10; i++) {
    ampFractionBuckets[i] = { count: 0, totalOnes: 0, maxOnes: 0 };
  }

  // 3. By cycle pattern
  const cyclePatterns = {};

  // 4. By cycle length
  const cycleLengths = {};

  // 5. By cycle count
  const cycleCounts = {};

  // 6. Setup ratio analysis
  const setupFractionBuckets = {};
  for (let i = 0; i <= 10; i++) {
    setupFractionBuckets[i] = { count: 0, totalOnes: 0, maxOnes: 0 };
  }

  // 7. Score distribution: with amp vs without
  const onesDistWith = {};     // ones → count (machines with amplification)
  const onesDistWithout = {};  // ones → count (machines without)

  // 8. Cleanup fraction
  const cleanupFractionBuckets = {};
  for (let i = 0; i <= 10; i++) {
    cleanupFractionBuckets[i] = { count: 0, totalOnes: 0, maxOnes: 0 };
  }

  // ── Enumeration ──────────────────────────────────────────────────

  const table = new Uint8Array(numEntries * 3);
  const counter = new Uint8Array(numEntries);
  let processed = 0;
  const progressInterval = Math.floor(totalMachines / 20);

  function decodeEntry(code) {
    return [code % 2, Math.floor(code / 2) % 2, Math.floor(code / 4)];
  }

  function setTable() {
    for (let i = 0; i < numEntries; i++) {
      const [w, m, n] = decodeEntry(counter[i]);
      table[i * 3] = w;
      table[i * 3 + 1] = m;
      table[i * 3 + 2] = n;
    }
  }

  function incrementCounter() {
    for (let i = 0; i < numEntries; i++) {
      counter[i]++;
      if (counter[i] < optionsPerEntry) return true;
      counter[i] = 0;
    }
    return false;
  }

  do {
    setTable();
    processed++;

    if (processed % progressInterval === 0) {
      const pct = Math.round(processed / totalMachines * 100);
      process.stdout.write(`  ${pct}%\r`);
    }

    // Quick filter: need at least one halt transition
    let hasHalt = false;
    for (let i = 0; i < numEntries; i++) {
      if (table[i * 3 + 2] === HALT) { hasHalt = true; break; }
    }
    if (!hasHalt) continue;

    const result = fastRun(table, maxSteps);
    if (!result.halted) continue;

    const phases = detectPhases(result.stateSeq, result.steps);
    const hasAmplification = phases.cycleCount >= 2;

    // 1. With vs without
    const bucket = hasAmplification ? withAmp : withoutAmp;
    bucket.count++;
    bucket.totalOnes += result.ones;
    bucket.totalSteps += result.steps;
    if (result.ones > bucket.maxOnes) bucket.maxOnes = result.ones;
    if (result.steps > bucket.maxSteps) bucket.maxSteps = result.steps;

    // Score distribution
    const dist = hasAmplification ? onesDistWith : onesDistWithout;
    dist[result.ones] = (dist[result.ones] || 0) + 1;

    if (hasAmplification && result.steps > 0) {
      // 2. Amplification fraction
      const ampFrac = Math.min(10, Math.floor(phases.amplification / result.steps * 10));
      ampFractionBuckets[ampFrac].count++;
      ampFractionBuckets[ampFrac].totalOnes += result.ones;
      if (result.ones > ampFractionBuckets[ampFrac].maxOnes) {
        ampFractionBuckets[ampFrac].maxOnes = result.ones;
      }

      // Setup fraction
      const setupFrac = Math.min(10, Math.floor(phases.setup / result.steps * 10));
      setupFractionBuckets[setupFrac].count++;
      setupFractionBuckets[setupFrac].totalOnes += result.ones;
      if (result.ones > setupFractionBuckets[setupFrac].maxOnes) {
        setupFractionBuckets[setupFrac].maxOnes = result.ones;
      }

      // Cleanup fraction
      const cleanupFrac = Math.min(10, Math.floor(phases.cleanup / result.steps * 10));
      cleanupFractionBuckets[cleanupFrac].count++;
      cleanupFractionBuckets[cleanupFrac].totalOnes += result.ones;
      if (result.ones > cleanupFractionBuckets[cleanupFrac].maxOnes) {
        cleanupFractionBuckets[cleanupFrac].maxOnes = result.ones;
      }

      // 3. Cycle pattern
      if (phases.pattern) {
        if (!cyclePatterns[phases.pattern]) {
          cyclePatterns[phases.pattern] = { count: 0, totalOnes: 0, maxOnes: 0, totalSteps: 0, maxSteps: 0 };
        }
        const cp = cyclePatterns[phases.pattern];
        cp.count++;
        cp.totalOnes += result.ones;
        cp.totalSteps += result.steps;
        if (result.ones > cp.maxOnes) cp.maxOnes = result.ones;
        if (result.steps > cp.maxSteps) cp.maxSteps = result.steps;
      }

      // 4. Cycle length
      const cl = phases.cycleLen;
      if (!cycleLengths[cl]) cycleLengths[cl] = { count: 0, totalOnes: 0, maxOnes: 0 };
      cycleLengths[cl].count++;
      cycleLengths[cl].totalOnes += result.ones;
      if (result.ones > cycleLengths[cl].maxOnes) cycleLengths[cl].maxOnes = result.ones;

      // 5. Cycle count
      const cc = phases.cycleCount;
      if (!cycleCounts[cc]) cycleCounts[cc] = { count: 0, totalOnes: 0, maxOnes: 0, maxSteps: 0 };
      cycleCounts[cc].count++;
      cycleCounts[cc].totalOnes += result.ones;
      if (result.ones > cycleCounts[cc].maxOnes) cycleCounts[cc].maxOnes = result.ones;
      if (result.steps > cycleCounts[cc].maxSteps) cycleCounts[cc].maxSteps = result.steps;
    }
  } while (incrementCounter());

  // ── Results ──────────────────────────────────────────────────────

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║           AMPLIFICATION DEEP ANALYSIS                   ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // 1. With vs without amplification
  console.log('═══ Q1: Does amplification predict success? ═══\n');
  const wAvg = withAmp.count ? (withAmp.totalOnes / withAmp.count).toFixed(3) : 0;
  const woAvg = withoutAmp.count ? (withoutAmp.totalOnes / withoutAmp.count).toFixed(3) : 0;
  const wStepAvg = withAmp.count ? (withAmp.totalSteps / withAmp.count).toFixed(1) : 0;
  const woStepAvg = withoutAmp.count ? (withoutAmp.totalSteps / withoutAmp.count).toFixed(1) : 0;

  console.log(`  WITH amplification:    ${withAmp.count.toLocaleString()} machines`);
  console.log(`    avg ones: ${wAvg}    max ones: ${withAmp.maxOnes}    avg steps: ${wStepAvg}    max steps: ${withAmp.maxSteps}`);
  console.log(`  WITHOUT amplification: ${withoutAmp.count.toLocaleString()} machines`);
  console.log(`    avg ones: ${woAvg}    max ones: ${withoutAmp.maxOnes}    avg steps: ${woStepAvg}    max steps: ${withoutAmp.maxSteps}`);
  console.log(`\n  Amplification advantage: ${(wAvg / woAvg).toFixed(1)}x average ones`);

  // Score distribution comparison
  console.log('\n  Ones distribution:');
  console.log('  Ones | With Amp          | Without Amp');
  console.log('  ─────┼───────────────────┼───────────────────');
  const allOnes = new Set([...Object.keys(onesDistWith), ...Object.keys(onesDistWithout)]);
  const sortedOnes = Array.from(allOnes).map(Number).sort((a, b) => a - b);
  for (const ones of sortedOnes) {
    const w = onesDistWith[ones] || 0;
    const wo = onesDistWithout[ones] || 0;
    const wPct = withAmp.count ? (w / withAmp.count * 100).toFixed(1) : '0';
    const woPct = withoutAmp.count ? (wo / withoutAmp.count * 100).toFixed(1) : '0';
    console.log(`    ${String(ones).padStart(2)}  | ${String(w).padStart(8)} (${wPct}%) | ${String(wo).padStart(8)} (${woPct}%)`);
  }

  // 2. Amplification fraction
  console.log('\n═══ Q2: What fraction of execution should be amplification? ═══\n');
  console.log('  Amp %    | Count      | Avg Ones | Max Ones');
  console.log('  ─────────┼────────────┼──────────┼─────────');
  for (let i = 0; i <= 10; i++) {
    const b = ampFractionBuckets[i];
    if (b.count === 0) continue;
    const label = `${i * 10}-${(i + 1) * 10}%`.padEnd(9);
    const avg = (b.totalOnes / b.count).toFixed(2);
    console.log(`  ${label} | ${String(b.count).padStart(10)} | ${String(avg).padStart(8)} | ${String(b.maxOnes).padStart(8)}`);
  }

  // Setup fraction
  console.log('\n═══ Q2b: What fraction should be setup? ═══\n');
  console.log('  Setup %  | Count      | Avg Ones | Max Ones');
  console.log('  ─────────┼────────────┼──────────┼─────────');
  for (let i = 0; i <= 10; i++) {
    const b = setupFractionBuckets[i];
    if (b.count === 0) continue;
    const label = `${i * 10}-${(i + 1) * 10}%`.padEnd(9);
    const avg = (b.totalOnes / b.count).toFixed(2);
    console.log(`  ${label} | ${String(b.count).padStart(10)} | ${String(avg).padStart(8)} | ${String(b.maxOnes).padStart(8)}`);
  }

  // Cleanup fraction
  console.log('\n═══ Q2c: What fraction should be cleanup? ═══\n');
  console.log('  Clean %  | Count      | Avg Ones | Max Ones');
  console.log('  ─────────┼────────────┼──────────┼─────────');
  for (let i = 0; i <= 10; i++) {
    const b = cleanupFractionBuckets[i];
    if (b.count === 0) continue;
    const label = `${i * 10}-${(i + 1) * 10}%`.padEnd(9);
    const avg = (b.totalOnes / b.count).toFixed(2);
    console.log(`  ${label} | ${String(b.count).padStart(10)} | ${String(avg).padStart(8)} | ${String(b.maxOnes).padStart(8)}`);
  }

  // 3. Cycle patterns
  console.log('\n═══ Q3: Which cycle patterns are most productive? ═══\n');
  const sortedPatterns = Object.entries(cyclePatterns)
    .sort((a, b) => b[1].maxOnes - a[1].maxOnes || b[1].count - a[1].count);
  console.log('  Pattern   | Count      | Avg Ones | Max Ones | Max Steps');
  console.log('  ──────────┼────────────┼──────────┼──────────┼──────────');
  for (const [pattern, stats] of sortedPatterns.slice(0, 25)) {
    const avg = (stats.totalOnes / stats.count).toFixed(2);
    console.log(`  ${pattern.padEnd(9)} | ${String(stats.count).padStart(10)} | ${String(avg).padStart(8)} | ${String(stats.maxOnes).padStart(8)} | ${String(stats.maxSteps).padStart(8)}`);
  }

  // 4. Cycle length
  console.log('\n═══ Q4: How does cycle length affect output? ═══\n');
  console.log('  Length | Count      | Avg Ones | Max Ones');
  console.log('  ───────┼────────────┼──────────┼─────────');
  for (const [len, stats] of Object.entries(cycleLengths).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const avg = (stats.totalOnes / stats.count).toFixed(2);
    console.log(`  ${String(len).padStart(5)}  | ${String(stats.count).padStart(10)} | ${String(avg).padStart(8)} | ${String(stats.maxOnes).padStart(8)}`);
  }

  // 5. Cycle count
  console.log('\n═══ Q5: How does cycle count (repetitions) affect output? ═══\n');
  console.log('  Reps  | Count      | Avg Ones | Max Ones | Max Steps');
  console.log('  ──────┼────────────┼──────────┼──────────┼──────────');
  for (const [count, stats] of Object.entries(cycleCounts).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const avg = (stats.totalOnes / stats.count).toFixed(2);
    console.log(`  ${String(count).padStart(4)}  | ${String(stats.count).padStart(10)} | ${String(avg).padStart(8)} | ${String(stats.maxOnes).padStart(8)} | ${String(stats.maxSteps).padStart(8)}`);
  }

  // Summary
  console.log('\n═══ Summary ═══\n');
  const totalHalting = withAmp.count + withoutAmp.count;
  const ampPct = (withAmp.count / totalHalting * 100).toFixed(1);
  console.log(`  ${ampPct}% of halting machines have detectable amplification`);
  console.log(`  Amplification gives ${(wAvg / woAvg).toFixed(1)}x average ones improvement`);

  const bestPattern = sortedPatterns[0];
  if (bestPattern) {
    console.log(`  Most productive cycle pattern: "${bestPattern[0]}" (max ${bestPattern[1].maxOnes} ones)`);
  }

  const bestCycleLen = Object.entries(cycleLengths).sort((a, b) => b[1].maxOnes - a[1].maxOnes)[0];
  if (bestCycleLen) {
    console.log(`  Best cycle length: ${bestCycleLen[0]} (max ${bestCycleLen[1].maxOnes} ones)`);
  }
}

// ── Run ──────────────────────────────────────────────────────────────

const numStates = parseInt(process.argv[2]) || 3;
const maxSteps = parseInt(process.argv[3]) || 200;

const start = Date.now();
analyse(numStates, maxSteps);
console.log(`\n  Completed in ${((Date.now() - start) / 1000).toFixed(1)}s`);
