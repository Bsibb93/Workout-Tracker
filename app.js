
const APP_VERSION = 'v10';
const $ = (s,e=document)=>e.querySelector(s); const $$=(s,e=document)=>Array.from(e.querySelectorAll(s));
const uid = ()=>Math.random().toString(36).slice(2,10); const todayStr=()=>new Date().toISOString().slice(0,10);
const storeKey='pocket_lifts_v1';
let state = JSON.parse(localStorage.getItem(storeKey)||'{"unit":"lb","movements":[],"workouts":[]}');
state.movements = state.movements || []; state.workouts = state.workouts || [];
if(!state.movements.length){ state.movements=[{id:uid(),name:'Bench Press'},{id:uid(),name:'Back Squat'}]; }
let currentTab='workout';
let draft = { date: todayStr(), notes:'', movementId: state.movements[0].id, weight:'', reps:5, intensity:'', sets:[] };

function save(){ localStorage.setItem(storeKey, JSON.stringify(state)); render(); }
function suggestWeight(mid){ if(!mid) return ''; const ws=[...state.workouts].sort((a,b)=>b.date.localeCompare(a.date));
  for(const w of ws){ const s=[...w.sets].reverse().find(s=>s.movementId===mid); if(s) return s.weight; } return ''; }
function addSetToDraft(){
  if(!draft.movementId){ alert('Pick a movement'); return; }
  const mv=state.movements.find(m=>m.id===draft.movementId); const weight=Number(draft.weight); const reps=Number(draft.reps);
  if(!mv||isNaN(weight)||isNaN(reps)||reps<=0){ alert('Enter valid weight & reps'); return; }
  draft.sets.push({id:uid(), movementId:mv.id, movementName:mv.name, weight, reps, intensity: draft.intensity||''});
  render(); setTimeout(()=>{ const rows=document.querySelectorAll('tbody tr'); if(rows.length) rows[rows.length-1].scrollIntoView({behavior:'smooth',block:'center'}); },0);
}
function saveWorkout(){ if(!draft.sets.length){ alert('Add at least one set'); return; } state.workouts.push({id:uid(), date:draft.date, notes:draft.notes.trim(), sets:JSON.parse(JSON.stringify(draft.sets))}); save(); draft={ date: todayStr(), notes:'', movementId: state.movements[0]?.id||null, weight:suggestWeight(state.movements[0]?.id), reps:5, intensity:'', sets:[] }; alert('Workout saved!'); }
function e1RM(w,r){ return Math.round(w*(1+r/30)); }
function lastUsed(mid){ const ws=[...state.workouts].sort((a,b)=>b.date.localeCompare(a.date)); for(const w of ws){ const s=[...w.sets].reverse().find(s=>s.movementId===mid); if(s) return {...s, date:w.date}; } return null; }
function formatUnit(n){ if(n===''||n==null) return ''; return Number(n).toLocaleString(undefined,{maximumFractionDigits:2})+' '+state.unit; }
function changeUnit(u){ state.unit=u; save(); }
function weightStepValue(){ return state.unit==='lb'?5:2.5; } function repStepValue(){ return 5; }
function nudgeWeight(d){ let w=parseFloat(draft.weight); if(isNaN(w)) w=0; w=w+d; draft.weight=state.unit==='kg'?Number(w.toFixed(1)):Math.round(w); render(); }
function nudgeReps(d){ let r=parseInt(draft.reps,10); if(isNaN(r)) r=0; r=r+d; if(r<0) r=0; draft.reps=r; render(); }
function setDraftIntensity(v){ draft.intensity=v; }
function suggestWaveWeights(base){ let m=parseFloat(base); if(isNaN(m)||m<=0) m=100; let easy=Math.round(m*0.9), heavy=Math.round(m*1.1); if(state.unit==='kg'){ easy=Number((m*0.9).toFixed(1)); heavy=Number((m*1.1).toFixed(1)); } return {easy,moderate:m,heavy}; }
function addWave(times){ if(!draft.movementId){ alert('Pick a movement'); return; } const seq=times===2?[6,4,2,6,4,2]:[6,4,2]; const base=draft.weight||suggestWeight(draft.movementId)||100; const sug=suggestWaveWeights(base);
  const wEasy=parseFloat(($('#w_easy')||{}).value)||sug.easy; const wMod=parseFloat(($('#w_moderate')||{}).value)||sug.moderate; const wHeavy=parseFloat(($('#w_heavy')||{}).value)||sug.heavy;
  const mv=state.movements.find(m=>m.id===draft.movementId); const intens=['easy','moderate','heavy']; const weights={easy:wEasy,moderate:wMod,heavy:wHeavy};
  seq.forEach((r,i)=>{ const tag=intens[i%3]; draft.sets.push({id:uid(), movementId:mv.id, movementName:mv.name, weight:weights[tag], reps:r, intensity:tag}); });
  render(); setTimeout(()=>{ const rows=document.querySelectorAll('tbody tr'); if(rows.length) rows[rows.length-1].scrollIntoView({behavior:'smooth',block:'center'}); },0);
}
function deleteWorkout(id){ if(!confirm('Delete this workout?')) return; state.workouts=state.workouts.filter(w=>w.id!==id); save(); }
function exportCSV(){ const rows=[['date','movement','weight','reps','unit','intensity','notes']]; for(const w of state.workouts){ for(const s of w.sets){ rows.push([w.date,s.movementName,s.weight,s.reps,state.unit,s.intensity||'',w.notes.replace(/\n/g,' ')]); } } const csv=rows.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n'); const blob=new Blob([csv],{type:'text/csv'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='pocket-lifts.csv'; a.click(); URL.revokeObjectURL(url); }
function switchTab(t){ currentTab=t; render(); }

function render(){
  const root=$('#app'); root.innerHTML='';
  const header=document.createElement('div'); header.className='header'; header.innerHTML=`
    <div class="row"><div class="title">Pocket Lifts</div><span class="badge">Offline</span></div>
    <div class="segmented" role="tablist"><button class="${currentTab==='workout'?'active':''}" onclick="switchTab('workout')">Workout</button><button class="${currentTab==='movements'?'active':''}" onclick="switchTab('movements')">Movements</button><button class="${currentTab==='history'?'active':''}" onclick="switchTab('history')">History</button></div>`; root.appendChild(header);
  const settings=document.createElement('div'); settings.className='mt12'; settings.innerHTML=`
    <div class="panel"><div class="row space-between">
      <div class="row wrap" style="gap:8px;"><span class="tag"><span class="dot"></span> Data saved on this device</span><span class="tag"><span class="dot" style="background:#22c55e"></span> No sign-in required</span></div>
      <div class="row"><span class="mr8 subtle small">Unit</span><div class="segmented"><button class="${state.unit==='lb'?'active':''}" onclick="changeUnit('lb')">lb</button><button class="${state.unit==='kg'?'active':''}" onclick="changeUnit('kg')">kg</button></div></div>
    </div></div>`; root.appendChild(settings);

  if(currentTab==='workout'){
    const panel=document.createElement('div'); panel.className='panel mt12'; const last=draft.movementId?lastUsed(draft.movementId):null;
    panel.innerHTML=`
      <h2>New Workout</h2>
      <div class="grid two mt8">
        <div>
          <div class="label">Movement</div>
          <select onchange="draft.movementId=this.value; draft.weight=suggestWeight(this.value); render()">
            ${state.movements.map(m=>`<option value="${m.id}" ${draft.movementId===m.id?'selected':''}>${m.name}</option>`).join('')}
          </select>
          ${draft.movementId ? (last ? `<div class="hint">Last: ${formatUnit(last.weight)} × ${last.reps} • ${last.date||'previous session'}</div>` : `<div class="hint">No history yet for this movement.</div>`) : ''}
          <div class="mt12"><div class="label">Intensity (optional)</div>
            <select onchange="setDraftIntensity(this.value)">
              <option value="" ${!draft.intensity?'selected':''}>—</option>
              <option value="easy" ${draft.intensity==='easy'?'selected':''}>easy</option>
              <option value="moderate" ${draft.intensity==='moderate'?'selected':''}>moderate</option>
              <option value="heavy" ${draft.intensity==='heavy'?'selected':''}>heavy</option>
            </select>
          </div>
          <button class="button good mt12" style="width:100%;" onclick="addSetToDraft()">Save set</button>
          <div class="waveBox">
            <div class="bold">Wave builder (6–4–2)</div>
            <div class="note">Set your easy/moderate/heavy weights and add one or two waves.</div>
            <div class="grid mt8">
              <div><div class="label">Easy weight (${state.unit})</div><input id="w_easy" class="input" type="number" inputmode="decimal" placeholder="e.g. 120"></div>
              <div><div class="label">Moderate weight (${state.unit})</div><input id="w_moderate" class="input" type="number" inputmode="decimal" placeholder="e.g. 135" value="${draft.weight||''}"></div>
              <div><div class="label">Heavy weight (${state.unit})</div><input id="w_heavy" class="input" type="number" inputmode="decimal" placeholder="e.g. 150"></div>
            </div>
            <div class="row mt12"><button class="button" onclick="addWave(1)">Add 6–4–2</button><button class="button" onclick="addWave(2)">Add 6–4–2–6–4–2</button></div>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:12px; width:100%;">
          <div><div class="label">Weight (${state.unit})</div>
            <input class="input big-number" type="number" inputmode="decimal" placeholder="e.g. 135" value="${draft.weight||''}" oninput="draft.weight=this.value">
            <div class="stepper mt8"><button class="button" onclick="nudgeWeight(-weightStepValue())">- ${weightStepValue()}</button><button class="button" onclick="nudgeWeight(weightStepValue())">+ ${weightStepValue()}</button></div>
          </div>
          <div><div class="label">Reps</div>
            <input class="input big-number" type="number" inputmode="numeric" placeholder="e.g. 5" value="${draft.reps}" oninput="draft.reps=this.value">
            <div class="stepper mt8"><button class="button" onclick="nudgeReps(-repStepValue())">- 5</button><button class="button" onclick="nudgeReps(repStepValue())">+ 5</button></div>
          </div>
        </div>
      </div>

      <div class="mt12">
        <h3>Sets in this workout</h3>
        ${draft.sets.length ? `
          <table class="mt8">
            <thead><tr><th>Movement</th><th>Weight</th><th>Reps</th><th>Tag</th><th class="right">Est. 1RM</th></tr></thead>
            <tbody>
              ${draft.sets.map(s=>`
                <tr>
                  <td>${s.movementName}</td>
                  <td>${formatUnit(s.weight)}</td>
                  <td>${s.reps}</td>
                  <td>${s.intensity ? `<span class='pill ${s.intensity}'>${s.intensity}</span>` : ''}</td>
                  <td class="right">${e1RM(s.weight, s.reps)} ${state.unit}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : `<div class="empty">No sets added yet.</div>`}
      </div>

      <div class="row mt16"><button class="button primary" onclick="saveWorkout()">Save workout</button><button class="button ghost" onclick="draft={ date: todayStr(), notes:'', movementId: state.movements[0]?.id||null, weight:suggestWeight(state.movements[0]?.id), reps:5, intensity:'', sets:[] }; render()">Reset</button></div>
    `;
    root.appendChild(panel);
  }

  if(currentTab==='movements'){
    const panel=document.createElement('div'); panel.className='panel mt12'; panel.innerHTML=`
      <h2>Movements</h2>
      <div class="row mt8"><input id="mvName" class="input" placeholder="e.g. Incline DB Press"><input id="mvPart" class="input" placeholder="Body part (optional)">
        <button class="button good" style="width:160px" onclick="(function(){ const n=$('#mvName').value; const p=$('#mvPart').value; if(!n.trim()) return; if(state.movements.some(m=>m.name.toLowerCase()===n.trim().toLowerCase())) return; state.movements.push({id:uid(),name:n.trim(),bodypart:p.trim()}); save(); $('#mvName').value=''; $('#mvPart').value=''; })()">Add movement</button></div>
      <div class="list mt12">
        ${state.movements.length ? state.movements.map(m=>`
          <div class="card row space-between"><div><div class="bold">${m.name}</div>${m.bodypart?`<div class="small subtle">${m.bodypart}</div>`:''}</div><div class="row"><button class="button danger" onclick="(function(){ if(!confirm('Delete this movement? (Past workouts stay)')) return; state.movements=state.movements.filter(x=>x.id!=='${m.id}'); save(); })()">Delete</button></div></div>
        `).join(''): `<div class="empty">No movements yet. Add your first one above.</div>`}
      </div>`;
    root.appendChild(panel);
  }

  if(currentTab==='history'){
    const panel=document.createElement('div'); panel.className='panel mt12';
    const byDate=[...state.workouts].sort((a,b)=>b.date.localeCompare(a.date));
    panel.innerHTML=`
      <h2>History</h2>
      <div class="row mt8"><button class="button" onclick="exportCSV()">Export CSV</button></div>
      <div class="list mt12">
        ${byDate.length ? byDate.map(w=>`
          <div class="card">
            <div class="row space-between"><div class="bold">${w.date}</div><button class="button danger small" onclick="(function(){ if(!confirm('Delete this workout?')) return; state.workouts=state.workouts.filter(x=>x.id!=='${w.id}'); save(); })()">Delete</button></div>
            ${w.notes?`<div class="small subtle mt8">${w.notes}</div>`:''}
            <table class="mt12"><thead><tr><th>Movement</th><th>Weight</th><th>Reps</th><th>Tag</th><th class="right">Est. 1RM</th></tr></thead>
              <tbody>
                ${w.sets.map(s=>`
                  <tr>
                    <td>${s.movementName}</td>
                    <td>${formatUnit(s.weight)}</td>
                    <td>${s.reps}</td>
                    <td>${s.intensity ? `<span class='pill ${s.intensity}'>${s.intensity}</span>` : ''}</td>
                    <td class="right">${e1RM(s.weight, s.reps)} ${state.unit}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `).join(''): `<div class="empty">No workouts yet. Save one from the Workout tab.</div>`}
      </div>`;
    root.appendChild(panel);
  }

  const footer=document.createElement('footer'); footer.innerHTML=`Tip: Add this to Home Screen on iPhone. <span class="badge2">Pocket Lifts ${APP_VERSION}</span>`; root.appendChild(footer);
}

window.addEventListener('load', ()=>{ render(); if('serviceWorker' in navigator){ navigator.serviceWorker.register('./service-worker.js').catch(()=>{}); } });
