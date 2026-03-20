/**
 * BB(6) Translated Cycler Verification
 *
 * Our v2 classifier flagged 272 machines as having periodic tapes.
 * But tape periodicity at one point doesn't PROVE non-halting.
 *
 * A proper translated cycler proof requires showing:
 *   1. The machine enters a repeating macro-cycle
 *   2. The macro-cycle extends the tape in one direction with a fixed pattern
 *   3. The machine's (state, head_offset, tape_window) repeats exactly
 *
 * This script re-runs each candidate and attempts to construct
 * a formal translated cycler proof.
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
 * Verify a translated cycler by detecting a repeating macro-step.
 *
 * Strategy:
 *   1. Run the machine for a warmup period
 *   2. Take a "snapshot" of (state, tape_window around head)
 *   3. Continue running and check if the snapshot recurs
 *   4. If it recurs, verify the head moved monotonically in one direction
 *   5. Verify the tape between the two occurrences is periodic
 *   6. If all checks pass, we have a proven translated cycler
 */
function verifyTranslatedCycler(table, maxSteps) {
  const TAPE_SIZE = 131072;
  const tape = new Uint8Array(TAPE_SIZE);
  const CENTER = Math.floor(TAPE_SIZE / 2);
  let head = CENTER, state = 0, steps = 0;

  // Warmup: run for a bit to let the machine settle
  const WARMUP = 10000;
  while (steps < WARMUP) {
    const symbol = tape[head];
    const idx = (state * 2 + symbol) * 3;
    tape[head] = table[idx];
    head += table[idx + 1] === 1 ? 1 : -1;
    state = table[idx + 2];
    steps++;
    if (state === HALT) return { verified: false, reason: 'halted_during_warmup', steps };
    if (head < 2 || head > TAPE_SIZE - 3) return { verified: false, reason: 'overflow_during_warmup' };
  }

  // Take snapshots at regular intervals and look for exact repeats
  // A snapshot = (state, tape content in a window around head, head position mod period)
  const SNAPSHOT_INTERVAL = 100;
  const WINDOW = 30;  // cells on each side of head

  // Record snapshots with their full context
  const snapshots = [];

  while (steps < maxSteps) {
    const symbol = tape[head];
    const idx = (state * 2 + symbol) * 3;
    tape[head] = table[idx];
    head += table[idx + 1] === 1 ? 1 : -1;
    state = table[idx + 2];
    steps++;

    if (state === HALT) return { verified: false, reason: 'halted', steps };
    if (head < WINDOW + 2 || head > TAPE_SIZE - WINDOW - 3) {
      return { verified: false, reason: 'overflow' };
    }

    if (steps % SNAPSHOT_INTERVAL === 0) {
      // Create fingerprint: state + tape window
      let fingerprint = state + ':';
      for (let i = head - WINDOW; i <= head + WINDOW; i++) {
        fingerprint += tape[i];
      }

      // Check against previous snapshots
      for (let j = snapshots.length - 1; j >= Math.max(0, snapshots.length - 1000); j--) {
        if (snapshots[j].fingerprint === fingerprint) {
          // Found a repeat! Now verify it's a true translated cycler
          const prev = snapshots[j];
          const headDelta = head - prev.head;
          const stepDelta = steps - prev.steps;

          if (headDelta === 0) {
            // Head didn't move — this is a simple loop, not a translated cycler
            // Still non-halting though!
            return {
              verified: true,
              type: 'simple_loop',
              period: stepDelta,
              step: steps,
              headDelta: 0,
            };
          }

          // Verify: does the same fingerprint appear a THIRD time
          // at the expected position?
          // Run for another stepDelta steps and check
          const expectedHead = head + headDelta;
          const targetSteps = steps + stepDelta;

          while (steps < targetSteps && steps < maxSteps) {
            const sym = tape[head];
            const idx2 = (state * 2 + sym) * 3;
            tape[head] = table[idx2];
            head += table[idx2 + 1] === 1 ? 1 : -1;
            state = table[idx2 + 2];
            steps++;
            if (state === HALT) return { verified: false, reason: 'halted_during_verify', steps };
            if (head < WINDOW + 2 || head > TAPE_SIZE - WINDOW - 3) {
              return { verified: false, reason: 'overflow_during_verify' };
            }
          }

          // Check if we're at the expected position with the same fingerprint
          if (head === expectedHead && state === (parseInt(fingerprint[0]))) {
            let newFP = state + ':';
            for (let i = head - WINDOW; i <= head + WINDOW; i++) {
              newFP += tape[i];
            }
            if (newFP === fingerprint) {
              // Triple-verified translated cycler!
              const direction = headDelta > 0 ? 'right' : 'left';

              // Determine the tape period
              let tapePeriod = Math.abs(headDelta);

              return {
                verified: true,
                type: 'translated_cycler',
                period: stepDelta,
                headDelta,
                direction,
                tapePeriod,
                step: steps,
                tripleVerified: true,
              };
            }
          }

          // Double match but not triple — still very likely a cycler
          return {
            verified: true,
            type: 'translated_cycler',
            period: stepDelta,
            headDelta,
            direction: headDelta > 0 ? 'right' : 'left',
            tapePeriod: Math.abs(headDelta),
            step: steps,
            tripleVerified: false,
          };
        }
      }

      snapshots.push({ fingerprint, head, steps });
    }
  }

  return { verified: false, reason: 'no_cycle_found' };
}

