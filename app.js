
const APP_VERSION = 'v9';

const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));
const uid = () => Math.random().toString(36).slice(2, 10);
const todayStr = () => new Date().toISOString().slice(0,10);

const storeKey = 'pocket_lifts_v1';
const defaultState = {
  unit: 'lb',
  movements: [
    { id: uid(), name: 'Back Squat', bodypart: 'Legs' },
    { id: uid(), name: 'Bench Press', bodypart: 'Chest' },
    { id: uid(), name: 'Deadlift', bodypart: 'Back' },
    { id: uid(), name: 'Overhead Press', bodypart: 'Shoulders' },
    { id: uid(), name: 'Barbell Row', bodypart: 'Back' }
  ],
  workouts: []
};

let state = load();
let currentTab = 'workout';
let draft = initDraft();

// For WhatsApp import UI
let importPreview = []; // [{name, checked}]

function save() {
  localStorage.setItem(storeKey, JSON.stringify(state));
  render();
}

function load() {
  try {
    const raw = localStorage.getItem(storeKey);
    if (!raw) return structuredClone(defaultState);
    const obj = JSON.parse(raw);
    obj.movements ??= [];
    obj.workouts ??= [];
    obj.unit ??= 'lb';
    return obj;
  } catch(e) {
    console.error('Load failed, resetting.', e);
    return structuredClone(defaultState);
  }
}

function initDraft() {
  return {
    date: todayStr(),
    notes: '',
    movementId: state.movements[0]?.id || null,
    weight: suggestWeight(state.movements[0]?.id),
    reps: 5,
    sets: []
  };
}

function suggestWeight(movementId) {
  if (!movementId) return '';
  const workouts = [...state.workouts].sort((a,b)=> b.date.localeCompare(a.date));
  for (const w of workouts) {
    const found = [...w.sets].reverse().find(s => s.movementId === movementId);
    if (found) return found.weight;
  }
  return '';
}

function addMovement(name, bodypart='') {
  name = (name||'').trim();
  if (!name) return;
  if (state.movements.some(m => m.name.toLowerCase() === name.toLowerCase())) return;
  state.movements.push({ id: uid(), name, bodypart });
}

function addMovementsBulk(names) {
  let count = 0;
  names.forEach(n => {
    const name = (n||'').trim();
    if (!name) return;
    if (state.movements.some(m => m.name.toLowerCase() === name.toLowerCase())) return;
    state.movements.push({ id: uid(), name });
    count++;
  });
  if (count) save(); else render();
}

function deleteMovement(id) {
  if (!confirm('Delete this movement? (This does not delete past workouts)')) return;
  state.movements = state.movements.filter(m => m.id !== id);
  save();
  if (draft.movementId === id) {
    draft.movementId = state.movements[0]?.id || null;
    draft.weight = suggestWeight(draft.movementId);
  }
}

function weightStepValue(){ return state.unit === 'lb' ? 5 : 2.5; }
function repStepValue(){ return 5; }
function nudgeWeight(delta){
  let w = parseFloat(draft.weight);
  if (isNaN(w)) w = 0;
  w = w + delta;
  draft.weight = state.unit === 'kg' ? Number(w.toFixed(1)) : Math.round(w);
  render();
}
function nudgeReps(delta){
  let r = parseInt(draft.reps, 10);
  if (isNaN(r)) r = 0;
  r = r + delta;
  if (r < 0) r = 0;
  draft.reps = r;
  render();
}

