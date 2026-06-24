/**
 * Plinko board geometry & canvas animation engine.
 * Runs entirely outside React render cycle via requestAnimationFrame.
 */

export const PLINKO = {
  NUM_ROWS: 12,
  NUM_SLOTS: 13,
  /** 0x | 1x | 2x | 5x | 10x | 25x | 50x | 25x | 10x | 5x | 2x | 1x | 0x */
  SLOT_VALUES: [0, 1, 2, 5, 10, 25, 50, 25, 10, 5, 2, 1, 0] as const,
  PEG_SPACING: 0.065,
};

export interface Point {
  x: number;
  y: number;
}

export interface Peg {
  row: number;
  col: number;
  x: number;
  y: number;
}

export interface Keyframe extends Point {
  t: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  hue: number;
}

function slotToX(slot: number): number {
  const m = 0.028;
  return m + (slot / (PLINKO.NUM_SLOTS - 1)) * (1 - 2 * m);
}

function rowY(row: number): number {
  const top = 0.1;
  const bottom = 0.74;
  return top + ((row + 0.5) / PLINKO.NUM_ROWS) * (bottom - top);
}

function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function buildPegGrid(): Peg[] {
  const pegs: Peg[] = [];
  for (let row = 0; row < PLINKO.NUM_ROWS; row++) {
    const count = row + 3;
    const y = rowY(row);
    for (let col = 0; col < count; col++) {
      pegs.push({
        row,
        col,
        x: 0.5 + (col - (count - 1) / 2) * PLINKO.PEG_SPACING,
        y,
      });
    }
  }
  return pegs;
}

/** Fisher-Yates shuffle — exactly targetSlot right bounces in NUM_ROWS rows. */
export function generateLRPath(targetSlot: number): ('L' | 'R')[] {
  const rights = Math.max(0, Math.min(PLINKO.NUM_ROWS, targetSlot));
  const moves: ('L' | 'R')[] = [
    ...Array(rights).fill('R' as const),
    ...Array(PLINKO.NUM_ROWS - rights).fill('L' as const),
  ];
  for (let i = moves.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [moves[i], moves[j]] = [moves[j], moves[i]];
  }
  return moves;
}

/** Build timed keyframes for Catmull-Rom spline — continuous flow through peg lanes. */
export function buildTrajectory(path: ('L' | 'R')[], targetSlot: number, seed: number): Keyframe[] {
  const rand = seededRandom(seed);
  const kf: Keyframe[] = [];
  let rights = 0;
  let time = 0;

  kf.push({ x: 0.5 + (rand() - 0.5) * 0.01, y: 0.02, t: time });

  for (let row = 0; row < path.length; row++) {
    const laneX = slotToX(rights);
    const y = rowY(row);
    const wobble = (rand() - 0.5) * 0.012;

    time += 70 + rand() * 25;
    kf.push({ x: laneX + wobble, y: y - 0.028, t: time });

    time += 55 + rand() * 20;
    kf.push({ x: laneX + wobble * 0.4, y: y - 0.006, t: time });

    time += 40;
    kf.push({ x: laneX, y, t: time });

    if (path[row] === 'R') rights++;

    const nextLane = slotToX(rights);
    const midX = laneX + (nextLane - laneX) * (0.28 + rand() * 0.12);

    time += 48;
    kf.push({ x: midX, y: y + 0.006, t: time });

    time += 58 + rand() * 22;
    kf.push({
      x: nextLane + (rand() - 0.5) * 0.008,
      y: y + 0.018 + rand() * 0.004,
      t: time,
    });
  }

  const finalX = slotToX(targetSlot);
  time += 140;
  kf.push({ x: finalX, y: 0.78, t: time });
  time += 200;
  kf.push({ x: finalX + (rand() - 0.5) * 0.004, y: 0.84, t: time });
  time += 220;
  kf.push({ x: finalX, y: 0.875, t: time });
  time += 180;
  kf.push({ x: finalX + 0.004, y: 0.892, t: time });
  time += 160;
  kf.push({ x: finalX, y: 0.898, t: time });

  return kf;
}

