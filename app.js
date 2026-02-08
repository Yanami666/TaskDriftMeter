// app.js — Firebase SDK v12.9.0
import { db } from "./firebase.js";
import {
  doc, setDoc, getDoc, updateDoc, deleteDoc,
  collection, addDoc,
  query, orderBy, onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

const LS_MEMBER = "tdm_member_id";
const LS_GROUP  = "tdm_group_code";
const LS_NAME   = "tdm_display_name";

function makeId(){ return crypto.getRandomValues(new Uint32Array(4)).join("-"); }
function cleanCode(s){ return (s||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,12); }
function escapeHtml(str){
  return (str||"").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}
function hashToInt(str){
  let h = 2166136261;
  for (let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

// Member colors (pie)
const MEMBER_PALETTE = [
  "#2563EB", "#DC2626", "#16A34A", "#7C3AED", "#D97706",
  "#0EA5E9", "#DB2777", "#84CC16", "#4B5563", "#111827"
];
function memberColor(mid){
  const n = hashToInt(String(mid));
  return MEMBER_PALETTE[n % MEMBER_PALETTE.length];
}

// Task colors (ONLY 4, user-choosable)
const TASK_COLORS = ["#2563EB", "#DC2626", "#16A34A", "#7C3AED"]; // blue, red, green, purple
function clampColorIndex(i){
  const n = Number(i);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(3, Math.floor(n)));
}
function fallbackTaskIndex(todoId){
  // if older tasks didn't have colorIndex saved, pick stable default but DO NOT write
  return hashToInt(String(todoId)) % 4;
}
function taskColorFromTodo(todo){
  if (!todo) return "#9CA3AF";
  const idx = (todo.colorIndex == null) ? fallbackTaskIndex(todo.id) : clampColorIndex(todo.colorIndex);
  return TASK_COLORS[idx] || TASK_COLORS[0];
}

let memberId = localStorage.getItem(LS_MEMBER);
if (!memberId){ memberId = makeId(); localStorage.setItem(LS_MEMBER, memberId); }

let groupCode = "";
let unsubAll = [];
let membersMap = {};     // memberId -> { displayName, color }
let todosMap = {};       // todoId -> { id, text, done, colorIndex, color }
let todosList = [];      // ordered array
let totalsByMember = {}; // memberId -> minutes
let minutesByMemberTask = {}; // memberId -> { taskKey -> minutes }
let eventsCache = [];    // events snapshot cache

init();

/* -------------------- UI bindings -------------------- */
$("backBtn")?.addEventListener("click", () => {
  window.location.href = "./index.html";
});

$("todoToggleBtn")?.addEventListener("click", () => {
  $("todoCard").classList.toggle("hide");
});

// Add button = add task (same as Enter)
$("todoAddBtn")?.addEventListener("click", () => addTodoFromInput());

// Enter = add, Shift+Enter = newline
$("todoAddInput")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    addTodoFromInput();
  }
});

$("showDoneToggle")?.addEventListener("change", () => {
  renderTodoList();
  renderTaskSelect();
  renderTaskLegend();
});

$("taskSelect")?.addEventListener("change", () => {
  const v = $("taskSelect").value;
  $("otherSubjectWrap").classList.toggle("hide", v !== "__OTHER__");
});

$("logBtn")?.addEventListener("click", async () => {
  try { await logEntry(); }
  catch (e) { $("logStatus").textContent = `Error: ${e.message}`; }
});

/* -------------------- init + realtime -------------------- */
async function init(){
  const params = new URLSearchParams(window.location.search);
  const urlGroup = cleanCode(params.get("group") || "");
  const storedGroup = cleanCode(localStorage.getItem(LS_GROUP) || "");
  groupCode = urlGroup || storedGroup;

  if (!groupCode){
    $("appStatus").textContent = "Missing group code. Go back and Join/Create.";
    return;
  }

  localStorage.setItem(LS_GROUP, groupCode);
  $("groupLabel").textContent = groupCode;

  const gSnap = await getDoc(doc(db, "groups", groupCode));
  if (!gSnap.exists()){
    $("appStatus").textContent = "Group not found (wrong link). Go back.";
    return;
  }

  // ensure member exists
  const name = localStorage.getItem(LS_NAME) || "Member";
  await setDoc(doc(db, "groups", groupCode, "members", memberId), {
    displayName: name,
    joinedAt: serverTimestamp()
  }, { merge: true });

  $("appStatus").textContent = "Connected ✓";
  startRealtime();
}

