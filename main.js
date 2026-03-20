// ── Background Particle Canvas ─────────────────────────────────
const bgCanvas = document.getElementById('bg-canvas');
const bgCtx = bgCanvas.getContext('2d');

let particles = [];
let scrollProgress = 0;

function initBgCanvas() {
    bgCanvas.width = window.innerWidth * devicePixelRatio;
    bgCanvas.height = window.innerHeight * devicePixelRatio;
    bgCtx.scale(devicePixelRatio, devicePixelRatio);
}

function createParticles() {
    particles = [];
    const count = Math.floor(window.innerWidth * window.innerHeight / 4000);
    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            size: Math.random() * 2 + 0.5,
            baseAlpha: Math.random() * 0.3 + 0.05,
        });
    }
}

// Phase color palette — interpolated based on scroll position
const phaseColors = [
    { pos: 0.00, bg: [10, 10, 18],   particle: [139, 198, 236] },  // deep blue
    { pos: 0.15, bg: [12, 10, 24],   particle: [167, 139, 250] },  // purple
    { pos: 0.35, bg: [18, 8, 12],    particle: [255, 107, 107] },  // red
    { pos: 0.50, bg: [18, 14, 6],    particle: [251, 191, 36] },   // gold
    { pos: 0.70, bg: [6, 16, 14],    particle: [52, 211, 153] },   // green
    { pos: 0.85, bg: [14, 6, 18],    particle: [240, 171, 252] },  // pink
    { pos: 1.00, bg: [8, 8, 14],     particle: [200, 200, 220] },  // silver
];

function lerpColor(c1, c2, t) {
    return c1.map((v, i) => Math.round(v + (c2[i] - v) * t));
}

function getPhaseColor(progress, key) {
    for (let i = 0; i < phaseColors.length - 1; i++) {
        if (progress >= phaseColors[i].pos && progress <= phaseColors[i + 1].pos) {
            const t = (progress - phaseColors[i].pos) / (phaseColors[i + 1].pos - phaseColors[i].pos);
            return lerpColor(phaseColors[i][key], phaseColors[i + 1][key], t);
        }
    }
    return phaseColors[phaseColors.length - 1][key];
}

function drawParticles() {
    bgCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    const pColor = getPhaseColor(scrollProgress, 'particle');

    // Chaos factor increases with scroll progress
    const chaos = scrollProgress * 2;

    particles.forEach(p => {
        // Movement increases with chaos
        p.x += p.vx * (1 + chaos * 3);
        p.y += p.vy * (1 + chaos * 3);

        // Wrap around
        if (p.x < 0) p.x += window.innerWidth;
        if (p.x > window.innerWidth) p.x -= window.innerWidth;
        if (p.y < 0) p.y += window.innerHeight;
        if (p.y > window.innerHeight) p.y -= window.innerHeight;

        // Size pulses more with chaos
        const pulse = 1 + Math.sin(Date.now() * 0.001 + p.x * 0.01) * chaos * 0.5;
        const size = p.size * pulse;

        // Alpha increases with scroll
        const alpha = p.baseAlpha * (1 + scrollProgress * 2);

        bgCtx.beginPath();
        bgCtx.arc(p.x, p.y, size, 0, Math.PI * 2);
        bgCtx.fillStyle = `rgba(${pColor[0]}, ${pColor[1]}, ${pColor[2]}, ${Math.min(alpha, 0.6)})`;
        bgCtx.fill();
    });

    requestAnimationFrame(drawParticles);
}

initBgCanvas();
createParticles();
drawParticles();

window.addEventListener('resize', () => {
    initBgCanvas();
    createParticles();
});

// ── Build the journey from entries data ─────────────────────────
const journey = document.getElementById('journey');
let currentPhase = '';

ENTRIES.forEach(entry => {
    if (entry.type === 'phase') {
        const section = document.createElement('section');
        section.className = 'phase-break';
        section.dataset.phase = entry.phase || '';
        section.dataset.phasetitle = entry.title;
        section.innerHTML = `
            <div class="phase-line"></div>
            <h2>${entry.title}</h2>
            <p class="phase-desc">${entry.desc}</p>
        `;
        journey.appendChild(section);
        currentPhase = entry.phase;
        return;
    }

    const div = document.createElement('div');
    div.className = 'entry';
    div.dataset.category = entry.category;

    let html = `<h3 class="number-name">${entry.name}</h3>`;

    if (entry.value) {
        html += `<div class="number-value">${entry.value}`;
        if (entry.approx) {
            html += `<br><span class="approx">${entry.approx}</span>`;
        }
        html += `</div>`;
    }

    html += `<p class="description">${entry.description}</p>`;

    if (entry.viz) {
        html += `<div class="viz">${entry.viz}</div>`;
    }

    // Placeholder for interactive visualization
    if (entry.interactive) {
        html += `<div class="interactive-viz" data-viz="${entry.interactive}"></div>`;
    }

    if (entry.funFact) {
        html += `<div class="fun-fact">${entry.funFact}</div>`;
    }

    div.innerHTML = html;
    journey.appendChild(div);
});

// ── Initialize interactive visualizations ───────────────────────
document.querySelectorAll('.interactive-viz').forEach(container => {
    const vizName = container.dataset.viz;
    if (VISUALIZATIONS[vizName]) {
        VISUALIZATIONS[vizName](container);
    }
});

// ── Scroll-triggered visibility ─────────────────────────────────
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, {
    threshold: 0.1,
    rootMargin: '0px 0px -30px 0px'
});

document.querySelectorAll('.entry, .phase-break').forEach(el => {
    observer.observe(el);
});

// ── Phase label observer ────────────────────────────────────────
const phaseLabel = document.getElementById('phase-label');
const phaseObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting && entry.target.dataset.phasetitle) {
            phaseLabel.textContent = entry.target.dataset.phasetitle;
        }
    });
}, {
    threshold: 0.3
});

document.querySelectorAll('.phase-break').forEach(el => {
    phaseObserver.observe(el);
});

// ── Scroll handler: progress bar + background color ─────────────
window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    scrollProgress = Math.min(1, scrollTop / docHeight);

    // Progress bar
    const bar = document.getElementById('progress-bar');
    bar.style.width = (scrollProgress * 100) + '%';
    bar.style.backgroundPosition = (scrollProgress * 200) + '% 0';

    // Background color
    const bg = getPhaseColor(scrollProgress, 'bg');
    document.body.style.backgroundColor = `rgb(${bg[0]}, ${bg[1]}, ${bg[2]})`;
}, { passive: true });
