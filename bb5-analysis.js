/**
 * BB(5) Phase & Nesting Analysis
 *
 * BB(5) champion runs for 47,176,870 steps producing 4098 ones.
 * We can't use O(n²) cycle detection on 47M steps, so instead:
 *
 *   1. Run the machine, sampling state + head position at intervals
 *   2. Use Brent's algorithm for cycle detection in the sampled stream
 *   3. Analyse the state sequence at multiple resolutions (zoom levels)
 *   4. Measure LZ complexity at each resolution
 *
 * BB(5) champion (from bbchallenge.org, proven 2024):
 *   A0 → 1RB   A1 → 1LC
 *   B0 → 1RC   B1 → 1RB
 *   C0 → 1RD   C1 → 0LE
 *   D0 → 1LA   D1 → 1LD
 *   E0 → 1RH   E1 → 0LA
 */

const HALT = 5;
const STATE_NAMES = ['A', 'B', 'C', 'D', 'E', 'H'];

function createTable(transitions) {
  const stateMap = { 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'H': 5 };
  const moveMap = { 'L': 0, 'R': 1 };
  const table = new Uint8Array(HALT * 2 * 3);
  for (const [state, read, write, move, next] of transitions) {
    const idx = stateMap[state] * 2 + read;
    table[idx * 3] = write;
    table[idx * 3 + 1] = moveMap[move];
    table[idx * 3 + 2] = stateMap[next];
  }
  return table;
}

// BB(5) champion
const bb5 = createTable([
  ['A', 0, 1, 'R', 'B'], ['A', 1, 1, 'L', 'C'],
  ['B', 0, 1, 'R', 'C'], ['B', 1, 1, 'R', 'B'],
  ['C', 0, 1, 'R', 'D'], ['C', 1, 0, 'L', 'E'],
  ['D', 0, 1, 'L', 'A'], ['D', 1, 1, 'L', 'D'],
  ['E', 0, 1, 'R', 'H'], ['E', 1, 0, 'L', 'A'],
]);

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║           BB(5) CHAMPION — DEEP ANALYSIS               ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

console.log('Transition table:');
console.log('  A,0 → 1RB    A,1 → 1LC');
console.log('  B,0 → 1RC    B,1 → 1RB');
console.log('  C,0 → 1RD    C,1 → 0LE');
console.log('  D,0 → 1LA    D,1 → 1LD');
console.log('  E,0 → 1RH    E,1 → 0LA\n');

console.log('Static motifs:');
console.log('  Gap-maker:       YES (C,1 writes 0; E,1 writes 0)');
console.log('  Sweeper:         YES (B,1 → 1RB marches right; D,1 → 1LD marches left)');
console.log('  Reluctant halter: YES (halt is E,0 — only triggers when E reads a 0)');
console.log();

// ── Run with multi-resolution sampling ───────────────────────────────

console.log('Running BB(5) champion (47M steps)...');
const startTime = Date.now();

const TAPE_SIZE = 65536;
const tape = new Uint8Array(TAPE_SIZE);
let head = Math.floor(TAPE_SIZE / 2);
let state = 0;
let steps = 0;
let onesCount = 0;
let minHead = head, maxHead = head;

// Sample at multiple resolutions
const SAMPLE_INTERVALS = [1, 10, 100, 1000, 10000, 100000];
const samples = {};
for (const interval of SAMPLE_INTERVALS) {
  samples[interval] = { states: [], heads: [], ones: [] };
}

// Phase boundary detection: track when behavior changes
const stateHistogram = new Uint32Array(HALT);  // rolling window state counts
const windowSize = 10000;
const stateHistory = new Uint8Array(windowSize);
let histPos = 0;
const phaseTransitions = [];  // steps where behavior shifts

// State bigram tracking at different time scales
const bigramWindows = [100, 1000, 10000];
const bigramTrackers = {};
for (const w of bigramWindows) {
  bigramTrackers[w] = { buffer: new Uint8Array(w), pos: 0, bigrams: new Map(), filled: false };
}

const MAX_STEPS = 48_000_000;