function startRealtime(){
  unsubAll.forEach(fn => fn());
  unsubAll = [];

  // members
  const membersQ = query(collection(db,"groups",groupCode,"members"), orderBy("joinedAt","asc"));
  unsubAll.push(onSnapshot(membersQ, (snap)=>{
    const next = {};
    snap.forEach(d=>{
      const m = d.data();
      next[d.id] = { displayName: m.displayName || "Member", color: memberColor(d.id) };
    });
    membersMap = next;

    for (const mid of Object.keys(membersMap)){
      if (totalsByMember[mid] == null) totalsByMember[mid] = 0;
      if (minutesByMemberTask[mid] == null) minutesByMemberTask[mid] = {};
    }

    renderAll();
  }));

  // todos
  const todosQ = query(collection(db,"groups",groupCode,"todos"), orderBy("createdAt","asc"));
  unsubAll.push(onSnapshot(todosQ, (snap)=>{
    const map = {};
    const list = [];
    snap.forEach(d=>{
      const t = d.data();
      const obj = {
        id: d.id,
        text: t.text || "Untitled",
        done: !!t.done,
        colorIndex: (t.colorIndex == null ? null : clampColorIndex(t.colorIndex)),
      };
      obj.color = taskColorFromTodo(obj);
      map[d.id] = obj;
      list.push(obj);
    });
    todosMap = map;
    todosList = list;

    renderTodoList();
    renderTaskSelect();
    renderTaskLegend();
    renderAll();
  }));

  // events
  const eventsQ = query(collection(db,"groups",groupCode,"events"), orderBy("createdAt","asc"));
  unsubAll.push(onSnapshot(eventsQ, (snap)=>{
    const evs = [];
    snap.forEach(d=>{
      const e = d.data();
      evs.push({
        id: d.id,
        memberId: e.memberId,
        minutes: Number(e.minutes||0),
        todoId: e.todoId || null,
        subjectText: e.subjectText || "",
      });
    });
    eventsCache = evs;
    recomputeAggregates();
    renderAll();
  }));
}

/* -------------------- Todo CRUD -------------------- */
async function addTodoFromInput(){
  try{
    const box = $("todoAddInput");
    const text = (box.value || "").trim();
    if (!text) return;

    const idx = clampColorIndex($("todoColorSelect")?.value ?? 0);

    $("todoStatus").textContent = "";
    box.value = "";
    box.style.height = "";

    await addDoc(collection(db,"groups",groupCode,"todos"), {
      text,
      done: false,
      colorIndex: idx,          // ✅ store chosen color
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: memberId,
    });
  }catch(e){
    $("todoStatus").textContent = `Error: ${e.message}`;
  }
}

function renderTodoList(){
  const listEl = $("todoList");
  if (!listEl) return;
  listEl.innerHTML = "";

  const showDone = $("showDoneToggle")?.checked;
  const filtered = todosList.filter(t => showDone ? true : !t.done);

  if (!filtered.length){
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "No tasks yet. Add one above.";
    listEl.appendChild(empty);
    return;
  }

  for (const t of filtered){
    const row = document.createElement("div");
    row.className = "todoItem";

    const dot = document.createElement("span");
    dot.className = "taskDot";
    dot.style.background = t.color;

    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = !!t.done;
    check.addEventListener("change", async () => {
      await updateDoc(doc(db,"groups",groupCode,"todos",t.id), {
        done: check.checked,
        updatedAt: serverTimestamp(),
        updatedBy: memberId
      });
    });

    const input = document.createElement("input");
    input.className = "todoText";
    input.value = t.text;

    input.addEventListener("keydown", async (e)=>{
      if (e.key === "Enter") {
        e.preventDefault();
        input.blur();
      }
    });

    input.addEventListener("blur", async ()=>{
      const next = (input.value||"").trim() || "Untitled";
      if (next === t.text) return;
      await updateDoc(doc(db,"groups",groupCode,"todos",t.id), {
        text: next,
        updatedAt: serverTimestamp(),
        updatedBy: memberId
      });
    });

    // ✅ color picker per task (4 options)
    const colorPick = document.createElement("select");
    colorPick.className = "todoColorPick";
    colorPick.innerHTML = `
      <option value="0">Blue</option>
      <option value="1">Red</option>
      <option value="2">Green</option>
      <option value="3">Purple</option>
    `;
    const currentIdx = (t.colorIndex == null) ? fallbackTaskIndex(t.id) : clampColorIndex(t.colorIndex);
    colorPick.value = String(currentIdx);

    colorPick.addEventListener("change", async ()=>{
      const idx = clampColorIndex(colorPick.value);
      await updateDoc(doc(db,"groups",groupCode,"todos",t.id), {
        colorIndex: idx,
        updatedAt: serverTimestamp(),
        updatedBy: memberId
      });
    });

    const actions = document.createElement("div");
    actions.className = "todoActions";

    const del = document.createElement("button");
    del.className = "smallBtn ghost";
    del.textContent = "Delete";
    del.addEventListener("click", async ()=>{
      if (!confirm("Delete this task?")) return;
      await deleteDoc(doc(db,"groups",groupCode,"todos",t.id));
    });

    actions.appendChild(del);

    row.appendChild(dot);
    row.appendChild(check);
    row.appendChild(input);
    row.appendChild(colorPick);
    row.appendChild(actions);
    listEl.appendChild(row);
  }
}