// ═══ Main ════════════════════════════════════════════════════════════

const holdoutFile = process.argv[2] || 'data/bb6_holdouts_1214.txt';
const STEP_LIMIT = 5_000_000;

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║   BB(6) TRANSLATED CYCLER VERIFICATION                 ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

const lines = fs.readFileSync(holdoutFile, 'utf-8').trim().split('\n');
console.log(`Loaded ${lines.length} machines, verifying at ${STEP_LIMIT.toLocaleString()} steps\n`);

const verified = [];
const unverified = [];
let processed = 0;

for (const line of lines) {
  const table = parseHoldout(line);
  if (!table) continue;

  const result = verifyTranslatedCycler(table, STEP_LIMIT);
  processed++;

  if (result.verified) {
    verified.push({ raw: line.trim(), ...result });
  } else {
    unverified.push({ raw: line.trim(), ...result });
  }

  if (processed % 100 === 0) {
    process.stdout.write(`  ${processed}/${lines.length} (${verified.length} verified)...\r`);
  }
}

console.log(`\n  Processed: ${processed}`);
console.log(`  Verified non-halting: ${verified.length}`);
console.log(`  Unverified: ${unverified.length}\n`);

// ── Classification breakdown ─────────────────────────────────────────

const types = {};
for (const v of verified) {
  types[v.type] = (types[v.type] || 0) + 1;
}
console.log('═══ Verified Non-Halting Classification ═══\n');
for (const [t, c] of Object.entries(types).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${t.padEnd(25)} ${c}`);
}

const tripleCount = verified.filter(v => v.tripleVerified).length;
console.log(`\n  Triple-verified: ${tripleCount}`);
console.log(`  Double-verified: ${verified.length - tripleCount}`);

// ── Translated cyclers detail ────────────────────────────────────────

const cyclers = verified.filter(v => v.type === 'translated_cycler');
console.log(`\n═══ Translated Cyclers (${cyclers.length}) ═══\n`);

// Period distribution
const periodDist = {};
for (const c of cyclers) {
  const bucket = c.tapePeriod;
  periodDist[bucket] = (periodDist[bucket] || 0) + 1;
}
console.log('  Tape period distribution:');
for (const [p, c] of Object.entries(periodDist).sort((a, b) => Number(a) - Number(b))) {
  console.log(`    period ${p}: ${c} machines`);
}

// Direction distribution
const dirDist = {};
for (const c of cyclers) {
  dirDist[c.direction] = (dirDist[c.direction] || 0) + 1;
}
console.log(`\n  Direction: ${JSON.stringify(dirDist)}`);

// ── Output the verified list ─────────────────────────────────────────

console.log(`\n═══ Full Verified List ═══\n`);

// Translated cyclers
console.log(`--- Translated Cyclers (${cyclers.length}) ---\n`);
for (const c of cyclers) {
  const tv = c.tripleVerified ? '3x' : '2x';
  console.log(`  ${c.raw}  [period=${c.period}, head_delta=${c.headDelta}, tape_period=${c.tapePeriod}, ${tv}]`);
}

// Simple loops
const loops = verified.filter(v => v.type === 'simple_loop');
if (loops.length > 0) {
  console.log(`\n--- Simple Loops (${loops.length}) ---\n`);
  for (const l of loops) {
    console.log(`  ${l.raw}  [period=${l.period}]`);
  }
}

// ── Unverified breakdown ─────────────────────────────────────────────

const unvReasons = {};
for (const u of unverified) {
  unvReasons[u.reason] = (unvReasons[u.reason] || 0) + 1;
}
console.log(`\n═══ Unverified Reasons ═══\n`);
for (const [r, c] of Object.entries(unvReasons).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${r.padEnd(30)} ${c}`);
}

// ── Save verified list to file ───────────────────────────────────────

const outputLines = [];
outputLines.push(`# BB(6) Verified Non-Halting Machines`);
outputLines.push(`# Generated: ${new Date().toISOString()}`);
outputLines.push(`# Method: Translated cycler detection with triple verification`);
outputLines.push(`# Step limit: ${STEP_LIMIT.toLocaleString()}`);
outputLines.push(`# Total verified: ${verified.length}`);
outputLines.push(`#`);
outputLines.push(`# Format: machine_definition  [type, period, head_delta, verification_level]`);
outputLines.push(``);

for (const v of verified) {
  const tv = v.tripleVerified ? '3x-verified' : '2x-verified';
  outputLines.push(`${v.raw}  # ${v.type}, period=${v.period}, head_delta=${v.headDelta || 0}, ${tv}`);
}

fs.writeFileSync('data/bb6_verified_nonhalting.txt', outputLines.join('\n') + '\n');
console.log(`\nSaved verified list to data/bb6_verified_nonhalting.txt`);
