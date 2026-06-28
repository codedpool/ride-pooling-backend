/* ============================================================
   DISPATCH console — client logic
   ============================================================ */
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const state = {
  ctx: null,
  bbox: { latMin: 28.40, latMax: 28.78, lonMin: 76.98, lonMax: 77.36 },
  rides: [],
  lastBooking: null
};

const TESTS = [
  { id: 'database',    name: 'Database connectivity & PostGIS' },
  { id: 'geospatial',  name: 'Geospatial distance & detour math' },
  { id: 'pricing',     name: 'Fare & surge calculation' },
  { id: 'matching',    name: 'Ride matching & scoring' },
  { id: 'concurrency', name: 'Concurrency — race condition guard' },
  { id: 'throughput',  name: 'Matching throughput benchmark' }
];

/* ---------- tiny utils ---------- */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const short = (id) => (id ? String(id).slice(0, 8) : '—');
const num = (v) => Number(v);

async function fetchJSON(url, opts) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  });
  let body = {};
  try { body = await res.json(); } catch { /* ignore */ }
  return { ok: res.ok, status: res.status, body };
}

/* ---------- terminal ---------- */
function logTo(el, msg, type = 'info') {
  const stamp = new Date().toLocaleTimeString('en-GB', { hour12: false });
  const line = document.createElement('div');
  line.className = `line ${type}`;
  line.innerHTML = `<span class="t">${stamp}</span><span class="msg"></span>`;
  line.querySelector('.msg').textContent = msg;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}
const log = (m, t) => logTo($('#log'), m, t);
const slog = (m, t) => logTo($('#suiteLog'), m, t);

/* ---------- toast ---------- */
let toastTimer;
function toast(msg, kind = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `toast show ${kind}`;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 2600);
}

/* ---------- button busy state ---------- */
function busy(btn, on) {
  btn.classList.toggle('busy', on);
  btn.disabled = on;
}

/* ---------- count-up metric ---------- */
function setMetric(el, target) {
  const from = parseInt(el.textContent.replace(/\D/g, '')) || 0;
  target = parseInt(target) || 0;
  if (from === target) { el.textContent = target; return; }
  const steps = 14, diff = target - from;
  let i = 0;
  const tick = () => {
    i++;
    el.textContent = Math.round(from + diff * (i / steps));
    if (i < steps) requestAnimationFrame(tick);
    else el.textContent = target;
  };
  requestAnimationFrame(tick);
}

/* ============================================================
   RADAR
   ============================================================ */
function project(lat, lon, W, H, pad) {
  const b = state.bbox;
  const x = pad + (lon - b.lonMin) / (b.lonMax - b.lonMin) * (W - 2 * pad);
  const y = pad + (1 - (lat - b.latMin) / (b.latMax - b.latMin)) * (H - 2 * pad);
  return { x, y };
}

