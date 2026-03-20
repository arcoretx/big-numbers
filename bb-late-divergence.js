/**
 * Late Divergence Hypothesis Test
 *
 * Question: do machines with radically different final scores have
 * nearly indistinguishable early behavior?
 *
 * Method:
 *   1. Enumerate all 3-state halting machines (16.7M total, ~7.5M halt)
 *   2. For each, record the first K steps as a "fingerprint"
 *   3. Group machines by their fingerprint
 *   4. Within each group, measure the variance in final scores
 *   5. If high variance → late divergence confirmed
 *      If low variance → early behavior predicts outcome
 *
 * Also test on BB(5) mutations: do the champion and its broken
 * mutations share early-step fingerprints?
 */

// ── Fast TM (from bb-enumerate.js) ───────────────────────────────────

let HALT_STATE, NUM_STATES_CONFIG;

function initStates(n) {
  HALT_STATE = n;
  NUM_STATES_CONFIG = n;
}

function fastRun(table, maxSteps, fingerprintLen) {
  const tape = new Uint8Array(256);
  let head = 128, state = 0, steps = 0;
  let minHead = head, maxHead = head;

  // Capture fingerprint: first K (state, symbol, write) triples
  const fingerprint = [];

  while (steps < maxSteps) {
    const symbol = tape[head];
    const idx = (state * 2 + symbol) * 3;
    const write = table[idx], move = table[idx + 1], next = table[idx + 2];

    if (steps < fingerprintLen) {
      fingerprint.push(state * 4 + symbol * 2 + write);  // compact encoding
    }

    tape[head] = write;
    head += move === 1 ? 1 : -1;
    state = next;
    steps++;

    if (head < minHead) minHead = head;
    if (head > maxHead) maxHead = head;

    if (state === HALT_STATE) {
      let ones = 0;
      for (let i = minHead; i <= maxHead; i++) ones += tape[i];
      return { halted: true, steps, ones, fingerprint: fingerprint.join(',') };
    }
    if (head < 2 || head > 253) {
      return { halted: false, fingerprint: fingerprint.join(',') };
    }
  }
  return { halted: false, fingerprint: fingerprint.join(',') };
}

// ── 3-State Enumeration with Fingerprinting ──────────────────────────

function enumerate3State(fingerprintLen) {
  initStates(3);
  const numEntries = 6;  // 3 states × 2 symbols
  const optionsPerEntry = 2 * 2 * 4;  // write × move × (3 states + halt)
  const totalMachines = Math.pow(optionsPerEntry, numEntries);

  console.log(`Enumerating ${totalMachines.toLocaleString()} 3-state machines`);
  console.log(`Fingerprint length: first ${fingerprintLen} steps\n`);

  const table = new Uint8Array(numEntries * 3);
  const counter = new Uint8Array(numEntries);

  // Group by fingerprint → collect scores
  const fingerprintGroups = new Map();
  let halted = 0, processed = 0;
  const progressInterval = Math.floor(totalMachines / 20);

  function decodeEntry(code) {
    return [code % 2, Math.floor(code / 2) % 2, Math.floor(code / 4)];
  }

  function setTable() {
    for (let i = 0; i < numEntries; i++) {
      const [w, m, n] = decodeEntry(counter[i]);
      table[i * 3] = w; table[i * 3 + 1] = m; table[i * 3 + 2] = n;
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
      process.stdout.write(`  ${Math.round(processed / totalMachines * 100)}%\r`);
    }

    // Quick filter: need halt transition
    let hasHalt = false;
    for (let i = 0; i < numEntries; i++) {
      if (table[i * 3 + 2] === HALT_STATE) { hasHalt = true; break; }
    }
    if (!hasHalt) continue;

    const result = fastRun(table, 200, fingerprintLen);
    if (!result.halted) continue;

    halted++;
    const fp = result.fingerprint;

    if (!fingerprintGroups.has(fp)) {
      fingerprintGroups.set(fp, { scores: [], steps: [], count: 0 });
    }
    const group = fingerprintGroups.get(fp);
    group.scores.push(result.ones);
    group.steps.push(result.steps);
    group.count++;
  } while (incrementCounter());

  return { halted, fingerprintGroups };
}

// ═══ Main Analysis ═══════════════════════════════════════════════════

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║   LATE DIVERGENCE HYPOTHESIS TEST                      ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

// Test multiple fingerprint lengths
const FINGERPRINT_LENGTHS = [1, 2, 3, 4, 5, 6, 8, 10];