function catmullRom(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

function sampleSpline(keyframes: Keyframe[], elapsed: number, wobblePhase: number): { pos: Point; rot: number; vy: number } {
  const total = keyframes[keyframes.length - 1].t;
  const clamped = Math.min(elapsed, total);

  let seg = 0;
  while (seg < keyframes.length - 2 && keyframes[seg + 1].t < clamped) seg++;

  const k0 = keyframes[Math.max(0, seg - 1)];
  const k1 = keyframes[seg];
  const k2 = keyframes[Math.min(keyframes.length - 1, seg + 1)];
  const k3 = keyframes[Math.min(keyframes.length - 1, seg + 2)];

  const segDur = k2.t - k1.t || 1;
  let u = (clamped - k1.t) / segDur;
  u = u * u * (3 - 2 * u);

  const pos = catmullRom(k0, k1, k2, k3, u);

  const progress = clamped / total;
  const wobbleAmp = 0.006 * (1 - progress * 0.85);
  pos.x += Math.sin(wobblePhase * 0.09 + seg * 1.7) * wobbleAmp;
  pos.y += Math.cos(wobblePhase * 0.07 + seg * 2.1) * wobbleAmp * 0.4;

  const next = catmullRom(k0, k1, k2, k3, Math.min(1, u + 0.02));
  const rot = Math.atan2(next.y - pos.y, next.x - pos.x) * (180 / Math.PI);
  const vy = (next.y - pos.y) / 0.02;

  return { pos, rot, vy };
}

const SLOT_COLORS: Record<number, string> = {
  0: '#dc2626',
  1: '#ea580c',
  2: '#f59e0b',
  5: '#84cc16',
  10: '#06b6d4',
  25: '#a855f7',
  50: '#fbbf24',
};

function slotColor(mult: number): string {
  return SLOT_COLORS[mult] ?? '#6366f1';
}

export class PlinkoCanvasEngine {
  private ctx: CanvasRenderingContext2D;
  private pegs: Peg[];
  private w = 0;
  private h = 0;
  private dpr = 1;
  private rafId = 0;
  private particles: Particle[] = [];
  private highlightSlot: number | null = null;
  private ball = { x: 0.5, y: 0.02, rot: 0, visible: false, scale: 1 };
  private animStart = 0;
  private keyframes: Keyframe[] = [];
  private wobblePhase = 0;
  private targetSlot = 0;
  private onComplete: (() => void) | null = null;
  private landingDone = false;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D unavailable');
    this.ctx = ctx;
    this.pegs = buildPegGrid();
  }

  resize(): void {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    const width = rect?.width ?? 800;
    const height = rect?.height ?? 520;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = width;
    this.h = height;
    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  destroy(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  setHighlight(slot: number | null): void {
    this.highlightSlot = slot;
  }

  startDrop(path: ('L' | 'R')[], targetSlot: number, seed: number, onComplete: () => void): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.targetSlot = targetSlot;
    this.keyframes = buildTrajectory(path, targetSlot, seed);
    this.onComplete = onComplete;
    this.particles = [];
    this.landingDone = false;
    this.highlightSlot = null;
    this.ball = { x: 0.5, y: 0.02, rot: 0, visible: true, scale: 1 };
    this.wobblePhase = seed;
    this.animStart = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    const elapsed = now - this.animStart;
    const total = this.keyframes[this.keyframes.length - 1]?.t ?? 1;

    if (this.keyframes.length > 1) {
      const { pos, rot, vy } = sampleSpline(this.keyframes, elapsed, this.wobblePhase);
      this.ball.x = pos.x;
      this.ball.y = pos.y;
      this.ball.rot = rot + Math.sin(elapsed * 0.015) * 8;
      this.ball.scale = 1 + Math.min(0.12, vy * 0.8);

      const landingStart = total * 0.88;
      if (elapsed > landingStart && !this.landingDone) {
        this.landingDone = true;
        this.highlightSlot = this.targetSlot;
        this.spawnCoins(this.ball.x, this.ball.y);
      }
    }

    this.updateParticles();
    this.draw();

    if (elapsed < total + 400) {
      this.rafId = requestAnimationFrame(this.tick);
    } else {
      this.ball.scale = 1;
      this.onComplete?.();
    }
  };

  private spawnCoins(x: number, y: number): void {
    for (let i = 0; i < 24; i++) {
      const angle = (Math.PI * 2 * i) / 24 + Math.random() * 0.5;
      const speed = 0.002 + Math.random() * 0.004;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.003,
        life: 1,
        hue: 45 + Math.random() * 20,
      });
    }
  }

  private updateParticles(): void {
    this.particles = this.particles
      .map(p => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        vy: p.vy + 0.00015,
        life: p.life - 0.018,
      }))
      .filter(p => p.life > 0);
  }

  drawIdle(): void {
    this.ball.visible = false;
    this.draw();
  }

  private draw(): void {
    const { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);

    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#0c0420');
    bg.addColorStop(0.5, '#15082e');
    bg.addColorStop(1, '#0a0618');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(168,85,247,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, w - 16, h - 16);

    const glass = ctx.createLinearGradient(0, 0, w, h);
    glass.addColorStop(0, 'rgba(255,255,255,0.04)');
    glass.addColorStop(0.5, 'rgba(255,255,255,0)');
    glass.addColorStop(1, 'rgba(168,85,247,0.06)');
    ctx.fillStyle = glass;
    ctx.fillRect(8, 8, w - 16, h - 16);

    this.drawSlots();
    this.drawPegs();
    this.drawParticles();

    if (this.ball.visible) {
      this.drawBall();
    }
  }

  private drawPegs(): void {
    const { ctx, w, h, pegs } = this;
    for (const peg of pegs) {
      const px = peg.x * w;
      const py = peg.y * h;
      const r = Math.max(4, w * 0.011);

      ctx.beginPath();
      ctx.ellipse(px, py + r * 0.6, r * 0.9, r * 0.35, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fill();

      const glow = ctx.createRadialGradient(px - r * 0.2, py - r * 0.2, 0, px, py, r * 1.8);
      glow.addColorStop(0, '#ffffff');
      glow.addColorStop(0.35, '#e9d5ff');
      glow.addColorStop(0.7, '#a855f7');
      glow.addColorStop(1, '#6b21a8');

      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(px - r * 0.25, py - r * 0.25, r * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fill();
    }
  }

  private drawSlots(): void {
    const { ctx, w, h } = this;
    const slotH = h * 0.1;
    const slotTop = h - slotH - 6;
    const gap = 2;

    for (let i = 0; i < PLINKO.NUM_SLOTS; i++) {
      const mult = PLINKO.SLOT_VALUES[i];
      const x0 = slotToX(i) * w - (w / PLINKO.NUM_SLOTS) * 0.42;
      const sw = w / PLINKO.NUM_SLOTS - gap;
      const isHi = this.highlightSlot === i;

      const grad = ctx.createLinearGradient(x0, slotTop, x0, slotTop + slotH);
      const base = slotColor(mult);
      grad.addColorStop(0, isHi ? '#ffffff' : base);
      grad.addColorStop(1, isHi ? base : '#1a1025');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x0, slotTop, sw, slotH, [6, 6, 0, 0]);
      ctx.fill();

      if (isHi) {
        ctx.shadowColor = base;
        ctx.shadowBlur = 18;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      ctx.fillStyle = isHi ? '#fff' : '#e5e7eb';
      ctx.font = `bold ${Math.max(9, sw * 0.22)}px Orbitron, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`${mult}x`, x0 + sw / 2, slotTop + slotH * 0.62);
    }
  }

  private drawBall(): void {
    const { ctx, w, h, ball } = this;
    const px = ball.x * w;
    const py = ball.y * h;
    const r = Math.max(9, w * 0.014) * ball.scale;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate((ball.rot * Math.PI) / 180);

    ctx.beginPath();
    ctx.ellipse(0, r * 0.85, r * 0.85, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();

    const ballGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    ballGrad.addColorStop(0, '#fef9c3');
    ballGrad.addColorStop(0.45, '#fbbf24');
    ballGrad.addColorStop(1, '#b45309');

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = ballGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(-r * 0.28, -r * 0.28, r * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fill();

    ctx.strokeStyle = 'rgba(251,191,36,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.85, 0.3, Math.PI * 0.7);
    ctx.stroke();

    ctx.restore();
  }

  private drawParticles(): void {
    const { ctx, w, h, particles } = this;
    for (const p of particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = `hsl(${p.hue}, 90%, 60%)`;
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, 3 * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

export { slotToX, rowY };
