const NAMES = {
  groundtruth: "Groundtruth", reasoned: "Groundtruth + Reasoning", nbm: "National Blend (NOAA)", nbm_corrected: "National Blend, station-corrected", nws: "NWS official",
  ifs: "ECMWF IFS", aifs: "ECMWF AIFS (AI)", gfs: "GFS (NOAA)", climatology: "Climate normal",
};
const SHORT = { groundtruth: "Ours", reasoned: "Ours + AI", nbm: "NBM", nws: "NWS", ifs: "IFS", aifs: "AIFS", gfs: "GFS" };
const COLORS = { groundtruth: "ours", reasoned: "reason", nbm: "nbm", nbm_corrected: "nbm", nws: "nws", ifs: "ifs", aifs: "aifs", gfs: "gfs", climatology: "climo" };
const state = { mode: "hindcast", lead: "Day 1", target: "high", city: "KNYC" };
const $ = (id) => document.getElementById(id);
const fmt = (n, d = 2) => (n === null || n === undefined ? "–" : Number(n).toFixed(d));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function segment(id, options, key, onChange) {
  const el = $(id);
  el.innerHTML = options.map((o) => `<button type="button" data-v="${o.value}" aria-pressed="${state[key] === o.value}">${o.label}</button>`).join("");
  el.onclick = (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    state[key] = button.dataset.v;
    [...el.children].forEach((b) => b.setAttribute("aria-pressed", b === button));
    onChange();
  };
}

function renderBoard(data) {
  const board = (data.boards[state.mode] || {})[state.lead];
  $("board-note").textContent = state.mode === "live"
    ? "Forecasts locked in before the weather happened."
    : "Reconstructed from archived model runs, walking forward day by day. NWS and the reasoning arm have no archive, so they appear only in the live record.";
  if (!board) {
    $("board").innerHTML = '<tr><td>No verified forecasts in this view yet. The first live scores arrive the day after launch.</td></tr>';
    $("verdict").innerHTML = "";
    return;
  }
  const rows = Object.entries(board.mae).sort((a, b) => a[1] - b[1]);
  const worst = rows[rows.length - 1][1];
  $("board").innerHTML = `<thead><tr><th>Forecast</th><th>Avg miss °F</th><th>CRPS</th><th>Forecasts</th></tr></thead><tbody>` +
    rows.map(([k, v]) => `<tr class="${k.startsWith("groundtruth") || k === "reasoned" ? "mine" : ""}"><td><span class="sw" style="background:var(--${COLORS[k]})"></span>${NAMES[k] || k}</td>
      <td><span class="bar" style="width:${Math.round((v / worst) * 90)}px;color:var(--${COLORS[k]})"></span>${fmt(v)}</td><td>${fmt(board.crps[k])}</td><td>${board.n[k].toLocaleString()}</td></tr>`).join("") + "</tbody>";
  const useRaw = board.gap_vs_nbm >= board.fair_gap;
  const [gapValue, interval] = useRaw ? [board.gap_vs_nbm, board.gap_ci] : [board.fair_gap, board.fair_gap_ci];
  const bar = useRaw ? "the published National Blend" : "the station-corrected National Blend";
  let head = "Too early to call";
  let body = `${board.days} days scored. We need more data before any claim against the National Blend.`;
  if (interval) {
    const [low, high] = interval;
    const gap = `${fmt(Math.abs(gapValue))}°F (95% interval ${fmt(low)} to ${fmt(high)})`;
    if (high < 0) { head = "Ahead of the National Blend"; body = `Average miss is lower than ${bar} by ${gap} over ${board.days} days.`; }
    else if (low > 0) { head = "Behind the National Blend"; body = `Average miss is higher than ${bar} by ${gap} over ${board.days} days.`; }
    else { head = "No proven lead over the National Blend"; body = `Gap to ${bar} is ${gap} over ${board.days} days. The interval includes zero.`; }
  }
  body += ` Compared against whichever National Blend version is harder to beat. Our 90% ranges contained the outcome ${fmt(board.coverage90, 1)}% of the time.`;
  if (state.mode === "hindcast") body += " This is a reconstruction covering one season, not a live record.";
  $("verdict").innerHTML = `<strong>${head}</strong>${body}`;
}