for (const fpLen of FINGERPRINT_LENGTHS) {
  console.log(`\n═══ Fingerprint Length: ${fpLen} steps ═══\n`);

  const { halted, fingerprintGroups } = enumerate3State(fpLen);
  console.log(`  Halting machines: ${halted.toLocaleString()}`);
  console.log(`  Unique fingerprints: ${fingerprintGroups.size.toLocaleString()}`);

  // Analyse groups
  let totalGroups = 0;
  let groupsWithVariance = 0;  // groups where machines have different scores
  let maxScoreRange = 0;
  let maxRangeFingerprint = '';
  let totalMachinesInMultiGroups = 0;
  let perfectPrediction = 0;  // groups where all machines have the same score

  // Score distribution by fingerprint
  const interestingGroups = [];

  for (const [fp, group] of fingerprintGroups) {
    if (group.count < 2) continue;
    totalGroups++;
    totalMachinesInMultiGroups += group.count;

    let minScore = Infinity, maxScore = -Infinity;
    for (const s of group.scores) { if (s < minScore) minScore = s; if (s > maxScore) maxScore = s; }
    const range = maxScore - minScore;

    if (range === 0) {
      perfectPrediction++;
    } else {
      groupsWithVariance++;
      if (range > maxScoreRange) {
        maxScoreRange = range;
        maxRangeFingerprint = fp;
      }
    }

    if (range > 0 && group.count >= 3) {
      const avg = group.scores.reduce((a, b) => a + b, 0) / group.scores.length;
      const variance = group.scores.reduce((a, s) => a + (s - avg) ** 2, 0) / group.scores.length;
      interestingGroups.push({
        fp, count: group.count, minScore, maxScore, range, avg, variance,
        scores: group.scores.sort((a, b) => a - b),
      });
    }
  }

  interestingGroups.sort((a, b) => b.range - a.range);

  const predictionRate = totalGroups > 0 ? (perfectPrediction / totalGroups * 100).toFixed(1) : 'N/A';

  console.log(`\n  Groups with 2+ machines: ${totalGroups.toLocaleString()}`);
  console.log(`  Score-homogeneous groups: ${perfectPrediction.toLocaleString()} (${predictionRate}%)`);
  console.log(`  Score-heterogeneous groups: ${groupsWithVariance.toLocaleString()}`);
  console.log(`  Max score range within one fingerprint: ${maxScoreRange}`);

  if (totalGroups > 0) {
    console.log(`\n  Interpretation:`);
    if (parseFloat(predictionRate) > 90) {
      console.log(`    First ${fpLen} steps STRONGLY predict final score (${predictionRate}% homogeneous)`);
      console.log(`    → AGAINST late divergence at this timescale`);
    } else if (parseFloat(predictionRate) > 50) {
      console.log(`    First ${fpLen} steps PARTIALLY predict final score (${predictionRate}% homogeneous)`);
      console.log(`    → MIXED evidence for late divergence`);
    } else {
      console.log(`    First ${fpLen} steps POORLY predict final score (${predictionRate}% homogeneous)`);
      console.log(`    → SUPPORTS late divergence hypothesis`);
    }
  }

  // Show most divergent groups
  if (interestingGroups.length > 0) {
    console.log(`\n  Top 5 most divergent fingerprint groups:`);
    for (const g of interestingGroups.slice(0, 5)) {
      const scoreDistrib = {};
      for (const s of g.scores) scoreDistrib[s] = (scoreDistrib[s] || 0) + 1;
      const distribStr = Object.entries(scoreDistrib).map(([s, c]) => `${s}×${c}`).join(', ');
      console.log(`    fp=[${g.fp}] n=${g.count} scores: ${distribStr} (range ${g.range})`);
    }
  }
}

// ═══ Summary across all fingerprint lengths ══════════════════════════

console.log('\n\n═══ SUMMARY: Prediction Power vs Fingerprint Length ═══\n');
console.log('  How many steps do you need to predict the final score?\n');
console.log('  Steps | Unique FPs | Homogeneous % | Max Range | Verdict');
console.log('  ──────┼────────────┼───────────────┼───────────┼────────');

// Re-run with compact output (reusing the data would be better but
// the enumeration is fast enough)
for (const fpLen of FINGERPRINT_LENGTHS) {
  const { halted, fingerprintGroups } = enumerate3State(fpLen);

  let totalGroups = 0, perfect = 0, maxRange = 0;
  for (const [, group] of fingerprintGroups) {
    if (group.count < 2) continue;
    totalGroups++;
    let gMin = Infinity, gMax = -Infinity;
    for (const s of group.scores) { if (s < gMin) gMin = s; if (s > gMax) gMax = s; }
    const range = gMax - gMin;
    if (range === 0) perfect++;
    if (range > maxRange) maxRange = range;
  }

  const pct = totalGroups > 0 ? (perfect / totalGroups * 100).toFixed(1) : 'N/A';
  const verdict = parseFloat(pct) > 90 ? 'PREDICTIVE' :
    parseFloat(pct) > 50 ? 'PARTIAL' : 'DIVERGENT';

  console.log(`  ${String(fpLen).padStart(5)} | ${String(fingerprintGroups.size).padStart(10)} | ${pct.padStart(12)}% | ${String(maxRange).padStart(9)} | ${verdict}`);
}
