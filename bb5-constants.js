/**
 * BB(5) Constant Analysis
 *
 * Two questions:
 *   1. Is the inter-crash ratio exactly e (2.71828...) or something else?
 *   2. Does the loss fraction converge to exactly 2/3?
 *
 * Uses exact crash data from our analysis.
 */

// Exact crash start steps from our analysis
const crashes = [
  { start: 35000, peak: 335, trough: 183 },
  { start: 99000, peak: 563, trough: 263 },
  { start: 280000, peak: 947, trough: 389 },
  { start: 785000, peak: 1585, trough: 593 },
  { start: 2190000, peak: 2647, trough: 945 },
  { start: 6098000, peak: 4417, trough: 1537 },
  { start: 16963000, peak: 7367, trough: 2525 },
  { start: 47164000, peak: 12285, trough: 4098 },
];

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║       BB(5) CONSTANT ANALYSIS                          ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

// ═══ Question 1: Inter-crash ratio ═══════════════════════════════════

console.log('═══ Q1: What is the inter-crash interval ratio? ═══\n');

const intervals = [];
for (let i = 1; i < crashes.length; i++) {
  intervals.push(crashes[i].start - crashes[i - 1].start);
}

console.log('  Inter-crash intervals:');
for (let i = 0; i < intervals.length; i++) {
  console.log(`    Crash ${i + 1}→${i + 2}: ${intervals[i].toLocaleString()} steps`);
}

const ratios = [];
for (let i = 1; i < intervals.length; i++) {
  ratios.push(intervals[i] / intervals[i - 1]);
}

console.log('\n  Successive interval ratios:');
for (let i = 0; i < ratios.length; i++) {
  console.log(`    Interval ${i + 2}/${i + 1}: ${ratios[i].toFixed(8)}`);
}

const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
const lastRatio = ratios[ratios.length - 1];

console.log(`\n  Average ratio:     ${avgRatio.toFixed(8)}`);
console.log(`  Last ratio:        ${lastRatio.toFixed(8)}`);
console.log(`  e =                ${Math.E.toFixed(8)}`);
console.log(`  e - avg ratio:     ${(Math.E - avgRatio).toFixed(8)}`);
console.log(`  e - last ratio:    ${(Math.E - lastRatio).toFixed(8)}`);

// Test other candidate constants
const candidates = [
  { name: 'e', value: Math.E },
  { name: 'e - 1/e', value: Math.E - 1/Math.E },
  { name: 'sqrt(e)', value: Math.sqrt(Math.E) },
  { name: 'e^(2/3)', value: Math.pow(Math.E, 2/3) },
  { name: '1 + sqrt(3)', value: 1 + Math.sqrt(3) },
  { name: 'phi + 1 (phi=golden)', value: (1 + Math.sqrt(5)) / 2 + 1 },
  { name: 'phi^2', value: Math.pow((1 + Math.sqrt(5)) / 2, 2) },
  { name: 'sqrt(2) + 1', value: Math.sqrt(2) + 1 },
  { name: '2 + sqrt(2)/2', value: 2 + Math.sqrt(2) / 2 },
  { name: '25/9', value: 25 / 9 },
  { name: '14/5', value: 14 / 5 },
  { name: '11/4', value: 11 / 4 },
  { name: 'sqrt(8)', value: Math.sqrt(8) },
  { name: '2^(3/2)', value: Math.pow(2, 1.5) },
  { name: 'log2(e) + 1', value: Math.log2(Math.E) + 1 },
  { name: '3 - 1/e', value: 3 - 1/Math.E },
  { name: 'pi - 1/3', value: Math.PI - 1/3 },
  { name: '(1+sqrt(5))/2 + 1', value: (1+Math.sqrt(5))/2 + 1 },
];

console.log('\n  Candidate constant matching (using last 3 ratios avg):');
const lateAvg = ratios.slice(-3).reduce((a, b) => a + b, 0) / 3;
console.log(`  Late average (last 3): ${lateAvg.toFixed(8)}\n`);

candidates.sort((a, b) => Math.abs(a.value - lateAvg) - Math.abs(b.value - lateAvg));
console.log('  Candidate               Value        Δ from late avg');
console.log('  ────────────────────────────────────────────────────');
for (const c of candidates.slice(0, 10)) {
  const delta = c.value - lateAvg;
  console.log(`  ${c.name.padEnd(22)} ${c.value.toFixed(8)}   ${delta >= 0 ? '+' : ''}${delta.toFixed(8)}`);
}

