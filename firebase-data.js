import { db } from "./firebase.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function safeUserFromLocal() {
  try {
    const raw = localStorage.getItem("gwm_user");
    const u = raw ? JSON.parse(raw) : {};
    return {
      id: u.id || "local-user",
      username: u.username || "Guest",
      email: u.email || ""
    };
  } catch {
    return { id: "local-user", username: "Guest", email: "" };
  }
}

export async function fbCreateGroup({ name, description = "", invited = [], bannerDataUrl = "" }) {
  const user = safeUserFromLocal();
  const id = "g_" + Date.now();
  const code = makeCode();

  const groupDoc = {
    id,
    code,
    name,
    description,
    bannerDataUrl, // demo阶段先直接存（会比较大，正式版建议用 Storage）
    members: [{
      id: user.id,
      username: user.username,
      email: user.email,
      role: "owner",
      joinedAt: Date.now()
    }],
    invited,
    workItems: [],
    workLogs: [],
    completedTaskIds: [],
    createdBy: user.id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    createdAtServer: serverTimestamp(),
    updatedAtServer: serverTimestamp()
  };

  await setDoc(doc(db, "groups", id), groupDoc);
  return groupDoc;
}

export async function fbJoinGroup({ code, displayName = "" }) {
  const user = safeUserFromLocal();

  const q = query(collection(db, "groups"), where("code", "==", code));
  const snap = await getDocs(q);

  if (snap.empty) {
    throw new Error("Group code not found");
  }

  const ref = snap.docs[0];
  const data = ref.data();

  const members = Array.isArray(data.members) ? [...data.members] : [];
  const existingIndex = members.findIndex(m => (m.id && m.id === user.id) || (m.email && m.email === user.email));

  const memberObj = {
    id: user.id,
    username: displayName || user.username || "Guest",
    email: user.email || "",
    role: existingIndex >= 0 ? (members[existingIndex].role || "member") : "member",
    joinedAt: existingIndex >= 0 ? (members[existingIndex].joinedAt || Date.now()) : Date.now()
  };

  if (existingIndex >= 0) members[existingIndex] = memberObj;
  else members.push(memberObj);

  await updateDoc(doc(db, "groups", data.id), {
    members,
    updatedAt: Date.now(),
    updatedAtServer: serverTimestamp()
  });

  return {
    ...data,
    members
  };
}

export async function fbGetGroupById(groupId) {
  const snap = await getDoc(doc(db, "groups", groupId));
  if (!snap.exists()) return null;
  return snap.data();
}

export async function fbGetMyGroups() {
  const user = safeUserFromLocal();
  const snap = await getDocs(collection(db, "groups"));
  const all = snap.docs.map(d => d.data());

  // 简单过滤：我创建的 或 我在members里
  return all.filter(g => {
    if (g.createdBy === user.id) return true;
    const members = Array.isArray(g.members) ? g.members : [];
    return members.some(m => (m.id && m.id === user.id) || (m.email && m.email === user.email));
  }).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function fbAppendWorkLog(groupId, logInput) {
  const snap = await getDoc(doc(db, "groups", groupId));
  if (!snap.exists()) throw new Error("Group not found");
  const g = snap.data();

  const user = safeUserFromLocal();
  const workItems = Array.isArray(g.workItems) ? [...g.workItems] : [];
  const workLogs = Array.isArray(g.workLogs) ? [...g.workLogs] : [];

  let taskId = logInput.taskId || "";
  let taskName = (logInput.taskName || "").trim();

  if (!taskId && taskName) {
    taskId = "t_" + Date.now();
    workItems.unshift({ id: taskId, name: taskName, createdAt: Date.now() });
  } else if (taskId) {
    const found = workItems.find(x => x.id === taskId);
    taskName = found ? found.name : "Task";
  }

  const newLog = {
    id: "log_" + Date.now(),
    taskId,
    taskName: taskName || "Task",
    stars: Number(logInput.stars || 0),
    minutes: Number(logInput.minutes || 0),
    photoDataUrl: logInput.photoDataUrl || "",
    memberId: user.id,
    memberName: user.username || "Guest",
    memberEmail: user.email || "",
    createdAt: Date.now()
  };

  workLogs.unshift(newLog);

  await updateDoc(doc(db, "groups", groupId), {
    workItems,
    workLogs,
    updatedAt: Date.now(),
    updatedAtServer: serverTimestamp()
  });

  return { ...g, workItems, workLogs };
}