/* Pocket Lifts — simple offline workout tracker (v3)
 * Changes:
 * - "Save set" immediately updates list and auto-scrolls
 * - Compact "Last" line under movement selector
 */
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
  name = name.trim();
  if (!name) return;
  if (state.movements.some(m => m.name.toLowerCase() === name.toLowerCase())) {
    alert('Movement already exists.');
    return;
  }
  state.movements.push({ id: uid(), name, bodypart });
  save();
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

function addSetToDraft() {
  if (!draft.movementId) { alert('Add a movement first.'); return; }
  const mv = state.movements.find(m => m.id === draft.movementId);
  const weight = Number(draft.weight);
  const reps = Number(draft.reps);
  if (!mv || isNaN(weight) || isNaN(reps) || reps <= 0) { alert('Please enter a valid weight and reps.'); return; }

  draft.sets.push({ id: uid(), movementId: mv.id, movementName: mv.name, weight, reps });
  // Keep same weight by default
  draft.weight = weight;

  // Re-render immediately so the new set shows
  render();
  // Scroll to the last row for feedback
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
    for (const s of w.sets) rows.push([w.date, s.movementName, s.weight, s.reps, state.unit, w.notes.replace(/\\n/g,' ')]);
  }
  const csv = rows.map(r => r.map(x => `\"${String(x).replace(/\"/g,'\"\"')}\"`).join(',')).join('\\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'pocket-lifts.csv'; a.click(); URL.revokeObjectURL(url);
}

function changeUnit(u) { state.unit = u; save(); }

function weightStepValue(){ return state.unit === 'lb' ? 5 : 2.5; }
function nudgeWeight(delta){
  let w = parseFloat(draft.weight);
  if (isNaN(w)) w = 0;
  w = w + delta;
  // Keep one decimal for kg; integers fine for lb
  draft.weight = state.unit === 'kg' ? Number(w.toFixed(1)) : Math.round(w);
  render();
}


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
        <div>
          <div class="label">Date</div>
          <input class="input" type="date" value="${draft.date}" onchange="draft.date=this.value">
        </div>
        <div>
          <div class="label">Notes</div>
          <input class="input" type="text" placeholder="Optional notes…" value="${draft.notes}" oninput="draft.notes=this.value">
        </div>
      </div>
      <div class="divider"></div>
      <div class="grid two">
        <div>
          <div class="label">Movement</div>
          <select onchange="draft.movementId=this.value; draft.weight=suggestWeight(this.value); render()">
            ${state.movements.map(m => `<option value="${m.id}" ${draft.movementId===m.id?'selected':''}>${m.name}</option>`).join('')}
          </select>
          ${draft.movementId ? (last
            ? `<div class="hint">Last: ${formatUnit(last.weight)} × ${last.reps} • ${last.date || 'previous session'}</div>`
            : `<div class="hint">No history yet for this movement.</div>`
          ) : ''}
        </div>
        <div class="row" style="gap:10px; align-items:flex-end;">
          <div style="flex:1"><div class="label">Weight (${state.unit})</div><input class="input big-number" type="number" inputmode="decimal" placeholder="e.g. 135" value="${draft.weight}" oninput="draft.weight=this.value"><div class="stepper mt8"><button class="button" onclick="nudgeWeight(-weightStepValue())">- ${weightStepValue()}</button><button class="button" onclick="nudgeWeight(weightStepValue())">+ ${weightStepValue()}</button></div></div><div style="width:110px"><div class="label">Reps</div>
            <input class="input" type="number" inputmode="numeric" placeholder="e.g. 5" value="${draft.reps}" oninput="draft.reps=this.value">
          </div>
          <button class="button good" style="width:140px" onclick="addSetToDraft()">Save set</button>
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
          addMovement(n, p); document.getElementById('mvName').value=''; document.getElementById('mvPart').value='';
        })()">Add movement</button>
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
        `).join('') : `<div class="empty">No movements yet. Add your first one above.</div>`}
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
  footer.innerHTML = `Tip: On iPhone, tap the <span class="kbd">Share</span> button in Safari → <b>Add to Home Screen</b> to install.`;
  root.appendChild(footer);
}

window.addEventListener('load', () => {
  render();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
  }
});