// ═══ Also try: ratio of crash starts directly ═══════════════════════

console.log('\n═══ Direct crash-start ratios (crash_n+1 / crash_n) ═══\n');
for (let i = 1; i < crashes.length; i++) {
  const r = crashes[i].start / crashes[i - 1].start;
  console.log(`  Crash ${i + 1} / Crash ${i}: ${crashes[i].start.toLocaleString()} / ${crashes[i - 1].start.toLocaleString()} = ${r.toFixed(8)}`);
}

const directRatios = [];
for (let i = 1; i < crashes.length; i++) {
  directRatios.push(crashes[i].start / crashes[i - 1].start);
}
const directLateAvg = directRatios.slice(-3).reduce((a, b) => a + b, 0) / 3;
console.log(`\n  Late average (last 3): ${directLateAvg.toFixed(8)}`);
console.log(`  e =                    ${Math.E.toFixed(8)}`);
console.log(`  Difference:            ${(directLateAvg - Math.E).toFixed(8)}`);

// ═══ Question 2: Loss fraction convergence ══════════════════════════

console.log('\n\n═══ Q2: Does the loss fraction converge to 2/3? ═══\n');

console.log('  Crash | Peak    | Trough | Loss   | Loss fraction | 1 - fraction | Δ from 2/3');
console.log('  ──────┼─────────┼────────┼────────┼───────────────┼──────────────┼───────────');
for (let i = 0; i < crashes.length; i++) {
  const c = crashes[i];
  const lossFrac = c.loss / c.peak;
  const keepFrac = 1 - lossFrac;
  const delta = lossFrac - 2 / 3;
  const loss = c.peak - c.trough;
  console.log(`  ${String(i + 1).padStart(4)}  | ${String(c.peak).padStart(7)} | ${String(c.trough).padStart(6)} | ${String(loss).padStart(6)} | ${lossFrac.toFixed(8)}    | ${keepFrac.toFixed(8)}   | ${delta >= 0 ? '+' : ''}${delta.toFixed(8)}`);
}

// Trough/peak ratio (= keep fraction)
console.log('\n  Trough/Peak ratios (what fraction survives):');
const keepFractions = [];
for (let i = 0; i < crashes.length; i++) {
  const c = crashes[i];
  const keep = c.trough / c.peak;
  keepFractions.push(keep);
  console.log(`    Crash ${i + 1}: ${keep.toFixed(8)}`);
}

const lateKeep = keepFractions.slice(-3).reduce((a, b) => a + b, 0) / 3;
console.log(`\n  Late average keep fraction: ${lateKeep.toFixed(8)}`);
console.log(`  1/3 =                       ${(1 / 3).toFixed(8)}`);
console.log(`  Difference:                 ${(lateKeep - 1 / 3).toFixed(8)}`);
console.log(`  1/e =                       ${(1 / Math.E).toFixed(8)}`);
console.log(`  Difference from 1/e:        ${(lateKeep - 1 / Math.E).toFixed(8)}`);

// Check candidate fractions for trough/peak
console.log('\n  Candidate survival fractions:');
const fracCandidates = [
  { name: '1/3', value: 1 / 3 },
  { name: '1/e', value: 1 / Math.E },
  { name: '1/pi', value: 1 / Math.PI },
  { name: '1/sqrt(e)', value: 1 / Math.sqrt(Math.E) },
  { name: 'e - 2', value: Math.E - 2 },
  { name: '1/phi', value: 2 / (1 + Math.sqrt(5)) },
  { name: 'ln(2)', value: Math.LN2 },
  { name: '2/pi', value: 2 / Math.PI },
  { name: '(sqrt(5)-1)/2 - 1/4', value: (Math.sqrt(5) - 1) / 2 - 0.25 },
  { name: '3/10', value: 0.3 },
  { name: '1/sqrt(10)', value: 1 / Math.sqrt(10) },
  { name: 'sqrt(1/9)', value: 1 / 3 },
  { name: '1/(1+sqrt(3))', value: 1 / (1 + Math.sqrt(3)) },
  { name: '2 - sqrt(3)', value: 2 - Math.sqrt(3) },
  { name: '1/2.78', value: 1 / 2.78 },
];

