/**
 * Plinko board geometry & canvas animation engine.
 * Ball motion uses continuous physics simulation — not peg-to-peg waypoints.
 * Runs entirely outside React render cycle via requestAnimationFrame.
 */

export const PLINKO = {
  NUM_ROWS: 12,
  NUM_SLOTS: 13,
  /** 0x | 1x | 2x | 5x | 10x | 25x | 50x | 25x | 10x | 5x | 2x | 1x | 0x */
  SLOT_VALUES: [0, 1, 2, 5, 10, 25, 50, 25, 10, 5, 2, 1, 0] as const,
  PEG_SPACING: 0.074,
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

export interface TrajectorySample extends Point {
  t: number;
  vx: number;
  vy: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  hue: number;
}

const BOARD = {
  TOP: 0.06,
  PEG_BOTTOM: 0.73,
  SLOT_Y: 0.88,
  SPAWN_X: 0.5,
  SPAWN_Y: 0.035,
};

const PHYSICS = {
  GRAVITY: 0.00042,
  DEFLECT_VAR: 0.0018,
  BOUNCE_DAMP: 0.86,
  FRICTION: 0.993,
  MAX_VX: 0.018,
  MIN_VY: 0.001,
  DT: 0.014,
  SAMPLE_MS: 8,
};

function slotToX(slot: number): number {
  const m = 0.032;
  return m + (slot / (PLINKO.NUM_SLOTS - 1)) * (1 - 2 * m);
}

function rowY(row: number): number {
  const top = BOARD.TOP;
  const bottom = BOARD.PEG_BOTTOM;
  return top + ((row + 0.5) / PLINKO.NUM_ROWS) * (bottom - top);
}

function pegFieldBounds(row: number): { min: number; max: number } {
  const count = row + 3;
  const half = ((count - 1) / 2) * PLINKO.PEG_SPACING;
  const pad = PLINKO.PEG_SPACING * 0.35;
  return { min: 0.5 - half - pad, max: 0.5 + half + pad };
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

/**
 * Simulate a marble falling through the peg field.
 * L/R path steers deflections at each row; gravity dominates motion.
 * Returns dense time-stamped samples for smooth playback.
 */
export function simulateTrajectory(
  path: ('L' | 'R')[],
  targetSlot: number,
  seed: number,
): TrajectorySample[] {
  const rand = seededRandom(seed);
  const samples: TrajectorySample[] = [];

  let x = BOARD.SPAWN_X;
  let y = BOARD.SPAWN_Y;
  let vx = 0;
  let vy = PHYSICS.MIN_VY;
  let t = 0;
  let rowCrossed = -1;

  const finalX = slotToX(targetSlot);
  const slotStep = (slotToX(1) - slotToX(0));

  const pushSample = () => {
    samples.push({ x, y, t, vx, vy });
  };

  pushSample();

  let nextSampleT = PHYSICS.SAMPLE_MS;
  const maxSteps = 14000;
  let steps = 0;

  while (y < BOARD.SLOT_Y + 0.05 && steps < maxSteps) {
    steps++;
    const dt = PHYSICS.DT;
    t += dt * 16.67;

    vy += PHYSICS.GRAVITY;
    vy = Math.max(vy, PHYSICS.MIN_VY);

    x += vx * dt;
    y += vy * dt;

    const currentRow = Math.min(
      PLINKO.NUM_ROWS - 1,
      Math.floor(((y - BOARD.TOP) / (BOARD.PEG_BOTTOM - BOARD.TOP)) * PLINKO.NUM_ROWS),
    );

    if (currentRow > rowCrossed && currentRow < PLINKO.NUM_ROWS) {
      rowCrossed = currentRow;
      const move = path[currentRow];
      const variance = (rand() - 0.5) * PHYSICS.DEFLECT_VAR;
      const peg = findNearestPeg(x, y, currentRow);

      const deflect = slotStep * (0.42 + rand() * 0.08);
      if (move === 'R') {
        vx += deflect + variance;
      } else {
        vx -= deflect + variance;
      }

      if (peg) {
        const away = x - peg.x;
        vx += away * 0.06;
        vy *= PHYSICS.BOUNCE_DAMP;
      }

      vy = Math.max(vy, PHYSICS.MIN_VY);
    }

    const bounds = pegFieldBounds(Math.max(0, Math.min(PLINKO.NUM_ROWS - 1, currentRow)));
    const innerMin = bounds.min + PLINKO.PEG_SPACING * 0.22;
    const innerMax = bounds.max - PLINKO.PEG_SPACING * 0.22;

    if (x < innerMin) {
      x = innerMin;
      vx = Math.abs(vx) * 0.18;
    } else if (x > innerMax) {
      x = innerMax;
      vx = -Math.abs(vx) * 0.18;
    }

    vx *= PHYSICS.FRICTION;
    vx = Math.max(-PHYSICS.MAX_VX, Math.min(PHYSICS.MAX_VX, vx));

    if (y > BOARD.PEG_BOTTOM + 0.02) {
      const dropZone = (y - BOARD.PEG_BOTTOM) / (BOARD.SLOT_Y - BOARD.PEG_BOTTOM);
      vy *= 1 - Math.min(0.015, dropZone * 0.012);
    }

    if (t >= nextSampleT) {
      pushSample();
      nextSampleT += PHYSICS.SAMPLE_MS;
    }
  }

  const landingSamples = buildLandingPhase(
    samples[samples.length - 1],
    finalX,
  );
  for (const s of landingSamples) {
    samples.push(s);
  }

  return samples;
}

function findNearestPeg(x: number, y: number, row: number): Peg | null {
  const count = row + 3;
  const py = rowY(row);
  if (Math.abs(y - py) > 0.04) return null;

  let best: Peg | null = null;
  let bestDist = Infinity;
  for (let col = 0; col < count; col++) {
    const px = 0.5 + (col - (count - 1) / 2) * PLINKO.PEG_SPACING;
    const d = Math.hypot(x - px, y - py);
    if (d < bestDist) {
      bestDist = d;
      best = { row, col, x: px, y: py };
    }
  }
  return best;
}

function buildLandingPhase(
  last: TrajectorySample,
  finalX: number,
): TrajectorySample[] {
  const out: TrajectorySample[] = [];
  let { x, y, t, vx, vy } = { ...last };

  vx *= 0.6;
  vy = Math.max(vy, 0.0012);

  const slotHalf = (slotToX(1) - slotToX(0)) * 0.38;
  let bounced = false;
  let settled = false;
  const maxSteps = 800;

  for (let step = 0; step < maxSteps; step++) {
    t += PHYSICS.SAMPLE_MS;
    const dt = PHYSICS.DT;

    vy += PHYSICS.GRAVITY * 0.85;
    x += vx * dt;
    y += vy * dt;

    if (x < finalX - slotHalf) {
      x = finalX - slotHalf;
      vx = Math.abs(vx) * 0.35;
    } else if (x > finalX + slotHalf) {
      x = finalX + slotHalf;
      vx = -Math.abs(vx) * 0.35;
    }

    if (y >= BOARD.SLOT_Y && vy > 0) {
      y = BOARD.SLOT_Y;
      vy = -vy * (bounced ? 0.28 : 0.42);
      vx *= 0.72;
      bounced = true;
    }

    vx *= 0.97;
    vy *= 0.998;

    if (bounced && Math.abs(vy) < 0.00025 && y >= BOARD.SLOT_Y - 0.002) {
      vy = 0;
      vx *= 0.82;
      x += (finalX - x) * 0.04;
      settled = true;
    }

    out.push({ x, y, t, vx, vy });

    if (settled && step > 40) break;
    if (y > BOARD.SLOT_Y + 0.025 && bounced) break;
  }

  const restSteps = Math.ceil(220 / PHYSICS.SAMPLE_MS);
  for (let i = 0; i < restSteps; i++) {
    t += PHYSICS.SAMPLE_MS;
    x += (finalX - x) * 0.06;
    y = BOARD.SLOT_Y + 0.006 + Math.sin(i * 0.4) * 0.001 * Math.max(0, 1 - i / restSteps);
    out.push({ x, y, t, vx: 0, vy: 0 });
  }

  return out;
}

function hermite(p0: number, v0: number, p1: number, v1: number, u: number): number {
  const u2 = u * u;
  const u3 = u2 * u;
  return (
    (2 * u3 - 3 * u2 + 1) * p0 +
    (u3 - 2 * u2 + u) * v0 +
    (-2 * u3 + 3 * u2) * p1 +
    (u3 - u2) * v1
  );
}

function sampleTrajectory(
  samples: TrajectorySample[],
  elapsed: number,
): { pos: Point; rot: number; vy: number; speed: number } {
  const total = samples[samples.length - 1].t;
  const clamped = Math.min(Math.max(0, elapsed), total);

  let i = 0;
  while (i < samples.length - 2 && samples[i + 1].t < clamped) i++;

  const s0 = samples[Math.max(0, i - 1)];
  const s1 = samples[i];
  const s2 = samples[Math.min(samples.length - 1, i + 1)];
  const s3 = samples[Math.min(samples.length - 1, i + 2)];

  const segDur = s2.t - s1.t || 1;
  const u = (clamped - s1.t) / segDur;

  const pos: Point = {
    x: hermite(s1.x, (s2.x - s0.x) * 0.5, s2.x, (s3.x - s1.x) * 0.5, u),
    y: hermite(s1.y, (s2.y - s0.y) * 0.5, s2.y, (s3.y - s1.y) * 0.5, u),
  };

  const nextU = Math.min(1, u + 0.03);
  const nextX = hermite(s1.x, (s2.x - s0.x) * 0.5, s2.x, (s3.x - s1.x) * 0.5, nextU);
  const nextY = hermite(s1.y, (s2.y - s0.y) * 0.5, s2.y, (s3.y - s1.y) * 0.5, nextU);

  const dx = nextX - pos.x;
  const dy = nextY - pos.y;
  const speed = Math.hypot(dx, dy);
  const vy = dy / 0.03;
  const rot = Math.atan2(dx, dy) * (180 / Math.PI);

  return { pos, rot, vy, speed };
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
  private ball = { x: BOARD.SPAWN_X, y: BOARD.SPAWN_Y, rot: 0, roll: 0, visible: false, scale: 1 };
  private animStart = 0;
  private trajectory: TrajectorySample[] = [];
  private targetSlot = 0;
  private onComplete: (() => void) | null = null;
  private landingDone = false;
  private lastElapsed = 0;

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
    this.trajectory = simulateTrajectory(path, targetSlot, seed);
    this.onComplete = onComplete;
    this.particles = [];
    this.landingDone = false;
    this.lastElapsed = 0;
    this.ball = {
      x: BOARD.SPAWN_X,
      y: BOARD.SPAWN_Y,
      rot: 0,
      roll: 0,
      visible: true,
      scale: 1,
    };
    this.animStart = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    const elapsed = now - this.animStart;
    const total = this.trajectory[this.trajectory.length - 1]?.t ?? 1;

    if (this.trajectory.length > 1) {
      const { pos, rot, vy, speed } = sampleTrajectory(this.trajectory, elapsed);
      const dt = Math.max(1, elapsed - this.lastElapsed);
      this.lastElapsed = elapsed;

      this.ball.x = pos.x;
      this.ball.y = pos.y;
      this.ball.roll += speed * dt * 0.35;
      this.ball.rot = rot * 0.15 + this.ball.roll;
      this.ball.scale = 1 + Math.min(0.06, Math.abs(vy) * 0.4);

      const landingStart = total * 0.86;
      if (elapsed > landingStart && !this.landingDone) {
        this.landingDone = true;
        this.highlightSlot = this.targetSlot;
        this.spawnCoins(this.ball.x, this.ball.y);
      }
    }

    this.updateParticles();
    this.draw();

    if (elapsed < total + 350) {
      this.rafId = requestAnimationFrame(this.tick);
    } else {
      this.ball.scale = 1;
      this.onComplete?.();
    }
  };

  private spawnCoins(x: number, y: number): void {
    for (let i = 0; i < 24; i++) {
      const angle = (Math.PI * 2 * i) / 24 + Math.random() * 0.5;
      const spd = 0.002 + Math.random() * 0.004;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 0.003,
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

  private pegRadius(): number {
    return Math.max(2.5, this.w * 0.0055);
  }

  private ballRadius(): number {
    return Math.max(7, this.w * 0.0078);
  }

  private draw(): void {
    const { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);

    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#08021a');
    bg.addColorStop(0.45, '#120828');
    bg.addColorStop(1, '#060312');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.shadowColor = 'rgba(168,85,247,0.45)';
    ctx.shadowBlur = 24;
    ctx.strokeStyle = 'rgba(168,85,247,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.restore();

    const innerGlow = ctx.createLinearGradient(0, 0, w, h);
    innerGlow.addColorStop(0, 'rgba(255,255,255,0.06)');
    innerGlow.addColorStop(0.35, 'rgba(255,255,255,0.01)');
    innerGlow.addColorStop(0.7, 'rgba(168,85,247,0.04)');
    innerGlow.addColorStop(1, 'rgba(99,102,241,0.06)');
    ctx.fillStyle = innerGlow;
    ctx.fillRect(10, 10, w - 20, h - 20);

    const vignette = ctx.createRadialGradient(w / 2, h * 0.4, w * 0.1, w / 2, h * 0.45, w * 0.65);
    vignette.addColorStop(0, 'rgba(255,255,255,0.03)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = vignette;
    ctx.fillRect(10, 10, w - 20, h - 20);

    this.drawSlots();
    this.drawPegs();
    this.drawParticles();

    if (this.ball.visible) {
      this.drawBall();
    }
  }

  private drawPegs(): void {
    const { ctx, w, h, pegs } = this;
    const r = this.pegRadius();

    for (const peg of pegs) {
      const px = peg.x * w;
      const py = peg.y * h;

      ctx.beginPath();
      ctx.ellipse(px, py + r * 0.7, r * 0.85, r * 0.28, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fill();

      const metal = ctx.createRadialGradient(px - r * 0.35, py - r * 0.35, r * 0.05, px, py, r * 1.4);
      metal.addColorStop(0, '#f8fafc');
      metal.addColorStop(0.25, '#cbd5e1');
      metal.addColorStop(0.55, '#94a3b8');
      metal.addColorStop(0.85, '#64748b');
      metal.addColorStop(1, '#334155');

      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = metal;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(px - r * 0.32, py - r * 0.32, r * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(px + r * 0.15, py + r * 0.2, r * 0.12, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fill();
    }
  }

  private drawSlots(): void {
    const { ctx, w, h } = this;
    const slotH = h * 0.095;
    const slotTop = h - slotH - 8;
    const gap = 2.5;

    for (let i = 0; i < PLINKO.NUM_SLOTS; i++) {
      const mult = PLINKO.SLOT_VALUES[i];
      const x0 = slotToX(i) * w - (w / PLINKO.NUM_SLOTS) * 0.44;
      const sw = w / PLINKO.NUM_SLOTS - gap;
      const isHi = this.highlightSlot === i;
      const base = slotColor(mult);

      const grad = ctx.createLinearGradient(x0, slotTop, x0, slotTop + slotH);
      grad.addColorStop(0, isHi ? '#ffffff' : `${base}cc`);
      grad.addColorStop(0.4, isHi ? base : `${base}88`);
      grad.addColorStop(1, '#0f0818');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x0, slotTop, sw, slotH, [5, 5, 0, 0]);
      ctx.fill();

      ctx.strokeStyle = isHi ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.12)';
      ctx.lineWidth = isHi ? 2 : 1;
      ctx.stroke();

      if (isHi) {
        ctx.save();
        ctx.shadowColor = base;
        ctx.shadowBlur = 22;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }

      ctx.fillStyle = isHi ? '#fff' : '#d1d5db';
      ctx.font = `bold ${Math.max(8, sw * 0.21)}px Orbitron, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`${mult}x`, x0 + sw / 2, slotTop + slotH * 0.64);
    }
  }

  private drawBall(): void {
    const { ctx, w, h, ball } = this;
    const px = ball.x * w;
    const py = ball.y * h;
    const r = this.ballRadius() * ball.scale;

    const shadowScale = 1 + (1 - ball.y) * 0.35;
    const shadowAlpha = 0.15 + ball.y * 0.35;
    const shadowBlur = 4 + (1 - ball.y) * 10;

    ctx.save();
    ctx.filter = `blur(${shadowBlur}px)`;
    ctx.beginPath();
    ctx.ellipse(px, py + r * 1.1, r * 0.75 * shadowScale, r * 0.22 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
    ctx.fill();
    ctx.filter = 'none';

    ctx.translate(px, py);
    ctx.rotate((ball.rot * Math.PI) / 180);

    const marble = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.05, r * 0.08, r * 0.1, r);
    marble.addColorStop(0, 'rgba(255,255,255,0.95)');
    marble.addColorStop(0.12, '#fde68a');
    marble.addColorStop(0.35, '#f59e0b');
    marble.addColorStop(0.65, '#d97706');
    marble.addColorStop(0.88, '#92400e');
    marble.addColorStop(1, '#78350f');

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = marble;
    ctx.fill();

    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(r * 0.15, r * 0.2, r * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = '#fff7ed';
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.beginPath();
    ctx.arc(-r * 0.32, -r * 0.32, r * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(-r * 0.12, -r * 0.42, r * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.92, 0.2, Math.PI * 0.55);
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