function renderTrend(data) {
  const keys = ["groundtruth", "nbm", "ifs", "aifs", "gfs"];
  const days = Object.keys(data.trend);
  if (days.length < 20) { $("trend").innerHTML = '<p class="note">Not enough verified days yet.</p>'; return; }
  const series = keys.map((k) => days.map((_, i) => {
    const part = days.slice(Math.max(0, i - 13), i + 1).map((d) => data.trend[d][k]).filter((v) => v !== undefined);
    return i < 13 || !part.length ? null : part.reduce((a, b) => a + b, 0) / part.length;
  }));
  const flat = series.flat().filter((v) => v !== null);
  const [min, max] = [Math.min(...flat) * 0.92, Math.max(...flat) * 1.04];
  const [W, H, L, B] = [1000, 340, 42, 28];
  const x = (i) => L + (i / (days.length - 1)) * (W - L - 10);
  const y = (v) => 10 + (1 - (v - min) / (max - min)) * (H - B - 10);
  const ticks = [0, 1, 2, 3].map((t) => min + ((max - min) * t) / 3);
  const lines = series.map((s, n) => {
    const d = s.map((v, i) => (v === null ? "" : `${x(i).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean).join(" ");
    return `<polyline fill="none" stroke="var(--${COLORS[keys[n]]})" stroke-width="${n ? 1.6 : 3}" points="${d}"/>`;
  }).join("");
  $("trend").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Rolling average forecast error by source">
    ${ticks.map((t) => `<line x1="${L}" x2="${W - 10}" y1="${y(t)}" y2="${y(t)}" stroke="var(--rule)"/><text x="0" y="${y(t) + 4}" font-size="12" fill="var(--muted)">${t.toFixed(1)}°</text>`).join("")}
    <text x="${L}" y="${H - 6}" font-size="12" fill="var(--muted)">${days[13]}</text><text x="${W - 10}" y="${H - 6}" text-anchor="end" font-size="12" fill="var(--muted)">${days[days.length - 1]}</text>${lines}</svg>
    <div class="legend">${keys.map((k) => `<span><i style="background:var(--${COLORS[k]})"></i>${NAMES[k]}</span>`).join("")}</div>`;
}

function renderLedger(data) {
  const rows = data.ledger.filter((r) => r.station === state.city && r.target === state.target).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 21);
  const keys = ["groundtruth", "reasoned", "nbm", "nws", "ifs", "aifs", "gfs"].filter((k) => rows.some((r) => r[k] !== undefined && r[k] !== null));
  if (!rows.length) { $("ledger").innerHTML = "<tr><td>No verified days yet.</td></tr>"; return; }
  $("ledger").innerHTML = `<thead><tr><th>Date</th><th>Actual</th>${keys.map((k) => `<th>${SHORT[k]}</th>`).join("")}</tr></thead><tbody>` + rows.map((r) => {
    const best = Math.min(...keys.filter((k) => r[k] !== undefined && r[k] !== null).map((k) => Math.abs(Math.round(r[k]) - r.truth)));
    return `<tr><td>${r.date}</td><td class="actual">${r.truth}°</td>${keys.map((k) => {
      const v = r[k];
      if (v === undefined || v === null) return "<td>–</td>";
      return `<td class="${Math.abs(Math.round(v) - r.truth) === best ? "best" : ""}">${fmt(v, 0)}°</td>`;
    }).join("")}</tr>`;
  }).join("") + "</tbody>";
}

function renderOpen(data) {
  const next = data.open.length ? data.open.reduce((m, r) => (r.date < m ? r.date : m), data.open[0].date) : null;
  if (!next) { $("open").innerHTML = "<tr><td>No open forecasts.</td></tr>"; return; }
  $("open-note").textContent = `Forecast highs for ${next}. Nobody knows the answer yet.`;
  const rows = data.open.filter((r) => r.date === next && r.target === "high");
  const keys = ["groundtruth", "reasoned", "nbm", "nws", "ifs", "aifs", "gfs"].filter((k) => rows.some((r) => r[k] !== undefined && r[k] !== null));
  $("open").innerHTML = `<thead><tr><th>City</th>${keys.map((k) => `<th>${SHORT[k]}</th>`).join("")}<th>Our ±90%</th></tr></thead><tbody>` + rows.map((r) =>
    `<tr><td>${data.stations[r.station].city}</td>${keys.map((k) => `<td>${r[k] === undefined || r[k] === null ? "–" : fmt(r[k], 0) + "°"}</td>`).join("")}<td>±${fmt(1.645 * r.sigma, 0)}°</td></tr>`).join("") + "</tbody>";
}

function renderDesk(data) {
  const audit = data.reasoning.audit;
  if (!audit || audit.status !== "ok") {
    $("desk").innerHTML = '<p class="note">The desk opens with the first live forecast.</p>';
    return;
  }
  const calls = Object.values(data.reasoning.adjustments);
  $("desk").innerHTML = `${audit.discussion ? `<blockquote>${esc(audit.discussion)}</blockquote>` : ""}
    <div class="funnel"><div><b>${audit.cases.length}</b>cases reviewed</div><div><b>${audit.proposed}</b>changes proposed</div><div><b>${audit.grounded}</b>traced to data</div><div><b>${audit.kept}</b>survived skeptic</div></div>
    ${calls.map((c) => `<div class="call"><h3>${esc(c.case)}: ${c.delta_f > 0 ? "+" : ""}${c.delta_f}°F, spread ×${c.sigma_mult}</h3>${esc(c.reason)}<br><em>Skeptic:</em> ${esc(c.skeptic)}</div>`).join("") || '<p class="note">Nothing survived today. That is the expected result most days.</p>'}`;
}

function headline(data) {
  const live = data.boards.live && data.boards.live["Day 1"];
  const hind = data.boards.hindcast && data.boards.hindcast["Day 1"];
  const board = live && live.days >= 14 ? live : hind;
  if (live && live.days >= 14) state.mode = "live";
  if (!board) { $("lede").textContent = "The first scores arrive after launch."; return; }
  const word = board === live ? "live" : "hindcast";
  $("lede").innerHTML = `Across ${board.days} days of ${word} day-ahead forecasts at 25 US stations, the average miss was <b>${fmt(board.mae.groundtruth, 2)}°F</b> for Groundtruth and <b>${fmt(Math.min(board.mae.nbm, board.mae.nbm_corrected), 2)}°F</b> for NOAA's National Blend.`;
}

function draw(data) {
  renderBoard(data); renderLedger(data);
}

fetch("data.json").then((r) => r.json()).then((data) => {
  headline(data);
  segment("mode", [{ value: "live", label: "Live" }, { value: "hindcast", label: "Hindcast" }], "mode", () => renderBoard(data));
  segment("lead", ["Day 1", "Day 2", "Day 3", "Days 4-7"].map((v) => ({ value: v, label: v })), "lead", () => renderBoard(data));
  segment("target", [{ value: "high", label: "High" }, { value: "low", label: "Low" }], "target", () => renderLedger(data));
  $("city").innerHTML = Object.entries(data.stations).sort((a, b) => a[1].city.localeCompare(b[1].city)).map(([k, v]) => `<option value="${k}" ${k === state.city ? "selected" : ""}>${v.city}</option>`).join("");
  $("city").onchange = (e) => { state.city = e.target.value; renderLedger(data); };
  draw(data); renderTrend(data); renderOpen(data); renderDesk(data);
  $("stamp").textContent = `Updated ${data.generated}`;
}).catch(() => { $("lede").textContent = "The record could not be loaded."; });
