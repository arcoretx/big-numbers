/**
 * BB(6) Collatz Function Extraction
 *
 * For the 108 unverified BB(6) holdouts, attempt to extract
 * Collatz-like functions by:
 *   1. Running the machine with tape compression (run-length encoding)
 *   2. Identifying repeating "rule steps" — configurations that
 *      recur with different parameters
 *   3. Extracting the function that maps parameters between recurrences
 *
 * Methodology adapted from Sligocki's approach.
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

/**
 * Run a machine and capture "landmark" configurations.
 *
 * A landmark = when the machine is at the edge of the non-blank region
 * in a specific state. At landmarks, the tape can be described compactly
 * as a run-length encoded string with a small number of distinct blocks.
 *
 * We look for landmarks that recur with similar structure but different
 * block sizes — those reveal the Collatz-like recurrence.
 */
function extractCollatz(table, maxSteps) {
  const TAPE_SIZE = 131072;
  const tape = new Uint8Array(TAPE_SIZE);
  const CENTER = Math.floor(TAPE_SIZE / 2);
  let head = CENTER, state = 0, steps = 0;
  let minHead = CENTER, maxHead = CENTER;

  // Capture landmarks: when the head is at or near the tape boundary
  // and the state is one of the "rare" states (not a sweeper)
  const landmarks = [];
  const LANDMARK_INTERVAL = 10000; // check every N steps
  let lastLandmarkStep = 0;

  // Track which states are sweepers (self-loops on read-1)
  const sweepers = new Set();
  for (let s = 0; s < NUM_STATES; s++) {
    const idx = (s * 2 + 1) * 3; // read-1 transition
    if (table[idx + 2] === s) sweepers.add(s); // self-loop
  }

  // RLE encode the tape
  function rleTape() {
    if (minHead > maxHead) return [];
    const runs = [];
    let runVal = tape[minHead], runLen = 1;
    for (let i = minHead + 1; i <= maxHead; i++) {
      if (tape[i] === runVal) {
        runLen++;
      } else {
        runs.push({ val: runVal, len: runLen });
        runVal = tape[i];
        runLen = 1;
      }
    }
    runs.push({ val: runVal, len: runLen });
    return runs;
  }

  // Create a "signature" from RLE — the pattern of values with lengths replaced by variables
  function rleSignature(runs) {
    return runs.map(r => r.val).join('');
  }

  // Create a parameterised description
  function rleParams(runs) {
    return runs.map(r => r.len);
  }

  while (steps < maxSteps) {
    const symbol = tape[head];
    const idx = (state * 2 + symbol) * 3;
    const write = table[idx], move = table[idx + 1], next = table[idx + 2];

    tape[head] = write;
    head += move === 1 ? 1 : -1;
    state = next;
    steps++;

    if (head < minHead) minHead = head;
    if (head > maxHead) maxHead = head;

    if (state === HALT) {
      return { halted: true, steps, landmarks };
    }
    if (head < 2 || head > TAPE_SIZE - 3) {
      return { halted: false, reason: 'overflow', steps, landmarks };
    }

    // Capture landmark when head is near boundary and in a non-sweeper state
    if (steps - lastLandmarkStep >= LANDMARK_INTERVAL) {
      const nearLeft = head - minHead < 5;
      const nearRight = maxHead - head < 5;

      if ((nearLeft || nearRight) && !sweepers.has(state)) {
        const runs = rleTape();
        const sig = rleSignature(runs);
        const params = rleParams(runs);
        const headPos = nearLeft ? 'left' : 'right';

        if (landmarks.length < 500) {  // cap memory usage
          landmarks.push({
            step: steps,
            state,
            headPos,
            sig,
            params,
            numRuns: runs.length,
            span: maxHead - minHead + 1,
          });
        }

        lastLandmarkStep = steps;
      }
    }
  }

  return { halted: false, reason: 'step_limit', steps, landmarks };
}

/**
 * Analyse landmarks to find recurrences.
 * Look for pairs of landmarks with the same (state, headPos, signature)
 * but different parameters — those reveal the Collatz function.
 */
