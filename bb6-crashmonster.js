/**
 * BB(6) Crash Monster — Long Run Analysis
 *
 * The top mutation candidate: B,1→1RF, F,0→1RA, F,1→1RB
 * This had 4,948 crashes in 50M steps with max 17,314 ones.
 *
 * Full table:
 *   A: 0→1RB  1→1LC
 *   B: 0→1RC  1→1RF   ← mutated: was 1RB (self-loop), now goes to F
 *   C: 0→1RD  1→0LE
 *   D: 0→1LA  1→1LD
 *   E: 0→1RH  1→0LA
 *   F: 0→1RA  1→1RB   ← new: F,0 creates + goes to A; F,1 keeps + goes to B
 *
 * Run for 500M steps to see long-term dynamics.
 * Also run the D,1 mutation variant for comparison.
 */

const NUM_STATES = 6;
const HALT = NUM_STATES;
const STATE_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'H'];

function createTable(transitions) {
  const stateMap = {};
  STATE_NAMES.forEach((n, i) => stateMap[n] = i);
  const moveMap = { 'L': 0, 'R': 1 };
  const table = new Uint8Array(NUM_STATES * 2 * 3);
  for (const [state, read, write, move, next] of transitions) {
    const idx = stateMap[state] * 2 + read;
    table[idx * 3] = write;
    table[idx * 3 + 1] = moveMap[move];
    table[idx * 3 + 2] = stateMap[next];
  }
  return table;
}

function longRun(name, table, maxSteps) {
  const TAPE_SIZE = 1048576;  // 1M cells
  const tape = new Uint8Array(TAPE_SIZE);
  const CENTER = Math.floor(TAPE_SIZE / 2);
  let head = CENTER, state = 0, steps = 0, onesCount = 0;
  let maxOnes = 0, minHead = CENTER, maxHead = CENTER;

  const stateCounts = new Float64Array(NUM_STATES);

  // Crash tracking
  const CRASH_THRESHOLD = -50;
  const CHECK_INTERVAL = 1000;
  let prevCheckOnes = 0;
  const crashes = [];
  let crashPeakOnes = 0;

  // Sampling for ones-over-time
  const SAMPLE_INTERVAL = Math.max(1, Math.floor(maxSteps / 2000));
  const samples = [];

  console.log(`\n═══ ${name} ═══\n`);

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
      if (delta < CRASH_THRESHOLD) {
        crashes.push({
          step: steps,
          ones: onesCount,
          peak: crashPeakOnes,
          loss: crashPeakOnes - onesCount,
        });
      }
      if (onesCount > crashPeakOnes) crashPeakOnes = onesCount;
      prevCheckOnes = onesCount;
    }

    // Sampling
    if (steps % SAMPLE_INTERVAL === 0) {
      samples.push({ step: steps, ones: onesCount });
    }

    // Progress
    if (steps % 50_000_000 === 0) {
      process.stdout.write(`  ${(steps / 1_000_000).toFixed(0)}M steps, ones=${onesCount}, max=${maxOnes}, crashes=${crashes.length}\r`);
    }

    if (state === HALT) {
      console.log(`  HALTED at step ${steps.toLocaleString()} with ${onesCount} ones!`);
      break;
    }
    if (head < 2 || head > TAPE_SIZE - 3) {
      console.log(`  Tape overflow at step ${steps.toLocaleString()}, ones=${onesCount}, max=${maxOnes}`);
      break;
    }
  }

  if (state !== HALT && head >= 2 && head <= TAPE_SIZE - 3) {
    console.log(`  Step limit reached at ${steps.toLocaleString()} steps`);
  }

  // Results
  const total = steps;
  const dist = Array.from(stateCounts)
    .map((c, i) => `${STATE_NAMES[i]}=${(c / total * 100).toFixed(1)}%`)
    .join(' ');

  console.log(`\n  Final: ${onesCount} ones, max ${maxOnes}`);
  console.log(`  Crashes: ${crashes.length}`);
  console.log(`  Tape span: ${maxHead - minHead + 1} cells`);
  console.log(`  State dist: ${dist}`);

  // Crash analysis
  if (crashes.length > 0) {
    console.log(`\n  Crash timeline (first 20, last 20):`);
    console.log('  Step          | Peak   | Ones   | Loss   | Loss %');
    console.log('  ──────────────┼────────┼────────┼────────┼───────');

    const toShow = crashes.length <= 40 ? crashes :
      [...crashes.slice(0, 20), null, ...crashes.slice(-20)];

    for (const c of toShow) {
      if (c === null) {
        console.log(`  ... (${crashes.length - 40} more) ...`);
        continue;
      }
      const lossPct = c.peak > 0 ? (c.loss / c.peak * 100).toFixed(1) : '?';
      console.log(`  ${String(c.step.toLocaleString()).padStart(14)} | ${String(c.peak).padStart(6)} | ${String(c.ones).padStart(6)} | ${String(c.loss).padStart(6)} | ${lossPct}%`);
    }

    // Inter-crash intervals
    if (crashes.length >= 3) {
      console.log('\n  Inter-crash interval analysis:');
      const intervals = [];
      for (let i = 1; i < crashes.length; i++) {
        intervals.push(crashes[i].step - crashes[i - 1].step);
      }

      // Ratios of consecutive intervals
      const ratios = [];
      for (let i = 1; i < intervals.length; i++) {
        if (intervals[i - 1] > 0) ratios.push(intervals[i] / intervals[i - 1]);
      }

      if (ratios.length > 5) {
        const earlyRatios = ratios.slice(0, 5);
        const lateRatios = ratios.slice(-5);
        console.log(`    Early interval ratios: ${earlyRatios.map(r => r.toFixed(3)).join(', ')}`);
        console.log(`    Late interval ratios:  ${lateRatios.map(r => r.toFixed(3)).join(', ')}`);
        const avgLate = lateRatios.reduce((a, b) => a + b, 0) / lateRatios.length;
        console.log(`    Late average ratio:    ${avgLate.toFixed(6)}`);
        console.log(`    6/3 = 2.0:             ${(avgLate - 2.0).toFixed(6)} diff`);
        console.log(`    5/3 = 1.667:           ${(avgLate - 5/3).toFixed(6)} diff`);
      }

      // Loss fraction trend
      const lossFracs = crashes.filter(c => c.peak > 0).map(c => c.loss / c.peak);
      if (lossFracs.length > 5) {
        const earlyLoss = lossFracs.slice(0, 5);
        const lateLoss = lossFracs.slice(-5);
        console.log(`\n    Early loss fractions: ${earlyLoss.map(f => f.toFixed(3)).join(', ')}`);
        console.log(`    Late loss fractions:  ${lateLoss.map(f => f.toFixed(3)).join(', ')}`);
        const avgLateLoss = lateLoss.reduce((a, b) => a + b, 0) / lateLoss.length;
        console.log(`    Late avg loss frac:   ${avgLateLoss.toFixed(6)}`);
        console.log(`    2/3 = 0.667:          ${(avgLateLoss - 2/3).toFixed(6)} diff`);
        console.log(`    1/3 = 0.333:          ${(avgLateLoss - 1/3).toFixed(6)} diff`);
      }

      // Peak growth
      const peakGrowths = [];
      for (let i = 1; i < crashes.length; i++) {
        if (crashes[i - 1].peak > 0) {
          peakGrowths.push(crashes[i].peak / crashes[i - 1].peak);
        }
      }
      if (peakGrowths.length > 5) {
        const latePG = peakGrowths.slice(-5);
        const avgPG = latePG.reduce((a, b) => a + b, 0) / latePG.length;
        console.log(`\n    Late peak growth ratio: ${avgPG.toFixed(6)}`);
        console.log(`    6/3 = 2.0:              ${(avgPG - 2.0).toFixed(6)} diff`);
        console.log(`    5/3 = 1.667:            ${(avgPG - 5/3).toFixed(6)} diff`);
      }
    }
  }

  // Ones growth summary
  if (samples.length > 10) {
    console.log('\n  Ones over time (sampled):');
    console.log('  Step (M)     | Ones     | Max Ones');
    console.log('  ─────────────┼──────────┼─────────');
    const sampleRate = Math.max(1, Math.floor(samples.length / 20));
    for (let i = 0; i < samples.length; i += sampleRate) {
      const s = samples[i];
      console.log(`  ${(s.step / 1_000_000).toFixed(1).padStart(11)}M | ${String(s.ones).padStart(8)} | ${String(maxOnes).padStart(8)}`);
    }
  }
}

