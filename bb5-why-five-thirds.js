/**
 * BB(5) — Why 5/3?
 *
 * Analytical investigation of the 5/3 ratio.
 *
 * The machine spends 99%+ of its time in two transitions:
 *   B,1 → 1RB (sweep right through 1s)
 *   D,1 → 1LD (sweep left through 1s)
 *
 * The rare transitions (A, C, E) fire at the boundaries of the 1s region.
 * The question: why does the boundary processing produce a 5/3 growth ratio?
 *
 * Approach: trace exactly what happens at the boundaries during one
 * "normal" cycle (build phase) and one crash event.
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

const bb5 = createTable([
  ['A', 0, 1, 'R', 'B'], ['A', 1, 1, 'L', 'C'],
  ['B', 0, 1, 'R', 'C'], ['B', 1, 1, 'R', 'B'],
  ['C', 0, 1, 'R', 'D'], ['C', 1, 0, 'L', 'E'],
  ['D', 0, 1, 'L', 'A'], ['D', 1, 1, 'L', 'D'],
  ['E', 0, 1, 'R', 'H'], ['E', 1, 0, 'L', 'A'],
]);

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║       BB(5) — WHY 5/3?                                 ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

// ── Step 1: Understand the transition graph ──────────────────────────

console.log('═══ Transition Table Analysis ═══\n');
console.log('  The full table:');
console.log('  State | Read 0          | Read 1');
console.log('  ──────┼─────────────────┼─────────────────');
console.log('  A     | 1RB (create+R)  | 1LC (keep+L)');
console.log('  B     | 1RC (create+R)  | 1RB (keep+R)     ← RIGHT SWEEPER');
console.log('  C     | 1RD (create+R)  | 0LE (ERASE+L)    ← ERASER');
console.log('  D     | 1LA (create+L)  | 1LD (keep+L)     ← LEFT SWEEPER');
console.log('  E     | 1RH (HALT)      | 0LA (ERASE+L)    ← ERASER');
console.log();

console.log('  State transition graph (on 1s vs 0s):\n');
console.log('  On reading 1 (inside the ones region):');
console.log('    A →(1L)→ C');
console.log('    B →(1R)→ B  (self-loop: sweep right)');
console.log('    C →(0L)→ E  (ERASE! this is the key destructive transition)');
console.log('    D →(1L)→ D  (self-loop: sweep left)');
console.log('    E →(0L)→ A  (ERASE! second destructive transition)');
console.log();
console.log('  On reading 0 (at the edge of ones region):');
console.log('    A →(1R)→ B  (extend right boundary, start right sweep)');
console.log('    B →(1R)→ C  (extend right boundary, enter eraser-chain)');
console.log('    C →(1R)→ D  (extend right boundary, start left sweep)');
console.log('    D →(1L)→ A  (extend left boundary, cycle back to A)');
console.log('    E →(1R)→ H  (HALT)');
console.log();

// ── Step 2: Trace the boundary behavior ──────────────────────────────

console.log('═══ Boundary Cycle Analysis ═══\n');
console.log('When B sweeps right and hits a 0 (right boundary):');
console.log('  B reads 0 → writes 1, goes R, becomes C    (+1 one, boundary extended)');
console.log('  C reads 0 → writes 1, goes R, becomes D    (+1 one, boundary extended)');
console.log('  D now sweeps LEFT through all the 1s...');
console.log('  D reads 0 → writes 1, goes L, becomes A    (+1 one, left boundary extended)');
console.log('  A reads 1 → writes 1, goes L, becomes C    (no net change)');
console.log('  C reads 1 → writes 0, goes L, becomes E    (-1 one! ERASED!)');
console.log('  E reads 1 → writes 0, goes L, becomes A    (-1 one! ERASED!)');
console.log('  A reads 1 → writes 1, goes L, becomes C    (no net change)');
console.log('  C reads 1 → writes 0, goes L, becomes E    (-1 one! ERASED!)');
console.log('  ... this ACE erasure chain continues until it hits a 0...');
console.log('  E reads 0 → HALT (but only if this is the FINAL crash)');
console.log('  OR: A reads 0 → writes 1, goes R, becomes B (+1 one, new right sweep begins)');
console.log();

console.log('═══ Counting Creates vs Erases in One Boundary Event ═══\n');

// Let's actually trace what happens during a single boundary interaction
// Run the machine and capture detailed boundary events

const TAPE_SIZE = 65536;
const TAPE_CENTER = Math.floor(TAPE_SIZE / 2);
const tape = new Uint8Array(TAPE_SIZE);
let head = TAPE_CENTER;
let state = 0;
let steps = 0;
let onesCount = 0;

// Track "boundary events" — sequences of non-sweeper transitions
const boundaryEvents = [];
let currentEvent = null;
let lastSweepEnd = 0;

const MAX_STEPS = 200000; // enough to see several cycles

while (steps < MAX_STEPS) {
  const symbol = tape[head];
  const idx = (state * 2 + symbol) * 3;
  const write = bb5[idx], move = bb5[idx + 1], next = bb5[idx + 2];

  const isSweeper = (state === 1 && symbol === 1) || (state === 3 && symbol === 1); // B,1 or D,1

  if (!isSweeper) {
    if (!currentEvent) {
      currentEvent = {
        startStep: steps,
        transitions: [],
        creates: 0,
        erases: 0,
        onesAtStart: onesCount,
      };
    }
    const creating = symbol === 0 && write === 1;
    const erasing = symbol === 1 && write === 0;
    currentEvent.transitions.push({
      state: STATE_NAMES[state],
      symbol,
      write,
      move: move === 1 ? 'R' : 'L',
      next: STATE_NAMES[next],
      creating,
      erasing,
    });
    if (creating) currentEvent.creates++;
    if (erasing) currentEvent.erases++;
  } else if (currentEvent) {
    currentEvent.endStep = steps;
    currentEvent.onesAtEnd = onesCount;
    currentEvent.netChange = currentEvent.creates - currentEvent.erases;
    currentEvent.sweepsBetween = steps - lastSweepEnd;
    boundaryEvents.push(currentEvent);
    currentEvent = null;
  }

  if (!isSweeper && currentEvent === null) {
    // single non-sweeper step
  }

  if (isSweeper) {
    lastSweepEnd = steps;
  }

  if (tape[head] === 0 && write === 1) onesCount++;
  if (tape[head] === 1 && write === 0) onesCount--;

  tape[head] = write;
  head += move === 1 ? 1 : -1;
  state = next;
  steps++;

  if (state === HALT) break;
  if (head < 2 || head > TAPE_SIZE - 3) break;
}

console.log(`Ran ${steps.toLocaleString()} steps, captured ${boundaryEvents.length} boundary events\n`);

// Show first ~20 boundary events
console.log('═══ Boundary Events (first 30) ═══\n');
console.log('  #  | Step      | Creates | Erases | Net | Ones After | Sequence');
console.log('  ───┼───────────┼─────────┼────────┼─────┼────────────┼─────────');
for (let i = 0; i < Math.min(30, boundaryEvents.length); i++) {
  const e = boundaryEvents[i];
  const seq = e.transitions.map(t => {
    let marker = '';
    if (t.creating) marker = '+';
    if (t.erasing) marker = '-';
    return `${marker}${t.state}`;
  }).join('');
  console.log(`  ${String(i + 1).padStart(2)} | ${String(e.startStep).padStart(9)} | ${String(e.creates).padStart(7)} | ${String(e.erases).padStart(6)} | ${String(e.netChange).padStart(3)} | ${String(e.onesAtEnd).padStart(10)} | ${seq}`);
}

// ── Classify boundary events ─────────────────────────────────────────

console.log('\n═══ Boundary Event Classification ═══\n');

const eventTypes = {};
for (const e of boundaryEvents) {
  const signature = e.transitions.map(t => {
    let marker = t.creating ? '+' : t.erasing ? '-' : '=';
    return `${marker}${t.state}`;
  }).join(' ');
  if (!eventTypes[signature]) {
    eventTypes[signature] = { count: 0, totalNet: 0, creates: 0, erases: 0 };
  }
  eventTypes[signature].count++;
  eventTypes[signature].totalNet += e.netChange;
  eventTypes[signature].creates += e.creates;
  eventTypes[signature].erases += e.erases;
}

console.log('  Signature                                  | Count | Creates | Erases | Net/event');
console.log('  ───────────────────────────────────────────┼───────┼─────────┼────────┼──────────');
const sortedTypes = Object.entries(eventTypes).sort((a, b) => b[1].count - a[1].count);
for (const [sig, stats] of sortedTypes.slice(0, 20)) {
  const netPer = (stats.totalNet / stats.count).toFixed(1);
  console.log(`  ${sig.padEnd(43)} | ${String(stats.count).padStart(5)} | ${String(stats.creates).padStart(7)} | ${String(stats.erases).padStart(6)} | ${netPer.padStart(8)}`);
}

// ── Global create/erase ratio ────────────────────────────────────────

console.log('\n═══ Global Create/Erase Ratio ═══\n');
let totalCreates = 0, totalErases = 0;
for (const e of boundaryEvents) {
  totalCreates += e.creates;
  totalErases += e.erases;
}
console.log(`  Total creates at boundaries: ${totalCreates}`);
console.log(`  Total erases at boundaries:  ${totalErases}`);
console.log(`  Create/Erase ratio:          ${(totalCreates / totalErases).toFixed(8)}`);
console.log(`  5/3 =                        ${(5/3).toFixed(8)}`);
console.log(`  Difference from 5/3:         ${(totalCreates / totalErases - 5/3).toFixed(8)}`);
console.log(`  Net ones per boundary event: ${((totalCreates - totalErases) / boundaryEvents.length).toFixed(4)}`);

// ── Look at create/erase ratio at different time scales ──────────────

console.log('\n═══ Create/Erase Ratio Over Time ═══\n');
const WINDOW = 50; // events
console.log('  Events     | Creates | Erases | Ratio    | Δ from 5/3');
console.log('  ───────────┼─────────┼────────┼──────────┼───────────');
for (let i = 0; i + WINDOW <= boundaryEvents.length; i += WINDOW) {
  let c = 0, e = 0;
  for (let j = i; j < i + WINDOW; j++) {
    c += boundaryEvents[j].creates;
    e += boundaryEvents[j].erases;
  }
  if (e > 0) {
    const ratio = c / e;
    const diff = ratio - 5/3;
    console.log(`  ${String(i + 1).padStart(4)}-${String(i + WINDOW).padStart(4)} | ${String(c).padStart(7)} | ${String(e).padStart(6)} | ${ratio.toFixed(6)} | ${diff >= 0 ? '+' : ''}${diff.toFixed(6)}`);
  }
}