function renderRadar() {
  const W = 600, H = 600, pad = 30;
  const cx = 300, cy = 300, R = 250;
  const parts = [];

  // gradient for the sweep wedge
  parts.push(`<defs><linearGradient id="sweepG" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="rgba(65,224,163,0.28)"/>
    <stop offset="100%" stop-color="rgba(65,224,163,0)"/></linearGradient></defs>`);

  // crosshair
  parts.push(`<line class="r-cross" x1="${pad}" y1="${cy}" x2="${W - pad}" y2="${cy}"/>`);
  parts.push(`<line class="r-cross" x1="${cx}" y1="${pad}" x2="${cx}" y2="${H - pad}"/>`);

  // range rings + bearing ticks on the outer ring
  [90, 170, 250].forEach(r => parts.push(`<circle class="r-ring" cx="${cx}" cy="${cy}" r="${r}"/>`));
  for (let a = 0; a < 360; a += 30) {
    const rad = a * Math.PI / 180;
    const x1 = cx + (R - 8) * Math.cos(rad), y1 = cy + (R - 8) * Math.sin(rad);
    const x2 = cx + R * Math.cos(rad), y2 = cy + R * Math.sin(rad);
    parts.push(`<line class="r-tick" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);
  }

  // rotating sweep
  const half = 24 * Math.PI / 180;
  const p1x = cx + R * Math.cos(-half), p1y = cy + R * Math.sin(-half);
  const p2x = cx + R * Math.cos(half), p2y = cy + R * Math.sin(half);
  parts.push(`<g class="r-sweep" style="transform-origin:${cx}px ${cy}px">
    <path d="M${cx} ${cy} L${p1x.toFixed(1)} ${p1y.toFixed(1)} A${R} ${R} 0 0 1 ${p2x.toFixed(1)} ${p2y.toFixed(1)} Z" fill="url(#sweepG)"/>
    <line x1="${cx}" y1="${cy}" x2="${cx + R}" y2="${cy}" stroke="rgba(65,224,163,0.5)" stroke-width="1.5"/>
  </g>`);

  const rides = state.rides.slice(0, 90);
  if (rides.length === 0 && !state.lastBooking) {
    parts.push(`<text class="r-empty" x="${cx}" y="${cy - 4}" text-anchor="middle">NO CONTACTS</text>`);
    parts.push(`<text class="r-label" x="${cx}" y="${cy + 16}" text-anchor="middle">deploy a fleet to paint the scope</text>`);
  }

  // cab contacts
  rides.forEach(r => {
    const lat = num(r.cab_lat ?? r.pickup_lat);
    const lon = num(r.cab_lon ?? r.pickup_lon);
    if (!isFinite(lat) || !isFinite(lon)) return;
    const p = project(lat, lon, W, H, pad);
    const matched = state.lastBooking && r.id === state.lastBooking.rideId;
    parts.push(`<circle class="r-cab-halo" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="6"/>`);
    parts.push(`<circle class="r-cab" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.6"/>`);
    if (matched) parts.push(`<circle class="r-pulse" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="6"/>`);
  });

  // active booking route
  if (state.lastBooking) {
    const b = state.lastBooking;
    const pu = project(b.pickup.lat, b.pickup.lon, W, H, pad);
    const dr = project(b.dropoff.lat, b.dropoff.lon, W, H, pad);
    parts.push(`<line class="r-route" x1="${pu.x.toFixed(1)}" y1="${pu.y.toFixed(1)}" x2="${dr.x.toFixed(1)}" y2="${dr.y.toFixed(1)}"/>`);
    parts.push(`<circle class="r-pickup" cx="${pu.x.toFixed(1)}" cy="${pu.y.toFixed(1)}" r="4.5"/>`);
    parts.push(`<circle class="r-drop" cx="${dr.x.toFixed(1)}" cy="${dr.y.toFixed(1)}" r="4.5"/>`);
    parts.push(`<text class="r-label" x="${(pu.x + 9).toFixed(1)}" y="${(pu.y - 7).toFixed(1)}">pickup</text>`);
    parts.push(`<text class="r-label" x="${(dr.x + 9).toFixed(1)}" y="${(dr.y - 7).toFixed(1)}">drop</text>`);
  }

  $('.map-wrap').innerHTML =
    `<svg id="radar" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${parts.join('')}</svg>`;
}

/* ============================================================
   DATA REFRESH
   ============================================================ */
async function refreshStatus() {
  const { ok, body } = await fetchJSON('/api/simulate/status');
  const pill = $('#apiPill');
  pill.classList.remove('online', 'offline');
  if (ok && body.success) {
    const d = body.data;
    pill.classList.add('online');
    $('#apiLabel').textContent = 'online';
    $('#dbLatency').textContent = `${d.dbLatencyMs}ms`;
    setMetric($('#mRides'), d.activeRides);
    setMetric($('#mCabs'), d.cabs);
    setMetric($('#mBookings'), d.confirmedBookings);
    $('#fleetNote').textContent = d.activeRides > 0 ? `${d.activeRides} rides on the apron` : 'no cabs on the apron';
  } else {
    pill.classList.add('offline');
    $('#apiLabel').textContent = 'offline';
  }
}

async function refreshRides() {
  const { ok, body } = await fetchJSON('/api/rides');
  if (ok && body.success) {
    state.rides = body.data || [];
    renderRadar();
  }
}

/* ============================================================
   ACTIONS
   ============================================================ */
async function seedFleet() {
  const btn = $('#seedBtn');
  const count = parseInt($('#fleetCount').value) || 14;
  busy(btn, true);
  log(`Deploying ${count} cabs around IGI Airport…`, 'sys');
  const { ok, body } = await fetchJSON('/api/simulate/seed', { method: 'POST', body: JSON.stringify({ count }) });
  busy(btn, false);
  if (ok && body.success) {
    log(`Fleet deployed: ${body.data.created} cabs now broadcasting active rides.`, 'ok');
    toast(`${body.data.created} cabs deployed`, 'ok');
    await Promise.all([refreshStatus(), refreshRides()]);
  } else {
    log(`Seed failed: ${body.error || 'unknown error'}`, 'err');
    toast('Seed failed', 'err');
  }
}

