// ===== DOM =====
const gameSelect = document.getElementById("gameSelect");
const targetInput = document.getElementById("targetInput");
const noteInput = document.getElementById("noteInput");

const scoreGrid = document.getElementById("scoreGrid");
const leaderBadge = document.getElementById("leaderBadge");
const scoreHint = document.getElementById("scoreHint");

const manualInputs = document.getElementById("manualInputs");
const roundManual = document.getElementById("roundManual");

const trixPanel = document.getElementById("trixPanel");
const trixType = document.getElementById("trixType");
const trixHelpText = document.getElementById("trixHelpText");
const trixError = document.getElementById("trixError");

const trixCountsBlock = document.getElementById("trixCountsBlock");
const trixRankBlock = document.getElementById("trixRankBlock");

const trixCountInputs = document.getElementById("trixCountInputs");
const trixRankInputs = document.getElementById("trixRankInputs");

const historyHeadRow = document.getElementById("historyHeadRow");
const historyBody = document.getElementById("historyBody");

const undoBtn = document.getElementById("undoBtn");
const delLastBtn = document.getElementById("delLastBtn");

// ===== TRIX RULES (as you provided) =====
const TRIX = {
  king:     { label: "King of Hearts", unit: "king taken (0/1)", min: 0, max: 1, pointsPer: -75 },
  queens:   { label: "Queens",         unit: "queens taken (0..4)", min: 0, max: 4, pointsPer: -25 },
  diamonds: { label: "Diamonds",       unit: "♦ cards taken (0..13)", min: 0, max: 13, pointsPer: -10 },
  luto:     { label: "Luto",           unit: "tricks taken (0..13)", min: 0, max: 13, pointsPer: -15 },
  trix:     { label: "Trix",           unit: "place (1..4)", places: { 1: 200, 2: 150, 3: 100, 4: 50 } },
};

// ===== STATE =====
let state = {
  game: "400", // 400 | trix
  target: "",
  names: ["Player 1", "Player 2", "Player 3", "Player 4"],
  totals: [0, 0, 0, 0],
  rounds: [],   // { idx, ts, note, game, type, input[4], points[4] }
  history: [],
};

// ===== Helpers =====
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}
function snapshot() { return JSON.parse(JSON.stringify(state)); }
function pushUndo() {
  state.history.push(snapshot());
  if (state.history.length > 50) state.history.shift();
  undoBtn.disabled = state.history.length === 0;
}
function clampInt(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}
function sum(arr) { return arr.reduce((a, b) => a + b, 0); }

function showTrixError(msg) {
  trixError.textContent = msg;
  trixError.style.display = "";
}
function clearTrixError() {
  trixError.textContent = "";
  trixError.style.display = "none";
}

function validateTrixInput(type, input) {
  if (type === "king") {
    if (sum(input) !== 1) return "King: genau EIN Spieler muss 1 haben (Summe = 1).";
  }
  if (type === "queens") {
    if (sum(input) !== 4) return "Queens: insgesamt gibt es 4 Damen (Summe muss = 4).";
  }
  if (type === "diamonds") {
    if (sum(input) !== 13) return "Diamonds: insgesamt gibt es 13 ♦ Karten (Summe muss = 13).";
  }
  if (type === "luto") {
    if (sum(input) !== 13) return "Luto: insgesamt gibt es 13 Stiche (Summe muss = 13).";
  }
  if (type === "trix") {
    const sorted = [...input].sort((a,b)=>a-b).join(",");
    if (sorted !== "1,2,3,4") return "Trix: Plätze müssen genau 1,2,3,4 sein (jeder Platz einmal).";
  }
  return null;
}

// ===== Build UI =====
function buildScoreUI() {
  scoreGrid.innerHTML = "";
  state.names.forEach((name, i) => {
    const div = document.createElement("div");
    div.className = "scoreCard";
    div.innerHTML = `
      <div class="scoreName">${escapeHtml(name)}</div>
      <div class="scoreValue" id="total-${i}">0</div>
    `;
    scoreGrid.appendChild(div);
  });
}

function buildInputs(container, prefix, defaultValue = "0") {
  container.innerHTML = "";
  for (let i = 0; i < 4; i++) {
    const input = document.createElement("input");
    input.type = "number";
    input.value = defaultValue;
    input.id = `${prefix}-${i}`;
    input.inputMode = "numeric";
    input.addEventListener("change", () => {
      if (input.value === "") input.value = defaultValue;
    });
    container.appendChild(input);
  }
}

