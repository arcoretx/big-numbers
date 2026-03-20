/**
 * Busy Beaver Project — Interactive Site
 *
 * 1. TM Simulator (step through BB champions)
 * 2. BB(5) crash dynamics chart
 */

// ═══ TM Simulator ═══════════════════════════════════════════════════

const BB_CHAMPIONS = {
  1: { transitions: [['A',0,1,'R','H']], ones: 1, steps: 1 },
  2: {
    transitions: [
      ['A',0,1,'R','B'],['A',1,1,'L','B'],
      ['B',0,1,'L','A'],['B',1,1,'R','H'],
    ], ones: 4, steps: 6,
  },
  3: {
    transitions: [
      ['A',0,1,'R','B'],['A',1,1,'R','H'],
      ['B',0,0,'R','C'],['B',1,1,'R','B'],
      ['C',0,1,'L','C'],['C',1,1,'L','A'],
    ], ones: 6, steps: 14,
  },
  4: {
    transitions: [
      ['A',0,1,'R','B'],['A',1,1,'L','B'],
      ['B',0,1,'L','A'],['B',1,0,'L','C'],
      ['C',0,1,'R','H'],['C',1,1,'L','D'],
      ['D',0,1,'R','D'],['D',1,0,'R','A'],
    ], ones: 13, steps: 107,
  },
};

class TuringMachine {
  constructor(transitions) {
    this.table = {};
    for (const [s, r, w, m, n] of transitions) {
      this.table[`${s},${r}`] = { write: w, move: m, next: n };
    }
    this.reset();
  }

  reset() {
    this.tape = {};
    this.head = 0;
    this.state = 'A';
    this.steps = 0;
    this.halted = false;
  }

  read(pos) { return this.tape[pos] || 0; }

  step() {
    if (this.halted) return false;
    const sym = this.read(this.head);
    const instr = this.table[`${this.state},${sym}`];
    if (!instr) { this.halted = true; return false; }
    this.tape[this.head] = instr.write;
    this.head += instr.move === 'R' ? 1 : -1;
    this.state = instr.next;
    this.steps++;
    if (this.state === 'H') { this.halted = true; return false; }
    return true;
  }

  countOnes() {
    return Object.values(this.tape).filter(v => v === 1).length;
  }
}

// ── Demo UI ──────────────────────────────────────────────────────────

let currentMachine = null;
let runInterval = null;
const TAPE_CELLS = 21;
const TAPE_CENTER = 10;

function initDemo() {
  const select = document.getElementById('demo-select');
  const stepBtn = document.getElementById('demo-step');
  const runBtn = document.getElementById('demo-run');
  const resetBtn = document.getElementById('demo-reset');

  if (!select) return;

  function loadMachine() {
    stopRun();
    const n = parseInt(select.value);
    currentMachine = new TuringMachine(BB_CHAMPIONS[n].transitions);
    renderTape();
  }

  function renderTape() {
    const tapeEl = document.getElementById('demo-tape');
    const stateEl = document.getElementById('demo-state');
    const stepsEl = document.getElementById('demo-steps');
    const onesEl = document.getElementById('demo-ones');

    let html = '';
    for (let i = -TAPE_CENTER; i <= TAPE_CENTER; i++) {
      const pos = currentMachine.head + i;
      const val = currentMachine.read(pos);
      const isHead = i === 0;
      const classes = ['cell'];
      if (val === 1) classes.push('one');
      if (isHead) classes.push('head');
      html += `<div class="${classes.join(' ')}">${val}</div>`;
    }
    tapeEl.innerHTML = html;
    stateEl.textContent = currentMachine.halted ? 'HALT' : currentMachine.state;
    stepsEl.textContent = currentMachine.steps;
    onesEl.textContent = currentMachine.countOnes();
  }

  function doStep() {
    if (currentMachine && !currentMachine.halted) {
      currentMachine.step();
      renderTape();
      if (currentMachine.halted) stopRun();
    }
  }

  function startRun() {
    stopRun();
    runInterval = setInterval(doStep, 200);
    runBtn.textContent = 'Pause';
  }

  function stopRun() {
    if (runInterval) { clearInterval(runInterval); runInterval = null; }
    if (runBtn) runBtn.textContent = 'Run';
  }

  stepBtn.addEventListener('click', doStep);
  runBtn.addEventListener('click', () => runInterval ? stopRun() : startRun());
  resetBtn.addEventListener('click', loadMachine);
  select.addEventListener('change', loadMachine);

  loadMachine();
}

// ═══ BB(5) Crash Chart ═══════════════════════════════════════════════

