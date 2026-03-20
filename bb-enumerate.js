/**
 * Busy Beaver 3-State Enumerator with Motif & Phase Analysis
 *
 * Brute-forces all possible 3-state, 2-symbol Turing machines.
 * For each halting machine, analyses its execution to detect:
 *   - Structural motifs (sweepers, transporters, gap-makers)
 *   - Phase decomposition (setup, amplification, cleanup)
 *
 * 3 states (A,B,C) + halt (H), 2 symbols (0,1)
 * Each (state, symbol) pair → (write, move, nextState)
 * Options per entry: 2 writes × 2 moves × 4 next states = 16
 * 6 entries → 16^6 = 16,777,216 machines
 */

// ── Fast Turing Machine (optimised for enumeration) ──────────────────
// Uses numeric encoding: states 0,1,2 = A,B,C; 3 = halt
// Transition table is a flat array: table[state * 2 + symbol] = {write, move, next}
// where move: 0 = L, 1 = R

// HALT and STATE_NAMES are set dynamically based on numStates
let HALT = 3;
let STATE_NAMES = ['A', 'B', 'C', 'H'];

function initStates(numStates) {
  HALT = numStates;  // halt state is always the index after the last working state
  STATE_NAMES = [];
  for (let i = 0; i < numStates; i++) STATE_NAMES.push(String.fromCharCode(65 + i));
  STATE_NAMES.push('H');
}

function fastRun(table, maxSteps) {
  // Tape as two arrays: right[i] for positions >= 0, left[i] for positions < 0
  // This avoids Map overhead
  const right = new Uint8Array(64);  // positions 0..63
  const left = new Uint8Array(64);   // positions -1..-64
  let head = 32;  // offset so we can go left without negative indices on right[]
  // Actually, simpler: just use a single array centered
  const tape = new Uint8Array(256);  // positions 0..255, head starts at 128
  head = 128;

  let state = 0;  // start in state A
  let steps = 0;
  let minHead = head;
  let maxHead = head;

  // Record state sequence for phase analysis
  const stateSeq = new Uint8Array(maxSteps + 1);

  while (steps < maxSteps) {
    const symbol = tape[head];
    const idx = state * 2 + symbol;
    const write = table[idx * 3];
    const move = table[idx * 3 + 1];
    const next = table[idx * 3 + 2];

    stateSeq[steps] = state;
    tape[head] = write;
    head += move === 1 ? 1 : -1;
    state = next;
    steps++;

    if (head < minHead) minHead = head;
    if (head > maxHead) maxHead = head;

    if (state === HALT) {
      // Count ones
      let ones = 0;
      for (let i = minHead; i <= maxHead; i++) {
        ones += tape[i];
      }
      return { halted: true, steps, ones, stateSeq, tape, minHead, maxHead };
    }

    // Bounds check
    if (head < 2 || head > 253) {
      return { halted: false, steps, ones: 0, stateSeq, tape, minHead, maxHead };
    }
  }

  return { halted: false, steps, ones: 0, stateSeq, tape, minHead, maxHead };
}

// ── Motif Detection ──────────────────────────────────────────────────
// Analyse a transition table for structural motifs

function detectMotifs(table) {
  const motifs = new Set();

  for (let state = 0; state < HALT; state++) {
    for (let symbol = 0; symbol < 2; symbol++) {
      const idx = state * 2 + symbol;
      const write = table[idx * 3];
      const move = table[idx * 3 + 1];
      const next = table[idx * 3 + 2];

      // Gap-maker: writes a 0 (creates gaps in tape structure)
      if (write === 0) {
        motifs.add('gap-maker');
      }

      // Self-loop: state transitions to itself
      if (next === state) {
        // Sweeper: self-loop that writes 1
        if (write === 1) {
          motifs.add('sweeper');
        }
        // Transporter: self-loop that preserves the symbol
        if (write === symbol) {
          motifs.add('transporter');
        }
      }

      // Halt transition exists from this state
      if (next === HALT) {
        motifs.add(`halt-from-${STATE_NAMES[state]}`);
      }
    }
  }

  // Check for reluctant halter: halt only on read-1 (harder to trigger from blank tape)
  let haltOnZero = false;
  let haltOnOne = false;
  for (let state = 0; state < HALT; state++) {
    for (let symbol = 0; symbol < 2; symbol++) {
      const idx = state * 2 + symbol;
      if (table[idx * 3 + 2] === HALT) {
        if (symbol === 0) haltOnZero = true;
        if (symbol === 1) haltOnOne = true;
      }
    }
  }
  if (haltOnOne && !haltOnZero) {
    motifs.add('reluctant-halter');
  }

  return motifs;
}