/* -------------------- Log entry -------------------- */
function minutesFromInputs(){
  const h = Math.max(0, Number($("hoursInput").value || 0));
  const m = Math.max(0, Number($("minsInput").value || 0));
  return h * 60 + m;
}

async function logEntry(){
  if (!groupCode) throw new Error("No group code.");
  const minutes = minutesFromInputs();
  if (minutes <= 0) throw new Error("Time must be > 0 min.");

  const selected = $("taskSelect").value;
  let todoId = null;
  let subjectText = "";

  if (selected === "__OTHER__"){
    subjectText = ($("otherSubjectInput").value || "").trim();
    if (!subjectText) throw new Error("Please type the custom subject (Other).");
  } else if (selected && selected.startsWith("todo:")){
    todoId = selected.slice(5);
    subjectText = (todosMap[todoId]?.text) || "Task";
  } else {
    throw new Error("Please select a task (or Other).");
  }

  const desc = ($("descInput").value || "").trim();

  await addDoc(collection(db, "groups", groupCode, "events"), {
    memberId,
    minutes,
    todoId,
    subjectText,
    desc,
    createdAt: serverTimestamp()
  });

  $("logStatus").textContent = `Logged ${minutes} min ✓`;
  setTimeout(()=> $("logStatus").textContent="", 1200);
}

/* -------------------- Dropdown + legends -------------------- */
function renderTaskSelect(){
  const sel = $("taskSelect");
  if (!sel) return;

  const showDone = $("showDoneToggle")?.checked;
  const tasks = todosList.filter(t => showDone ? true : !t.done);

  const prev = sel.value;

  sel.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "Select a task…";
  sel.appendChild(opt0);

  for (const t of tasks){
    const opt = document.createElement("option");
    opt.value = `todo:${t.id}`;
    opt.textContent = t.text;
    sel.appendChild(opt);
  }

  const optOther = document.createElement("option");
  optOther.value = "__OTHER__";
  optOther.textContent = "Other…";
  sel.appendChild(optOther);

  if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
  $("otherSubjectWrap").classList.toggle("hide", sel.value !== "__OTHER__");
}

function renderTaskLegend(){
  const el = $("taskLegend");
  if (!el) return;
  el.innerHTML = "";

  const showDone = $("showDoneToggle")?.checked;
  const tasks = todosList.filter(t => showDone ? true : !t.done);

  if (!tasks.length){
    const m = document.createElement("div");
    m.className = "muted small";
    m.textContent = "No tasks yet — add items in To Do List.";
    el.appendChild(m);
    return;
  }

  for (const t of tasks){
    const tag = document.createElement("div");
    tag.className = "taskTag";

    const dot = document.createElement("span");
    dot.className = "taskDot";
    dot.style.background = t.color;

    const text = document.createElement("span");
    text.innerHTML = escapeHtml(t.text);

    tag.appendChild(dot);
    tag.appendChild(text);
    el.appendChild(tag);
  }
}

/* -------------------- Aggregation + rendering -------------------- */
function recomputeAggregates(){
  totalsByMember = {};
  minutesByMemberTask = {};

  for (const mid of Object.keys(membersMap)){
    totalsByMember[mid] = 0;
    minutesByMemberTask[mid] = {};
  }

  for (const e of eventsCache){
    if (!e.memberId) continue;
    totalsByMember[e.memberId] = (totalsByMember[e.memberId] || 0) + e.minutes;

    const taskKey = e.todoId ? `todo:${e.todoId}` : `other:${e.subjectText || "Other"}`;
    if (!minutesByMemberTask[e.memberId]) minutesByMemberTask[e.memberId] = {};
    minutesByMemberTask[e.memberId][taskKey] = (minutesByMemberTask[e.memberId][taskKey] || 0) + e.minutes;
  }
}

function renderAll(){
  renderBarsStacked();
  renderPieByMember();
}