// ═══ Machine 1: B,1 mutation (4948 crashes) ══════════════════════════

const machine1 = createTable([
  ['A', 0, 1, 'R', 'B'], ['A', 1, 1, 'L', 'C'],
  ['B', 0, 1, 'R', 'C'], ['B', 1, 1, 'R', 'F'],  // mutated
  ['C', 0, 1, 'R', 'D'], ['C', 1, 0, 'L', 'E'],
  ['D', 0, 1, 'L', 'A'], ['D', 1, 1, 'L', 'D'],
  ['E', 0, 1, 'R', 'H'], ['E', 1, 0, 'L', 'A'],
  ['F', 0, 1, 'R', 'A'], ['F', 1, 1, 'R', 'B'],
]);

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║   BB(6) CRASH MONSTER — 500M Step Long Run             ║');
console.log('╚══════════════════════════════════════════════════════════╝');

console.log('\nMachine 1 table:');
console.log('  A: 0→1RB  1→1LC');
console.log('  B: 0→1RC  1→1RF  ← mutated (was 1RB)');
console.log('  C: 0→1RD  1→0LE');
console.log('  D: 0→1LA  1→1LD');
console.log('  E: 0→1RH  1→0LA');
console.log('  F: 0→1RA  1→1RB  ← new state');

longRun('Machine 1: B,1→1RF (top crasher)', machine1, 500_000_000);

// ═══ Machine 2: D,1 mutation (3736 crashes, all 6 states) ═══════════

const machine2 = createTable([
  ['A', 0, 1, 'R', 'B'], ['A', 1, 1, 'L', 'C'],
  ['B', 0, 1, 'R', 'C'], ['B', 1, 1, 'R', 'B'],
  ['C', 0, 1, 'R', 'D'], ['C', 1, 0, 'L', 'E'],
  ['D', 0, 1, 'L', 'A'], ['D', 1, 1, 'L', 'F'],  // mutated
  ['E', 0, 1, 'R', 'H'], ['E', 1, 0, 'L', 'A'],
  ['F', 0, 0, 'L', 'A'], ['F', 1, 1, 'L', 'B'],  // gap-maker on F,0
]);

console.log('\n\nMachine 2 table:');
console.log('  A: 0→1RB  1→1LC');
console.log('  B: 0→1RC  1→1RB');
console.log('  C: 0→1RD  1→0LE');
console.log('  D: 0→1LA  1→1LF  ← mutated (was 1LD)');
console.log('  E: 0→1RH  1→0LA');
console.log('  F: 0→0LA  1→1LB  ← new state');

longRun('Machine 2: D,1→1LF (6-state crasher)', machine2, 500_000_000);
