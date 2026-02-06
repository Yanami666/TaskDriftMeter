// app.js (for app.html) — Firebase SDK v12.9.0
import { db } from "./firebase.js";
import {
  doc, setDoc, getDoc,
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

let memberId = localStorage.getItem(LS_MEMBER);
if (!memberId){ memberId = makeId(); localStorage.setItem(LS_MEMBER, memberId); }

let groupCode = "";
let unsubscribe = null;

init();

$("backBtn").addEventListener("click", () => {
  window.location.href = "./index.html";
});

$("logBtn").addEventListener("click", async () => {
  try { await logEntry(); }
  catch (e) { $("logStatus").textContent = `Error: ${e.message}`; }
});

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

  // ensure group exists
  const gSnap = await getDoc(doc(db, "groups", groupCode));
  if (!gSnap.exists()){
    $("appStatus").textContent = "Group not found (maybe wrong link). Go back.";
    return;
  }

  // ensure member exists (in case they jumped here directly)
  const name = localStorage.getItem(LS_NAME) || "Member";
  await setDoc(doc(db, "groups", groupCode, "members", memberId), {
    displayName: name,
    joinedAt: serverTimestamp()
  }, { merge: true });

  $("appStatus").textContent = `Connected ✓`;
  startRealtime();
}

function minutesFromInputs(){
  const h = Math.max(0, Number($("hoursInput").value || 0));
  const m = Math.max(0, Number($("minsInput").value || 0));
  return h * 60 + m;
}

async function logEntry(){
  if (!groupCode) throw new Error("No group code.");
  const minutes = minutesFromInputs();
  if (minutes <= 0) throw new Error("Time must be > 0 min.");

  const subject = ($("subjectInput").value || "").trim();
  const desc = ($("descInput").value || "").trim();

  await addDoc(collection(db, "groups", groupCode, "events"), {
    memberId,
    minutes,
    subject,
    desc,
    createdAt: serverTimestamp()
  });

  $("logStatus").textContent = `Logged ${minutes} min ✓`;
  setTimeout(()=> $("logStatus").textContent="", 1200);
}

function startRealtime(){
  if (unsubscribe) unsubscribe();

  const membersMap = {};
  const totals = {};

  const membersQ = query(collection(db,"groups",groupCode,"members"), orderBy("joinedAt","asc"));
  const unsubMembers = onSnapshot(membersQ, (snap)=>{
    snap.forEach(d=>{
      const m = d.data();
      membersMap[d.id] = m.displayName || "Member";
      if (totals[d.id] == null) totals[d.id] = 0; // show 0-min members too
    });
    render(totals, membersMap);
  });

  const eventsQ = query(collection(db,"groups",groupCode,"events"), orderBy("createdAt","asc"));
  const unsubEvents = onSnapshot(eventsQ, (snap)=>{
    // reset totals but keep members at 0
    for (const k of Object.keys(totals)) totals[k] = 0;

    snap.forEach(d=>{
      const e = d.data();
      totals[e.memberId] = (totals[e.memberId] || 0) + Number(e.minutes || 0);
    });

    render(totals, membersMap);
  });

  unsubscribe = () => { unsubMembers(); unsubEvents(); };
}

function render(totals, membersMap){
  const list = $("dashList");
  list.innerHTML = "";

  const entries = Object.entries(totals).sort((a,b)=>b[1]-a[1]);
  const max = Math.max(1, ...entries.map(e=>e[1]));

  for (const [mid, mins] of entries){
    const name = membersMap[mid] || "Member";
    const pct = Math.round((mins / max) * 100);

    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="topline">
        <div class="name">${escapeHtml(name)} <span class="muted">(${mid===memberId ? "you" : "teammate"})</span></div>
        <div class="mono">${mins} min</div>
      </div>
      <div class="bar"><div style="width:${pct}%"></div></div>
    `;
    list.appendChild(div);
  }

  // draw pie chart under bars
  renderPie(entries, membersMap, memberId);
}

function renderPie(entries, membersMap, selfMemberId){
  const canvas = document.getElementById("pieCanvas");
  const legend = document.getElementById("pieLegend");
  if (!canvas || !legend) return;

  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  // clear
  ctx.clearRect(0, 0, w, h);
  legend.innerHTML = "";

  const total = entries.reduce((sum, [,mins]) => sum + Number(mins || 0), 0);

  if (!entries.length || total <= 0){
    const cx = w/2, cy = h/2;
    const r = Math.min(w,h)*0.38;

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

  const cx = w/2, cy = h/2;
  const r = Math.min(w,h)*0.38;

  let start = -Math.PI / 2;

  entries.forEach(([mid, mins], idx) => {
    const value = Number(mins || 0);
    const angle = (value / total) * Math.PI * 2;
    const end = start + angle;

    const color = pieColor(idx);

    // slice
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, end);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    start = end;

    // legend
    const name = membersMap[mid] || "Member";
    const pct = Math.round((value / total) * 100);

    const item = document.createElement("div");
    item.className = "legendItem";

    const sw = document.createElement("span");
    sw.className = "swatch";
    sw.style.background = color;

    const label = document.createElement("div");
    const youTag = (mid === selfMemberId) ? " (you)" : "";
    label.innerHTML = `
      <div class="name">${escapeHtml(name)}<span class="muted">${youTag}</span></div>
      <div class="muted">${value} min • ${pct}%</div>
    `;

    item.appendChild(sw);
    item.appendChild(label);
    legend.appendChild(item);
  });

  // donut hole
  ctx.beginPath();
  ctx.arc(cx, cy, r*0.55, 0, Math.PI*2);
  ctx.fillStyle = "#fff";
  ctx.fill();

  // center text
  ctx.fillStyle = "#111";
  ctx.font = "600 14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.textAlign = "center";
  ctx.fillText("Total", cx, cy - 6);

  ctx.fillStyle = "#666";
  ctx.font = "13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText(`${total} min`, cx, cy + 14);
}

function pieColor(i){
  const palette = [
    "#111827","#2563EB","#DC2626","#16A34A","#7C3AED",
    "#D97706","#0EA5E9","#DB2777","#4B5563","#84CC16"
  ];
  return palette[i % palette.length];
}

function escapeHtml(str){
  return (str||"").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}