while (steps < MAX_STEPS) {
  const symbol = tape[head];
  const idx = (state * 2 + symbol) * 3;
  const write = bb5[idx], move = bb5[idx + 1], next = bb5[idx + 2];

  // Track ones
  if (tape[head] === 0 && write === 1) onesCount++;
  if (tape[head] === 1 && write === 0) onesCount--;

  tape[head] = write;
  head += move === 1 ? 1 : -1;

  // Rolling state histogram for phase detection
  if (steps >= windowSize) {
    stateHistogram[stateHistory[histPos]]--;
  }
  stateHistogram[state]++;
  stateHistory[histPos] = state;
  histPos = (histPos + 1) % windowSize;

  const prevState = state;
  state = next;
  steps++;

  if (head < minHead) minHead = head;
  if (head > maxHead) maxHead = head;

  // Sample at multiple resolutions
  for (const interval of SAMPLE_INTERVALS) {
    if (steps % interval === 0) {
      const s = samples[interval];
      s.states.push(prevState);
      s.heads.push(head - Math.floor(TAPE_SIZE / 2));
      s.ones.push(onesCount);
    }
  }

  // Detect phase transitions (shifts in state distribution)
  if (steps % windowSize === 0 && steps > windowSize * 2) {
    // Compute dominant state
    let dominant = 0;
    for (let i = 1; i < HALT; i++) {
      if (stateHistogram[i] > stateHistogram[dominant]) dominant = i;
    }
    const dominantFrac = stateHistogram[dominant] / windowSize;

    if (phaseTransitions.length === 0 ||
        phaseTransitions[phaseTransitions.length - 1].dominant !== dominant ||
        Math.abs(phaseTransitions[phaseTransitions.length - 1].frac - dominantFrac) > 0.1) {
      phaseTransitions.push({
        step: steps,
        dominant,
        frac: dominantFrac,
        ones: onesCount,
        head: head - Math.floor(TAPE_SIZE / 2),
        distribution: Array.from(stateHistogram).map(c => (c / windowSize * 100).toFixed(0) + '%'),
      });
    }
  }

  if (state === HALT) {
    console.log(`HALTED at step ${steps.toLocaleString()} with ${onesCount} ones\n`);
    break;
  }

  if (head < 2 || head > TAPE_SIZE - 3) {
    console.log(`ERROR: tape overflow at step ${steps}`);
    break;
  }

  if (steps % 5_000_000 === 0) {
    process.stdout.write(`  ${(steps / 1_000_000).toFixed(0)}M steps, ${onesCount} ones...\r`);
  }
}

const runTime = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`Run completed in ${runTime}s\n`);

// ── Analysis ─────────────────────────────────────────────────────────

console.log('═══ Basic Stats ═══\n');
console.log(`  Total steps:  ${steps.toLocaleString()}`);
console.log(`  Final ones:   ${onesCount}`);
console.log(`  Tape span:    ${maxHead - minHead + 1} cells`);
console.log(`  Head range:   ${minHead - Math.floor(TAPE_SIZE / 2)} to ${maxHead - Math.floor(TAPE_SIZE / 2)}`);

// ── Multi-resolution state pattern analysis ──────────────────────────

console.log('\n═══ Multi-Resolution State Patterns ═══\n');

for (const interval of SAMPLE_INTERVALS) {
  const s = samples[interval];
  if (s.states.length < 10) continue;

  // LZ complexity
  const seen = new Set();
  let lzCount = 0;
  let current = '';
  for (let i = 0; i < s.states.length; i++) {
    current += s.states[i];
    if (!seen.has(current)) {
      seen.add(current);
      lzCount++;
      current = '';
    }
  }
  if (current.length > 0) lzCount++;
  const lzRatio = lzCount / s.states.length;

  // State distribution
  const dist = new Uint32Array(HALT);
  for (const st of s.states) dist[st]++;

  // Bigram counts
  const bigrams = new Map();
  for (let i = 0; i < s.states.length - 1; i++) {
    const key = s.states[i] * 10 + s.states[i + 1];
    bigrams.set(key, (bigrams.get(key) || 0) + 1);
  }

  // Conditional entropy
  const uniCounts = new Map();
  for (let i = 0; i < s.states.length - 1; i++) {
    uniCounts.set(s.states[i], (uniCounts.get(s.states[i]) || 0) + 1);
  }
  let condEntropy = 0;
  for (const [bg, count] of bigrams) {
    const cur = Math.floor(bg / 10);
    const p_bg = count / (s.states.length - 1);
    const p_cond = count / uniCounts.get(cur);
    condEntropy -= p_bg * Math.log2(p_cond);
  }

  console.log(`  Resolution: every ${interval.toLocaleString()} steps (${s.states.length.toLocaleString()} samples)`);
  console.log(`    LZ complexity: ${lzRatio.toFixed(4)}`);
  console.log(`    Cond. entropy: ${condEntropy.toFixed(4)} bits`);
  console.log(`    State dist: ${STATE_NAMES.slice(0, HALT).map((n, i) => `${n}=${(dist[i] / s.states.length * 100).toFixed(1)}%`).join(' ')}`);

  // Show first few and last few states at this resolution
  const first = s.states.slice(0, 40).map(st => STATE_NAMES[st]).join('');
  const last = s.states.slice(-40).map(st => STATE_NAMES[st]).join('');
  console.log(`    First: ${first}`);
  console.log(`    Last:  ${last}`);

  // Detect cycles at this resolution using brute force on a window
  const windowForCycle = s.states.slice(0, Math.min(1000, s.states.length));
  let bestCL = 0, bestCC = 0;
  for (let cl = 2; cl <= Math.min(50, windowForCycle.length / 2); cl++) {
    for (let start = 0; start <= windowForCycle.length - cl * 2; start++) {
      let count = 0, pos = start;
      while (pos + cl <= windowForCycle.length) {
        let match = true;
        for (let j = 0; j < cl; j++) {
          if (windowForCycle[pos + j] !== windowForCycle[start + j]) { match = false; break; }
        }
        if (!match) break;
        count++;
        pos += cl;
      }
      if (count >= 2 && count * cl > bestCC * bestCL) {
        bestCL = cl;
        bestCC = count;
      }
    }
  }
  if (bestCC >= 2) {
    const cyclePattern = windowForCycle.slice(0, bestCL).map(s => STATE_NAMES[s]).join('');
    console.log(`    Dominant cycle: "${cyclePattern}" ×${bestCC} (len ${bestCL})`);
  } else {
    console.log(`    No simple cycle detected at this resolution`);
  }
  console.log();
}