/* -------- stacked bars by task -------- */
function taskLabel(taskKey){
  if (taskKey.startsWith("todo:")){
    const id = taskKey.slice(5);
    return todosMap[id]?.text || "Task";
  }
  if (taskKey.startsWith("other:")){
    return taskKey.slice(6) || "Other";
  }
  return "Task";
}
function taskColor(taskKey){
  if (taskKey.startsWith("todo:")){
    const id = taskKey.slice(5);
    return taskColorFromTodo(todosMap[id] || { id });
  }
  return "#9CA3AF";
}

function renderBarsStacked(){
  const list = $("dashList");
  if (!list) return;

  list.innerHTML = "";

  const entries = Object.entries(totalsByMember).sort((a,b)=> (b[1]||0) - (a[1]||0));
  const maxTotal = Math.max(1, ...entries.map(([,mins])=>mins||0));

  for (const [mid, total] of entries){
    const m = membersMap[mid] || { displayName:"Member", color:"#111" };
    const isYou = mid === memberId;

    const taskMap = minutesByMemberTask[mid] || {};
    const taskPairs = Object.entries(taskMap).sort((a,b)=> (b[1]||0)-(a[1]||0));

    const item = document.createElement("div");
    item.className = "item";

    const header = document.createElement("div");
    header.className = "topline";
    header.innerHTML = `
      <div class="name">${escapeHtml(m.displayName)} <span class="muted">(${isYou ? "you" : "teammate"})</span></div>
      <div class="mono">${total || 0} min</div>
    `;

    const bar = document.createElement("div");
    bar.className = "stackedBar";

    const fullPct = Math.round(((total||0) / maxTotal) * 100);

    const inner = document.createElement("div");
    inner.style.width = `${fullPct}%`;
    inner.style.display = "flex";
    inner.style.height = "100%";

    if ((total||0) > 0){
      for (const [taskKey, mins] of taskPairs){
        const seg = document.createElement("div");
        seg.className = "seg";
        seg.style.width = `${Math.max(0.5, (mins/total)*100)}%`;
        seg.title = `${taskLabel(taskKey)} — ${mins} min`;
        seg.style.background = taskColor(taskKey);
        inner.appendChild(seg);
      }
    }

    bar.appendChild(inner);
    item.appendChild(header);
    item.appendChild(bar);
    list.appendChild(item);
  }
}

/* -------- pie by member (member colors) -------- */
function renderPieByMember(){
  const canvas = $("pieCanvas");
  const legend = $("pieLegend");
  if (!canvas || !legend) return;

  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);
  legend.innerHTML = "";

  const entries = Object.entries(totalsByMember).sort((a,b)=> (b[1]||0)-(a[1]||0));
  const totalAll = entries.reduce((s,[,v])=> s + Number(v||0), 0);

  const cx = w/2, cy = h/2;
  const r = Math.min(w,h)*0.38;

  if (!entries.length || totalAll <= 0){
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.strokeStyle = "#ddd";
    ctx.lineWidth = 18;
    ctx.stroke();

    ctx.fillStyle = "#666";
    ctx.font = "14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "center";
    ctx.fillText("No data yet", cx, cy);
    return;
  }

  let start = -Math.PI/2;

  for (const [mid, mins] of entries){
    const m = membersMap[mid] || { displayName:"Member", color: memberColor(mid) };
    const value = Number(mins||0);
    const angle = (value/totalAll) * Math.PI*2;
    const end = start + angle;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, end);
    ctx.closePath();
    ctx.fillStyle = m.color;
    ctx.fill();

    start = end;

    const pct = Math.round((value/totalAll)*100);
    const item = document.createElement("div");
    item.className = "legendItem";

    const sw = document.createElement("span");
    sw.className = "swatch";
    sw.style.background = m.color;

    const label = document.createElement("div");
    const youTag = (mid === memberId) ? " (you)" : "";
    label.innerHTML = `
      <div class="name">${escapeHtml(m.displayName)}<span class="muted">${youTag}</span></div>
      <div class="muted">${value} min • ${pct}%</div>
    `;

    item.appendChild(sw);
    item.appendChild(label);
    legend.appendChild(item);
  }

  ctx.beginPath();
  ctx.arc(cx, cy, r*0.55, 0, Math.PI*2);
  ctx.fillStyle = "#fff";
  ctx.fill();

  ctx.fillStyle = "#111";
  ctx.font = "600 14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.textAlign = "center";
  ctx.fillText("Total", cx, cy - 6);

  ctx.fillStyle = "#666";
  ctx.font = "13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText(`${totalAll} min`, cx, cy + 14);
}