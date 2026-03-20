/**
 * BB(6) Ratio-2 Machine Investigation
 *
 * The Collatz extraction found 50 machines with recurrence ratio ≈ 2.0.
 * If genuine, this confirms the n/3 hypothesis (6/3 = 2).
 *
 * For each ratio-2 candidate:
 *   1. Filter out translated cyclers (periodic tape = not genuine)
 *   2. Run survivors for 100M steps with detailed landmark tracking
 *   3. Extract the exact Collatz function if possible
 *   4. Verify the ratio holds over many recurrences
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
 * Deep analysis of a single machine.
 * Track tape configurations at landmarks, looking for Collatz recurrences.
 */
function deepAnalyse(table, maxSteps) {
  const TAPE_SIZE = 524288;
  const tape = new Uint8Array(TAPE_SIZE);
  const CENTER = Math.floor(TAPE_SIZE / 2);
  let head = CENTER, state = 0, steps = 0, onesCount = 0;
  let minHead = CENTER, maxHead = CENTER;
  const stateCounts = new Float64Array(NUM_STATES);

  // Identify sweepers
  const sweepers = new Set();
  for (let s = 0; s < NUM_STATES; s++) {
    const idx = (s * 2 + 1) * 3;
    if (table[idx + 2] === s) sweepers.add(s);
  }

  // Track when the machine visits a boundary in a non-sweeper state
  // Record: (state, RLE of tape) as a parameterised configuration
  const configs = []; // { step, state, headSide, runs: [{val, len}] }
  const CHECK_INTERVAL = 500;
  let lastConfigStep = 0;

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

    if (head < minHead) minHead = head;
    if (head > maxHead) maxHead = head;

    if (state === HALT) return { halted: true, steps, ones: onesCount, configs, stateCounts };
    if (head < 2 || head > TAPE_SIZE - 3) return { halted: false, reason: 'overflow', steps, ones: onesCount, configs, stateCounts };

    // Capture config at boundaries
    if (steps - lastConfigStep >= CHECK_INTERVAL && !sweepers.has(state)) {
      const nearLeft = head - minHead < 3;
      const nearRight = maxHead - head < 3;
      if (nearLeft || nearRight) {
        // RLE encode
        const runs = [];
        let rv = tape[minHead], rl = 1;
        for (let i = minHead + 1; i <= maxHead; i++) {
          if (tape[i] === rv) rl++;
          else { runs.push({ v: rv, l: rl }); rv = tape[i]; rl = 1; }
        }
        runs.push({ v: rv, l: rl });

        if (configs.length < 200) {
          configs.push({
            step: steps, state, ones: onesCount,
            headSide: nearLeft ? 'L' : 'R',
            runs: runs.map(r => ({ ...r })),
            sig: runs.map(r => r.v).join(''),
            params: runs.map(r => r.l),
            span: maxHead - minHead + 1,
          });
        }
        lastConfigStep = steps;
      }
    }
  }

  return { halted: false, reason: 'step_limit', steps, ones: onesCount, configs, stateCounts };
}

/**
 * Find Collatz-like recurrences in configurations.
 * Group by (state, headSide, signature), then look at parameter evolution.
 */