function buildHistoryHeader() {
  const cols = state.names.map(n => `<th>${escapeHtml(n)}</th>`).join("");
  historyHeadRow.innerHTML = `
    <tr>
      <th>#</th>
      <th>Zeit</th>
      <th>Spiel</th>
      <th>Typ</th>
      <th>Notiz</th>
      ${cols}
      <th>Summe</th>
    </tr>
  `;
}

// ===== Names =====
function wireNameInputs() {
  const ids = ["p1Name","p2Name","p3Name","p4Name"];
  ids.forEach((id, idx) => {
    document.getElementById(id).addEventListener("input", (e) => {
      state.names[idx] = e.target.value || `Player ${idx+1}`;
      buildScoreUI();
      buildHistoryHeader();
      renderAll();
    });
  });
}

// ===== Game switch =====
function onGameChange() {
  pushUndo();
  state.game = gameSelect.value;

  updatePanels();
  updateHint();

  if (state.game === "trix") onTrixTypeChange();

  renderAll();
}

function updatePanels() {
  const isTrix = state.game === "trix";
  trixPanel.style.display = isTrix ? "" : "none";
  roundManual.style.display = isTrix ? "none" : "";
}

function updateHint() {
  if (state.game === "400") {
    scoreHint.textContent = "400: Punkte pro Runde manuell pro Spieler eintragen.";
  } else {
    scoreHint.textContent = "Trix: Wähle Spieltyp und trage Counts/Plätze ein → Punkte werden automatisch berechnet.";
  }
}

function onTrixTypeChange() {
  clearTrixError();
  const type = trixType.value;

  if (type === "trix") {
    trixCountsBlock.style.display = "none";
    trixRankBlock.style.display = "";
    trixHelpText.textContent = "Trix: Trage Platz 1..4 pro Spieler ein (jeder Platz genau einmal).";
  } else {
    trixCountsBlock.style.display = "";
    trixRankBlock.style.display = "none";
    const cfg = TRIX[type];
    trixHelpText.textContent = `${cfg.label}: Gib ${cfg.unit} ein → Punkte = Anzahl × (${cfg.pointsPer}).`;
  }
}

// ===== 400 manual round =====
function addRound400() {
  pushUndo();
  state.target = targetInput.value.trim();

  const values = readInputs("m"); // raw points
  values.forEach((v, i) => state.totals[i] += v);

  state.rounds.push({
    idx: state.rounds.length + 1,
    ts: new Date().toLocaleString(),
    note: noteInput.value.trim(),
    game: "400",
    type: "manual",
    input: values.slice(),
    points: values.slice(),
  });

  clearManual();
  renderAll();
}

function clearManual() {
  for (let i = 0; i < 4; i++) document.getElementById(`m-${i}`).value = "0";
  noteInput.value = "";
}

// ===== TRIX round =====
function addRoundTrix() {
  pushUndo();
  clearTrixError();

  state.target = targetInput.value.trim();
  const type = trixType.value;

  let input = [];
  let points = [];

  if (type === "trix") {
    input = readInputs("r").map(v => clampInt(v, 1, 4));
    const err = validateTrixInput(type, input);
    if (err) {
      showTrixError(err);
      state.history.pop(); // revert the undo push for invalid attempt
      undoBtn.disabled = state.history.length === 0;
      return;
    }
    points = input.map(place => TRIX.trix.places[place] ?? 0);
  } else {
    input = readInputs("c");
    const cfg = TRIX[type];
    input = input.map(v => clampInt(v, cfg.min, cfg.max));

    const err = validateTrixInput(type, input);
    if (err) {
      showTrixError(err);
      state.history.pop();
      undoBtn.disabled = state.history.length === 0;
      return;
    }
    points = input.map(cnt => cnt * cfg.pointsPer);
  }

  points.forEach((p, i) => state.totals[i] += p);

  state.rounds.push({
    idx: state.rounds.length + 1,
    ts: new Date().toLocaleString(),
    note: noteInput.value.trim(),
    game: "trix",
    type,
    input: input.slice(),
    points: points.slice(),
  });

  clearTrix();
  renderAll();
}

function clearTrix() {
  clearTrixError();
  for (let i = 0; i < 4; i++) {
    document.getElementById(`c-${i}`).value = "0";
    document.getElementById(`r-${i}`).value = "";
  }
  noteInput.value = "";
}

