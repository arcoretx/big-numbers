/**
 * Amplification Nesting Depth Analysis
 *
 * Measures two things for every halting 3-state machine:
 *   1. Nesting depth — recursive cycle-within-cycle detection
 *   2. Compression ratio — how compressible is the state sequence
 *
 * Tests the hypothesis: deeper nesting → higher scores
 */

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
  let head = 128, state = 0, steps = 0;
  let minHead = head, maxHead = head;
  const stateSeq = new Uint8Array(maxSteps + 1);

  while (steps < maxSteps) {
    const symbol = tape[head];
    const idx = (state * 2 + symbol) * 3;
    const write = table[idx], move = table[idx + 1], next = table[idx + 2];
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
    if (head < 2 || head > 253) return { halted: false };
  }
  return { halted: false };
}

// ── Recursive Nesting Depth Detection ────────────────────────────────
//
// Strategy:
//   1. Find the dominant cycle in the state sequence
//   2. Extract ONE instance of that cycle
//   3. Recursively look for cycles WITHIN that cycle
//   4. Depth = 1 + depth of the sub-cycle (or 0 if no cycle found)

function findDominantCycle(stateSeq, start, length) {
  if (length < 4) return null;

  let bestCycleLen = 0, bestCycleCount = 0, bestCycleStart = 0;

  const maxCycleLen = Math.min(Math.floor(length / 2), 30);
  for (let cycleLen = 2; cycleLen <= maxCycleLen; cycleLen++) {
    for (let s = 0; s <= length - cycleLen * 2; s++) {
      let count = 0, pos = s;
      while (pos + cycleLen <= length) {
        let match = true;
        for (let j = 0; j < cycleLen; j++) {
          if (stateSeq[start + pos + j] !== stateSeq[start + s + j]) { match = false; break; }
        }
        if (!match) break;
        count++;
        pos += cycleLen;
      }
      if (count >= 2 && count * cycleLen > bestCycleCount * bestCycleLen) {
        bestCycleLen = cycleLen;
        bestCycleCount = count;
        bestCycleStart = s;
      }
    }
  }

  if (bestCycleCount >= 2) {
    return {
      relativeStart: bestCycleStart,
      cycleLen: bestCycleLen,
      cycleCount: bestCycleCount,
      pattern: Array.from(stateSeq.slice(start + bestCycleStart, start + bestCycleStart + bestCycleLen))
        .map(s => STATE_NAMES[s]).join(''),
    };
  }
  return null;
}

function measureNestingDepth(stateSeq, start, length, maxDepth = 5) {
  const cycle = findDominantCycle(stateSeq, start, length);
  if (!cycle) return { depth: 0, structure: null };

  // Recurse into one instance of the cycle
  const subResult = measureNestingDepth(
    stateSeq,
    start + cycle.relativeStart,
    cycle.cycleLen,
    maxDepth - 1
  );

  return {
    depth: 1 + subResult.depth,
    structure: {
      pattern: cycle.pattern,
      reps: cycle.cycleCount,
      len: cycle.cycleLen,
      sub: subResult.structure,
    },
  };
}

// ── Compression Ratio ────────────────────────────────────────────────
// Run-length encoding on the state sequence as a simple compression proxy.
// More structured sequences compress better.

function compressionRatio(stateSeq, length) {
  if (length <= 1) return 1.0;

  // Method 1: Run-length encoding of state sequence
  let rleLength = 0;
  let i = 0;
  while (i < length) {
    let j = i + 1;
    while (j < length && stateSeq[j] === stateSeq[i]) j++;
    rleLength++;  // one entry for this run
    i = j;
  }

  // Method 2: Bigram entropy — how predictable is the next state?
  // Count transitions between states
  const bigramCounts = new Map();
  const unigramCounts = new Map();
  for (let i = 0; i < length - 1; i++) {
    const key = stateSeq[i] * 10 + stateSeq[i + 1];
    bigramCounts.set(key, (bigramCounts.get(key) || 0) + 1);
    unigramCounts.set(stateSeq[i], (unigramCounts.get(stateSeq[i]) || 0) + 1);
  }

  // Conditional entropy H(next | current)
  let condEntropy = 0;
  for (const [bigram, count] of bigramCounts) {
    const current = Math.floor(bigram / 10);
    const p_bigram = count / (length - 1);
    const p_cond = count / unigramCounts.get(current);
    condEntropy -= p_bigram * Math.log2(p_cond);
  }

  // Method 3: LZ-style — count unique substrings (Lempel-Ziv complexity)
  const seen = new Set();
  let lzCount = 0;
  let current = '';
  for (let i = 0; i < length; i++) {
    current += stateSeq[i];
    if (!seen.has(current)) {
      seen.add(current);
      lzCount++;
      current = '';
    }
  }
  if (current.length > 0) lzCount++;

  return {
    rleRatio: rleLength / length,       // lower = more runs of same state
    condEntropy,                         // lower = more predictable transitions
    lzComplexity: lzCount / length,     // lower = more compressible
  };
}