function addSetToDraft() {
  if (!draft.movementId) { alert('Add a movement first.'); return; }
  const mv = state.movements.find(m => m.id === draft.movementId);
  const weight = Number(draft.weight);
  const reps = Number(draft.reps);
  if (!mv || isNaN(weight) || isNaN(reps) || reps <= 0) { alert('Please enter a valid weight and reps.'); return; }

  draft.sets.push({ id: uid(), movementId: mv.id, movementName: mv.name, weight, reps });
  draft.weight = weight;
  render();
  setTimeout(() => {
    const rows = document.querySelectorAll('tbody tr');
    if (rows.length) rows[rows.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 0);
}

function saveWorkout() {
  if (!draft.sets.length) { alert('Add at least one set.'); return; }
  state.workouts.push({ id: uid(), date: draft.date, notes: draft.notes.trim(), sets: structuredClone(draft.sets) });
  save();
  draft = initDraft();
  alert('Workout saved!');
}

function e1RM(weight, reps) { return Math.round(weight * (1 + reps/30)); }

function lastUsed(movementId) {
  const workouts = [...state.workouts].sort((a,b)=> b.date.localeCompare(a.date));
  for (const w of workouts) {
    const set = [...w.sets].reverse().find(s => s.movementId === movementId);
    if (set) return { ...set, date: w.date };
  }
  return null;
}

function formatUnit(n) {
  if (n === '' || n === null || typeof n === 'undefined') return '';
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' ' + state.unit;
}

function switchTab(tab) { currentTab = tab; render(); }
function deleteWorkout(id) { if (!confirm('Delete this workout?')) return; state.workouts = state.workouts.filter(w => w.id !== id); save(); }

function exportCSV() {
  const rows = [['date','movement','weight','reps','unit','notes']];
  for (const w of state.workouts) {
    for (const s of w.sets) rows.push([w.date, s.movementName, s.weight, s.reps, state.unit, w.notes.replace(/\n/g,' ')]);
  }
  const csv = rows.map(r => r.map(x => `"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'pocket-lifts.csv'; a.click(); URL.revokeObjectURL(url);
}

function changeUnit(u) { state.unit = u; save(); }

// ---- WhatsApp Import ----
function normalizeLine(line) {
  // Drop WhatsApp timestamp/name prefixes if present.
  // Remove bracketed prefix like [12/08/2025, 9:10 PM] or [2025-08-12, 21:10]
  line = line.replace(/^\[[^\]]+\]\s*/, '');
  // Remove leading date/time - name: prefix like "12/08/2025, 9:10 PM - John: "
  line = line.replace(/^\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{2,4},?\s+\d{1,2}:\d{2}(?:\s?[APap]\.?[Mm]\.?)?\s*-\s*[^:]+:\s*/, '');
  // Also try ISO date: "2025-08-12 21:10 - Name: "
  line = line.replace(/^\d{4}-\d{2}-\d{2}[, ]+\d{1,2}:\d{2}(?:\s?[APap]\.?[Mm]\.?)?\s*-\s*[^:]+:\s*/, '');
  return line.trim();
}

const KNOWN_LIFTS = [
  'Back Squat','Front Squat','Bench Press','Incline Bench','Decline Bench','Overhead Press','Shoulder Press',
  'Deadlift','Sumo Deadlift','Romanian Deadlift','Barbell Row','Pendlay Row','Dumbbell Row',
  'Lat Pulldown','Pull Up','Chin Up','Dip','Push Up',
  'Leg Press','Leg Extension','Leg Curl','Calf Raise',
  'Bicep Curl','EZ Bar Curl','Hammer Curl','Triceps Pushdown','Skull Crusher',
  'Hip Thrust','Glute Bridge','Lunge','Split Squat','Bulgarian Split Squat',
  'Cable Fly','Chest Fly','Pec Deck','Seated Row','Face Pull'
];

function extractMovementsFromText(text) {
  const candidates = new Set();

  const lines = text.split(/\r?\n/);
  for (let raw of lines) {
    let line = normalizeLine(raw);
    if (!line) continue;

    // Explicit tag format: "mv: Movement Name"
    const tagMatch = line.match(/^\s*(?:mv|movement)\s*:\s*(.+)$/i);
    if (tagMatch) {
      candidates.add(tagMatch[1].trim());
      continue;
    }

    // Pattern: "<movement> 225x5" or "<movement> 100 kg x 8" or "<movement> 3x5 @ 135"
    const m1 = line.match(/^\s*([A-Za-z][A-Za-z /&\-]{2,}?)\s+\d{1,4}(?:\.\d+)?\s*(?:kg|lb)?\s*(?:x|×|@)\s*\d+/i);
    if (m1) {
      candidates.add(m1[1].trim().replace(/\s{2,}/g,' '));
      continue;
    }

    // Pattern: "225x5 <movement>" or "100 kg x 8 <movement>"
    const m2 = line.match(/^\s*\d{1,4}(?:\.\d+)?\s*(?:kg|lb)?\s*(?:x|×|@)\s*\d+\s+([A-Za-z][A-Za-z /&\-]{2,})/i);
    if (m2) {
      candidates.add(m2[1].trim().replace(/\s{2,}/g,' '));
      continue;
    }

    // Look for any known lift mentioned verbatim
    for (const lift of KNOWN_LIFTS) {
      const rx = new RegExp(`\\b${lift.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&')}\\b`, 'i');
      if (rx.test(line)) {
        candidates.add(lift);
      }
    }
  }

  // Dedup by case-insensitive compare
  const list = Array.from(candidates).sort((a,b)=> a.localeCompare(b, undefined, {sensitivity:'base'}));
  return list;
}

function handleWhatsappFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const text = reader.result;
    const names = extractMovementsFromText(text);
    importPreview = names.map(n => ({ name: n, checked: true }));
    render(); // show preview list
  };
  reader.readAsText(file);
}

function toggleImportItem(idx, prop, value) {
  importPreview[idx][prop] = value;
  render();
}

function applyImportSelection() {
  const selected = importPreview.filter(i => i.checked).map(i => i.name);
  addMovementsBulk(selected);
  importPreview = [];
  alert(`Added ${selected.length} movements.`);
}

function clearImportPreview() {
  importPreview = [];
  render();
}

// ---- UI ----

function render() {
  const root = $('#app'); root.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'header';
  header.innerHTML = `
    <div class="row">
      <div class="title">Pocket Lifts</div>
      <span class="badge">Offline</span>
    </div>
    <div class="segmented" role="tablist" aria-label="Main navigation">
      <button class="${currentTab==='workout'?'active':''}" onclick="switchTab('workout')">Workout</button>
      <button class="${currentTab==='movements'?'active':''}" onclick="switchTab('movements')">Movements</button>
      <button class="${currentTab==='history'?'active':''}" onclick="switchTab('history')">History</button>
    </div>
  `;
  root.appendChild(header);

  const settings = document.createElement('div');
  settings.className = 'mt12';
  settings.innerHTML = `
    <div class="panel">
      <div class="row space-between">
        <div class="row wrap" style="gap:8px;">
          <span class="tag"><span class="dot"></span> Data saved on this device</span>
          <span class="tag"><span class="dot" style="background:#22c55e"></span> No sign-in required</span>
        </div>
        <div class="row">
          <span class="mr8 subtle small">Unit</span>
          <div class="segmented">
            <button class="${state.unit==='lb'?'active':''}" onclick="changeUnit('lb')">lb</button>
            <button class="${state.unit==='kg'?'active':''}" onclick="changeUnit('kg')">kg</button>
          </div>
        </div>
      </div>
    </div>
  `;
  root.appendChild(settings);

  if (currentTab === 'workout') {
    const panel = document.createElement('div');
    panel.className = 'panel mt12';
    const last = draft.movementId ? lastUsed(draft.movementId) : null;
    panel.innerHTML = `
      <h2>New Workout</h2>
      <div class="grid two mt8">
        <!-- LEFT COLUMN -->
        <div>
          <div class="label">Movement</div>
          <select onchange="draft.movementId=this.value; draft.weight=suggestWeight(this.value); render()">
            ${state.movements.map(m => `<option value="${m.id}" ${draft.movementId===m.id?'selected':''}>${m.name}</option>`).join('')}
          </select>
          ${draft.movementId ? (last
            ? `<div class="hint">Last: ${formatUnit(last.weight)} × ${last.reps} • ${last.date || 'previous session'}</div>`
            : `<div class="hint">No history yet for this movement.</div>`
          ) : ''}
          <!-- Save set -->
          <button class="button good mt12" style="width:100%;" onclick="addSetToDraft()">Save set</button>
        </div>

        <!-- RIGHT COLUMN: Weight and Reps with steppers underneath -->
        <div style="display:flex; flex-direction:column; gap:12px; width:100%;">
          <div>
            <div class="label">Weight (${state.unit})</div>
            <input class="input big-number" type="number" inputmode="decimal" placeholder="e.g. 135"
                   value="${draft.weight}" oninput="draft.weight=this.value">
            <div class="stepper mt8">
              <button class="button" onclick="nudgeWeight(-weightStepValue())">- ${weightStepValue()}</button>
              <button class="button" onclick="nudgeWeight(weightStepValue())">+ ${weightStepValue()}</button>
            </div>
          </div>
          <div>
            <div class="label">Reps</div>
            <input class="input big-number" type="number" inputmode="numeric" placeholder="e.g. 5"
                   value="${draft.reps}" oninput="draft.reps=this.value">
            <div class="stepper mt8">
              <button class="button" onclick="nudgeReps(-repStepValue())">- 5</button>
              <button class="button" onclick="nudgeReps(repStepValue())">+ 5</button>
            </div>
          </div>
        </div>
      </div>

      <div class="mt12">
        <h3>Sets in this workout</h3>
        ${draft.sets.length ? `
          <table class="mt8">
            <thead><tr><th>Movement</th><th>Weight</th><th>Reps</th><th class="right">Est. 1RM</th></tr></thead>
            <tbody>
              ${draft.sets.map(s=>`
                <tr>
                  <td>${s.movementName}</td>
                  <td>${formatUnit(s.weight)}</td>
                  <td>${s.reps}</td>
                  <td class="right">${e1RM(s.weight, s.reps)} ${state.unit}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : `<div class="empty">No sets added yet.</div>`}
      </div>

      <div class="row mt16">
        <button class="button primary" onclick="saveWorkout()">Save workout</button>
        <button class="button ghost" onclick="draft=initDraft(); render()">Reset</button>
      </div>
    `;
    root.appendChild(panel);
  }

  if (currentTab === 'movements') {
    const panel = document.createElement('div');
    panel.className = 'panel mt12';
    panel.innerHTML = `
      <h2>Movements</h2>
      <div class="row mt8">
        <input id="mvName" class="input" placeholder="e.g. Incline DB Press">
        <input id="mvPart" class="input" placeholder="Body part (optional)">
        <button class="button good" style="width:160px" onclick="(function(){
          const n = document.getElementById('mvName').value;
          const p = document.getElementById('mvPart').value;
          addMovement(n, p); document.getElementById('mvName').value=''; document.getElementById('mvPart').value=''; save();
        })()">Add movement</button>
      </div>

      <div class="mt12 importBox">
        <div class="row space-between">
          <div>
            <div class="bold">Import from WhatsApp (.txt)</div>
            <div class="note">Use WhatsApp → Group chat → Export chat → <b>Without Media</b>. Then pick the <code>.txt</code> file here.</div>
          </div>
          <input type="file" accept=".txt" onchange="if(this.files && this.files[0]) handleWhatsappFile(this.files[0])">
        </div>

        ${importPreview.length ? `
          <div class="importList">
            ${importPreview.map((it, idx) => `
              <div class="importItem">
                <input type="checkbox" ${it.checked ? 'checked' : ''} onchange="toggleImportItem(${idx}, 'checked', this.checked)">
                <input class="input" type="text" value="${it.name.replace(/\"/g,'&quot;')}" oninput="toggleImportItem(${idx}, 'name', this.value)">
              </div>
            `).join('')}
          </div>
          <div class="row mt12">
            <button class="button primary" onclick="applyImportSelection()">Add selected</button>
            <button class="button ghost" onclick="clearImportPreview()">Clear</button>
          </div>
        ` : ''}
      </div>

      <div class="list mt12">
        ${state.movements.length ? state.movements.map(m => `
          <div class="card row space-between">
            <div>
              <div class="bold">${m.name}</div>
              ${m.bodypart ? `<div class="small subtle">${m.bodypart}</div>` : ''}
            </div>
            <div class="row">
              <button class="button danger" onclick="deleteMovement('${m.id}')">Delete</button>
            </div>
          </div>
        `).join('') : `<div class="empty">No movements yet. Add or import some above.</div>`}
      </div>
    `;
    root.appendChild(panel);
  }

  if (currentTab === 'history') {
    const panel = document.createElement('div');
    panel.className = 'panel mt12';
    const allMovements = state.movements;
    const byDate = [...state.workouts].sort((a,b)=> b.date.localeCompare(a.date));

    panel.innerHTML = `
      <h2>History</h2>
      <div class="row mt8">
        <select id="filterMv">
          <option value="">All movements</option>
          ${allMovements.map(m => `<option value="${m.id}">${m.name}</option>`).join('')}
        </select>
        <button class="button" onclick="exportCSV()">Export CSV</button>
      </div>
      <div class="list mt12">
        ${byDate.length ? byDate.map(w => `
          <div class="card">
            <div class="row space-between">
              <div class="bold">${w.date}</div>
              <button class="button danger small" onclick="deleteWorkout('${w.id}')">Delete</button>
            </div>
            ${w.notes ? `<div class="small subtle mt8">${w.notes}</div>` : ''}
            <table class="mt12">
              <thead><tr><th>Movement</th><th>Weight</th><th>Reps</th><th class="right">Est. 1RM</th></tr></thead>
              <tbody>
                ${w.sets.map(s=>`
                  <tr data-movement-id="${s.movementId}">
                    <td>${s.movementName}</td>
                    <td>${formatUnit(s.weight)}</td>
                    <td>${s.reps}</td>
                    <td class="right">${e1RM(s.weight, s.reps)} ${state.unit}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `).join('') : `<div class="empty">No workouts yet. Save one from the Workout tab.</div>`}
      </div>
    `;
    root.appendChild(panel);

    const filter = $('#filterMv');
    filter.addEventListener('change', () => {
      const mv = filter.value;
      if (!mv) { $$('tbody tr', panel).forEach(tr => tr.style.display = ''); }
      else {
        $$('tbody tr', panel).forEach(tr => {
          tr.style.display = (tr.getAttribute('data-movement-id') === mv) ? '' : 'none';
        });
      }
    });
  }

  const footer = document.createElement('footer');
  footer.innerHTML = `Tip: On iPhone, tap the <span class="kbd">Share</span> button in Safari → <b>Add to Home Screen</b>. <span class="badge2">Pocket Lifts ${APP_VERSION}</span>`;
  root.appendChild(footer);
}

window.addEventListener('load', () => {
  render();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
  }
});
