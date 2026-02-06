// app.js (for app.html)
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
  // read group from URL first, fallback to localStorage
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
}

function escapeHtml(str){
  return (str||"").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}