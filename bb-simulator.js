/**
 * Busy Beaver Turing Machine Simulator
 *
 * A Turing machine has:
 *   - A tape: infinite in both directions, initially all 0s
 *   - A head: points to one cell on the tape
 *   - A state: one of n states (A, B, C, ...) plus a HALT state
 *   - A transition table: for each (state, symbol) pair, specifies:
 *       { write, move, nextState }
 *
 * BB(n) = the maximum number of 1s written by any halting n-state machine
 * starting on a blank tape.
 */

// ── Transition table format ──────────────────────────────────────────
// A machine is an object mapping "state,symbol" to { write, move, nextState }
// States are strings: "A", "B", "C", etc.  HALT = "H"
// Symbols are 0 or 1.  Move is "L" or "R".
//
// Example: the BB(2) champion
//   State A, read 0 → write 1, move R, go to B
//   State A, read 1 → write 1, move L, go to B
//   State B, read 0 → write 1, move L, go to A
//   State B, read 1 → write 1, move R, go to H

function createMachine(transitions) {
  // transitions: array of [state, read, write, move, nextState]
  const table = {};
  for (const [state, read, write, move, nextState] of transitions) {
    table[`${state},${read}`] = { write, move, nextState };
  }
  return table;
}

// ── The Tape ─────────────────────────────────────────────────────────
// We use a Map so the tape is "infinite" in both directions.
// Any cell not in the map is implicitly 0.

class Tape {
  constructor() {
    this.cells = new Map();
  }

  read(pos) {
    return this.cells.get(pos) || 0;
  }

  write(pos, symbol) {
    if (symbol === 0) {
      this.cells.delete(pos);  // keep map sparse
    } else {
      this.cells.set(pos, symbol);
    }
  }

  // Count the 1s on the tape (the "score" for Busy Beaver)
  countOnes() {
    return this.cells.size;  // only non-zero values are stored
  }

  // Render a section of the tape as a string
  toString(center, radius = 20) {
    let result = '';
    for (let i = center - radius; i <= center + radius; i++) {
      result += this.read(i);
    }
    return result;
  }
}

// ── The Simulator ────────────────────────────────────────────────────

class TuringMachine {
  constructor(machine) {
    this.table = machine;
    this.tape = new Tape();
    this.head = 0;
    this.state = 'A';  // always start in state A
    this.steps = 0;
    this.halted = false;
    this.history = [];  // optional: record states for visualization
  }

  step() {
    if (this.halted) return false;

    const symbol = this.tape.read(this.head);
    const key = `${this.state},${symbol}`;
    const instruction = this.table[key];

    if (!instruction) {
      // No instruction = undefined transition, treat as halt
      this.halted = true;
      return false;
    }

    // Record state before transition (for visualization/debugging)
    this.history.push({
      step: this.steps,
      state: this.state,
      head: this.head,
      read: symbol,
      write: instruction.write,
      move: instruction.move,
      nextState: instruction.nextState,
    });

    // Execute the transition
    this.tape.write(this.head, instruction.write);
    this.head += instruction.move === 'R' ? 1 : -1;
    this.state = instruction.nextState;
    this.steps++;

    if (this.state === 'H') {
      this.halted = true;
      return false;
    }

    return true;  // still running
  }

  // Run until halt or step limit
  run(maxSteps = 1_000_000) {
    while (this.steps < maxSteps && this.step()) {}
    return {
      halted: this.halted,
      steps: this.steps,
      ones: this.tape.countOnes(),
      state: this.state,
    };
  }

  // Pretty-print the current configuration
  printState(radius = 15) {
    const tapeStr = this.tape.toString(this.head, radius);
    const headPos = radius;  // head is always at center of the rendered string
    const pointer = ' '.repeat(headPos) + '^';
    const stateLabel = ' '.repeat(headPos) + (this.halted ? 'HALT' : this.state);
    return `Step ${this.steps}:\n  ${tapeStr}\n  ${pointer}\n  ${stateLabel}`;
  }
}

// ── BB Champion Machines ─────────────────────────────────────────────
// These are the proven champions — the n-state machines that produce
// the most 1s before halting.

const BB_CHAMPIONS = {
  // BB(1) = 1 (1 one, 1 step)
  1: createMachine([
    ['A', 0, 1, 'R', 'H'],
  ]),

  // BB(2) = 4 (4 ones, 6 steps)
  2: createMachine([
    ['A', 0, 1, 'R', 'B'],
    ['A', 1, 1, 'L', 'B'],
    ['B', 0, 1, 'L', 'A'],
    ['B', 1, 1, 'R', 'H'],
  ]),

  // BB(3): Σ(3) = 6 ones, 14 steps
  3: createMachine([
    ['A', 0, 1, 'R', 'B'],
    ['A', 1, 1, 'R', 'H'],
    ['B', 0, 0, 'R', 'C'],
    ['B', 1, 1, 'R', 'B'],
    ['C', 0, 1, 'L', 'C'],
    ['C', 1, 1, 'L', 'A'],
  ]),

  // BB(4) = 13 (13 ones, 107 steps)
  4: createMachine([
    ['A', 0, 1, 'R', 'B'],
    ['A', 1, 1, 'L', 'B'],
    ['B', 0, 1, 'L', 'A'],
    ['B', 1, 0, 'L', 'C'],
    ['C', 0, 1, 'R', 'H'],
    ['C', 1, 1, 'L', 'D'],
    ['D', 0, 1, 'R', 'D'],
    ['D', 1, 0, 'R', 'A'],
  ]),
};

// ── Demo: Run all champions ──────────────────────────────────────────

function runAllChampions() {
  console.log('=== Busy Beaver Champions ===\n');

  for (const [n, machine] of Object.entries(BB_CHAMPIONS)) {
    const tm = new TuringMachine(machine);
    const result = tm.run();

    console.log(`BB(${n}):`);
    console.log(`  Ones on tape: ${result.ones}`);
    console.log(`  Steps taken:  ${result.steps}`);
    console.log(`  Final tape:   ${tm.tape.toString(tm.head, 20)}`);
    console.log();
  }
}

// ── Step-by-step trace ───────────────────────────────────────────────
// Watch a machine execute one step at a time — this is where
// the intuition really builds.

function traceExecution(machine, maxSteps = 200) {
  const tm = new TuringMachine(machine);

  console.log('--- Trace ---');
  console.log(tm.printState());

  while (tm.step()) {
    if (tm.steps > maxSteps) {
      console.log(`... (stopped after ${maxSteps} steps, still running)`);
      return;
    }
    console.log(tm.printState());
  }

  console.log(tm.printState());
  console.log(`\nResult: ${tm.tape.countOnes()} ones in ${tm.steps} steps`);
}

// ── Run it! ──────────────────────────────────────────────────────────

runAllChampions();

console.log('\n=== Step-by-step trace of BB(2) champion ===\n');
traceExecution(BB_CHAMPIONS[2]);

console.log('\n=== Step-by-step trace of BB(3) champion ===\n');
traceExecution(BB_CHAMPIONS[3]);