// ── Phase Detection ──────────────────────────────────────────────────
// Analyse execution trace to find setup/amplification/cleanup phases
//
// Strategy: look for repeating state subsequences in the execution.
// The amplification phase is a repeated cycle of states.

function detectPhases(stateSeq, totalSteps) {
  if (totalSteps < 4) {
    return { setup: totalSteps, amplification: 0, cleanup: 0, cycleLength: 0, cycleCount: 0 };
  }

  // Try to find repeating cycles of length 1..totalSteps/2
  // A "cycle" here means the same sequence of states repeats consecutively
  let bestCycleLen = 0;
  let bestCycleCount = 0;
  let bestCycleStart = 0;

  for (let cycleLen = 2; cycleLen <= Math.min(totalSteps / 2, 30); cycleLen++) {
    // Try each possible start position
    for (let start = 0; start <= totalSteps - cycleLen * 2; start++) {
      let count = 0;

      // Count consecutive repetitions of the cycle
      let pos = start;
      while (pos + cycleLen <= totalSteps) {
        let match = true;
        for (let j = 0; j < cycleLen; j++) {
          if (stateSeq[pos + j] !== stateSeq[start + j]) {
            match = false;
            break;
          }
        }
        if (!match) break;
        count++;
        pos += cycleLen;
      }

      // Is this the best cycle? (most total steps covered)
      if (count >= 2 && count * cycleLen > bestCycleCount * bestCycleLen) {
        bestCycleLen = cycleLen;
        bestCycleCount = count;
        bestCycleStart = start;
      }
    }
  }

  if (bestCycleCount >= 2) {
    const setup = bestCycleStart;
    const amplification = bestCycleLen * bestCycleCount;
    const cleanup = totalSteps - setup - amplification;
    return {
      setup,
      amplification,
      cleanup,
      cycleLength: bestCycleLen,
      cycleCount: bestCycleCount,
      pattern: Array.from(stateSeq.slice(bestCycleStart, bestCycleStart + bestCycleLen))
        .map(s => STATE_NAMES[s]).join(''),
    };
  }

  return { setup: totalSteps, amplification: 0, cleanup: 0, cycleLength: 0, cycleCount: 0 };
}

// ── Enumeration ──────────────────────────────────────────────────────