function autoRankHint() {
  for (let i = 0; i < 4; i++) {
    document.getElementById(`r-${i}`).value = String(i + 1);
  }
}

function fillZeros(containerId) {
  const container = document.getElementById(containerId);
  const inputs = [...container.querySelectorAll("input")];
  inputs.forEach(inp => inp.value = "0");
}

// ===== Common input reader =====
function readInputs(prefix) {
  const vals = [];
  for (let i = 0; i < 4; i++) {
    const el = document.getElementById(`${prefix}-${i}`);
    const v = Number(el.value || 0);
    vals.push(Number.isFinite(v) ? v : 0);
  }
  return vals;
}

// ===== History / Undo / Delete =====
function deleteLastRound() {
  if (state.rounds.length === 0) return;
  pushUndo();

  const last = state.rounds.pop();
  last.points.forEach((p, i) => state.totals[i] -= p);

  renderAll();
}

function newGame() {
  pushUndo();
  state.rounds = [];
  state.totals = [0,0,0,0];
  state.target = "";
  targetInput.value = "";
  noteInput.value = "";
  clearManual();
  clearTrix();
  renderAll();
}

function undo() {
  const prev = state.history.pop();
  if (!prev) return;
  state = prev;

  gameSelect.value = state.game;
  targetInput.value = state.target || "";
  noteInput.value = "";

  document.getElementById("p1Name").value = state.names[0];
  document.getElementById("p2Name").value = state.names[1];
  document.getElementById("p3Name").value = state.names[2];
  document.getElementById("p4Name").value = state.names[3];

  updatePanels();
  updateHint();
  buildScoreUI();
  buildHistoryHeader();

  if (state.game === "trix") onTrixTypeChange();

  renderAll();
  undoBtn.disabled = state.history.length === 0;
}

// ===== Render =====
function renderTotals() {
  state.totals.forEach((t, i) => {
    const el = document.getElementById(`total-${i}`);
    if (el) el.textContent = String(t);
  });
}

function typeLabelForRow(r) {
  if (r.game === "400") return "400 manual";
  if (r.type === "king") return "King♥ (−75)";
  if (r.type === "queens") return "Queens (−25 each)";
  if (r.type === "diamonds") return "Diamonds (−10 each ♦)";
  if (r.type === "luto") return "Luto (−15 per trick)";
  if (r.type === "trix") return "Trix (+200/+150/+100/+50)";
  return r.type;
}

function renderHistory() {
  historyBody.innerHTML = "";

  for (const r of state.rounds) {
    const sumRow = r.points.reduce((a,b)=>a+b,0);
    const cols = r.points.map(v => `<td>${v}</td>`).join("");

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.idx}</td>
      <td>${escapeHtml(r.ts)}</td>
      <td>${r.game.toUpperCase()}</td>
      <td>${escapeHtml(typeLabelForRow(r))}</td>
      <td>${escapeHtml(r.note || "—")}</td>
      ${cols}
      <td><b>${sumRow}</b></td>
    `;
    historyBody.appendChild(tr);
  }

  delLastBtn.disabled = state.rounds.length === 0;
}

function renderLeader() {
  [...scoreGrid.children].forEach(c => c.classList.remove("leading"));

  const max = Math.max(...state.totals);
  const min = Math.min(...state.totals);

  if (max === min) {
    leaderBadge.textContent = "Gleichstand";
    return;
  }

  const winnerIndex = state.totals.indexOf(max);
  const winnerName = state.names[winnerIndex];
  leaderBadge.textContent = `Leader: ${winnerName}`;

  const winnerCard = scoreGrid.children[winnerIndex];
  if (winnerCard) winnerCard.classList.add("leading");

  const target = Number(state.target);
  if (state.target !== "" && Number.isFinite(target) && max >= target) {
    leaderBadge.textContent = `✅ Ziel erreicht: ${winnerName} (${max}/${target})`;
  }
}

function renderAll() {
  renderTotals();
  renderHistory();
  renderLeader();
  undoBtn.disabled = state.history.length === 0;
}

// ===== Boot =====
function init() {
  buildScoreUI();

  buildInputs(manualInputs, "m", "0");   // 400 inputs
  buildInputs(trixCountInputs, "c", "0"); // trix counts
  buildInputs(trixRankInputs, "r", "");   // trix ranks

  buildHistoryHeader();
  wireNameInputs();

  updatePanels();
  updateHint();

  trixType.value = "king";
  onTrixTypeChange();

  renderAll();
}
init();