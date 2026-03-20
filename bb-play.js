/**
 * Interactive BB Playground
 *
 * Run: node bb-play.js
 *
 * Lets you define machines interactively and watch them run.
 * Also includes some experiments to try.
 */

const readline = require('readline');

// ── Pull in our simulator classes ────────────────────────────────────
// (Duplicated here to keep it standalone — we'll clean up later)

function createMachine(transitions) {
  const table = {};
  for (const [state, read, write, move, nextState] of transitions) {
    table[`${state},${read}`] = { write, move, nextState };
  }
  return table;
}

class Tape {
  constructor() { this.cells = new Map(); }
  read(pos) { return this.cells.get(pos) || 0; }
  write(pos, symbol) {
    symbol === 0 ? this.cells.delete(pos) : this.cells.set(pos, symbol);
  }
  countOnes() { return this.cells.size; }
  toString(center, radius = 20) {
    let r = '';
    for (let i = center - radius; i <= center + radius; i++) r += this.read(i);
    return r;
  }
}

class TuringMachine {
  constructor(machine) {
    this.table = machine;
    this.tape = new Tape();
    this.head = 0;
    this.state = 'A';
    this.steps = 0;
    this.halted = false;
  }
  step() {
    if (this.halted) return false;
    const symbol = this.tape.read(this.head);
    const instr = this.table[`${this.state},${symbol}`];
    if (!instr) { this.halted = true; return false; }
    this.tape.write(this.head, instr.write);
    this.head += instr.move === 'R' ? 1 : -1;
    this.state = instr.nextState;
    this.steps++;
    if (this.state === 'H') { this.halted = true; return false; }
    return true;
  }
  run(maxSteps = 1_000_000) {
    while (this.steps < maxSteps && this.step()) {}
    return { halted: this.halted, steps: this.steps, ones: this.tape.countOnes() };
  }
  printState(radius = 20) {
    const tapeStr = this.tape.toString(this.head, radius);
    const pointer = ' '.repeat(radius) + '^';
    const label = ' '.repeat(radius) + (this.halted ? 'HALT' : this.state);
    return `  ${tapeStr}\n  ${pointer}\n  ${label}`;
  }
}

// ── Preset machines to explore ───────────────────────────────────────

const PRESETS = {
  'bb1': {
    name: 'BB(1) Champion — 1 one, 1 step',
    machine: [['A', 0, 1, 'R', 'H']],
  },
  'bb2': {
    name: 'BB(2) Champion — 4 ones, 6 steps',
    machine: [
      ['A', 0, 1, 'R', 'B'], ['A', 1, 1, 'L', 'B'],
      ['B', 0, 1, 'L', 'A'], ['B', 1, 1, 'R', 'H'],
    ],
  },
  'bb3': {
    name: 'BB(3) Champion — 6 ones, 14 steps',
    machine: [
      ['A', 0, 1, 'R', 'B'], ['A', 1, 1, 'R', 'H'],
      ['B', 0, 0, 'R', 'C'], ['B', 1, 1, 'R', 'B'],
      ['C', 0, 1, 'L', 'C'], ['C', 1, 1, 'L', 'A'],
    ],
  },
  'bb4': {
    name: 'BB(4) Champion — 13 ones, 107 steps',
    machine: [
      ['A', 0, 1, 'R', 'B'], ['A', 1, 1, 'L', 'B'],
      ['B', 0, 1, 'L', 'A'], ['B', 1, 0, 'L', 'C'],
      ['C', 0, 1, 'R', 'H'], ['C', 1, 1, 'L', 'D'],
      ['D', 0, 1, 'R', 'D'], ['D', 1, 0, 'R', 'A'],
    ],
  },
  'loop': {
    name: 'Simple infinite loop — never halts',
    machine: [
      ['A', 0, 1, 'R', 'B'],
      ['B', 0, 1, 'L', 'A'],  // bounces back and forth forever
    ],
  },
  'marcher': {
    name: 'Right marcher — walks right forever writing 1s',
    machine: [
      ['A', 0, 1, 'R', 'A'],  // just keeps going
    ],
  },
};

// ── Interactive mode ─────────────────────────────────────────────────

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(q) {
  return new Promise(resolve => rl.question(q, resolve));
}

function runAndTrace(transitions, stepByStep = true, maxSteps = 500) {
  const machine = createMachine(transitions);
  const tm = new TuringMachine(machine);

  if (stepByStep && maxSteps <= 500) {
    console.log('\nStep 0:');
    console.log(tm.printState());
    while (tm.step()) {
      if (tm.steps > maxSteps) {
        console.log(`\n  ... stopped after ${maxSteps} steps (still running)`);
        console.log(`  Ones so far: ${tm.tape.countOnes()}`);
        return;
      }
      console.log(`Step ${tm.steps}:`);
      console.log(tm.printState());
    }
    console.log(`\n  HALTED after ${tm.steps} steps with ${tm.tape.countOnes()} ones on the tape.`);
  } else {
    const result = tm.run(maxSteps);
    if (result.halted) {
      console.log(`\n  HALTED after ${result.steps} steps with ${result.ones} ones.`);
    } else {
      console.log(`\n  Still running after ${result.steps} steps. ${result.ones} ones so far.`);
    }
    console.log(`  Final tape: ${tm.tape.toString(tm.head, 30)}`);
  }
}