async function resetBoard() {
  const btn = $('#resetBtn');
  busy(btn, true);
  const { ok, body } = await fetchJSON('/api/simulate/reset', { method: 'POST' });
  busy(btn, false);
  if (ok && body.success) {
    state.lastBooking = null;
    $('#bookResult').hidden = true;
    $('#bookFoot').hidden = true;
    $('#stressResult').hidden = true;
    $('#readoutMeta').textContent = 'standby';
    log(`Apron cleared — ${body.data.clearedCabs} cabs removed.`, 'warn');
    toast('Apron cleared');
    await Promise.all([refreshStatus(), refreshRides()]);
  } else {
    log(`Reset failed: ${body.error || 'unknown'}`, 'err');
  }
}

async function bookRide() {
  const btn = $('#bookBtn');
  const locs = state.ctx.locations;
  const pickup = locs[+$('#pickupSel').value];
  const dropoff = locs[+$('#dropoffSel').value];
  const luggageCount = parseInt($('#luggage').value);

  if (pickup === dropoff) { toast('Pickup and drop-off are the same', 'err'); return; }

  busy(btn, true);
  log(`Dispatch: ${pickup.name} → ${dropoff.name} (${luggageCount} bag${luggageCount === 1 ? '' : 's'})`, 'sys');

  const payload = {
    userId: state.ctx.userId,
    pickupLat: pickup.lat, pickupLon: pickup.lon,
    dropoffLat: dropoff.lat, dropoffLon: dropoff.lon,
    luggageCount
  };
  const { ok, body } = await fetchJSON('/api/rides/book', { method: 'POST', body: JSON.stringify(payload) });
  busy(btn, false);

  const resEl = $('#bookResult');
  const readout = $('#bookReadout');
  $('#stressResult').hidden = true;
  $('#readoutMeta').textContent = 'dispatch';
  resEl.hidden = false;

  if (ok && body.success) {
    const d = body.data;
    $('#bookBadge').textContent = 'MATCHED';
    $('#bookBadge').className = 'badge';
    $('#bookTime').textContent = body.meta?.responseTime || '';
    readout.innerHTML = `
      <div class="kv"><span class="k">fare</span><span class="v hot">₹${d.pricing.fare}</span></div>
      <div class="kv"><span class="k">trip distance</span><span class="v">${d.pricing.distance} km</span></div>
      <div class="kv"><span class="k">detour added</span><span class="v">${d.detour.percent}%</span></div>
      <div class="kv"><span class="k">seats left on cab</span><span class="v good">${d.ride.availableSeats}</span></div>
      <div class="kv"><span class="k">booking</span><span class="v">${short(d.booking.id)}</span></div>`;
    log(`✓ Matched cab ${short(d.ride.cabId)} — fare ₹${d.pricing.fare}, detour ${d.detour.percent}%, ${body.meta?.responseTime}`, 'ok');

    state.lastBooking = {
      bookingId: d.booking.id,
      rideId: d.ride.id, cabId: d.ride.cabId,
      pickup: { lat: pickup.lat, lon: pickup.lon },
      dropoff: { lat: dropoff.lat, lon: dropoff.lon }
    };
    $('#bookFoot').hidden = false;
    await Promise.all([refreshStatus(), refreshRides()]);
  } else {
    $('#bookBadge').textContent = body.status === 404 ? 'NO MATCH' : 'REJECTED';
    $('#bookBadge').className = 'badge fail';
    $('#bookTime').textContent = '';
    $('#bookFoot').hidden = true;
    const reason = body.error || (body.errors && body.errors[0]?.msg) || 'request failed';
    readout.innerHTML = `<div class="kv"><span class="k">reason</span><span class="v">${reason}</span></div>
      <div class="kv"><span class="k">hint</span><span class="v">deploy a fleet, then retry</span></div>`;
    log(`✗ No booking: ${reason}`, 'warn');
  }
}

async function cancelBooking() {
  const b = state.lastBooking;
  if (!b || !b.bookingId) return;
  const btn = $('#cancelBtn');
  busy(btn, true);
  const { ok, body } = await fetchJSON(`/api/rides/cancel/${b.bookingId}`, { method: 'POST' });
  busy(btn, false);
  if (ok && body.success) {
    log(`Booking ${short(b.bookingId)} cancelled — seat returned to cab ${short(b.cabId)}.`, 'warn');
    toast('Booking cancelled — seat returned');
    state.lastBooking = null;
    $('#bookResult').hidden = true;
    $('#bookFoot').hidden = true;
    $('#readoutMeta').textContent = 'standby';
    await Promise.all([refreshStatus(), refreshRides()]);
  } else {
    log(`Cancel failed: ${body.error || 'unknown'}`, 'err');
    toast('Cancel failed', 'err');
  }
}