function findRecurrences(landmarks) {
  // Group by (state, headPos, signature)
  const groups = new Map();
  for (const lm of landmarks) {
    const key = `${STATE_NAMES[lm.state]}_${lm.headPos}_${lm.sig}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(lm);
  }

  const recurrences = [];

  for (const [key, lms] of groups) {
    if (lms.length < 3) continue; // need at least 3 to see a pattern

    // Check if parameters change in a predictable way
    // For each parameter position, compute the sequence of values
    const numParams = lms[0].params.length;
    const paramSeqs = [];
    for (let p = 0; p < numParams; p++) {
      paramSeqs.push(lms.map(lm => lm.params[p]));
    }

    // Find which parameters change (vs stay constant)
    const changing = [];
    const constant = [];
    for (let p = 0; p < numParams; p++) {
      const vals = new Set(paramSeqs[p]);
      if (vals.size > 1) {
        changing.push({ param: p, values: paramSeqs[p] });
      } else {
        constant.push({ param: p, value: paramSeqs[p][0] });
      }
    }

    if (changing.length === 0) continue; // all constant = simple loop, not Collatz

    // For each changing parameter, try to find the recurrence
    // f(x_n) = x_{n+1}
    for (const ch of changing) {
      const vals = ch.values;
      // Try linear fit: x_{n+1} = a * x_n + b
      if (vals.length >= 3) {
        const ratios = [];
        const diffs = [];
        for (let i = 1; i < vals.length; i++) {
          if (vals[i - 1] !== 0) ratios.push(vals[i] / vals[i - 1]);
          diffs.push(vals[i] - vals[i - 1]);
        }

        // Check if ratios are approximately constant (linear recurrence)
        const avgRatio = ratios.length > 0 ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0;
        const ratioVar = ratios.length > 0 ? ratios.reduce((a, r) => a + (r - avgRatio) ** 2, 0) / ratios.length : Infinity;

        // Check if diffs are approximately constant (arithmetic growth)
        const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
        const diffVar = diffs.reduce((a, d) => a + (d - avgDiff) ** 2, 0) / diffs.length;

        // Try to find a/b such that x_{n+1} ≈ a * x_n + b
        let bestA = 0, bestB = 0, bestErr = Infinity;
        if (vals.length >= 2) {
          // Linear regression: x_{n+1} = a * x_n + b
          let sumX = 0, sumY = 0, sumXX = 0, sumXY = 0, n = 0;
          for (let i = 0; i < vals.length - 1; i++) {
            sumX += vals[i]; sumY += vals[i + 1];
            sumXX += vals[i] * vals[i]; sumXY += vals[i] * vals[i + 1];
            n++;
          }
          if (n * sumXX - sumX * sumX !== 0) {
            bestA = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
            bestB = (sumY - bestA * sumX) / n;
            // Compute error
            bestErr = 0;
            for (let i = 0; i < vals.length - 1; i++) {
              const pred = bestA * vals[i] + bestB;
              bestErr += (pred - vals[i + 1]) ** 2;
            }
            bestErr = Math.sqrt(bestErr / n);
          }
        }

        recurrences.push({
          key,
          param: ch.param,
          values: vals,
          numOccurrences: vals.length,
          avgRatio: avgRatio,
          ratioStability: ratioVar < 0.01 ? 'stable' : ratioVar < 0.1 ? 'moderate' : 'unstable',
          linearFit: { a: bestA, b: bestB, rmse: bestErr },
          steps: lms.map(l => l.step),
          changing: changing.length,
          constant: constant.length,
        });
      }
    }
  }

  // Sort by quality of fit
  recurrences.sort((a, b) => a.linearFit.rmse - b.linearFit.rmse);
  return recurrences;
}

// ═══ Main ════════════════════════════════════════════════════════════

// First, identify which machines are unverified from our cycle detection
// (the 108 that had no_cycle_found)
const holdoutFile = process.argv[2] || 'data/bb6_holdouts_1214.txt';
const STEP_LIMIT = 10_000_000;

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║   BB(6) COLLATZ FUNCTION EXTRACTION                    ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

const lines = fs.readFileSync(holdoutFile, 'utf-8').trim().split('\n');
console.log(`Loaded ${lines.length} machines, running at ${STEP_LIMIT.toLocaleString()} steps\n`);

// Run all machines but focus reporting on the most interesting
const allResults = [];
let processed = 0;

for (const line of lines) {
  const table = parseHoldout(line);
  if (!table) continue;

  const result = extractCollatz(table, STEP_LIMIT);
  const recurrences = findRecurrences(result.landmarks);

  allResults.push({
    raw: line.trim(),
    halted: result.halted,
    reason: result.reason,
    steps: result.steps,
    numLandmarks: result.landmarks.length,
    recurrences,
    bestRecurrence: recurrences.length > 0 ? recurrences[0] : null,
  });

  processed++;
  if (processed % 50 === 0) {
    process.stdout.write(`  ${processed}/${lines.length}...\r`);
  }
}

console.log(`  ${processed} machines analysed\n`);

// ═══ Results ═════════════════════════════════════════════════════════

// Machines with good Collatz-like recurrences
const withRecurrence = allResults.filter(r => r.bestRecurrence && r.bestRecurrence.linearFit.rmse < 1.0);
withRecurrence.sort((a, b) => a.bestRecurrence.linearFit.rmse - b.bestRecurrence.linearFit.rmse);

console.log(`═══ Machines with Clean Recurrences (RMSE < 1.0) — ${withRecurrence.length} found ═══\n`);

for (const r of withRecurrence.slice(0, 30)) {
  const rec = r.bestRecurrence;
  const aStr = rec.linearFit.a.toFixed(4);
  const bStr = rec.linearFit.b.toFixed(1);

  // Express a as a fraction if close to a simple one
  let aFrac = aStr;
  for (const [num, den] of [[5,3],[4,3],[3,2],[7,4],[2,1],[5,2],[7,3],[8,3],[3,1]]) {
    if (Math.abs(rec.linearFit.a - num/den) < 0.02) {
      aFrac = `${num}/${den}`;
      break;
    }
  }

  console.log(`  ${r.raw}`);
  console.log(`    x_{n+1} ≈ ${aFrac} * x_n + ${bStr}  (RMSE=${rec.linearFit.rmse.toFixed(4)})`);
  console.log(`    ratio=${rec.avgRatio.toFixed(4)} (${rec.ratioStability}), ${rec.numOccurrences} occurrences`);
  console.log(`    config: ${rec.key} param=${rec.param}`);

  // Show the parameter values
  const valsStr = rec.values.length <= 10
    ? rec.values.join(', ')
    : rec.values.slice(0, 5).join(', ') + ' ... ' + rec.values.slice(-3).join(', ');
  console.log(`    values: [${valsStr}]`);
  console.log();
}

// Summary of all ratios found
console.log('═══ Ratio Distribution (all machines with recurrences) ═══\n');
const ratioHist = {};
for (const r of allResults) {
  if (!r.bestRecurrence) continue;
  const ratio = r.bestRecurrence.avgRatio;
  const bucket = (Math.round(ratio * 10) / 10).toFixed(1);
  ratioHist[bucket] = (ratioHist[bucket] || 0) + 1;
}
const sortedBuckets = Object.entries(ratioHist).sort((a, b) => Number(a[0]) - Number(b[0]));
for (const [bucket, count] of sortedBuckets) {
  const bar = '#'.repeat(Math.min(count, 50));
  console.log(`  ${bucket.padStart(5)}x | ${bar} ${count}`);
}

// Machines with ratio near interesting constants
console.log('\n═══ Machines with Ratios Near Known Constants ═══\n');
const targets = [
  { name: '5/3', value: 5/3 },
  { name: '2', value: 2 },
  { name: '7/3', value: 7/3 },
  { name: '3', value: 3 },
  { name: '4/3', value: 4/3 },
];

for (const target of targets) {
  const near = allResults.filter(r =>
    r.bestRecurrence &&
    Math.abs(r.bestRecurrence.avgRatio - target.value) < 0.1 &&
    r.bestRecurrence.linearFit.rmse < 5.0
  );
  if (near.length > 0) {
    console.log(`  Near ${target.name} = ${target.value.toFixed(4)}: ${near.length} machines`);
    for (const r of near.slice(0, 3)) {
      console.log(`    ${r.raw}  ratio=${r.bestRecurrence.avgRatio.toFixed(4)} rmse=${r.bestRecurrence.linearFit.rmse.toFixed(2)}`);
    }
  }
}