function enumerate(numStates, maxSteps) {
  initStates(numStates);
  const stateCount = numStates;
  const nextStates = stateCount + 1;  // include halt
  const entriesPerTransition = 3;     // write, move, next
  const numEntries = stateCount * 2;  // (state, symbol) pairs

  // Total machines: (2 * 2 * nextStates) ^ numEntries
  const optionsPerEntry = 2 * 2 * nextStates;
  const totalMachines = Math.pow(optionsPerEntry, numEntries);

  console.log(`\nEnumerating all ${stateCount}-state machines...`);
  console.log(`Options per transition: ${optionsPerEntry}`);
  console.log(`Transition entries: ${numEntries}`);
  console.log(`Total machines: ${totalMachines.toLocaleString()}\n`);

  // Stats
  let halted = 0;
  let nonHalting = 0;
  let maxOnes = 0;
  let maxStepsHalted = 0;
  const topByOnes = [];        // top 20 by ones count
  const topBySteps = [];       // top 20 by step count
  const motifCounts = {};      // how often each motif appears in halting machines
  const motifScores = {};      // total ones produced by machines with each motif
  const motifComboScores = {}; // scores by motif combination
  const phaseStats = [];       // phase decomposition of top machines

  // Generate all transition tables
  // Table format: flat array [write0, move0, next0, write1, move1, next1, ...]
  // Index: (state * 2 + symbol) * 3 + {0=write, 1=move, 2=next}

  const table = new Uint8Array(numEntries * entriesPerTransition);

  // Use iterative enumeration with a counter
  const counter = new Uint8Array(numEntries);  // each position 0..optionsPerEntry-1
  let progressInterval = Math.floor(totalMachines / 20);
  let processed = 0;

  function decodeEntry(code) {
    // code 0..optionsPerEntry-1 → write, move, nextState
    const write = code % 2;
    const move = Math.floor(code / 2) % 2;
    const next = Math.floor(code / 4);
    return [write, move, next];
  }

  function setTable() {
    for (let i = 0; i < numEntries; i++) {
      const [w, m, n] = decodeEntry(counter[i]);
      table[i * 3] = w;
      table[i * 3 + 1] = m;
      table[i * 3 + 2] = n;
    }
  }

  function incrementCounter() {
    for (let i = 0; i < numEntries; i++) {
      counter[i]++;
      if (counter[i] < optionsPerEntry) return true;
      counter[i] = 0;
    }
    return false;  // overflow = done
  }

  function insertSorted(arr, item, key, maxLen) {
    arr.push(item);
    arr.sort((a, b) => b[key] - a[key]);
    if (arr.length > maxLen) arr.length = maxLen;
  }

  // Main enumeration loop
  do {
    setTable();
    processed++;

    if (processed % progressInterval === 0) {
      const pct = Math.round(processed / totalMachines * 100);
      process.stdout.write(`  ${pct}% (${halted.toLocaleString()} halted so far)\r`);
    }

    // Quick filter: at least one transition must go to HALT
    let hasHalt = false;
    for (let i = 0; i < numEntries; i++) {
      if (table[i * 3 + 2] === HALT) { hasHalt = true; break; }
    }
    if (!hasHalt) { nonHalting++; continue; }

    const result = fastRun(table, maxSteps);

    if (result.halted) {
      halted++;

      // Detect motifs
      const motifs = detectMotifs(table);
      const motifKey = Array.from(motifs).sort().join('+');

      for (const m of motifs) {
        motifCounts[m] = (motifCounts[m] || 0) + 1;
        motifScores[m] = (motifScores[m] || 0) + result.ones;
      }
      motifComboScores[motifKey] = motifComboScores[motifKey] || { count: 0, totalOnes: 0, maxOnes: 0, maxSteps: 0 };
      motifComboScores[motifKey].count++;
      motifComboScores[motifKey].totalOnes += result.ones;
      if (result.ones > motifComboScores[motifKey].maxOnes) {
        motifComboScores[motifKey].maxOnes = result.ones;
      }
      if (result.steps > motifComboScores[motifKey].maxSteps) {
        motifComboScores[motifKey].maxSteps = result.steps;
      }

      if (result.ones > maxOnes) maxOnes = result.ones;
      if (result.steps > maxStepsHalted) maxStepsHalted = result.steps;

      // Track top machines
      const tableSnapshot = Array.from(table);
      const entry = {
        table: tableSnapshot,
        ones: result.ones,
        steps: result.steps,
        motifs: motifKey,
      };

      insertSorted(topByOnes, entry, 'ones', 20);
      insertSorted(topBySteps, entry, 'steps', 20);
    } else {
      nonHalting++;
    }
  } while (incrementCounter());

  // ── Phase analysis on top machines ──────────────────────────────
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  ${stateCount}-STATE ENUMERATION RESULTS`);
  console.log('═══════════════════════════════════════════════════════\n');

  console.log(`Total machines:    ${totalMachines.toLocaleString()}`);
  console.log(`Halting:           ${halted.toLocaleString()} (${(halted/totalMachines*100).toFixed(1)}%)`);
  console.log(`Non-halting:       ${nonHalting.toLocaleString()} (${(nonHalting/totalMachines*100).toFixed(1)}%)`);
  console.log(`\nΣ(${stateCount}) = ${maxOnes} (most 1s by any halting machine)`);
  console.log(`S(${stateCount}) = ${maxStepsHalted} (most steps by any halting machine)\n`);

  // ── Top machines by ones ────────────────────────────────────────
  console.log('─── Top 10 Machines by Ones ───\n');
  for (let i = 0; i < Math.min(10, topByOnes.length); i++) {
    const m = topByOnes[i];
    console.log(`  #${i+1}: ${m.ones} ones, ${m.steps} steps  [${m.motifs}]`);
    printTable(m.table, stateCount, '       ');
  }

  // ── Top machines by steps ───────────────────────────────────────
  console.log('\n─── Top 10 Machines by Steps ───\n');
  for (let i = 0; i < Math.min(10, topBySteps.length); i++) {
    const m = topBySteps[i];
    console.log(`  #${i+1}: ${m.steps} steps, ${m.ones} ones  [${m.motifs}]`);
    printTable(m.table, stateCount, '       ');
  }

  // ── Motif frequency ─────────────────────────────────────────────
  console.log('\n─── Motif Frequency in Halting Machines ───\n');
  const sortedMotifs = Object.entries(motifCounts).sort((a, b) => b[1] - a[1]);
  for (const [motif, count] of sortedMotifs) {
    const avgScore = (motifScores[motif] / count).toFixed(2);
    const pct = (count / halted * 100).toFixed(1);
    console.log(`  ${motif.padEnd(20)} ${count.toLocaleString().padStart(8)} machines (${pct}%)  avg ones: ${avgScore}`);
  }

  // ── Motif combinations ─────────────────────────────────────────
  console.log('\n─── Top 15 Motif Combinations (by max ones) ───\n');
  const sortedCombos = Object.entries(motifComboScores)
    .sort((a, b) => b[1].maxOnes - a[1].maxOnes)
    .slice(0, 15);
  for (const [combo, stats] of sortedCombos) {
    const avg = (stats.totalOnes / stats.count).toFixed(2);
    console.log(`  ${combo}`);
    console.log(`    count: ${stats.count.toLocaleString()}  max ones: ${stats.maxOnes}  max steps: ${stats.maxSteps}  avg ones: ${avg}\n`);
  }

  // ── Phase analysis on top 10 by ones ────────────────────────────
  console.log('─── Phase Analysis (Top 10 by Ones) ───\n');
  for (let i = 0; i < Math.min(10, topByOnes.length); i++) {
    const m = topByOnes[i];
    // Re-run to get state sequence
    setTableFrom(table, m.table);
    const result = fastRun(table, maxSteps);
    const phases = detectPhases(result.stateSeq, result.steps);

    console.log(`  #${i+1} (${m.ones} ones, ${m.steps} steps):`);
    if (phases.cycleCount > 0) {
      console.log(`    Setup: ${phases.setup} steps → Amplification: ${phases.amplification} steps (${phases.cycleCount}× cycle "${phases.pattern}", len ${phases.cycleLength}) → Cleanup: ${phases.cleanup} steps`);
    } else {
      console.log(`    No repeating cycle detected (${phases.setup} steps, all setup/linear)`);
    }
  }

  console.log('\n─── Phase Analysis (Top 10 by Steps) ───\n');
  for (let i = 0; i < Math.min(10, topBySteps.length); i++) {
    const m = topBySteps[i];
    setTableFrom(table, m.table);
    const result = fastRun(table, maxSteps);
    const phases = detectPhases(result.stateSeq, result.steps);

    console.log(`  #${i+1} (${m.steps} steps, ${m.ones} ones):`);
    if (phases.cycleCount > 0) {
      console.log(`    Setup: ${phases.setup} steps → Amplification: ${phases.amplification} steps (${phases.cycleCount}× cycle "${phases.pattern}", len ${phases.cycleLength}) → Cleanup: ${phases.cleanup} steps`);
    } else {
      console.log(`    No repeating cycle detected (${phases.setup} steps, all setup/linear)`);
    }
  }
}

function setTableFrom(table, snapshot) {
  for (let i = 0; i < snapshot.length; i++) table[i] = snapshot[i];
}

function printTable(table, numStates, indent) {
  for (let state = 0; state < numStates; state++) {
    for (let symbol = 0; symbol < 2; symbol++) {
      const idx = (state * 2 + symbol) * 3;
      const w = table[idx];
      const m = table[idx + 1] === 1 ? 'R' : 'L';
      const n = STATE_NAMES[table[idx + 2]];
      process.stdout.write(`${indent}${STATE_NAMES[state]},${symbol} → ${w}${m}${n}  `);
    }
    console.log();
  }
}

// ── Main ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const numStates = parseInt(args[0]) || 3;
const maxSteps = parseInt(args[1]) || 200;

console.log(`Busy Beaver Enumerator`);
console.log(`States: ${numStates}, Step limit: ${maxSteps}`);

const start = Date.now();
enumerate(numStates, maxSteps);
const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log(`\nCompleted in ${elapsed}s`);
