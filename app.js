import { db } from "./firebase.js";
import {
  doc, setDoc, getDoc,
  collection, addDoc,
  query, orderBy, onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

// local identity
const LS_MEMBER = "tdm_member_id";
const LS_GROUP  = "tdm_group_code";

function makeId(){ return crypto.getRandomValues(new Uint32Array(4)).join("-"); }
function cleanCode(s){ return (s||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,12); }

let memberId = localStorage.getItem(LS_MEMBER);
if (!memberId){ memberId = makeId(); localStorage.setItem(LS_MEMBER, memberId); }

let groupCode = localStorage.getItem(LS_GROUP) || "";
if (groupCode) $("groupInput").value = groupCode;

let unsubscribe = null;

$("createBtn").addEventListener("click", async () => {
  try {
    const codeInput = cleanCode($("groupInput").value);
    const code = codeInput || cleanCode(makeId().slice(0,6));
    groupCode = code;
    $("groupInput").value = code;
    localStorage.setItem(LS_GROUP, groupCode);

    await setDoc(doc(db, "groups", groupCode), {
      createdAt: serverTimestamp(),
      createdBy: memberId
    }, { merge:true });

    $("groupStatus").textContent = `Group created: ${groupCode}`;
    await joinGroup(); // auto
  } catch (e) {
    $("groupStatus").textContent = `Error: ${e.message}`;
  }
});

$("joinBtn").addEventListener("click", async () => {
  try { await joinGroup(); }
  catch (e) { $("groupStatus").textContent = `Error: ${e.message}`; }
});

$("logBtn").addEventListener("click", async () => {
  try { await logEntry(); }
  catch (e) { $("logStatus").textContent = `Error: ${e.message}`; }
});

async function joinGroup(){
  const code = cleanCode($("groupInput").value);
  if (!code) throw new Error("Enter group code.");
  groupCode = code;
  localStorage.setItem(LS_GROUP, groupCode);

  // must exist
  const gRef = doc(db, "groups", groupCode);
  const gSnap = await getDoc(gRef);
  if (!gSnap.exists()) throw new Error("Group not found. Create it first.");

  const name = ($("nameInput").value || "").trim() || "Member";

  await setDoc(doc(db, "groups", groupCode, "members", memberId), {
    displayName: name,
    joinedAt: serverTimestamp()
  }, { merge:true });

  $("groupStatus").textContent = `Joined ${groupCode} as "${name}"`;
  startRealtime();
}

function minutesFromInputs(){
  const h = Math.max(0, Number($("hoursInput").value || 0));
  const m = Math.max(0, Number($("minsInput").value || 0));
  return h*60 + m;
}

async function logEntry(){
  if (!groupCode) throw new Error("Join a group first.");
  const minutes = minutesFromInputs();
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
    });
    render(totals, membersMap);
  });

  const eventsQ = query(collection(db,"groups",groupCode,"events"), orderBy("createdAt","asc"));
  const unsubEvents = onSnapshot(eventsQ, (snap)=>{
    for (const k of Object.keys(totals)) delete totals[k];
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

  if (entries.length===0){
    list.innerHTML = `<p class="muted">No logs yet. Log an entry to start.</p>`;
    return;
  }

  for (const [mid, mins] of entries){
    const name = membersMap[mid] || "Member";
    const pct = Math.round((mins / max) * 100);
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="topline">
        <div class="name">${escapeHtml(name)} <span class="muted">(${mid===localStorage.getItem("${LS_MEMBER}") ? "you" : "teammate"})</span></div>
        <div class="mono">${mins} min</div>
      </div>
      <div class="bar"><div style="width:${pct}%"></div></div>
    `;
    list.appendChild(div);
  }
}

function escapeHtml(str){
  return (str||"").replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m]));
}