fracCandidates.sort((a, b) => Math.abs(a.value - lateKeep) - Math.abs(b.value - lateKeep));
console.log(`\n  Late keep fraction: ${lateKeep.toFixed(8)}\n`);
console.log('  Candidate               Value        Δ from late avg');
console.log('  ────────────────────────────────────────────────────');
for (const c of fracCandidates.slice(0, 8)) {
  const delta = c.value - lateKeep;
  console.log(`  ${c.name.padEnd(22)} ${c.value.toFixed(8)}   ${delta >= 0 ? '+' : ''}${delta.toFixed(8)}`);
}

// ═══ Relationship between the two constants ═════════════════════════

console.log('\n\n═══ Relationship Between Constants ═══\n');
console.log('If the interval ratio is r and the keep fraction is k:');
console.log(`  r (late avg):     ${directLateAvg.toFixed(8)}`);
console.log(`  k (late avg):     ${lateKeep.toFixed(8)}`);
console.log(`  r * k:            ${(directLateAvg * lateKeep).toFixed(8)}`);
console.log(`  r + k:            ${(directLateAvg + lateKeep).toFixed(8)}`);
console.log(`  r^k:              ${Math.pow(directLateAvg, lateKeep).toFixed(8)}`);
console.log(`  k^r:              ${Math.pow(lateKeep, directLateAvg).toFixed(8)}`);
console.log(`  1/r:              ${(1 / directLateAvg).toFixed(8)}`);
console.log(`  1 - k:            ${(1 - lateKeep).toFixed(8)}`);
console.log(`  ln(r):            ${Math.log(directLateAvg).toFixed(8)}`);
console.log(`  -ln(k):           ${(-Math.log(lateKeep)).toFixed(8)}`);

// ═══ Peak growth analysis ════════════════════════════════════════════

console.log('\n═══ Peak Growth Between Crashes ═══\n');
console.log('  Peak ratios (peak_n+1 / peak_n):');
for (let i = 1; i < crashes.length; i++) {
  const r = crashes[i].peak / crashes[i - 1].peak;
  console.log(`    Peak ${i + 1} / Peak ${i}: ${crashes[i].peak} / ${crashes[i - 1].peak} = ${r.toFixed(8)}`);
}

const peakRatios = [];
for (let i = 1; i < crashes.length; i++) {
  peakRatios.push(crashes[i].peak / crashes[i - 1].peak);
}
const latePeakRatio = peakRatios.slice(-3).reduce((a, b) => a + b, 0) / 3;
console.log(`\n  Late average peak ratio: ${latePeakRatio.toFixed(8)}`);
console.log(`  sqrt(e) =                ${Math.sqrt(Math.E).toFixed(8)}`);
console.log(`  5/3 =                    ${(5 / 3).toFixed(8)}`);
console.log(`  phi =                    ${((1 + Math.sqrt(5)) / 2).toFixed(8)}`);

// ═══ Trough-to-next-peak ratio ══════════════════════════════════════

console.log('\n═══ Recovery Multiplier (next peak / trough) ═══\n');
for (let i = 0; i < crashes.length - 1; i++) {
  const recovery = crashes[i + 1].peak / crashes[i].trough;
  console.log(`  Crash ${i + 1} trough → Crash ${i + 2} peak: ${crashes[i + 1].peak} / ${crashes[i].trough} = ${recovery.toFixed(4)}`);
}

const recoveryMults = [];
for (let i = 0; i < crashes.length - 1; i++) {
  recoveryMults.push(crashes[i + 1].peak / crashes[i].trough);
}
const lateRecovery = recoveryMults.slice(-3).reduce((a, b) => a + b, 0) / 3;
console.log(`\n  Late average recovery multiplier: ${lateRecovery.toFixed(8)}`);
console.log(`  e =                               ${Math.E.toFixed(8)}`);
console.log(`  Difference from e:                ${(lateRecovery - Math.E).toFixed(8)}`);

// ═══ Summary ═════════════════════════════════════════════════════════

console.log('\n\n═══ SUMMARY ═══\n');
console.log(`  Inter-crash interval ratio: ${directLateAvg.toFixed(4)} (e = ${Math.E.toFixed(4)}, diff = ${(directLateAvg - Math.E).toFixed(4)})`);
console.log(`  Survival fraction:          ${lateKeep.toFixed(4)} (1/3 = ${(1/3).toFixed(4)}, diff = ${(lateKeep - 1/3).toFixed(4)})`);
console.log(`  Peak growth ratio:          ${latePeakRatio.toFixed(4)}`);
console.log(`  Recovery multiplier:        ${lateRecovery.toFixed(4)} (e = ${Math.E.toFixed(4)}, diff = ${(lateRecovery - Math.E).toFixed(4)})`);
