// The one kitty. Cut at 2x like the furniture: one art pixel = one pixel of the 2x room buffer.
// Sheet rows (see public/art/kitty.json): sleep 4, blink 5, stretch 5, walk 6 (faces right), held 4 (top-anchored).
// Position (x, y) is where her feet touch the ground, in 480x270 room units.
const HEART = [[-1, 0], [1, 0], [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1], [-1, 2], [0, 2], [1, 2], [0, 3]];   // 5x4 pixel heart
export function createKitty(img, meta, K, world) {
  const [cw, ch] = meta.cell, R = (n) => meta.rows[n].row;
  const k = { x: 250, y: 252, face: 1, state: 'idle', t: 0, anim: 0, perch: null, hearts: [], vy: 0, held: null, dest: null, next: 3 };
  const rand = (a, b) => a + Math.random() * (b - a);
  const floorClamp = () => { k.x = Math.min(world.floor.x1, Math.max(world.floor.x0, k.x)); k.y = Math.min(world.floor.y1, Math.max(k.x > world.floor.bedX ? world.floor.yFront : world.floor.y0, k.y)); };

  function set(state, dur) { k.state = state; k.t = 0; k.dur = dur; k.anim = 0; }
  const P = world.perches;                                                    // { bed, sill }: approach, spot, zone, spotMin/Max
  const perchAt = (x, y) => Object.keys(P).find((n) => x > P[n].zone[0] && x < P[n].zone[2] && y > P[n].zone[1] && y < P[n].zone[3]);
  function think(night) {
    const r = Math.random();
    if (k.perch) { if (r < 0.5 - night * 0.35) hop(null); else set('sleep', rand(25, 60)); return; }
    const toBed = 0.2 + night * 0.4, toSill = 0.14 * (1 - night * 0.7), sleepFloor = 0.1 + night * 0.1;
    if (r < toBed) { k.dest = { ...P.bed.approach, then: 'bed' }; set('walk', 99); }
    else if (r < toBed + toSill) { k.dest = { ...P.sill.approach, then: 'sill' }; set('walk', 99); }
    else if (r < toBed + toSill + sleepFloor) set('sleep', rand(15, 40));
    else if (r < toBed + toSill + sleepFloor + 0.4) { const x = rand(world.floor.x0 + 10, world.floor.x1 - 10); k.dest = { x, y: rand(x > world.floor.bedX ? world.floor.yFront : world.floor.y0, world.floor.y1) }; set('walk', 99); }
    else if (r < 0.93) set('stretch', 1.4);
    else set('idle', rand(3, 7));
  }
  // hop to a perch (name) or back down to the floor (null, from wherever she is)
  function hop(name) {
    const from = k.perch, to = name ? P[name].spot : { x: P[from].approach.x, y: P[from].approach.y }, dur = name ? 0.85 : 0.65;
    k.hop = { x0: k.x, y0: k.y, x1: to.x, y1: to.y, t: 0, dur, perch: name, lift: name === 'sill' ? 62 : 26, down: !name && from === 'sill' };
    set('hop', dur);
  }
  function update(dt, night) {
    k.t += dt;
    for (const h of k.hearts) { h.t += dt; }
    k.hearts = k.hearts.filter((h) => h.t < 1.4);
    if (k.state === 'held') return;
    if (k.state === 'fall') {
      k.vy += 420 * dt; k.y += k.vy * dt;
      const ground = k.fallTo;
      if (k.y >= ground) { k.y = ground; k.perch = k.landPerch || null; set(k.perch ? 'sleep' : 'idle', k.perch ? rand(20, 40) : 2.5); }
      return;
    }
    if (k.state === 'hop') {
      const h = k.hop, p = Math.min(1, (h.t += dt) / h.dur);
      k.x = h.x0 + (h.x1 - h.x0) * p; k.y = h.y0 + (h.y1 - h.y0) * p - Math.sin(p * Math.PI) * h.lift; k.face = h.x1 >= h.x0 ? 1 : -1;
      if (p >= 1) { k.perch = h.perch; k.x = h.x1; k.y = h.y1; set(k.perch ? 'sleep' : 'idle', k.perch ? rand(25, 60) : 1.5); }
      return;
    }
    if (k.state === 'walk') {
      const d = k.dest, dx = d.x - k.x, dy = d.y - k.y, dist = Math.hypot(dx, dy), sp = 22 * dt;
      if (dist <= sp) { k.x = d.x; k.y = d.y; if (d.then) hop(d.then); else set('idle', rand(2, 5)); }
      else { k.x += dx / dist * sp; k.y += dy / dist * sp * 0.8; if (Math.abs(dx) > 1) k.face = dx > 0 ? 1 : -1; }
      return;
    }
    if (k.dur !== undefined && k.t >= k.dur) think(night);
  }

  // which sheet cell to draw
  function cell() {
    switch (k.state) {
      case 'walk': return ['walk', Math.floor(k.t * 9) % 6];
      case 'sleep': return ['sleep', (k.t % 9) > 8 ? 3 : [0, 1, 2, 1][Math.floor(k.t / 1.1) % 4]];
      case 'stretch': return ['stretch', Math.min(4, Math.floor(k.t / (k.dur / 5)))];
      case 'happy': return ['blink', [1, 2, 2, 1, 0][Math.min(4, Math.floor(k.t / 0.25))]];
      case 'hop': return ['stretch', k.hop.t / k.hop.dur < 0.5 ? 2 : 3];
      case 'fall': return ['held', 1];
      case 'held': return ['held', Math.floor(k.t * 3) % 4];
      default: return ['blink', (k.t % 4.2) > 4.0 ? 1 : 0];                 // idle: eyes open, blinks now and then
    }
  }
  function rect() {                                                           // current frame bounds in room units
    const [row, f] = cell(), [w, h] = meta.rows[row].sizes[f], top = meta.rows[row].anchor === 'top';
    const px = k.state === 'held' ? k.held.x : k.x, py = k.state === 'held' ? k.held.y : k.y;
    return top ? { x: px - w / 2 / K, y: py, w: w / K, h: h / K } : { x: px - w / 2 / K, y: py - h / K, w: w / K, h: h / K };
  }
  function draw(b) {
    const [row, f0] = cell(), m = meta.rows[row], f = Math.min(f0, m.frames - 1), sx = f * cw, sy = m.row * ch;
    const flip = k.face < 0 && row !== 'held';
    const px = k.state === 'held' ? k.held.x : k.x, py = k.state === 'held' ? k.held.y : k.y;
    // soft contact shadow on the ground (hard-edged steps), not when held or in the air
    if (k.state !== 'held') {
      const gy = k.state === 'hop' ? k.hop.y0 + (k.hop.y1 - k.hop.y0) * (k.hop.t / k.hop.dur) : k.state === 'fall' ? k.fallTo : k.y, w = (m.sizes[f][0] / K) * 0.7;
      b.fillStyle = 'rgba(70,36,80,0.22)';
      b.fillRect(px - w / 2, gy - 1, w, 1.5); b.fillStyle = 'rgba(70,36,80,0.14)'; b.fillRect(px - w / 2 + 2, gy + 0.5, w - 4, 1.5);
    }
    b.save();
    const dw = cw / K, dh = ch / K, dx = px - dw / 2, dy = m.anchor === 'top' ? py : py - dh;
    if (flip) { b.translate(px, 0); b.scale(-1, 1); b.translate(-px, 0); }
    b.drawImage(img, sx, sy, cw, ch, dx, dy, dw, dh);
    b.restore();
    for (const h of k.hearts) {                                              // little pixel hearts rising from her head
      const hy = h.y - h.t * 14, a = 1 - h.t / 1.4; b.fillStyle = `rgba(232,106,124,${a})`;
      for (const [ox, oy] of HEART) b.fillRect(Math.round((h.x + ox) * K) / K, Math.round((hy + oy) * K) / K, 1 / K, 1 / K);
    }
  }
  // pointer interaction (room units)
  function hit(x, y) { const r = rect(); return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }
  function down(x, y) { k.held = { x, y: y - 6, dx: x, dy: y, moved: false, t0: performance.now() }; k.state = 'held'; k.t = 0; k.perch = null; }
  function move(x, y) { if (k.state !== 'held') return; if (Math.hypot(x - k.held.dx, y - k.held.dy) > 3) k.held.moved = true; k.held.x = x; k.held.y = y - 6; k.face = 1; }
  function up(night) {
    if (k.state !== 'held') return;
    const h = k.held;
    if (!h.moved) {                                                          // a tap: she is happy
      k.x = h.x; k.y = h.y + 6; k.held = null; set('happy', 1.25); const r = rect();
      k.hearts.push({ x: k.x, y: r.y - 4, t: 0 }); k.y = Math.min(world.floor.y1, k.y); return;
    }
    k.x = h.x; k.y = h.y + 40; k.held = null;                                // she hangs ~40 units below the scruff point
    const pn = perchAt(k.x, h.y + 6);   // judged by where the pointer is let go
    k.landPerch = pn || null;
    if (pn) { k.x = Math.min(P[pn].spotMax, Math.max(P[pn].spotMin, k.x)); k.fallTo = P[pn].spot.y; k.y = Math.min(k.y, k.fallTo - 4); }
    else { floorClamp(); k.fallTo = k.y < world.floor.y0 ? Math.min(world.floor.y1, Math.max(world.floor.y0, k.y + 30)) : k.y; k.y = Math.min(k.y, k.fallTo - 4); }
    k.vy = 0; set('fall', 99);
  }
  set('idle', 3);
  return { k, update, draw, hit, down, move, up };
}
