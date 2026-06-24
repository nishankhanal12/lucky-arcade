/**
 * Plinko board geometry & canvas animation engine.
 * Route is fully pre-calculated before animation — no mid-flight correction.
 * Runs entirely outside React render cycle via requestAnimationFrame.
 */

export const PLINKO = {
  NUM_ROWS: 12,
  NUM_SLOTS: 13,
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

export interface PlinkoRouteNode {
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

const MOTION = {
  TARGET_MS: 5000,
  SAMPLE_MS: 10,
};

function slotToX(slot: number): number {
  const m = 0.032;
  return m + (slot / (PLINKO.NUM_SLOTS - 1)) * (1 - 2 * m);
}

function rowY(row: number): number {
  return BOARD.TOP + ((row + 0.5) / PLINKO.NUM_ROWS) * (BOARD.PEG_BOTTOM - BOARD.TOP);
}

function channelX(row: number, col: number): number {
  if (row >= PLINKO.NUM_ROWS - 1) return slotToX(col);
  return 0.5 + (col - (row + 1) / 2) * PLINKO.PEG_SPACING;
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

/** Client-side fallback if route missing from API. */
export function buildRouteFromPath(path: ('L' | 'R')[], targetSlot: number): PlinkoRouteNode[] {
  let col = 0;
  const nodes: PlinkoRouteNode[] = [{ row: -1, col: 0, x: BOARD.SPAWN_X, y: BOARD.SPAWN_Y }];

  for (let row = 0; row < path.length; row++) {
    if (path[row] === 'R') col++;
    nodes.push({
      row,
      col,
      x: row >= PLINKO.NUM_ROWS - 1 ? slotToX(col) : channelX(row, col),
      y: rowY(row) + 0.018,
    });
  }

  const finalX = slotToX(targetSlot);
  nodes[nodes.length - 1].x = finalX;
  nodes[nodes.length - 1].col = targetSlot;

  nodes.push({ row: PLINKO.NUM_ROWS, col: targetSlot, x: finalX, y: 0.758 });
  nodes.push({ row: PLINKO.NUM_ROWS + 1, col: targetSlot, x: finalX, y: 0.808 });
  nodes.push({ row: PLINKO.NUM_ROWS + 2, col: targetSlot, x: finalX, y: 0.858 });
  nodes.push({ row: PLINKO.NUM_ROWS + 3, col: targetSlot, x: finalX, y: BOARD.SLOT_Y });
  nodes.push({ row: PLINKO.NUM_ROWS + 4, col: targetSlot, x: finalX, y: BOARD.SLOT_Y + 0.006 });

  return nodes;
}

export function validateRoute(route: PlinkoRouteNode[], targetSlot: number): boolean {
  if (route.length < 3) return false;
  if (Math.abs(route[0].x - BOARD.SPAWN_X) > 0.0001) return false;

  const pegNodes = route.filter(n => n.row >= 0 && n.row < PLINKO.NUM_ROWS);
  if (pegNodes.length !== PLINKO.NUM_ROWS) return false;

  let prevCol = -1;
  for (const node of pegNodes) {
    if (prevCol >= 0) {
      const delta = node.col - prevCol;
      if (delta < 0 || delta > 1) return false;
    }
    prevCol = node.col;
  }

  if (prevCol !== targetSlot) return false;

  const finalX = slotToX(targetSlot);
  if (Math.abs(pegNodes[pegNodes.length - 1].x - finalX) > 0.0001) return false;

  for (const node of route.filter(n => n.row >= PLINKO.NUM_ROWS)) {
    if (node.col !== targetSlot || Math.abs(node.x - finalX) > 0.0001) return false;
  }

  return true;
}

/**
 * Convert validated route into timed samples — animation only reads, never steers.
 */
export function buildTrajectoryFromRoute(route: PlinkoRouteNode[], seed: number): TrajectorySample[] {
  const rand = seededRandom(seed);
  const keyframes: TrajectorySample[] = [];
  let t = 0;

  keyframes.push({ x: route[0].x, y: route[0].y, t: 0, vx: 0, vy: 0.0003 });

  for (let i = 1; i < route.length; i++) {
    const prev = route[i - 1];
    const curr = route[i];
    const vertical = Math.abs(curr.x - prev.x) < 0.0001;
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;

    if (vertical) {
      const dur = 220 + Math.abs(dy) * 520;
      t += dur * 0.45;
      keyframes.push({ x: curr.x, y: prev.y + dy * 0.5, t, vx: 0, vy: 0.00035 });
      t += dur * 0.55;
      keyframes.push({ x: curr.x, y: curr.y, t, vx: 0, vy: 0.0002 });
    } else {
      const dur = 340 + rand() * 70;
      const wobble = (rand() - 0.5) * 0.0008;

      t += dur * 0.38;
      keyframes.push({
        x: prev.x + dx * 0.12 + wobble,
        y: prev.y + dy * 0.28,
        t,
        vx: dx * 0.0008,
        vy: 0.00032,
      });

      t += dur * 0.34;
      keyframes.push({
        x: prev.x + dx * 0.52 + wobble * 0.5,
        y: prev.y + dy * 0.58,
        t,
        vx: dx * 0.0006,
        vy: 0.00028,
      });

      t += dur * 0.28;
      keyframes.push({
        x: curr.x + wobble * 0.3,
        y: curr.y,
        t,
        vx: dx * 0.0003,
        vy: 0.00035,
      });
    }
  }

  const finalX = route[route.length - 1].x;
  const bounceH = 0.009 + rand() * 0.004;
  t += 180;
  keyframes.push({ x: finalX, y: BOARD.SLOT_Y, t, vx: 0, vy: 0.00015 });
  t += 160;
  keyframes.push({ x: finalX, y: BOARD.SLOT_Y - bounceH, t, vx: 0, vy: -0.0001 });
  t += 140;
  keyframes.push({ x: finalX, y: BOARD.SLOT_Y, t, vx: 0, vy: 0.00008 });
  t += 200;
  keyframes.push({ x: finalX, y: BOARD.SLOT_Y + 0.006, t, vx: 0, vy: 0 });

  return scaleTrajectoryDuration(densifyKeyframes(keyframes), MOTION.TARGET_MS);
}

function densifyKeyframes(keyframes: TrajectorySample[]): TrajectorySample[] {
  if (keyframes.length < 2) return keyframes;
  const total = keyframes[keyframes.length - 1].t;
  const out: TrajectorySample[] = [];

  for (let t = 0; t <= total; t += MOTION.SAMPLE_MS) {
    const { pos, vx, vy } = interpolateKeyframes(keyframes, t);
    out.push({ x: pos.x, y: pos.y, t, vx, vy });
  }
  return out;
}

function scaleTrajectoryDuration(samples: TrajectorySample[], targetMs: number): TrajectorySample[] {
  if (samples.length < 2) return samples;
  const current = samples[samples.length - 1].t;
  if (current <= 0) return samples;
  const scale = targetMs / current;
  return samples.map(s => ({ ...s, t: s.t * scale }));
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

function interpolateKeyframes(
  keyframes: TrajectorySample[],
  elapsed: number,
): { pos: Point; vx: number; vy: number } {
  const clamped = Math.min(Math.max(0, elapsed), keyframes[keyframes.length - 1].t);

  let i = 0;
  while (i < keyframes.length - 2 && keyframes[i + 1].t < clamped) i++;

  const s0 = keyframes[Math.max(0, i - 1)];
  const s1 = keyframes[i];
  const s2 = keyframes[Math.min(keyframes.length - 1, i + 1)];
  const s3 = keyframes[Math.min(keyframes.length - 1, i + 2)];

  const segDur = s2.t - s1.t || 1;
  let u = (clamped - s1.t) / segDur;
  u = u * u * (3 - 2 * u);

  const vertical = Math.abs(s2.x - s1.x) < 0.0001;
  const tx1 = vertical ? 0 : (s2.x - s0.x) * 0.35;
  const tx2 = vertical ? 0 : (s3.x - s1.x) * 0.35;
  const ty1 = Math.max(0.0002, (s2.y - s0.y) * 0.4);
  const ty2 = Math.max(0.0002, (s3.y - s1.y) * 0.4);

  const pos: Point = {
    x: hermite(s1.x, tx1, s2.x, tx2, u),
    y: hermite(s1.y, ty1, s2.y, ty2, u),
  };

  const nextU = Math.min(1, u + 0.018);
  const nextX = hermite(s1.x, tx1, s2.x, tx2, nextU);
  const nextY = hermite(s1.y, ty1, s2.y, ty2, nextU);

  return {
    pos,
    vx: (nextX - pos.x) / 0.018,
    vy: (nextY - pos.y) / 0.018,
  };
}

function sampleTrajectory(
  samples: TrajectorySample[],
  elapsed: number,
): { pos: Point; rot: number; vy: number; speed: number } {
  const { pos, vx, vy } = interpolateKeyframes(samples, elapsed);

  const next = interpolateKeyframes(samples, Math.min(samples[samples.length - 1].t, elapsed + 16));
  const dx = next.pos.x - pos.x;
  const dy = next.pos.y - pos.y;
  const speed = Math.hypot(dx, dy);
  const rot = Math.atan2(dx, Math.max(dy, 0.00001)) * (180 / Math.PI);

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

  startDrop(
    route: PlinkoRouteNode[],
    targetSlot: number,
    seed: number,
    onComplete: () => void,
  ): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.targetSlot = targetSlot;

    if (!validateRoute(route, targetSlot)) {
      throw new Error('Invalid Plinko route — refusing to animate');
    }

    this.trajectory = buildTrajectoryFromRoute(route, seed);
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
      this.ball.roll += speed * dt * 0.16;
      this.ball.rot = rot * 0.1 + this.ball.roll;
      this.ball.scale = 1 + Math.min(0.03, Math.abs(vy) * 60);

      const landingStart = total * 0.88;
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
    marble.addColorStop(0.12, '#e2e8f0');
    marble.addColorStop(0.35, '#94a3b8');
    marble.addColorStop(0.65, '#64748b');
    marble.addColorStop(0.88, '#475569');
    marble.addColorStop(1, '#334155');

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = marble;
    ctx.fill();

    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(r * 0.12, r * 0.18, r * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.beginPath();
    ctx.arc(-r * 0.32, -r * 0.32, r * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
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