// ── Main Analysis ────────────────────────────────────────────────────

function analyse(numStates, maxSteps) {
  initStates(numStates);
  const nextStates = numStates + 1;
  const numEntries = numStates * 2;
  const optionsPerEntry = 2 * 2 * nextStates;
  const totalMachines = Math.pow(optionsPerEntry, numEntries);

  console.log(`\nNesting depth analysis for ${numStates}-state machines...`);
  console.log(`Total machines: ${totalMachines.toLocaleString()}\n`);

  // Accumulators by nesting depth
  const depthStats = {};  // depth → { count, totalOnes, maxOnes, maxSteps, examples[] }

  // Accumulators for compression vs score
  const compressionBuckets = {};  // bucket → { count, totalOnes, maxOnes }
  for (let i = 0; i <= 10; i++) {
    compressionBuckets[i] = { count: 0, totalOnes: 0, maxOnes: 0 };
  }

  // Entropy buckets
  const entropyBuckets = {};
  for (let i = 0; i <= 20; i++) {
    entropyBuckets[i] = { count: 0, totalOnes: 0, maxOnes: 0 };
  }

  // LZ complexity buckets
  const lzBuckets = {};
  for (let i = 0; i <= 10; i++) {
    lzBuckets[i] = { count: 0, totalOnes: 0, maxOnes: 0 };
  }

  // Cross-analysis: depth × score
  const depthScoreMatrix = {};  // "depth-ones" → count

  const table = new Uint8Array(numEntries * 3);
  const counter = new Uint8Array(numEntries);
  const progressInterval = Math.floor(totalMachines / 20);
  let processed = 0;

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

    let hasHalt = false;
    for (let i = 0; i < numEntries; i++) {
      if (table[i * 3 + 2] === HALT) { hasHalt = true; break; }
    }
    if (!hasHalt) continue;

    const result = fastRun(table, maxSteps);
    if (!result.halted) continue;

    // Nesting depth
    const nesting = measureNestingDepth(result.stateSeq, 0, result.steps);
    const depth = nesting.depth;

    if (!depthStats[depth]) {
      depthStats[depth] = { count: 0, totalOnes: 0, maxOnes: 0, maxSteps: 0, examples: [] };
    }
    const ds = depthStats[depth];
    ds.count++;
    ds.totalOnes += result.ones;
    if (result.ones > ds.maxOnes) ds.maxOnes = result.ones;
    if (result.steps > ds.maxSteps) ds.maxSteps = result.steps;

    // Keep top examples per depth
    if (ds.examples.length < 5 || result.ones > ds.examples[ds.examples.length - 1].ones) {
      ds.examples.push({
        ones: result.ones,
        steps: result.steps,
        structure: nesting.structure,
        seq: Array.from(result.stateSeq.slice(0, Math.min(result.steps, 60)))
          .map(s => STATE_NAMES[s]).join(''),
      });
      ds.examples.sort((a, b) => b.ones - a.ones);
      if (ds.examples.length > 5) ds.examples.length = 5;
    }

    // Depth × score matrix
    const key = `${depth}-${result.ones}`;
    depthScoreMatrix[key] = (depthScoreMatrix[key] || 0) + 1;

    // Compression metrics (only for machines with enough steps to be meaningful)
    if (result.steps >= 4) {
      const comp = compressionRatio(result.stateSeq, result.steps);

      // LZ complexity bucket
      const lzBucket = Math.min(10, Math.floor(comp.lzComplexity * 10));
      lzBuckets[lzBucket].count++;
      lzBuckets[lzBucket].totalOnes += result.ones;
      if (result.ones > lzBuckets[lzBucket].maxOnes) lzBuckets[lzBucket].maxOnes = result.ones;

      // Entropy bucket
      const entBucket = Math.min(20, Math.floor(comp.condEntropy * 10));
      if (!entropyBuckets[entBucket]) entropyBuckets[entBucket] = { count: 0, totalOnes: 0, maxOnes: 0 };
      entropyBuckets[entBucket].count++;
      entropyBuckets[entBucket].totalOnes += result.ones;
      if (result.ones > entropyBuckets[entBucket].maxOnes) entropyBuckets[entBucket].maxOnes = result.ones;

      // RLE ratio bucket
      const rleBucket = Math.min(10, Math.floor(comp.rleRatio * 10));
      compressionBuckets[rleBucket].count++;
      compressionBuckets[rleBucket].totalOnes += result.ones;
      if (result.ones > compressionBuckets[rleBucket].maxOnes) compressionBuckets[rleBucket].maxOnes = result.ones;
    }
  } while (incrementCounter());

  // ── Results ──────────────────────────────────────────────────────

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║        NESTING DEPTH & COMPRESSION ANALYSIS            ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Depth statistics
  console.log('═══ Nesting Depth vs Performance ═══\n');
  console.log('  Depth | Count        | Avg Ones | Max Ones | Max Steps');
  console.log('  ──────┼──────────────┼──────────┼──────────┼──────────');
  for (const [depth, stats] of Object.entries(depthStats).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const avg = (stats.totalOnes / stats.count).toFixed(3);
    console.log(`  ${String(depth).padStart(4)}  | ${String(stats.count.toLocaleString()).padStart(12)} | ${String(avg).padStart(8)} | ${String(stats.maxOnes).padStart(8)} | ${String(stats.maxSteps).padStart(8)}`);
  }

  // Depth × Score matrix
  console.log('\n═══ Depth × Score Matrix (machine count) ═══\n');
  const maxOnesAll = Math.max(...Object.keys(depthScoreMatrix).map(k => Number(k.split('-')[1])));
  const maxDepthAll = Math.max(...Object.keys(depthScoreMatrix).map(k => Number(k.split('-')[0])));
  process.stdout.write('         ');
  for (let o = 0; o <= maxOnesAll; o++) process.stdout.write(` ${String(o).padStart(8)} ones`);
  console.log();
  for (let d = 0; d <= maxDepthAll; d++) {
    process.stdout.write(`  d=${d}    `);
    for (let o = 0; o <= maxOnesAll; o++) {
      const count = depthScoreMatrix[`${d}-${o}`] || 0;
      process.stdout.write(` ${String(count.toLocaleString()).padStart(8)}    `);
    }
    console.log();
  }

  // Best examples per depth
  console.log('\n═══ Top Machines at Each Nesting Depth ═══\n');
  for (const [depth, stats] of Object.entries(depthStats).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    console.log(`  Depth ${depth} (${stats.count.toLocaleString()} machines, max ${stats.maxOnes} ones):`);
    for (const ex of stats.examples) {
      console.log(`    ${ex.ones} ones, ${ex.steps} steps: ${ex.seq}${ex.steps > 60 ? '...' : ''}`);
      if (ex.structure) {
        let s = ex.structure;
        let indent = '      ';
        while (s) {
          console.log(`${indent}↳ cycle "${s.pattern}" ×${s.reps} (len ${s.len})`);
          s = s.sub;
          indent += '  ';
        }
      }
    }
    console.log();
  }

  // LZ Complexity vs Score
  console.log('═══ LZ Complexity vs Score (lower = more compressible) ═══\n');
  console.log('  LZ ratio  | Count      | Avg Ones | Max Ones');
  console.log('  ──────────┼────────────┼──────────┼─────────');
  for (let i = 0; i <= 10; i++) {
    const b = lzBuckets[i];
    if (b.count === 0) continue;
    const avg = (b.totalOnes / b.count).toFixed(3);
    console.log(`  ${(i/10).toFixed(1)}-${((i+1)/10).toFixed(1)}   | ${String(b.count.toLocaleString()).padStart(10)} | ${String(avg).padStart(8)} | ${String(b.maxOnes).padStart(8)}`);
  }

  // Conditional Entropy vs Score
  console.log('\n═══ Transition Entropy vs Score (lower = more predictable) ═══\n');
  console.log('  Entropy   | Count      | Avg Ones | Max Ones');
  console.log('  ──────────┼────────────┼──────────┼─────────');
  for (let i = 0; i <= 20; i++) {
    const b = entropyBuckets[i];
    if (!b || b.count === 0) continue;
    const avg = (b.totalOnes / b.count).toFixed(3);
    console.log(`  ${(i/10).toFixed(1)}-${((i+1)/10).toFixed(1)}   | ${String(b.count.toLocaleString()).padStart(10)} | ${String(avg).padStart(8)} | ${String(b.maxOnes).padStart(8)}`);
  }

  // Summary
  console.log('\n═══ Key Findings ═══\n');
  const depths = Object.entries(depthStats).sort((a, b) => Number(a[0]) - Number(b[0]));
  if (depths.length > 1) {
    const d0 = depthStats[0] || { count: 0, totalOnes: 0 };
    const d1 = depthStats[1] || { count: 0, totalOnes: 0 };
    const d0avg = d0.count ? d0.totalOnes / d0.count : 0;
    const d1avg = d1.count ? d1.totalOnes / d1.count : 0;
    console.log(`  Depth 0 avg ones: ${d0avg.toFixed(3)}`);
    console.log(`  Depth 1 avg ones: ${d1avg.toFixed(3)}`);
    if (d0avg > 0) console.log(`  Depth 1 advantage: ${(d1avg / d0avg).toFixed(1)}x`);
    if (depthStats[2]) {
      const d2avg = depthStats[2].totalOnes / depthStats[2].count;
      console.log(`  Depth 2 avg ones: ${d2avg.toFixed(3)} (${(d2avg / d0avg).toFixed(1)}x vs depth 0)`);
    }
  }
}

const numStates = parseInt(process.argv[2]) || 3;
const maxSteps = parseInt(process.argv[3]) || 200;
const start = Date.now();
analyse(numStates, maxSteps);
console.log(`\n  Completed in ${((Date.now() - start) / 1000).toFixed(1)}s`);