const CRASH_DATA = [
  { step: 35000, peak: 335, trough: 183 },
  { step: 99000, peak: 563, trough: 263 },
  { step: 280000, peak: 947, trough: 389 },
  { step: 785000, peak: 1585, trough: 593 },
  { step: 2190000, peak: 2647, trough: 945 },
  { step: 6098000, peak: 4417, trough: 1537 },
  { step: 16963000, peak: 7367, trough: 2525 },
  { step: 47164000, peak: 12285, trough: 4098 },
];

function drawCrashChart() {
  const canvas = document.getElementById('crash-chart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = (rect.width - 40) * dpr;
  canvas.height = 400 * dpr;
  canvas.style.width = (rect.width - 40) + 'px';
  canvas.style.height = '400px';
  ctx.scale(dpr, dpr);

  const W = rect.width - 40;
  const H = 400;
  const pad = { top: 30, right: 30, bottom: 50, left: 70 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  // Use log scale for x axis
  const maxStep = 50000000;
  const maxOnes = 13000;
  const minStep = 10000;

  function xPos(step) {
    return pad.left + (Math.log10(Math.max(step, minStep)) - Math.log10(minStep)) / (Math.log10(maxStep) - Math.log10(minStep)) * plotW;
  }
  function yPos(ones) {
    return pad.top + plotH - (ones / maxOnes) * plotH;
  }

  // Background
  ctx.fillStyle = '#12121a';
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = '#1e1e2e';
  ctx.lineWidth = 1;
  for (let p = 4; p <= 7; p++) {
    const x = xPos(Math.pow(10, p));
    ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, H - pad.bottom); ctx.stroke();
  }
  for (let o = 0; o <= 12000; o += 2000) {
    const y = yPos(o);
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
  }

  // Axes labels
  ctx.fillStyle = '#8888a0';
  ctx.font = '12px Inter';
  ctx.textAlign = 'center';
  for (let p = 4; p <= 7; p++) {
    ctx.fillText(`10^${p}`, xPos(Math.pow(10, p)), H - pad.bottom + 20);
  }
  ctx.fillText('Steps', W / 2, H - 8);

  ctx.textAlign = 'right';
  for (let o = 0; o <= 12000; o += 2000) {
    ctx.fillText(o.toLocaleString(), pad.left - 8, yPos(o) + 4);
  }
  ctx.save();
  ctx.translate(14, H / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('Ones on tape', 0, 0);
  ctx.restore();

  // Draw sawtooth pattern
  // Build approximate ones-over-time from crash data
  const points = [];
  points.push({ x: minStep, y: 0 });

  for (let i = 0; i < CRASH_DATA.length; i++) {
    const c = CRASH_DATA[i];
    // Rise to peak
    points.push({ x: c.step, y: c.peak });
    // Drop to trough
    points.push({ x: c.step * 1.001, y: c.trough });
  }

  // Draw the sawtooth
  ctx.beginPath();
  ctx.strokeStyle = '#6c8cff';
  ctx.lineWidth = 2;
  ctx.moveTo(xPos(points[0].x), yPos(points[0].y));
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(xPos(points[i].x), yPos(points[i].y));
  }
  ctx.stroke();

  // Mark crash points
  for (const c of CRASH_DATA) {
    // Peak dot
    ctx.beginPath();
    ctx.arc(xPos(c.step), yPos(c.peak), 4, 0, Math.PI * 2);
    ctx.fillStyle = '#6c8cff';
    ctx.fill();

    // Trough dot
    ctx.beginPath();
    ctx.arc(xPos(c.step * 1.001), yPos(c.trough), 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ff6c8c';
    ctx.fill();

    // Drop line
    ctx.beginPath();
    ctx.strokeStyle = '#ff6c8c44';
    ctx.lineWidth = 1;
    ctx.moveTo(xPos(c.step), yPos(c.peak));
    ctx.lineTo(xPos(c.step * 1.001), yPos(c.trough));
    ctx.stroke();
  }

  // 5/3 growth line
  ctx.beginPath();
  ctx.strokeStyle = '#4cdf7c44';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  let refOnes = 335;
  let refStep = 35000;
  for (let i = 0; i < 8; i++) {
    ctx.moveTo(xPos(refStep), yPos(refOnes));
    refOnes *= 5 / 3;
    refStep *= 25 / 9;
    ctx.lineTo(xPos(refStep), yPos(refOnes));
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Legend
  ctx.font = '11px JetBrains Mono';
  ctx.fillStyle = '#6c8cff';
  ctx.fillText('peak', W - pad.right - 60, pad.top + 15);
  ctx.fillStyle = '#ff6c8c';
  ctx.fillText('trough', W - pad.right - 60, pad.top + 30);
  ctx.fillStyle = '#4cdf7c';
  ctx.fillText('5/3 growth', W - pad.right - 60, pad.top + 45);
}

// ═══ Init ════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  initDemo();
  drawCrashChart();
  window.addEventListener('resize', drawCrashChart);
});
