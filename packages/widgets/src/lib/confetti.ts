/**
 * Zero-dependency confetti burst (pmxt-widgets ships no runtime deps).
 * Physics and options mirror the canvas-confetti calls used on
 * enterprise.pmxt.dev so the celebration feels identical.
 */

export interface ConfettiOptions {
    /** Particles in this burst (default 80). */
    particleCount?: number;
    /** Spread angle in degrees around straight-up (default 60). */
    spread?: number;
    /** Launch point in viewport fractions, 0–1 (default center). */
    origin?: { x: number; y: number };
    /** Particle colors (default PMXT green shades). */
    colors?: string[];
    /** Initial velocity in px/frame (default 20). */
    startVelocity?: number;
    /** Downward acceleration per frame (default 0.8). */
    gravity?: number;
    /** Particle size multiplier (default 0.8). */
    scalar?: number;
    /** Frames a particle lives (default 100). */
    ticks?: number;
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    size: number;
    tick: number;
    ticks: number;
    gravity: number;
    rotation: number;
    spin: number;
    wobble: number;
}

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let particles: Particle[] = [];
let raf = 0;

function ensureCanvas(): CanvasRenderingContext2D | null {
    if (typeof document === 'undefined') return null;
    if (!canvas || !canvas.isConnected) {
        canvas = document.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true');
        canvas.style.cssText =
            'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147483646';
        document.body.appendChild(canvas);
        ctx = canvas.getContext('2d');
    }
    if (canvas) {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return ctx;
}

function frame(): void {
    const context = ctx;
    if (!context || !canvas) return;
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);

    particles = particles.filter((p) => p.tick < p.ticks);
    for (const p of particles) {
        p.tick += 1;
        p.vy += p.gravity * 0.1;
        p.vx *= 0.99;
        p.x += p.vx + Math.sin(p.wobble + p.tick / 10);
        p.y += p.vy;
        p.rotation += p.spin;

        const fade = 1 - p.tick / p.ticks;
        context.save();
        context.globalAlpha = Math.max(0, fade);
        context.translate(p.x, p.y);
        context.rotate(p.rotation);
        context.fillStyle = p.color;
        context.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        context.restore();
    }

    if (particles.length > 0) {
        raf = requestAnimationFrame(frame);
    } else {
        canvas.remove();
        canvas = null;
        ctx = null;
        raf = 0;
    }
}

/**
 * Fire a confetti burst. Safe to call repeatedly (bursts stack); no-ops
 * during SSR and for users who prefer reduced motion.
 */
export function fireConfetti(options: ConfettiOptions = {}): void {
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const context = ensureCanvas();
    if (!context) return;

    const {
        particleCount = 80,
        spread = 60,
        origin = { x: 0.5, y: 0.5 },
        colors = ['#143720', '#c3ffbe', '#85f382'],
        startVelocity = 20,
        gravity = 0.8,
        scalar = 0.8,
        ticks = 100,
    } = options;

    const originX = origin.x * window.innerWidth;
    const originY = origin.y * window.innerHeight;
    const spreadRad = (spread * Math.PI) / 180;

    for (let i = 0; i < particleCount; i++) {
        // Straight up ± spread/2, like canvas-confetti's default angle=90.
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * spreadRad;
        const velocity = startVelocity * (0.6 + Math.random() * 0.8);
        particles.push({
            x: originX,
            y: originY,
            vx: Math.cos(angle) * velocity,
            vy: Math.sin(angle) * velocity,
            color: colors[i % colors.length] ?? '#85f382',
            size: (6 + Math.random() * 6) * scalar,
            tick: 0,
            ticks: ticks * (0.8 + Math.random() * 0.4),
            gravity,
            rotation: Math.random() * Math.PI,
            spin: (Math.random() - 0.5) * 0.3,
            wobble: Math.random() * Math.PI * 2,
        });
    }

    if (!raf) raf = requestAnimationFrame(frame);
}

/**
 * The two-stage burst enterprise.pmxt.dev fires on a filled order, aimed at
 * the center-top of `el`. Green shades for buys, red shades for sells.
 */
export function fireTradeConfetti(el: HTMLElement | null, isBuy: boolean): void {
    if (typeof window === 'undefined') return;
    const colors = isBuy
        ? ['#143720', '#c3ffbe', '#85f382']
        : ['#691919', '#ff9999', '#ffcccc'];
    let origin = { x: 0.5, y: 0.4 };
    if (el) {
        const rect = el.getBoundingClientRect();
        origin = {
            x: (rect.left + rect.width / 2) / window.innerWidth,
            y: rect.top / window.innerHeight - 0.05,
        };
    }
    fireConfetti({
        particleCount: 80,
        spread: 60,
        origin,
        colors,
        startVelocity: 20,
        gravity: 0.8,
        scalar: 0.8,
        ticks: 100,
    });
    setTimeout(() => {
        fireConfetti({
            particleCount: 40,
            spread: 80,
            origin: { x: origin.x, y: origin.y - 0.03 },
            colors,
            startVelocity: 15,
            gravity: 0.6,
            scalar: 0.6,
            ticks: 80,
        });
    }, 150);
}
