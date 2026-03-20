/**
 * BB(6) B2 Deep Analysis
 *
 * B2 is a binary counter that hits 2^17+1 ones without halting.
 * Questions:
 *   1. Why doesn't it halt? (F,0 → halt, but is F,0 ever reached?)
 *   2. What is F's actual role? (All F,1 variants gave identical results)
 *   3. What's the counter mechanism?
 *   4. What modification would make it halt?
 *
 * B2 table:
 *   A: 0→1RB  1→1LC
 *   B: 0→1LD  1→1RB  (right sweeper)
 *   C: 0→1RD  1→0LE
 *   D: 0→1RE  1→1LD  (left sweeper)
 *   E: 0→1LF  1→0LA
 *   F: 0→1RH  1→0RC  (halt on F,0)
 */

const NUM_STATES = 6;
const HALT = NUM_STATES;
const STATE_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'H'];

const b2 = new Uint8Array([
  // A,0: 1RB    A,1: 1LC
  1, 1, 1,    1, 0, 2,
  // B,0: 1LD    B,1: 1RB
  1, 0, 3,    1, 1, 1,
  // C,0: 1RD    C,1: 0LE
  1, 1, 3,    0, 0, 4,
  // D,0: 1RE    D,1: 1LD
  1, 1, 4,    1, 0, 3,
  // E,0: 1LF    E,1: 0LA
  1, 0, 5,    0, 0, 0,
  // F,0: 1RH    F,1: 0RC
  1, 1, 6,    0, 1, 2,
]);

// ── Detailed trace for first N steps ─────────────────────────────────

function detailedTrace(table, maxSteps, tapeRadius = 25) {
  const TAPE_SIZE = 65536;
  const tape = new Uint8Array(TAPE_SIZE);
  const CENTER = Math.floor(TAPE_SIZE / 2);
  let head = CENTER, state = 0, steps = 0, onesCount = 0;

  const transitionCounts = new Map();
  const fVisits = [];  // every time F is entered

  console.log('═══ Execution Trace ═══\n');

  function showTape() {
    let result = '';
    for (let i = head - tapeRadius; i <= head + tapeRadius; i++) {
      if (i === head) {
        result += `[${tape[i]}]`;
      } else {
        result += tape[i];
      }
    }
    return result;
  }

  // Show initial state
  if (maxSteps <= 200) {
    console.log(`  Step ${String(steps).padStart(4)}: ${STATE_NAMES[state]} ${showTape()}  ones=${onesCount}`);
  }

  while (steps < maxSteps) {
    const symbol = tape[head];
    const idx = (state * 2 + symbol) * 3;
    const write = table[idx], move = table[idx + 1], next = table[idx + 2];

    // Count transitions
    const transKey = `${STATE_NAMES[state]},${symbol}→${write}${move === 1 ? 'R' : 'L'}${STATE_NAMES[next]}`;
    transitionCounts.set(transKey, (transitionCounts.get(transKey) || 0) + 1);

    if (tape[head] === 0 && write === 1) onesCount++;
    if (tape[head] === 1 && write === 0) onesCount--;

    tape[head] = write;
    head += move === 1 ? 1 : -1;
    state = next;
    steps++;

    // Track F visits
    if (state === 5) {  // F
      fVisits.push({
        step: steps,
        head: head - CENTER,
        symbol: tape[head],  // what F will read
        ones: onesCount,
      });
    }

    if (maxSteps <= 200) {
      const marker = (next === 5) ? ' ← F!' : '';
      console.log(`  Step ${String(steps).padStart(4)}: ${STATE_NAMES[state]} ${showTape()}  ones=${onesCount}${marker}`);
    }

    if (state === HALT) {
      console.log(`\n  HALTED at step ${steps}`);
      break;
    }

    if (head < 2 || head > TAPE_SIZE - 3) {
      console.log(`\n  Tape overflow at step ${steps}`);
      break;
    }
  }

  return { steps, onesCount, transitionCounts, fVisits, tape, head, CENTER };
}