async function stressTest() {
  const btn = $('#stressBtn');
  const concurrency = parseInt($('#concurrency').value);
  busy(btn, true);
  log(`Firing ${concurrency} simultaneous bookings at one 4-seat cab…`, 'sys');

  const { ok, body } = await fetchJSON('/api/simulate/stress', { method: 'POST', body: JSON.stringify({ concurrency }) });
  busy(btn, false);

  if (!ok || !body.success) {
    log(`Stress test failed: ${body.error || 'unknown'}`, 'err');
    toast('Stress test failed', 'err');
    return;
  }

  const d = body.data;
  const res = $('#stressResult');
  $('#bookResult').hidden = true;
  $('#bookFoot').hidden = true;
  $('#readoutMeta').textContent = 'race test';
  res.hidden = false;

  // seat meter — one cell per request
  const meter = $('#seatMeter');
  meter.innerHTML = '';
  for (let i = 0; i < d.attempts; i++) {
    const cell = document.createElement('div');
    const won = i < d.succeeded;
    cell.className = 'seat';
    meter.appendChild(cell);
    setTimeout(() => {
      cell.className = `seat ${won ? 'win' : 'lose'}`;
      cell.textContent = won ? '✓' : '✕';
    }, 60 * i);
  }

  $('#stressStats').innerHTML = `
    <div class="metric-chip good"><span class="n">${d.succeeded}</span><span class="l">seated</span></div>
    <div class="metric-chip neu"><span class="n">${d.rejected}</span><span class="l">rejected</span></div>
    <div class="metric-chip ${d.doubleBookings === 0 ? 'good' : 'bad'}"><span class="n">${d.doubleBookings}</span><span class="l">double-booked</span></div>`;

  const verdict = d.passed
    ? `Lock held: exactly ${d.succeeded} seated, ${d.rejected} safely rejected, 0 double-bookings.`
    : `FAILURE: ${d.doubleBookings} double-booking(s) detected!`;
  log(verdict, d.passed ? 'ok' : 'err');
  toast(d.passed ? 'Zero double-bookings ✓' : 'Race detected!', d.passed ? 'ok' : 'err');
}

/* ============================================================
   TEST SUITE
   ============================================================ */
function metricSummary(t) {
  const m = t.metrics || {};
  switch (t.id) {
    case 'database': return `${m.latencyMs}ms`;
    case 'geospatial': return `${m.distanceKm} km`;
    case 'pricing': return `₹${m.fare}`;
    case 'matching': return `score ${m.score}`;
    case 'concurrency': return `${m.succeeded}/${m.attempts} seated`;
    case 'throughput': return `${(m.opsPerSec || 0).toLocaleString()}/s`;
    default: return '';
  }
}

function renderBoardPending() {
  const board = $('#testBoard');
  board.innerHTML = '';
  TESTS.forEach(t => {
    const row = document.createElement('div');
    row.className = 'frow';
    row.id = `row-${t.id}`;
    row.innerHTML = `
      <div class="frow-top">
        <span class="flap s-pending">QUEUED</span>
        <span class="frow-name">${t.name}</span>
        <span class="frow-metric"></span>
        <span class="frow-caret">▸</span>
      </div>
      <div class="frow-detail"><div class="frow-detail-in"></div></div>`;
    row.querySelector('.frow-top').addEventListener('click', () => row.classList.toggle('open'));
    board.appendChild(row);
  });
}

function setRow(test, status) {
  const row = $(`#row-${test.id}`);
  if (!row) return;
  row.classList.toggle('open', false);
  const flap = row.querySelector('.flap');
  const labels = { running: ['s-running', 'RUNNING'], pass: ['s-pass', 'PASS'], fail: ['s-fail', 'FAIL'] };
  const [cls, txt] = labels[status] || ['s-pending', 'QUEUED'];
  flap.className = `flap ${cls}`;
  flap.textContent = txt;
  if (test.name) row.querySelector('.frow-name').textContent = test.name;
  if (status === 'pass' || status === 'fail') {
    row.querySelector('.frow-metric').textContent = metricSummary(test);
    row.querySelector('.frow-detail-in').innerHTML =
      (test.logs || []).map(l => `<div class="dl">${l}</div>`).join('');
  }
}

