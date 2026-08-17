export class RotationController {
  yaw = 0; pitch = 0; selected = false; dragging = false;
  private speed: number; private resumeAt = 0;
  constructor(private period = 20, private autoRotate = true, private reduced = false) { this.speed = reduced || !autoRotate ? 0 : 1; }
  select(value: boolean, now = performance.now()) { if (this.selected && !value) this.resumeAt = now + 500; this.selected = value; }
  startDrag() { this.dragging = true; this.speed = 0; }
  drag(dx: number, dy: number) { this.yaw += dx * .006; this.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.pitch + dy * .006)); }
  endDrag(now = performance.now()) { this.dragging = false; this.resumeAt = now + 800; }
  update(dt: number, now = performance.now()) {
    const target = this.autoRotate && !this.reduced && !this.selected && !this.dragging && now >= this.resumeAt ? 1 : 0;
    const duration = target ? .5 : .25;
    this.speed += (target - this.speed) * Math.min(1, dt / duration);
    this.yaw += dt * (Math.PI * 2 / this.period) * this.speed;
    return { yaw: this.yaw, pitch: this.pitch, speed: this.speed };
  }
}