// ── Phase 1: Short trace to understand the mechanism ─────────────────

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║       B2 DEEP ANALYSIS                                 ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

console.log('Table:');
console.log('  A: 0→1RB  1→1LC');
console.log('  B: 0→1LD  1→1RB  (right sweeper)');
console.log('  C: 0→1RD  1→0LE');
console.log('  D: 0→1RE  1→1LD  (left sweeper)');
console.log('  E: 0→1LF  1→0LA');
console.log('  F: 0→1RH  1→0RC  (halt on F,0)\n');

console.log('──── First 100 steps ────\n');
const trace1 = detailedTrace(b2, 100, 15);

// ── Phase 2: Longer run to see F visits ──────────────────────────────

console.log('\n──── Running 50,000 steps (tracking F visits) ────\n');
const trace2 = detailedTrace(b2, 50000, 15);

console.log(`\n  Total F visits: ${trace2.fVisits.length}`);
if (trace2.fVisits.length > 0) {
  console.log('\n  F visit details:');
  console.log('  Step        | Head    | F reads | Ones');
  console.log('  ────────────┼─────────┼─────────┼──────');
  for (const v of trace2.fVisits.slice(0, 30)) {
    console.log(`  ${String(v.step).padStart(11)} | ${String(v.head).padStart(7)} | ${v.symbol.toString().padStart(7)} | ${String(v.ones).padStart(5)}`);
  }
  if (trace2.fVisits.length > 30) {
    console.log(`  ... (${trace2.fVisits.length - 30} more)`);
    console.log('\n  Last 10 F visits:');
    for (const v of trace2.fVisits.slice(-10)) {
      console.log(`  ${String(v.step).padStart(11)} | ${String(v.head).padStart(7)} | ${v.symbol.toString().padStart(7)} | ${String(v.ones).padStart(5)}`);
    }
  }

  // Does F ever read a 0?
  const f0 = trace2.fVisits.filter(v => v.symbol === 0);
  const f1 = trace2.fVisits.filter(v => v.symbol === 1);
  console.log(`\n  F reads 0: ${f0.length} times (would halt!)`);
  console.log(`  F reads 1: ${f1.length} times (continues)`);

  // Inter-F-visit intervals
  if (trace2.fVisits.length >= 2) {
    console.log('\n  Inter-F-visit intervals (first 20):');
    for (let i = 1; i < Math.min(20, trace2.fVisits.length); i++) {
      const interval = trace2.fVisits[i].step - trace2.fVisits[i - 1].step;
      console.log(`    Visit ${i} → ${i + 1}: ${interval} steps`);
    }
  }
} else {
  console.log('  F is NEVER visited!');
}

// ── Transition frequency analysis ────────────────────────────────────

console.log('\n═══ Transition Frequencies ═══\n');
const sorted = Array.from(trace2.transitionCounts.entries())
  .sort((a, b) => b[1] - a[1]);
const total = Array.from(trace2.transitionCounts.values()).reduce((a, b) => a + b, 0);

for (const [trans, count] of sorted) {
  const pct = (count / total * 100).toFixed(2);
  console.log(`  ${trans.padEnd(15)} ${String(count).padStart(8)} (${pct}%)`);
}

// ── Ones growth analysis ─────────────────────────────────────────────

console.log('\n═══ Ones Growth Pattern ═══\n');

// Run longer and sample
const TAPE_SIZE = 524288;
const tape3 = new Uint8Array(TAPE_SIZE);
const C3 = Math.floor(TAPE_SIZE / 2);
let head3 = C3, state3 = 0, steps3 = 0, ones3 = 0;
const growthSamples = [];

const LONG_RUN = 800000;  // just before overflow