async function parseCustomMachine() {
  console.log('\nDefine your transitions. Format: STATE READ WRITE MOVE NEXT_STATE');
  console.log('Example: A 0 1 R B');
  console.log('Use H for halt state. Type "done" when finished.\n');

  const transitions = [];
  while (true) {
    const line = await prompt('  > ');
    if (line.trim().toLowerCase() === 'done') break;
    const parts = line.trim().split(/\s+/);
    if (parts.length !== 5) {
      console.log('  Need 5 values: STATE READ WRITE MOVE NEXT_STATE');
      continue;
    }
    const [state, read, write, move, next] = parts;
    if (!['L', 'R'].includes(move.toUpperCase())) {
      console.log('  Move must be L or R');
      continue;
    }
    transitions.push([
      state.toUpperCase(),
      parseInt(read),
      parseInt(write),
      move.toUpperCase(),
      next.toUpperCase(),
    ]);
    console.log(`  Added: ${state.toUpperCase()} reading ${read} → write ${write}, move ${move.toUpperCase()}, go to ${next.toUpperCase()}`);
  }
  return transitions;
}

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║     Busy Beaver Playground               ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log();
  console.log('Commands:');
  console.log('  presets     — list preset machines');
  console.log('  run <name>  — run a preset (e.g. "run bb2")');
  console.log('  custom      — define your own machine');
  console.log('  enumerate   — brute-force all 2-state machines');
  console.log('  quit        — exit\n');

  while (true) {
    const input = (await prompt('bb> ')).trim().toLowerCase();

    if (input === 'quit' || input === 'exit' || input === 'q') {
      rl.close();
      break;
    }

    if (input === 'presets') {
      console.log('\nAvailable presets:');
      for (const [key, val] of Object.entries(PRESETS)) {
        console.log(`  ${key.padEnd(10)} ${val.name}`);
      }
      console.log();
      continue;
    }

    if (input.startsWith('run ')) {
      const name = input.slice(4).trim();
      const preset = PRESETS[name];
      if (!preset) {
        console.log(`Unknown preset "${name}". Type "presets" to see options.`);
        continue;
      }
      console.log(`\n--- ${preset.name} ---`);
      runAndTrace(preset.machine, true, 500);
      console.log();
      continue;
    }

    if (input === 'custom') {
      const transitions = await parseCustomMachine();
      if (transitions.length > 0) {
        const stepMode = (await prompt('Step-by-step trace? (y/n) ')).trim().toLowerCase();
        runAndTrace(transitions, stepMode === 'y' || stepMode === 'yes');
      }
      console.log();
      continue;
    }

    if (input === 'enumerate') {
      console.log('\nBrute-forcing all 2-state Turing machines...');
      enumerate2State();
      console.log();
      continue;
    }

    console.log('Unknown command. Try: presets, run <name>, custom, enumerate, quit');
  }
}

// ── Enumerate all 2-state machines ───────────────────────────────────
// A 2-state BB machine has 2 states (A, B) + halt, 2 symbols (0, 1).
// Each (state, symbol) pair has: write (0 or 1), move (L or R), next (A, B, or H)
// That's 4 entries, each with 2 * 2 * 3 = 12 options → 12^4 = 20,736 machines.
// But most don't halt. Let's find out!

function enumerate2State() {
  const writes = [0, 1];
  const moves = ['L', 'R'];
  const states = ['A', 'B', 'H'];

  let total = 0;
  let halted = 0;
  let maxOnes = 0;
  let maxSteps = 0;
  let champion = null;
  let stepChampion = null;

  // Generate all possible transition tables
  for (const w1 of writes) for (const m1 of moves) for (const s1 of states)     // A,0
  for (const w2 of writes) for (const m2 of moves) for (const s2 of states)     // A,1
  for (const w3 of writes) for (const m3 of moves) for (const s3 of states)     // B,0
  for (const w4 of writes) for (const m4 of moves) for (const s4 of states) {   // B,1
    total++;
    const transitions = [
      ['A', 0, w1, m1, s1],
      ['A', 1, w2, m2, s2],
      ['B', 0, w3, m3, s3],
      ['B', 1, w4, m4, s4],
    ];
    const machine = createMachine(transitions);
    const tm = new TuringMachine(machine);
    const result = tm.run(1000);  // generous limit for 2-state

    if (result.halted) {
      halted++;
      if (result.ones > maxOnes) {
        maxOnes = result.ones;
        champion = transitions;
      }
      if (result.steps > maxSteps) {
        maxSteps = result.steps;
        stepChampion = transitions;
      }
    }
  }

  console.log(`\n  Total 2-state machines:  ${total.toLocaleString()}`);
  console.log(`  Machines that halt:      ${halted.toLocaleString()}`);
  console.log(`  Machines that don't:     ${(total - halted).toLocaleString()}`);
  console.log(`\n  BB(2) = ${maxOnes} ones (champion below)`);
  console.log(`  Most steps before halt:  ${maxSteps}`);

  if (champion) {
    console.log(`\n  Champion (most 1s):`);
    for (const [st, rd, wr, mv, ns] of champion) {
      console.log(`    ${st},${rd} → write ${wr}, move ${mv}, goto ${ns}`);
    }
    console.log('\n  Running champion:');
    runAndTrace(champion, true);
  }
}

main();