function findCollatzFunction(configs) {
  const groups = new Map();
  for (const c of configs) {
    const key = `${STATE_NAMES[c.state]}_${c.headSide}_${c.sig}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }

  const results = [];
  for (const [key, cfgs] of groups) {
    if (cfgs.length < 4) continue;

    const numParams = cfgs[0].params.length;
    for (let p = 0; p < numParams; p++) {
      const vals = cfgs.map(c => c.params[p]);
      const uniqueVals = new Set(vals);
      if (uniqueVals.size < 3) continue; // need variation

      // Look for Collatz-like structure: x_{n+1} = f(x_n) where f depends on x_n mod k
      // Try moduli 2, 3, 4
      for (const mod of [2, 3, 4]) {
        const branches = {};
        let consistent = true;

        for (let i = 0; i < vals.length - 1; i++) {
          const residue = ((vals[i] % mod) + mod) % mod;
          const nextVal = vals[i + 1];

          // For this residue, compute (a, b) such that nextVal = a * floor(vals[i]/mod) + b
          const quotient = Math.floor(vals[i] / mod);
          if (quotient === 0) continue;

          if (!branches[residue]) {
            // First time seeing this residue — compute a and b
            // nextVal = a * quotient + b
            // Need at least 2 to determine a and b
            branches[residue] = { points: [] };
          }
          branches[residue].points.push({ x: quotient, y: nextVal, origX: vals[i] });
        }

        // For each residue branch, fit a linear function
        let allBranchesValid = true;
        const branchFunctions = {};

        for (const [res, data] of Object.entries(branches)) {
          if (data.points.length < 2) { allBranchesValid = false; continue; }

          // Linear regression: y = a * x + b
          const pts = data.points;
          let sx = 0, sy = 0, sxx = 0, sxy = 0;
          for (const p of pts) { sx += p.x; sy += p.y; sxx += p.x * p.x; sxy += p.x * p.y; }
          const n = pts.length;
          const denom = n * sxx - sx * sx;
          if (Math.abs(denom) < 0.001) continue;

          const a = (n * sxy - sx * sy) / denom;
          const b = (sy - a * sx) / n;

          // Check fit quality
          let maxErr = 0;
          for (const p of pts) {
            const pred = a * p.x + b;
            maxErr = Math.max(maxErr, Math.abs(pred - p.y));
          }

          branchFunctions[res] = { a, b, maxErr, nPoints: pts.length };
        }

        if (Object.keys(branchFunctions).length > 0) {
          const totalErr = Object.values(branchFunctions).reduce((s, f) => s + f.maxErr, 0);
          const avgA = Object.values(branchFunctions).reduce((s, f) => s + f.a, 0) / Object.keys(branchFunctions).length;

          results.push({
            key, param: p, mod,
            branches: branchFunctions,
            totalErr,
            avgMultiplier: avgA,
            growthRatio: avgA * mod / mod, // simplification
            values: vals,
          });
        }
      }
    }
  }

  results.sort((a, b) => a.totalErr - b.totalErr);
  return results;
}

// ═══ Main ════════════════════════════════════════════════════════════

// The ratio-2 machines from our Collatz extraction
const ratio2machines = [
  '1RB1LD_0LC0RA_1RA1LC_1RE0LC_---1RF_0RD0RB',
  '1RB1RF_1LC1RE_0LD0LC_1RD0RB_1RA0RB_1LB---',
  '1RB0LD_1RC1LE_0RD1RA_1LE0RB_0LA0RF_---1RE',
];

// Also grab ALL machines from the holdout file and find the ones
// our earlier extraction identified as ratio ≈ 2
const holdoutFile = process.argv[2] || 'data/bb6_holdouts_1214.txt';
const lines = fs.readFileSync(holdoutFile, 'utf-8').trim().split('\n');

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║   BB(6) RATIO-2 MACHINE INVESTIGATION                  ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

const STEP_LIMIT = 100_000_000;

// First, run the known ratio-2 machines with deep analysis
console.log('═══ Deep Analysis of Ratio-2 Candidates ═══\n');

for (const machine of ratio2machines) {
  const table = parseHoldout(machine);
  if (!table) continue;

  console.log(`Machine: ${machine}\n`);

  // Print transition table
  for (let s = 0; s < NUM_STATES; s++) {
    let row = `  ${STATE_NAMES[s]}: `;
    for (let sym = 0; sym < 2; sym++) {
      const idx = (s * 2 + sym) * 3;
      const w = table[idx], m = table[idx + 1] === 1 ? 'R' : 'L', n = STATE_NAMES[table[idx + 2]];
      row += `${sym}→${w}${m}${n}  `;
    }
    console.log(row);
  }
  console.log();

  const result = deepAnalyse(table, STEP_LIMIT);

  // Basic stats
  const dist = Array.from(result.stateCounts)
    .map((c, i) => ({ s: STATE_NAMES[i], p: c / result.steps * 100 }))
    .filter(x => x.p > 0.1)
    .sort((a, b) => b.p - a.p)
    .map(x => `${x.s}=${x.p.toFixed(1)}%`)
    .join(' ');

  console.log(`  Status: ${result.halted ? 'HALTED at ' + result.steps : result.reason + ' at ' + result.steps.toLocaleString()}`);
  console.log(`  Ones: ${result.ones}, Configs captured: ${result.configs.length}`);
  console.log(`  States: ${dist}`);

  // Check if tape is periodic (translated cycler check)
  if (result.configs.length > 0) {
    const lastConfig = result.configs[result.configs.length - 1];
    const tapeSig = lastConfig.sig;
    let isPeriodic = true;
    for (let period = 2; period <= 8; period++) {
      isPeriodic = true;
      for (let i = period; i < tapeSig.length; i++) {
        if (tapeSig[i] !== tapeSig[i % period]) { isPeriodic = false; break; }
      }
      if (isPeriodic) {
        console.log(`  WARNING: Tape appears periodic with period ${period} — likely translated cycler`);
        break;
      }
    }
    if (!isPeriodic) {
      console.log(`  Tape is NOT periodic — genuine candidate!`);
    }
  }

  // Find Collatz functions
  const collatz = findCollatzFunction(result.configs);
  if (collatz.length > 0) {
    console.log(`\n  Collatz-like functions found: ${collatz.length}`);
    for (const cf of collatz.slice(0, 3)) {
      console.log(`\n    Config: ${cf.key}, param ${cf.param}, mod ${cf.mod}`);
      console.log(`    Total error: ${cf.totalErr.toFixed(4)}`);

      for (const [res, fn] of Object.entries(cf.branches)) {
        // Try to express a as a simple fraction
        let aStr = fn.a.toFixed(4);
        for (const [num, den] of [[2,1],[3,1],[5,3],[4,3],[7,3],[3,2],[5,2],[7,4],[8,3]]) {
          if (Math.abs(fn.a - num / den) < 0.05) { aStr = `${num}/${den}`; break; }
        }
        console.log(`      f(${cf.mod}k+${res}) = ${aStr}·k + ${fn.b.toFixed(1)} (err=${fn.maxErr.toFixed(2)}, n=${fn.nPoints})`);
      }

      // Show parameter values
      const valsStr = cf.values.length <= 15
        ? cf.values.join(', ')
        : cf.values.slice(0, 8).join(', ') + ' ... ' + cf.values.slice(-4).join(', ');
      console.log(`    Values: [${valsStr}]`);

      // Compute successive ratios
      const ratios = [];
      for (let i = 1; i < cf.values.length; i++) {
        if (cf.values[i - 1] > 0) ratios.push(cf.values[i] / cf.values[i - 1]);
      }
      if (ratios.length > 0) {
        const lateRatios = ratios.slice(-Math.min(5, ratios.length));
        const avgRatio = lateRatios.reduce((a, b) => a + b, 0) / lateRatios.length;
        console.log(`    Late avg ratio: ${avgRatio.toFixed(4)}`);
        console.log(`    2.0 diff: ${(avgRatio - 2.0).toFixed(4)}`);
        console.log(`    5/3 diff: ${(avgRatio - 5/3).toFixed(4)}`);
      }
    }
  } else {
    console.log(`\n  No Collatz-like functions detected.`);
  }

  console.log('\n' + '─'.repeat(70) + '\n');
}

// ═══ Broader scan: find ALL ratio-2 machines ═════════════════════════

console.log('═══ Scanning All Holdouts for Ratio ≈ 2 (quick pass) ═══\n');

let ratio2count = 0;
const ratio2found = [];

for (const line of lines) {
  const table = parseHoldout(line);
  if (!table) continue;

  const result = deepAnalyse(table, 10_000_000); // quick pass
  const collatz = findCollatzFunction(result.configs);

  for (const cf of collatz) {
    // Check if any branch has multiplier near 2
    for (const [res, fn] of Object.entries(cf.branches)) {
      if (Math.abs(fn.a - 2) < 0.15 && fn.maxErr < 2 && fn.nPoints >= 3) {
        ratio2found.push({
          raw: line.trim(),
          mod: cf.mod, residue: res,
          a: fn.a, b: fn.b, err: fn.maxErr, nPoints: fn.nPoints,
          values: cf.values,
        });
        ratio2count++;
        break;
      }
    }
  }
}

console.log(`Found ${ratio2count} machines with a branch multiplier ≈ 2\n`);
for (const r of ratio2found.slice(0, 15)) {
  const ratios = [];
  for (let i = 1; i < r.values.length; i++) {
    if (r.values[i-1] > 0) ratios.push(r.values[i] / r.values[i-1]);
  }
  const avgRatio = ratios.length > 0 ? ratios.reduce((a,b)=>a+b,0)/ratios.length : 0;

  console.log(`  ${r.raw}`);
  console.log(`    f(${r.mod}k+${r.residue}) = ${r.a.toFixed(3)}·k + ${r.b.toFixed(1)}, err=${r.err.toFixed(2)}, n=${r.nPoints}, avg_ratio=${avgRatio.toFixed(3)}`);
}