while (steps3 < LONG_RUN) {
  const symbol = tape3[head3];
  const idx = (state3 * 2 + symbol) * 3;
  const write = b2[idx], move = b2[idx + 1], next = b2[idx + 2];

  if (tape3[head3] === 0 && write === 1) ones3++;
  if (tape3[head3] === 1 && write === 0) ones3--;

  tape3[head3] = write;
  head3 += move === 1 ? 1 : -1;
  state3 = next;
  steps3++;

  if (steps3 % 10000 === 0) {
    growthSamples.push({ step: steps3, ones: ones3 });
  }

  if (state3 === HALT) { console.log('  HALTED!'); break; }
  if (head3 < 2 || head3 > TAPE_SIZE - 3) { console.log(`  Tape overflow at step ${steps3}, ones=${ones3}`); break; }
}

console.log('  Step (K)   | Ones     | Δ Ones  | Ratio to 2^n');
console.log('  ───────────┼──────────┼─────────┼─────────────');
let prev = 0;
for (const s of growthSamples) {
  const delta = s.ones - prev;
  // Check if ones is close to a power of 2
  const log2 = Math.log2(s.ones);
  const nearPow = Math.round(log2);
  const pow2ratio = s.ones / Math.pow(2, nearPow);
  const pow2note = Math.abs(pow2ratio - 1) < 0.01 ? ` ≈ 2^${nearPow}` : '';
  if (s.step % 50000 === 0 || pow2note) {
    console.log(`  ${(s.step / 1000).toFixed(0).padStart(8)}K | ${String(s.ones).padStart(8)} | ${(delta >= 0 ? '+' : '') + delta.toString().padStart(6)} | ${pow2note}`);
  }
  prev = s.ones;
}

// ── Tape snapshot analysis ───────────────────────────────────────────

console.log('\n═══ Tape Structure Analysis ═══\n');

// Look at the tape at different points during execution
// Run again, capturing tape snapshots
const tape4 = new Uint8Array(2048);
const C4 = 1024;
let head4 = C4, state4 = 0, steps4 = 0, ones4 = 0;
const snapshots = [10, 50, 100, 200, 500, 1000, 2000, 5000];
let snapIdx = 0;

while (steps4 < 6000 && snapIdx < snapshots.length) {
  const symbol = tape4[head4];
  const idx = (state4 * 2 + symbol) * 3;
  const write = b2[idx], move = b2[idx + 1], next = b2[idx + 2];

  if (tape4[head4] === 0 && write === 1) ones4++;
  if (tape4[head4] === 1 && write === 0) ones4--;
  tape4[head4] = write;
  head4 += move === 1 ? 1 : -1;
  state4 = next;
  steps4++;

  if (state4 === HALT) break;

  if (steps4 === snapshots[snapIdx]) {
    // Show tape around the action
    let minP = C4, maxP = C4;
    for (let i = 0; i < 2048; i++) { if (tape4[i]) { if (i < minP) minP = i; if (i > maxP) maxP = i; } }

    let tapeStr = '';
    for (let i = Math.max(0, minP - 2); i <= Math.min(2047, maxP + 2); i++) {
      if (i === head4) tapeStr += `[${tape4[i]}]`;
      else tapeStr += tape4[i];
    }

    console.log(`  Step ${steps4}: ones=${ones4}, head=${head4 - C4}, state=${STATE_NAMES[state4]}`);
    console.log(`    Tape: ${tapeStr}`);
    console.log();
    snapIdx++;
  }
}

// ── Analysis: Why doesn't F,0 trigger? ───────────────────────────────

console.log('═══ Why Doesn\'t F Halt? ═══\n');
console.log('  F,0 → 1RH (halt). For this to fire, F must read a 0.');
console.log('  E,0 → 1LF: when E reads 0, writes 1, moves LEFT, enters F.');
console.log('  So F reads whatever is one cell LEFT of where E read 0.');
console.log();
console.log('  Question: is that cell always a 1?');
console.log('  If yes, F always reads 1, does 0RC, and never halts.');
console.log('  The tape structure must guarantee a 1 is always to the left');
console.log('  of any 0 that E encounters.');
