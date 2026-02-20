window.AppState = (function () {
  const KEYS = {
    user: "gwm_user",
    groups: "gwm_groups",
    currentGroupId: "gwm_current_group_id"
  };

  // =========================
  // Helpers
  // =========================
  function uid(prefix = "id") {
    return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  }

  function safeParse(raw, fallback) {
    try {
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function loadJSON(key, fallback) {
    return safeParse(localStorage.getItem(key), fallback);
  }

  // 6位邀请码（字母数字混合，去掉易混淆字符）
  // 6-char invite code (alphanumeric, avoids confusing chars)
  function randomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  function initials(name) {
    const s = String(name || "").trim();
    if (!s) return "?";
    const parts = s.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function clamp(v, min, max) {
    if (!Number.isFinite(v)) return min;
    return Math.max(min, Math.min(max, v));
  }

  function normalizeUser(u) {
    return {
      id: u?.id || "local_user",
      username: String(u?.username || "Guest").trim() || "Guest",
      email: String(u?.email || "").trim(),
      photoDataUrl: u?.photoDataUrl || ""
    };
  }

  function normalizeMember(m) {
    return {
      id: m?.id || "",
      username: String(m?.username || "Guest").trim() || "Guest",
      email: String(m?.email || "").trim(),
      photoDataUrl: m?.photoDataUrl || "",
      role: m?.role || "member",
      joinedAt: Number(m?.joinedAt || Date.now())
    };
  }

  function normalizeTask(t) {
    return {
      id: t?.id || uid("t"),
      name: String(t?.name || "Task").trim() || "Task",
      createdAt: Number(t?.createdAt || Date.now())
    };
  }

  function normalizeLog(log) {
    return {
      id: log?.id || uid("log"),
      taskId: log?.taskId || "",
      taskName: String(log?.taskName || "Task").trim() || "Task",
      stars: clamp(Number(log?.stars || 3), 1, 5),
      minutes: Math.max(0, Number(log?.minutes || 0)),
      photoDataUrl: log?.photoDataUrl || "",
      description: String(log?.description || "").trim(), // ✅ 新增
      memberId: log?.memberId || "",
      memberName: String(log?.memberName || "Guest").trim() || "Guest",
      memberEmail: String(log?.memberEmail || "").trim(),
      memberPhotoDataUrl: log?.memberPhotoDataUrl || "",
      createdAt: Number(log?.createdAt || Date.now())
    };
  }

  function normalizeGroup(g) {
    return {
      id: g?.id || uid("g"),
      code: String(g?.code || "").trim().toUpperCase() || randomCode(),
      name: String(g?.name || "Untitled Group").trim() || "Untitled Group",
      description: String(g?.description || "").trim(),
      bannerDataUrl: g?.bannerDataUrl || "",
      members: Array.isArray(g?.members) ? g.members.map(normalizeMember) : [],
      invited: Array.isArray(g?.invited) ? [...g.invited] : [],
      workItems: Array.isArray(g?.workItems) ? g.workItems.map(normalizeTask) : [],
      workLogs: Array.isArray(g?.workLogs) ? g.workLogs.map(normalizeLog) : [],
      completedTaskIds: Array.isArray(g?.completedTaskIds) ? [...g.completedTaskIds] : [],
      createdBy: g?.createdBy || "",
      createdAt: Number(g?.createdAt || Date.now()),
      updatedAt: Number(g?.updatedAt || Date.now())
    };
  }

  // =========================
  // User
  // =========================
  function loadUser() {
    return normalizeUser(loadJSON(KEYS.user, null));
  }

  function saveUser(partial) {
    const current = loadUser();
    const next = normalizeUser({ ...current, ...(partial || {}) });
    saveJSON(KEYS.user, next);
    return next;
  }

  // =========================
  // Groups basic
  // =========================
  function loadGroups() {
    const arr = loadJSON(KEYS.groups, []);
    if (!Array.isArray(arr)) return [];
    return arr.map(normalizeGroup);
  }

  function saveGroups(groups) {
    saveJSON(KEYS.groups, (groups || []).map(normalizeGroup));
  }

  function getCurrentGroupId() {
    return localStorage.getItem(KEYS.currentGroupId) || "";
  }

  function setCurrentGroupId(id) {
    if (!id) return;
    localStorage.setItem(KEYS.currentGroupId, String(id));
  }

  function getCurrentGroup() {
    const id = getCurrentGroupId();
    if (!id) return null;
    const groups = loadGroups();
    return groups.find(g => g.id === id) || null;
  }

  // =========================
  // Sync user into existing groups
  // =========================
  function updateCurrentUserInAllGroups() {
    const user = loadUser();
    const groups = loadGroups();
    let changed = false;

    groups.forEach(g => {
      const idx = g.members.findIndex(m => m.id === user.id || (!!user.email && m.email === user.email));
      if (idx >= 0) {
        g.members[idx] = normalizeMember({
          ...g.members[idx],
          id: user.id,
          username: user.username,
          email: user.email,
          photoDataUrl: user.photoDataUrl || ""
        });

        // 同步已存在日志里的头像和名字（演示版更一致）
        // Sync existing logs too for demo consistency
        g.workLogs = (g.workLogs || []).map(log => {
          const sameUser = log.memberId === user.id || (!!user.email && log.memberEmail === user.email);
          if (!sameUser) return log;
          return normalizeLog({
            ...log,
            memberName: user.username,
            memberEmail: user.email,
            memberPhotoDataUrl: user.photoDataUrl || ""
          });
        });

        g.updatedAt = Date.now();
        changed = true;
      }
    });

    if (changed) saveGroups(groups);
  }

  // =========================
  // Group create / join
  // =========================
  function createGroup({ name, description = "", bannerDataUrl = "", invited = [] }) {
    const user = loadUser();
    const groups = loadGroups();

    const group = normalizeGroup({
      id: uid("g"),
      code: randomCode(),
      name: String(name || "").trim() || "Untitled Group",
      description,
      bannerDataUrl,
      invited,
      members: [
        {
          id: user.id,
          username: user.username,
          email: user.email,
          photoDataUrl: user.photoDataUrl || "",
          role: "owner",
          joinedAt: Date.now()
        }
      ],
      workItems: [],
      workLogs: [],
      completedTaskIds: [],
      createdBy: user.id,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    groups.unshift(group);
    saveGroups(groups);
    setCurrentGroupId(group.id);
    return group;
  }

  function joinGroup({ code, displayName = "" }) {
    const user = loadUser();
    const groups = loadGroups();

    const normalizedCode = String(code || "").trim().toUpperCase();
    const g = groups.find(x => x.code === normalizedCode);

    if (!g) {
      throw new Error("Group not found");
    }

    const finalName = String(displayName || user.username || "Guest").trim() || "Guest";
    const idx = g.members.findIndex(m => m.id === user.id || (!!user.email && m.email === user.email));

    const member = normalizeMember({
      id: user.id,
      username: finalName,
      email: user.email,
      photoDataUrl: user.photoDataUrl || "",
      role: idx >= 0 ? (g.members[idx].role || "member") : "member",
      joinedAt: idx >= 0 ? (g.members[idx].joinedAt || Date.now()) : Date.now()
    });

    if (idx >= 0) g.members[idx] = member;
    else g.members.push(member);

    g.updatedAt = Date.now();
    saveGroups(groups);
    setCurrentGroupId(g.id);
    return g;
  }

  // =========================
  // Work logs / tasks
  // =========================
  function addWorkLog(groupId, payload) {
    const groups = loadGroups();
    const g = groups.find(x => x.id === groupId);
    if (!g) throw new Error("Group not found");

    const user = loadUser();
    const input = payload || {};

    let taskId = String(input.taskId || "").trim();
    let taskName = String(input.taskName || "").trim();

    if (!taskId && taskName) {
      const newTask = normalizeTask({
        id: uid("t"),
        name: taskName,
        createdAt: Date.now()
      });
      g.workItems.unshift(newTask);
      taskId = newTask.id;
      taskName = newTask.name;
    }

    if (taskId && !taskName) {
      const found = g.workItems.find(t => t.id === taskId);
      taskName = found ? found.name : "Task";
    }

    if (!taskId && !taskName) {
      throw new Error("No task selected or created");
    }

    const minutes = Number(input.minutes || 0);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      throw new Error("Invalid minutes");
    }

    const log = normalizeLog({
      id: uid("log"),
      taskId: taskId || uid("t_fallback"),
      taskName: taskName || "Task",
      stars: Number(input.stars || 3),
      minutes,
      photoDataUrl: input.photoDataUrl || "",
      description: String(input.description || "").trim(), // ✅ 新增
      memberId: user.id,
      memberName: user.username || "Guest",
      memberEmail: user.email || "",
      memberPhotoDataUrl: user.photoDataUrl || "",
      createdAt: Date.now()
    });

    g.workLogs.unshift(log);
    g.updatedAt = Date.now();

    saveGroups(groups);
    return log;
  }

  function toggleTaskComplete(groupId, taskId) {
    const groups = loadGroups();
    const g = groups.find(x => x.id === groupId);
    if (!g) return;

    const set = new Set(g.completedTaskIds || []);
    if (set.has(taskId)) set.delete(taskId);
    else set.add(taskId);

    g.completedTaskIds = Array.from(set);
    g.updatedAt = Date.now();
    saveGroups(groups);
  }

  // =========================
  // Derived
  // =========================
  function getMyTotalMinutesInGroup(groupId) {
    const user = loadUser();
    const g = loadGroups().find(x => x.id === groupId);
    if (!g) return 0;

    return (g.workLogs || [])
      .filter(log => log.memberId === user.id || (!!user.email && log.memberEmail === user.email))
      .reduce((sum, log) => sum + Number(log.minutes || 0), 0);
  }

  function getGroupTaskBreakdownForUser(groupId) {
    const user = loadUser();
    const g = loadGroups().find(x => x.id === groupId);
    if (!g) return [];

    const map = new Map();

    (g.workLogs || []).forEach(log => {
      const isMine = log.memberId === user.id || (!!user.email && log.memberEmail === user.email);
      if (!isMine) return;

      const key = log.taskId || log.taskName || uid("taskkey");
      if (!map.has(key)) {
        map.set(key, {
          taskId: log.taskId || key,
          taskName: log.taskName || "Task",
          minutes: 0
        });
      }
      map.get(key).minutes += Number(log.minutes || 0);
    });

    return Array.from(map.values()).sort((a, b) => b.minutes - a.minutes);
  }

  function formatMinutes(totalMinutes) {
    const mins = Math.max(0, Number(totalMinutes || 0));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  }

  // =========================
  // UI helpers
  // =========================
  function applyTopRightAvatar(el) {
    if (!el) return;
    const user = loadUser();

    el.classList.add("topIconAvatar");
    if (user.photoDataUrl) {
      el.innerHTML = `<img src="${user.photoDataUrl}" alt="avatar">`;
    } else {
      el.innerHTML = "";
    }
  }

  function resetAll() {
    localStorage.removeItem(KEYS.user);
    localStorage.removeItem(KEYS.groups);
    localStorage.removeItem(KEYS.currentGroupId);
  }

  return {
    loadUser,
    saveUser,

    loadGroups,
    saveGroups,
    getCurrentGroupId,
    setCurrentGroupId,
    getCurrentGroup,

    updateCurrentUserInAllGroups,

    createGroup,
    joinGroup,

    addWorkLog,
    toggleTaskComplete,

    getMyTotalMinutesInGroup,
    getGroupTaskBreakdownForUser,
    formatMinutes,

    applyTopRightAvatar,
    initials,

    resetAll
  };
})();