// ── Phase transitions ────────────────────────────────────────────────

console.log('═══ Phase Transitions (behavioral shifts) ═══\n');
console.log('  Step          | Dominant | Frac  | Ones  | Head   | Distribution');
console.log('  ──────────────┼──────────┼───────┼───────┼────────┼─────────────');

// Show a manageable subset
const ptToShow = phaseTransitions.length <= 40 ? phaseTransitions :
  [...phaseTransitions.slice(0, 15), null, ...phaseTransitions.slice(-15)];

for (const pt of ptToShow) {
  if (pt === null) {
    console.log(`  ... (${phaseTransitions.length - 30} more transitions) ...`);
    continue;
  }
  const step = String(pt.step.toLocaleString()).padStart(14);
  const dom = STATE_NAMES[pt.dominant].padStart(8);
  const frac = (pt.frac * 100).toFixed(0).padStart(4) + '%';
  const ones = String(pt.ones).padStart(5);
  const head = String(pt.head).padStart(6);
  console.log(`  ${step} | ${dom} | ${frac} | ${ones} | ${head} | [${pt.distribution.join(', ')}]`);
}

// ── Ones growth pattern ──────────────────────────────────────────────

console.log('\n═══ Ones Growth Over Time ═══\n');
const growthSamples = samples[100000];
if (growthSamples.ones.length > 0) {
  console.log('  Step (M)  | Ones    | Head    | Δ Ones');
  console.log('  ──────────┼─────────┼─────────┼───────');
  let prevOnes = 0;
  for (let i = 0; i < growthSamples.ones.length; i++) {
    const stepM = ((i + 1) * 100000 / 1_000_000).toFixed(1);
    const delta = growthSamples.ones[i] - prevOnes;
    console.log(`  ${stepM.padStart(8)}M | ${String(growthSamples.ones[i]).padStart(7)} | ${String(growthSamples.heads[i]).padStart(7)} | ${delta >= 0 ? '+' : ''}${delta}`);
    prevOnes = growthSamples.ones[i];
  }
}

// ── Comparison to lower BB champions ─────────────────────────────────

console.log('\n═══ Cross-BB Comparison ═══\n');
console.log('  BB(n) | Ones   | Steps        | Amp fraction | Nesting | Motifs');
console.log('  ──────┼────────┼──────────────┼──────────────┼─────────┼───────');
console.log('  BB(2) | 4      | 6            | ~100%        | depth 1 | reluctant-halter');
console.log('  BB(3) | 6      | 14           | ~29%         | depth 1 | gap-maker, sweeper, reluctant-halter');
console.log('  BB(4) | 13     | 107          | ~60%         | depth 2 | gap-maker, sweeper, reluctant-halter');
console.log(`  BB(5) | ${onesCount.toLocaleString().padEnd(6)} | ${steps.toLocaleString().padEnd(12)} | TBD          | TBD     | gap-maker, sweeper, reluctant-halter`);