function renderHeadline(report) {
  const h = report.headline, s = report.summary;
  const tiles = [
    { v: `${s.passed}/${s.total}`, l: 'tests passed', cls: s.failed ? 'bad' : 'good' },
    { v: (h.throughputOpsPerSec || 0).toLocaleString(), l: 'matches / sec', cls: 'amber' },
    { v: h.doubleBookings ?? '—', l: 'double-bookings', cls: h.doubleBookings === 0 ? 'good' : 'bad' },
    { v: `${report.durationMs}ms`, l: 'suite runtime', cls: '' }
  ];
  const el = $('#headline');
  el.hidden = false;
  el.innerHTML = tiles.map(t => `<div class="hl ${t.cls}"><div class="v">${t.v}</div><div class="l">${t.l}</div></div>`).join('');
}

async function runAll() {
  const btn = $('#runAllBtn');
  busy(btn, true);
  $('#headline').hidden = true;
  $('#suiteLog').innerHTML = '';
  renderBoardPending();
  slog('Booting validation suite against the live engine…', 'sys');

  const { ok, body } = await fetchJSON('/api/simulate/run-all', { method: 'POST' });

  if (!ok || !body.success) {
    busy(btn, false);
    slog(`Suite failed to start: ${body.error || 'unknown'}`, 'err');
    toast('Suite failed', 'err');
    return;
  }

  const report = body.data;

  // play results back as a stream for effect
  for (const test of report.tests) {
    setRow(test, 'running');
    slog(`▶ ${test.name}`, 'sys');
    await sleep(260);
    for (const line of (test.logs || [])) {
      slog('   ' + line, test.status === 'fail' ? 'err' : 'info');
      await sleep(110);
    }
    setRow(test, test.status);
    slog(`${test.status === 'pass' ? '✓ PASS' : '✗ FAIL'} · ${test.name} (${test.durationMs}ms)`, test.status === 'pass' ? 'ok' : 'err');
    await sleep(160);
  }

  renderHeadline(report);
  const { passed, failed, total } = report.summary;
  slog(`Suite complete — ${passed}/${total} passed in ${report.durationMs}ms.`, failed ? 'warn' : 'ok');
  toast(failed ? `${failed} test(s) failed` : `All ${total} tests passed ✓`, failed ? 'err' : 'ok');
  busy(btn, false);

  await Promise.all([refreshStatus(), refreshRides()]);
}

/* ============================================================
   INIT
   ============================================================ */
function fillSelects() {
  const locs = state.ctx.locations;
  const opts = locs.map((l, i) => `<option value="${i}">${l.name}</option>`).join('');
  $('#pickupSel').innerHTML = opts;
  $('#dropoffSel').innerHTML = opts;
  $('#pickupSel').value = 0;          // T3
  $('#dropoffSel').value = 3;         // Connaught Place
}

function startClock() {
  const tick = () => {
    $('#clock').textContent = new Date().toLocaleTimeString('en-GB', { hour12: false, timeZone: 'Asia/Kolkata' });
  };
  tick();
  setInterval(tick, 1000);
}

function wireEvents() {
  $('#seedBtn').addEventListener('click', seedFleet);
  $('#resetBtn').addEventListener('click', resetBoard);
  $('#bookBtn').addEventListener('click', bookRide);
  $('#cancelBtn').addEventListener('click', cancelBooking);
  $('#stressBtn').addEventListener('click', stressTest);
  $('#runAllBtn').addEventListener('click', runAll);
  $('#clearLog').addEventListener('click', () => { $('#log').innerHTML = ''; });
  $('#luggage').addEventListener('input', e => { $('#lugVal').textContent = e.target.value; });
  $('#concurrency').addEventListener('input', e => { $('#concVal').textContent = e.target.value; });
}

async function init() {
  startClock();
  wireEvents();
  renderRadar();
  renderBoardPending();
  slog('Standby — press “Run all checks” to validate the live engine.', 'sys');
  log('Console online. Linking to engine…', 'sys');

  const { ok, body } = await fetchJSON('/api/simulate/context');
  if (ok && body.success) {
    state.ctx = body.data;
    if (body.data.bbox) state.bbox = body.data.bbox;
    fillSelects();
    log(`Engine ready · detour cap ${state.ctx.config.maxDetourPercent}% · radius ${state.ctx.config.maxSearchRadiusKm}km`, 'info');
  } else {
    log('Could not load context — is the database reachable?', 'err');
  }

  await refreshStatus();
  await refreshRides();
  setInterval(refreshStatus, 6000);

  const empty = state.rides.length === 0;
  if (empty) log('Tip: deploy a fleet before dispatching a ride.', 'warn');
}

init();
