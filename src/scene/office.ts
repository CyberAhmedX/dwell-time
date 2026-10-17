import type { Chapter } from "../engine/types";
import { MOODS, type Mood } from "./mood";

// A hand-built pixel office rendered on a canvas. No sprite assets: everything
// is drawn from rectangles so it ships inside the single HTML file and scales
// cleanly. The scene reacts to the chapter mood (rain, lightning, darkness).

interface Drop {
  x: number;
  y: number;
  len: number;
  spd: number;
}

const VW = 320; // virtual pixel width
const VH = 180; // virtual pixel height

export class OfficeScene {
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private drops: Drop[] = [];
  private mood: Mood = MOODS[0];
  private t = 0;
  private flash = 0;
  private nextBolt = 3;
  private reduced: boolean;
  private scale = 1;
  private offX = 0;
  private offY = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    this.ctx = ctx;
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.resize();
    for (let i = 0; i < 160; i++) this.drops.push(this.newDrop(true));
    addEventListener("resize", this.resize);
  }

  /** null follows the system setting. */
  setReducedMotion(on: boolean | null): void {
    this.reduced = on ?? matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (this.reduced) this.flash = 0;
  }

  setChapter(ch: Chapter): void {
    this.mood = MOODS[ch];
  }

  start(): void {
    if (this.raf) return;
    let last = performance.now();
    const loop = (now: number): void => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.update(dt);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    removeEventListener("resize", this.resize);
  }

  private resize = (): void => {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.scale = Math.max(this.canvas.width / VW, this.canvas.height / VH);
    this.offX = (this.canvas.width - VW * this.scale) / 2;
    this.offY = (this.canvas.height - VH * this.scale) / 2;
  };

  private newDrop(seed = false): Drop {
    return {
      x: Math.random() * (VW + 40) - 20,
      y: seed ? Math.random() * VH : -10,
      len: 4 + Math.random() * 6,
      spd: 180 + Math.random() * 120,
    };
  }

  private update(dt: number): void {
    this.t += dt;
    if (this.reduced) return;
    const rain = this.mood.rain;
    const active = Math.floor(this.drops.length * rain);
    for (let i = 0; i < active; i++) {
      const d = this.drops[i];
      d.y += d.spd * dt;
      d.x -= d.spd * 0.25 * dt;
      if (d.y > VH + 10) Object.assign(d, this.newDrop());
    }
    if (this.mood.lightning) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) {
        this.flash = 1;
        this.nextBolt = 4 + Math.random() * 7;
      }
    }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3);
  }

  // ---- pixel helpers (virtual coordinates) ----
  private px(x: number, y: number, w: number, h: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(
      Math.round(this.offX + x * this.scale),
      Math.round(this.offY + y * this.scale),
      Math.ceil(w * this.scale),
      Math.ceil(h * this.scale),
    );
  }

  private draw(): void {
    const c = this.ctx;
    const m = this.mood;
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // window sky (gradient), seen through the back wall
    const sky = c.createLinearGradient(0, this.offY, 0, this.offY + VH * this.scale);
    sky.addColorStop(0, m.sky[0]);
    sky.addColorStop(1, m.sky[1]);
    c.fillStyle = sky;
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // back wall
    this.px(0, 0, VW, 118, m.room);
    // floor
    this.px(0, 118, VW, VH - 118, m.floor);
    // floor seam
    this.px(0, 118, VW, 2, "rgba(0,0,0,0.18)");

    this.drawWindow(150, 14, 120, 70);
    this.drawLighthouse();
    this.drawCorkboard(16, 20);
    this.drawPlant(292, 92);
    this.drawDesk(26, 96, m.lampWarm, false);
    this.drawDesk(120, 102, m.lampWarm, true);
    this.drawServerRack(286, 40);
    this.drawCat(176, 150, this.t);

    // rain in front of the window
    if (!this.reduced && m.rain > 0) this.drawRain();

    // ambient darkness overlay
    if (m.ambient > 0) {
      c.fillStyle = `rgba(6,8,16,${m.ambient})`;
      c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // warm pools under the desk lamps punch back through the dark
    if (m.lampWarm > 0) {
      this.lampGlow(44, 104, m.lampWarm);
      this.lampGlow(150, 110, m.lampWarm);
    }

    // emergency red wash in the finale
    if (m.emergency) {
      const pulse = 0.12 + 0.12 * (0.5 + 0.5 * Math.sin(this.t * 2.2));
      c.fillStyle = `rgba(190,30,45,${pulse})`;
      c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // lightning flash
    if (this.flash > 0) {
      c.fillStyle = `rgba(200,220,255,${this.flash * 0.5})`;
      c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // soft vignette
    const v = c.createRadialGradient(
      this.canvas.width / 2,
      this.canvas.height / 2,
      this.canvas.height * 0.25,
      this.canvas.width / 2,
      this.canvas.height / 2,
      this.canvas.height * 0.75,
    );
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, `rgba(0,0,0,${0.25 + m.ambient * 0.3})`);
    c.fillStyle = v;
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private drawWindow(x: number, y: number, w: number, h: number): void {
    this.px(x - 3, y - 3, w + 6, h + 6, "#8a7a63"); // frame
    const sky = this.ctx.createLinearGradient(0, this.offY, 0, this.offY + (y + h) * this.scale);
    sky.addColorStop(0, this.mood.sky[0]);
    sky.addColorStop(1, this.mood.sky[1]);
    this.ctx.fillStyle = sky;
    this.ctx.fillRect(
      this.offX + x * this.scale,
      this.offY + y * this.scale,
      w * this.scale,
      h * this.scale,
    );
    // distant sea
    this.px(x, y + h - 20, w, 20, "rgba(40,70,90,0.5)");
    // mullions
    this.px(x + w / 2 - 1, y, 2, h, "#6f6250");
    this.px(x, y + h / 2 - 1, w, 2, "#6f6250");
  }

  private drawLighthouse(): void {
    // on the horizon through the window
    const bx = 240;
    this.px(bx, 40, 6, 30, "#e8e4dc");
    this.px(bx, 46, 6, 4, "#c63b3b");
    this.px(bx + 1, 34, 4, 6, "#394049");
    // beam, stronger as it gets darker
    const beam = 0.1 + this.mood.ambient * 0.5;
    const sweep = Math.sin(this.t * 0.6);
    this.ctx.save();
    this.ctx.globalAlpha = beam;
    this.ctx.fillStyle = "rgba(255,240,200,1)";
    this.ctx.beginPath();
    const ox = this.offX + (bx + 3) * this.scale;
    const oy = this.offY + 37 * this.scale;
    this.ctx.moveTo(ox, oy);
    this.ctx.lineTo(ox + (40 + sweep * 20) * this.scale, oy - 14 * this.scale);
    this.ctx.lineTo(ox + (40 + sweep * 20) * this.scale, oy + 14 * this.scale);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();
  }

  private drawCorkboard(x: number, y: number): void {
    this.px(x, y, 60, 42, "#b9894f");
    this.px(x + 2, y + 2, 56, 38, "#c99a5e");
    // pinned notes
    const notes = [
      [4, 4, 16, 12, "#f4efe0"],
      [24, 6, 14, 10, "#dfe9f0"],
      [8, 20, 18, 12, "#f0e3d0"],
      [32, 22, 16, 12, "#e7f0df"],
    ] as const;
    for (const [nx, ny, nw, nh, col] of notes) {
      this.px(x + nx, y + ny, nw, nh, col as string);
      this.px(x + nx + (nw as number) / 2 - 1, y + ny - 1, 2, 2, "#c0392b");
    }
    // red string between two notes
    this.ctx.strokeStyle = "rgba(180,40,40,0.8)";
    this.ctx.lineWidth = Math.max(1, this.scale * 0.5);
    this.ctx.beginPath();
    this.ctx.moveTo(this.offX + (x + 12) * this.scale, this.offY + (y + 10) * this.scale);
    this.ctx.lineTo(this.offX + (x + 40) * this.scale, this.offY + (y + 28) * this.scale);
    this.ctx.stroke();
  }

  private drawPlant(x: number, y: number): void {
    this.px(x, y + 16, 12, 10, "#b5652f"); // pot
    this.px(x + 2, y, 3, 18, "#3f7d44");
    this.px(x + 5, y - 2, 3, 20, "#4b9150");
    this.px(x + 8, y + 2, 3, 16, "#3f7d44");
  }

  private drawDesk(x: number, y: number, lamp: number, hasMonitorTwo: boolean): void {
    // desk top
    this.px(x, y, 70, 6, "#7a5a3c");
    this.px(x, y + 6, 70, 18, "#5f4630");
    // legs
    this.px(x + 2, y + 24, 4, 14, "#4a371f");
    this.px(x + 64, y + 24, 4, 14, "#4a371f");
    // monitor
    this.px(x + 8, y - 20, 26, 18, "#2b2f36");
    this.px(x + 10, y - 18, 22, 14, lamp > 0.5 ? "#1f6f6a" : "#2f8f88");
    this.px(x + 19, y - 2, 4, 4, "#2b2f36");
    this.px(x + 14, y + 2, 14, 2, "#2b2f36");
    // scanlines on screen
    for (let i = 0; i < 6; i++) this.px(x + 11, y - 17 + i * 2, 20, 1, "rgba(255,255,255,0.06)");
    if (hasMonitorTwo) {
      this.px(x + 38, y - 16, 20, 14, "#2b2f36");
      this.px(x + 40, y - 14, 16, 10, "#8a5a2f");
    }
    // desk lamp with warm bulb
    this.px(x + 58, y - 14, 2, 14, "#3b3f45");
    this.px(x + 56, y - 16, 6, 3, "#3b3f45");
    if (lamp > 0) {
      this.ctx.save();
      this.ctx.globalAlpha = lamp;
      this.px(x + 57, y - 13, 4, 3, "#ffd27a");
      this.ctx.restore();
    }
    // coffee mug
    this.px(x + 2, y - 4, 5, 4, "#d8d2c6");
  }

  private drawServerRack(x: number, y: number): void {
    this.px(x, y, 26, 72, "#23262c");
    for (let i = 0; i < 9; i++) {
      this.px(x + 2, y + 3 + i * 7, 22, 5, "#2e333b");
      // blinking status LEDs
      const on = (Math.floor(this.t * 2) + i) % 3 !== 0;
      this.px(x + 20, y + 4 + i * 7, 2, 2, on ? "#59d98a" : "#1d5a38");
      this.px(x + 17, y + 4 + i * 7, 2, 2, (i + Math.floor(this.t)) % 4 === 0 ? "#e2c34a" : "#5a4e1d");
    }
  }

  private drawCat(x: number, y: number, t: number): void {
    const breathe = Math.sin(t * 1.5) * 0.6;
    // curled on the floor
    this.px(x, y + 4 + breathe, 20, 10, "#3a3a40"); // body
    this.px(x + 16, y + breathe, 7, 7, "#3a3a40"); // head
    this.px(x + 17, y - 1 + breathe, 2, 3, "#3a3a40"); // ear
    this.px(x + 21, y - 1 + breathe, 2, 3, "#3a3a40"); // ear
    this.px(x + 18, y + 2 + breathe, 1, 1, "#9ad1b0"); // eye
    this.px(x - 3, y + 7 + breathe, 5, 3, "#3a3a40"); // tail
  }

  private drawRain(): void {
    const c = this.ctx;
    c.strokeStyle = `rgba(190,210,230,${0.25 + this.mood.rain * 0.3})`;
    c.lineWidth = Math.max(1, this.scale * 0.4);
    c.beginPath();
    const active = Math.floor(this.drops.length * this.mood.rain);
    for (let i = 0; i < active; i++) {
      const d = this.drops[i];
      const sx = this.offX + d.x * this.scale;
      const sy = this.offY + d.y * this.scale;
      c.moveTo(sx, sy);
      c.lineTo(sx - d.len * 0.4 * this.scale, sy + d.len * this.scale);
    }
    c.stroke();
  }

  private lampGlow(x: number, y: number, strength: number): void {
    const c = this.ctx;
    const g = c.createRadialGradient(
      this.offX + x * this.scale,
      this.offY + y * this.scale,
      0,
      this.offX + x * this.scale,
      this.offY + y * this.scale,
      46 * this.scale,
    );
    g.addColorStop(0, `rgba(255,205,120,${0.28 * strength})`);
    g.addColorStop(1, "rgba(255,205,120,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
