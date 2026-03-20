// ── Interactive Visualization Registry ──
// Each viz is a function that receives a container element and sets up the interactive.

const VISUALIZATIONS = {

    // ─── A MILLION DOTS ──────────────────────────────────────────
    // Shows 1,000,000 tiny dots so you can viscerally feel the quantity
    millionDots(container) {
        const canvas = document.createElement('canvas');
        const h = 400;
        canvas.style.width = '100%';
        canvas.style.height = h + 'px';
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        let cols, rows, dotSize, gap;

        function resize() {
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width * devicePixelRatio;
            canvas.height = h * devicePixelRatio;
            ctx.scale(devicePixelRatio, devicePixelRatio);

            // Pack ~1,000,000 dots
            const area = rect.width * h;
            dotSize = Math.max(0.5, Math.sqrt(area / 1200000));
            gap = dotSize * 1.4;
            cols = Math.floor(rect.width / gap);
            rows = Math.floor(h / gap);
        }

        let highlightCount = 0;
        let animFrame;

        function draw() {
            const w = canvas.width / devicePixelRatio;
            ctx.clearRect(0, 0, w, h);

            const total = cols * rows;
            const offsetX = (w - cols * gap) / 2;
            const offsetY = (h - rows * gap) / 2;

            for (let i = 0; i < total; i++) {
                const col = i % cols;
                const row = Math.floor(i / cols);
                const x = offsetX + col * gap + gap / 2;
                const y = offsetY + row * gap + gap / 2;

                if (i < highlightCount) {
                    ctx.fillStyle = 'rgba(139, 198, 236, 0.9)';
                } else {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
                }
                ctx.fillRect(x - dotSize / 2, y - dotSize / 2, dotSize, dotSize);
            }
        }

        function animateHighlight(target) {
            const step = Math.max(1, Math.floor(cols * rows / 120));
            function tick() {
                if (highlightCount < target) {
                    highlightCount = Math.min(target, highlightCount + step);
                    draw();
                    animFrame = requestAnimationFrame(tick);
                }
            }
            cancelAnimationFrame(animFrame);
            tick();
        }

        resize();
        draw();
        window.addEventListener('resize', () => { resize(); draw(); });

        // Controls
        const controls = document.createElement('div');
        controls.className = 'viz-controls';
        controls.innerHTML = `
            <span class="viz-label">highlight</span>
            <button data-n="1000">1,000</button>
            <button data-n="10000">10,000</button>
            <button data-n="100000">100,000</button>
            <button data-n="all">All ~${(cols * rows).toLocaleString()}</button>
            <button data-n="0">Reset</button>
        `;
        container.appendChild(controls);

        controls.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON') return;
            const n = e.target.dataset.n;
            highlightCount = 0;
            if (n === 'all') {
                animateHighlight(cols * rows);
            } else {
                animateHighlight(parseInt(n) || 0);
            }
        });
    },

    // ─── ARROW NOTATION EXPLORER ────────────────────────────────
    // Lets you see how Knuth's up-arrow grows
    arrowExplorer(container) {
        const display = document.createElement('div');
        display.className = 'viz';
        display.style.whiteSpace = 'pre';
        display.style.minHeight = '200px';
        container.appendChild(display);

        const controls = document.createElement('div');
        controls.className = 'viz-controls';
        controls.innerHTML = `
            <span class="viz-label">arrows</span>
            <button data-arrows="1" class="active">&#8593;</button>
            <button data-arrows="2">&#8593;&#8593;</button>
            <button data-arrows="3">&#8593;&#8593;&#8593;</button>
            <button data-arrows="4">&#8593;&#8593;&#8593;&#8593;</button>
        `;
        container.appendChild(controls);

        function arrowStr(n) {
            return '\u2191'.repeat(n);
        }

        function compute(a, arrows, b) {
            // Only actually compute for small cases
            if (arrows === 1) return Math.pow(a, b);
            if (arrows === 2 && a === 3 && b <= 4) {
                // Tetration: 3^^b
                let r = 3;
                for (let i = 1; i < b; i++) r = Math.pow(3, r);
                return r;
            }
            return null; // Too large
        }

        function explain(arrows) {
            const a = arrowStr(arrows);
            let lines = [];

            if (arrows === 1) {
                lines.push(`3 ${a} 1 = 3\u00b9 = 3`);
                lines.push(`3 ${a} 2 = 3\u00b2 = 9`);
                lines.push(`3 ${a} 3 = 3\u00b3 = 27`);
                lines.push(`3 ${a} 4 = 3\u2074 = 81`);
                lines.push(`3 ${a} 10 = 3\u00b9\u2070 = 59,049`);
                lines.push(``);
                lines.push(`This is just exponentiation: 3\u207F`);
            } else if (arrows === 2) {
                lines.push(`3 ${a} 1 = 3`);
                lines.push(`3 ${a} 2 = 3\u00b3 = 27`);
                lines.push(`3 ${a} 3 = 3\u00b3\u00b3 = 3\u00b2\u2077 = 7,625,597,484,987`);
                lines.push(`3 ${a} 4 = 3\u00b3\u00b3\u00b3 = 3^7,625,597,484,987`);
                lines.push(`           = a number with ~3.6 trillion digits`);
                lines.push(``);
                lines.push(`Tetration: a tower of 3s, b levels high.`);
                lines.push(`Each level doesn't add — it exponentiates.`);
            } else if (arrows === 3) {
                lines.push(`3 ${a} 1 = 3`);
                lines.push(`3 ${a} 2 = 3 \u2191\u2191 3 = 7,625,597,484,987`);
                lines.push(`3 ${a} 3 = 3 \u2191\u2191 7,625,597,484,987`);
                lines.push(`         = a tower of 3s`);
                lines.push(`           7.6 TRILLION levels tall`);
                lines.push(``);
                lines.push(`Pentation. The height of the tower`);
                lines.push(`is itself computed by tetration.`);
                lines.push(`The result has more digits than atoms`);
                lines.push(`in the observable universe. By a lot.`);
            } else if (arrows === 4) {
                lines.push(`3 ${a} 1 = 3`);
                lines.push(`3 ${a} 2 = 3 \u2191\u2191\u2191 3`);
                lines.push(`         = a tower of 3s, 7.6T levels high`);
                lines.push(`3 ${a} 3 = 3 \u2191\u2191\u2191 (3 \u2191\u2191\u2191 3)`);
                lines.push(`         = 3 \u2191\u2191\u2191 [that tower result]`);
                lines.push(``);
                lines.push(`Hexation. We pentation by the`);
                lines.push(`result of the previous pentation.`);
                lines.push(``);
                lines.push(`This is where Graham's Number STARTS.`);
                lines.push(`g\u2081 = 3 \u2191\u2191\u2191\u2191 3`);
                lines.push(`Then g\u2082 uses g\u2081 arrows...`);
            }
            return lines.join('\n');
        }

        display.textContent = explain(1);

        controls.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON') return;
            controls.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const n = parseInt(e.target.dataset.arrows);
            display.textContent = explain(n);
        });
    },

    // ─── CANTOR'S DIAGONAL ──────────────────────────────────────
    // Animated proof that the reals are uncountable
    cantorDiagonal(container) {
        const canvas = document.createElement('canvas');
        const h = 360;
        canvas.style.width = '100%';
        canvas.style.height = h + 'px';
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        const gridSize = 8;
        const digits = [];
        for (let r = 0; r < gridSize; r++) {
            digits.push([]);
            for (let c = 0; c < gridSize + 3; c++) {
                digits[r].push(Math.floor(Math.random() * 10));
            }
        }

        let step = 0; // 0 = show grid, 1..gridSize = highlighting diagonal, gridSize+1 = show new number
        let animating = false;

        function draw() {
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width * devicePixelRatio;
            canvas.height = h * devicePixelRatio;
            ctx.scale(devicePixelRatio, devicePixelRatio);
            const w = rect.width;

            ctx.clearRect(0, 0, w, h);

            const cellW = 36;
            const cellH = 36;
            const startX = (w - (gridSize + 4) * cellW) / 2;
            const startY = 30;

            ctx.font = '14px JetBrains Mono, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            for (let r = 0; r < gridSize; r++) {
                // Row number
                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.fillText(`${r + 1}:`, startX, startY + r * cellH + cellH / 2);

                // "0."
                ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.fillText('0.', startX + cellW, startY + r * cellH + cellH / 2);

                for (let c = 0; c < gridSize + 3; c++) {
                    const x = startX + (c + 2) * cellW;
                    const y = startY + r * cellH;
                    const digit = digits[r][c];

                    const isDiag = c === r;
                    const isHighlighted = isDiag && step > r;

                    if (isHighlighted) {
                        // Diagonal cell highlighted
                        ctx.fillStyle = 'rgba(255, 107, 107, 0.15)';
                        ctx.fillRect(x, y, cellW, cellH);
                        ctx.strokeStyle = 'rgba(255, 107, 107, 0.5)';
                        ctx.strokeRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);
                        ctx.fillStyle = '#ff6b6b';
                    } else {
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                    }

                    ctx.fillText(digit.toString(), x + cellW / 2, y + cellH / 2);
                }

                // Ellipsis
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.fillText('...', startX + (gridSize + 5) * cellW - cellW, startY + r * cellH + cellH / 2);
            }

            // New number at bottom
            if (step > 0) {
                const newY = startY + gridSize * cellH + 30;
                ctx.fillStyle = 'rgba(52, 211, 153, 0.6)';
                ctx.font = '13px JetBrains Mono, monospace';
                ctx.textAlign = 'left';
                ctx.fillText('New: 0.', startX, newY);

                for (let c = 0; c < Math.min(step, gridSize); c++) {
                    const x = startX + (c + 2) * cellW;
                    const newDigit = (digits[c][c] + 1) % 10;

                    ctx.fillStyle = 'rgba(52, 211, 153, 0.9)';
                    ctx.font = '15px JetBrains Mono, monospace';
                    ctx.textAlign = 'center';
                    ctx.fillText(newDigit.toString(), x + cellW / 2, newY);
                }

                if (step > gridSize) {
                    ctx.fillStyle = 'rgba(52, 211, 153, 0.4)';
                    ctx.font = '13px JetBrains Mono, monospace';
                    ctx.textAlign = 'left';
                    const msgX = startX;
                    const msgY = newY + 35;
                    ctx.fillText('This number differs from every row.', msgX, msgY);
                    ctx.fillText('No list of reals can ever be complete.', msgX, msgY + 22);
                }
            }
        }

        function animate() {
            if (animating) return;
            animating = true;
            step = 0;
            draw();

            function nextStep() {
                step++;
                draw();
                if (step <= gridSize + 1) {
                    setTimeout(nextStep, 400);
                } else {
                    animating = false;
                }
            }
            setTimeout(nextStep, 600);
        }

        const controls = document.createElement('div');
        controls.className = 'viz-controls';
        controls.innerHTML = `
            <button id="cantor-run">Run the diagonal argument</button>
            <button id="cantor-reset">New random numbers</button>
        `;
        container.appendChild(controls);

        function initResize() {
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width * devicePixelRatio;
            canvas.height = h * devicePixelRatio;
            draw();
        }

        controls.querySelector('#cantor-run').addEventListener('click', animate);
        controls.querySelector('#cantor-reset').addEventListener('click', () => {
            for (let r = 0; r < gridSize; r++) {
                for (let c = 0; c < gridSize + 3; c++) {
                    digits[r][c] = Math.floor(Math.random() * 10);
                }
            }
            step = 0;
            animating = false;
            draw();
        });

        window.addEventListener('resize', initResize);
        setTimeout(initResize, 50);
    },

    // ─── HILBERT'S HOTEL ────────────────────────────────────────
    // Animated rooms showing infinite hotel paradox
    hilbertHotel(container) {
        const canvas = document.createElement('canvas');
        const h = 280;
        canvas.style.width = '100%';
        canvas.style.height = h + 'px';
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        const roomCount = 12;
        let rooms = Array.from({ length: roomCount }, (_, i) => ({ guest: i + 1, highlight: false }));
        let newGuest = null;
        let mode = 'full'; // full, shift, doubled

        function draw() {
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width * devicePixelRatio;
            canvas.height = h * devicePixelRatio;
            ctx.scale(devicePixelRatio, devicePixelRatio);
            const w = rect.width;

            ctx.clearRect(0, 0, w, h);

            const roomW = Math.min(56, (w - 40) / (roomCount + 1));
            const roomH = 70;
            const startX = (w - roomCount * roomW) / 2;
            const startY = 80;

            // Title
            ctx.font = '13px JetBrains Mono, monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(52, 211, 153, 0.5)';
            let title = 'Hilbert\'s Hotel: All rooms occupied';
            if (mode === 'shift') title = 'Everyone shifts up one room...';
            if (mode === 'doubled') title = 'Everyone moves to 2x their room...';
            ctx.fillText(title, w / 2, 30);

            // Rooms
            for (let i = 0; i < roomCount; i++) {
                const x = startX + i * roomW;
                const room = rooms[i];

                // Room box
                ctx.strokeStyle = room.highlight
                    ? 'rgba(52, 211, 153, 0.6)'
                    : 'rgba(255, 255, 255, 0.15)';
                ctx.lineWidth = room.highlight ? 2 : 1;
                ctx.strokeRect(x + 2, startY, roomW - 4, roomH);

                // Room number
                ctx.font = '10px JetBrains Mono, monospace';
                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.textAlign = 'center';
                ctx.fillText(`#${i + 1}`, x + roomW / 2, startY - 8);

                // Guest (circle + number)
                if (room.guest !== null) {
                    const cx = x + roomW / 2;
                    const cy = startY + roomH / 2;
                    ctx.beginPath();
                    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
                    ctx.fillStyle = room.highlight
                        ? 'rgba(52, 211, 153, 0.25)'
                        : 'rgba(139, 198, 236, 0.15)';
                    ctx.fill();
                    ctx.font = '11px JetBrains Mono, monospace';
                    ctx.fillStyle = room.highlight
                        ? 'rgba(52, 211, 153, 0.9)'
                        : 'rgba(139, 198, 236, 0.8)';
                    ctx.fillText(room.guest, cx, cy + 1);
                }
            }

            // Ellipsis
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.font = '18px JetBrains Mono, monospace';
            ctx.fillText('...', startX + roomCount * roomW + 16, startY + roomH / 2);

            // New guest waiting
            if (newGuest !== null) {
                const gx = startX - 50;
                const gy = startY + roomH / 2;
                ctx.beginPath();
                ctx.arc(gx, gy, 16, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(251, 191, 36, 0.2)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.font = '12px JetBrains Mono, monospace';
                ctx.fillStyle = 'rgba(251, 191, 36, 0.9)';
                ctx.textAlign = 'center';
                ctx.fillText(newGuest, gx, gy + 1);
                ctx.font = '10px JetBrains Mono, monospace';
                ctx.fillStyle = 'rgba(251, 191, 36, 0.5)';
                ctx.fillText('new!', gx, gy + 28);
            }

            // Bottom text
            ctx.font = '12px JetBrains Mono, monospace';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.textAlign = 'center';
            if (mode === 'full') ctx.fillText('Hotel is full. But there\'s always room...', w / 2, startY + roomH + 50);
            if (mode === 'shift') ctx.fillText('Room 1 is now free!', w / 2, startY + roomH + 50);
            if (mode === 'doubled') ctx.fillText('All odd rooms are now free!', w / 2, startY + roomH + 50);
        }

        const controls = document.createElement('div');
        controls.className = 'viz-controls';
        controls.innerHTML = `
            <button id="hilbert-one">+ 1 guest</button>
            <button id="hilbert-inf">+ \u221e guests</button>
            <button id="hilbert-reset">Reset</button>
        `;
        container.appendChild(controls);

        function reset() {
            rooms = Array.from({ length: roomCount }, (_, i) => ({ guest: i + 1, highlight: false }));
            newGuest = null;
            mode = 'full';
            draw();
        }

        controls.querySelector('#hilbert-one').addEventListener('click', () => {
            reset();
            newGuest = '?';
            draw();
            setTimeout(() => {
                mode = 'shift';
                rooms.forEach((r, i) => {
                    r.guest = i + 1;
                    r.highlight = i === 0;
                });
                // Shift everyone up
                for (let i = roomCount - 1; i > 0; i--) {
                    rooms[i].guest = rooms[i - 1].guest;
                }
                rooms[0].guest = null;
                rooms[0].highlight = true;
                draw();
                setTimeout(() => {
                    rooms[0].guest = '?';
                    newGuest = null;
                    draw();
                }, 800);
            }, 800);
        });

        controls.querySelector('#hilbert-inf').addEventListener('click', () => {
            reset();
            newGuest = '\u221e';
            draw();
            setTimeout(() => {
                mode = 'doubled';
                for (let i = 0; i < roomCount; i++) {
                    const origGuest = i + 1;
                    const newRoom = origGuest * 2 - 1;
                    rooms[i].guest = null;
                    rooms[i].highlight = false;
                }
                // Place guests in even-indexed rooms (0-indexed: 1,3,5,...)
                for (let i = 0; i < roomCount; i++) {
                    const destIdx = Math.min(i * 2, roomCount - 1);
                    if (i * 2 < roomCount) {
                        rooms[i * 2].guest = i + 1;
                    }
                    // Mark odd rooms as free (highlighted)
                    if (i * 2 + 1 < roomCount) {
                        rooms[i * 2 + 1].highlight = true;
                    }
                }
                newGuest = null;
                draw();
            }, 800);
        });

        controls.querySelector('#hilbert-reset').addEventListener('click', reset);

        function initResize() { draw(); }
        window.addEventListener('resize', initResize);
        setTimeout(() => draw(), 50);
    },

    // ─── BUSY BEAVER TAPE ───────────────────────────────────────
    // A tiny Turing machine running on a tape
    busyBeaverTape(container) {
        const canvas = document.createElement('canvas');
        const h = 200;
        canvas.style.width = '100%';
        canvas.style.height = h + 'px';
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d');

        // Simple 3-state busy beaver
        // State table: [state][read] = { write, move (R=1,L=-1), nextState }
        // Using the classic 3-state BB that runs for 21 steps
        const rules = {
            'A0': { write: 1, move: 1, next: 'B' },
            'A1': { write: 1, move: -1, next: 'C' },
            'B0': { write: 1, move: -1, next: 'A' },
            'B1': { write: 1, move: 1, next: 'B' },
            'C0': { write: 1, move: -1, next: 'B' },
            'C1': { write: 1, move: 0, next: 'HALT' },
        };

        let tape = {};
        let head = 0;
        let state = 'A';
        let stepCount = 0;
        let history = [];
        let playing = false;
        let playTimer = null;

        function reset() {
            tape = {};
            head = 0;
            state = 'A';
            stepCount = 0;
            history = [];
            playing = false;
            clearInterval(playTimer);
        }

        function step() {
            if (state === 'HALT') return false;
            const read = tape[head] || 0;
            const rule = rules[state + read];
            if (!rule) return false;

            history.push({ head, state, read });
            tape[head] = rule.write;
            state = rule.next;
            if (rule.move !== 0) head += rule.move;
            stepCount++;
            return state !== 'HALT';
        }

        function draw() {
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width * devicePixelRatio;
            canvas.height = h * devicePixelRatio;
            ctx.scale(devicePixelRatio, devicePixelRatio);
            const w = rect.width;

            ctx.clearRect(0, 0, w, h);

            const cellW = 32;
            const cellH = 36;
            const tapeY = 80;
            const visibleCells = Math.floor(w / cellW);
            const centerOffset = Math.floor(visibleCells / 2);

            // State display
            ctx.font = '13px JetBrains Mono, monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = state === 'HALT' ? 'rgba(255, 107, 107, 0.8)' : 'rgba(251, 191, 36, 0.7)';
            ctx.fillText(
                state === 'HALT' ? `HALTED after ${stepCount} steps` : `State: ${state}  |  Step: ${stepCount}`,
                w / 2, 30
            );

            // Tape
            for (let i = 0; i < visibleCells; i++) {
                const cellIdx = head - centerOffset + i;
                const x = i * cellW;
                const val = tape[cellIdx] || 0;
                const isHead = cellIdx === head;

                // Cell background
                if (isHead) {
                    ctx.fillStyle = state === 'HALT'
                        ? 'rgba(255, 107, 107, 0.15)'
                        : 'rgba(251, 191, 36, 0.12)';
                    ctx.fillRect(x, tapeY, cellW, cellH);
                }

                // Cell border
                ctx.strokeStyle = isHead
                    ? 'rgba(251, 191, 36, 0.5)'
                    : 'rgba(255, 255, 255, 0.08)';
                ctx.lineWidth = isHead ? 2 : 1;
                ctx.strokeRect(x, tapeY, cellW, cellH);

                // Cell value
                ctx.font = '14px JetBrains Mono, monospace';
                ctx.fillStyle = val === 1
                    ? 'rgba(251, 191, 36, 0.9)'
                    : 'rgba(255, 255, 255, 0.2)';
                ctx.textAlign = 'center';
                ctx.fillText(val.toString(), x + cellW / 2, tapeY + cellH / 2 + 1);
            }

            // Head pointer
            const headScreenX = centerOffset * cellW + cellW / 2;
            ctx.beginPath();
            ctx.moveTo(headScreenX, tapeY - 10);
            ctx.lineTo(headScreenX - 8, tapeY - 25);
            ctx.lineTo(headScreenX + 8, tapeY - 25);
            ctx.closePath();
            ctx.fillStyle = state === 'HALT' ? 'rgba(255, 107, 107, 0.6)' : 'rgba(251, 191, 36, 0.5)';
            ctx.fill();

            // Ones count
            const ones = Object.values(tape).filter(v => v === 1).length;
            ctx.font = '11px JetBrains Mono, monospace';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.textAlign = 'center';
            ctx.fillText(`Ones on tape: ${ones}`, w / 2, tapeY + cellH + 40);
            if (state === 'HALT') {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
                ctx.fillText(`BB(3) = 21 steps, leaving 6 ones`, w / 2, tapeY + cellH + 58);
            }
        }

        const controls = document.createElement('div');
        controls.className = 'viz-controls';
        controls.innerHTML = `
            <button id="bb-step">Step</button>
            <button id="bb-play">Play</button>
            <button id="bb-fast">Fast</button>
            <button id="bb-reset">Reset</button>
        `;
        container.appendChild(controls);

        controls.querySelector('#bb-step').addEventListener('click', () => {
            playing = false;
            clearInterval(playTimer);
            step();
            draw();
        });

        controls.querySelector('#bb-play').addEventListener('click', () => {
            if (playing) { playing = false; clearInterval(playTimer); return; }
            playing = true;
            playTimer = setInterval(() => {
                if (!step()) { playing = false; clearInterval(playTimer); }
                draw();
            }, 300);
        });

        controls.querySelector('#bb-fast').addEventListener('click', () => {
            playing = false;
            clearInterval(playTimer);
            while (step()) {}
            draw();
        });

        controls.querySelector('#bb-reset').addEventListener('click', () => {
            reset();
            draw();
        });

        window.addEventListener('resize', draw);
        setTimeout(() => draw(), 50);
    },

    // ─── POWER SET EXPLOSION ────────────────────────────────────
    // Shows how power sets grow: {a,b,c} → 8 subsets → 256 subsets of subsets...
    powerSet(container) {
        const canvas = document.createElement('canvas');
        const h = 300;
        canvas.style.width = '100%';
        canvas.style.height = h + 'px';
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        let level = 0; // 0=base set, 1=P(S), 2=P(P(S)), 3=P(P(P(S)))

        const sizes = [3, 8, 256, null]; // null = too many
        const labels = [
            '{ a, b, c }',
            'P(S) — 8 subsets',
            'P(P(S)) — 256 subsets',
            'P(P(P(S))) — 2²⁵⁶ subsets'
        ];
        const descriptions = [
            '3 elements',
            '2³ = 8 elements',
            '2⁸ = 256 elements',
            '2²⁵⁶ ≈ 1.16 × 10⁷⁷ elements\n(more than atoms in the universe)'
        ];

        function draw() {
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width * devicePixelRatio;
            canvas.height = h * devicePixelRatio;
            ctx.scale(devicePixelRatio, devicePixelRatio);
            const w = rect.width;

            ctx.clearRect(0, 0, w, h);

            const centerX = w / 2;
            const centerY = h / 2 - 10;

            // Draw dots for current level
            const count = sizes[level];
            if (count !== null && count <= 256) {
                const maxRadius = Math.min(120, w / 3);
                for (let i = 0; i < count; i++) {
                    let x, y;
                    if (count <= 8) {
                        const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
                        const r = count === 3 ? 40 : 70;
                        x = centerX + Math.cos(angle) * r;
                        y = centerY + Math.sin(angle) * r;
                    } else {
                        // Spiral layout for 256
                        const angle = i * 0.4;
                        const r = 5 + Math.sqrt(i) * 7;
                        x = centerX + Math.cos(angle) * Math.min(r, maxRadius);
                        y = centerY + Math.sin(angle) * Math.min(r, maxRadius);
                    }

                    const dotSize = count <= 8 ? 6 : 2;
                    ctx.beginPath();
                    ctx.arc(x, y, dotSize, 0, Math.PI * 2);

                    const hues = [200, 260, 0, 330];
                    const hue = hues[level];
                    ctx.fillStyle = `hsla(${hue}, 70%, 65%, ${count <= 8 ? 0.8 : 0.5})`;
                    ctx.fill();
                }
            } else {
                // Too many — show explosion effect
                ctx.font = '40px Playfair Display, serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = 'rgba(240, 171, 252, 0.6)';
                ctx.fillText('2²⁵⁶', centerX, centerY - 10);

                ctx.font = '13px JetBrains Mono, monospace';
                ctx.fillStyle = 'rgba(240, 171, 252, 0.35)';
                ctx.fillText('≈ 1.16 × 10⁷⁷ elements', centerX, centerY + 25);
                ctx.fillText('Cannot be drawn. Cannot be listed.', centerX, centerY + 45);
                ctx.fillText('More subsets than atoms in the universe.', centerX, centerY + 65);
            }

            // Label
            ctx.font = '14px JetBrains Mono, monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.fillText(labels[level], centerX, 30);

            ctx.font = '11px JetBrains Mono, monospace';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.fillText(descriptions[level], centerX, h - 20);
        }

        const controls = document.createElement('div');
        controls.className = 'viz-controls';
        controls.innerHTML = `
            <span class="viz-label">Take power set</span>
            <button id="ps-next">P( ... )</button>
            <button id="ps-reset">Reset</button>
        `;
        container.appendChild(controls);

        controls.querySelector('#ps-next').addEventListener('click', () => {
            if (level < sizes.length - 1) level++;
            draw();
        });

        controls.querySelector('#ps-reset').addEventListener('click', () => {
            level = 0;
            draw();
        });

        window.addEventListener('resize', draw);
        setTimeout(() => draw(), 50);
    },

    // ─── LARGE CARDINAL TOWER ───────────────────────────────────
    // Visual tower showing the hierarchy with glow effect
    cardinalTower(container) {
        const canvas = document.createElement('canvas');
        const h = 400;
        canvas.style.width = '100%';
        canvas.style.height = h + 'px';
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d');

        const levels = [
            { name: 'ZFC cardinals', desc: 'ℵ₀, ℵ₁, ℵ₂, ...', color: [139, 198, 236] },
            { name: 'Inaccessible', desc: 'Can\'t reach from below', color: [167, 139, 250] },
            { name: 'Mahlo', desc: 'Inaccessibles everywhere below', color: [167, 139, 250] },
            { name: 'Measurable', desc: 'Admits a non-trivial measure', color: [240, 171, 252] },
            { name: 'Woodin', desc: 'Tames projective sets', color: [240, 171, 252] },
            { name: 'Rank-into-rank', desc: 'Self-embedding of V', color: [255, 107, 107] },
            { name: '??? INCONSISTENT ???', desc: 'Kunen\'s boundary', color: [255, 60, 60] },
        ];

        let hoveredLevel = -1;

        function draw() {
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width * devicePixelRatio;
            canvas.height = h * devicePixelRatio;
            ctx.scale(devicePixelRatio, devicePixelRatio);
            const w = rect.width;

            ctx.clearRect(0, 0, w, h);

            const blockH = 44;
            const gap = 6;
            const totalH = levels.length * (blockH + gap);
            const startY = (h - totalH) / 2;
            const maxW = Math.min(500, w - 60);

            for (let i = 0; i < levels.length; i++) {
                const lvl = levels[i];
                const y = startY + (levels.length - 1 - i) * (blockH + gap);
                const bw = maxW * (0.5 + 0.5 * (i / (levels.length - 1)));
                const x = (w - bw) / 2;
                const [r, g, b] = lvl.color;

                const isHovered = i === hoveredLevel;
                const alpha = isHovered ? 0.25 : 0.08;

                // Glow
                if (isHovered) {
                    ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.4)`;
                    ctx.shadowBlur = 20;
                }

                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
                ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${isHovered ? 0.6 : 0.2})`;
                ctx.lineWidth = isHovered ? 2 : 1;

                // Rounded rect
                const radius = 6;
                ctx.beginPath();
                ctx.moveTo(x + radius, y);
                ctx.lineTo(x + bw - radius, y);
                ctx.quadraticCurveTo(x + bw, y, x + bw, y + radius);
                ctx.lineTo(x + bw, y + blockH - radius);
                ctx.quadraticCurveTo(x + bw, y + blockH, x + bw - radius, y + blockH);
                ctx.lineTo(x + radius, y + blockH);
                ctx.quadraticCurveTo(x, y + blockH, x, y + blockH - radius);
                ctx.lineTo(x, y + radius);
                ctx.quadraticCurveTo(x, y, x + radius, y);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;

                // Text
                ctx.font = `${isHovered ? '14' : '13'}px JetBrains Mono, monospace`;
                ctx.textAlign = 'center';
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${isHovered ? 1 : 0.7})`;
                ctx.fillText(lvl.name, w / 2, y + blockH / 2 - (isHovered ? 4 : 0));

                if (isHovered) {
                    ctx.font = '10px JetBrains Mono, monospace';
                    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.5)`;
                    ctx.fillText(lvl.desc, w / 2, y + blockH / 2 + 12);
                }
            }
        }

        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const mouseY = e.clientY - rect.top;
            const blockH2 = 44;
            const gap2 = 6;
            const totalH2 = levels.length * (blockH2 + gap2);
            const startY2 = (h - totalH2) / 2;

            hoveredLevel = -1;
            for (let i = 0; i < levels.length; i++) {
                const y = startY2 + (levels.length - 1 - i) * (blockH2 + gap2);
                if (mouseY >= y && mouseY <= y + blockH2) {
                    hoveredLevel = i;
                    break;
                }
            }
            draw();
        });

        canvas.addEventListener('mouseleave', () => {
            hoveredLevel = -1;
            draw();
        });

        window.addEventListener('resize', draw);
        setTimeout(() => draw(), 50);
    }
};
