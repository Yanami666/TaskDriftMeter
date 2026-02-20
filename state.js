window.AppState = (function () {
  const KEYS = {
    user: "gwm_user",
    groups: "gwm_groups",
    currentGroupId: "gwm_current_group_id"
  };

  // ---------- helpers ----------
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

  function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function load(key, fallback) {
    return safeParse(localStorage.getItem(key), fallback);
  }

  function normalizeUser(u) {
    return {
      id: u?.id || "local_user",
      username: (u?.username || "Guest").trim() || "Guest",
      email: (u?.email || "").trim(),
      photoDataUrl: u?.photoDataUrl || ""
    };
  }

  function normalizeGroup(g) {
    return {
      id: g?.id || uid("g"),
      code: g?.code || "",
      name: (g?.name || "Untitled Group").trim() || "Untitled Group",
      description: g?.description || "",
      bannerDataUrl: g?.bannerDataUrl || "",
      members: Array.isArray(g?.members) ? g.members : [],
      invited: Array.isArray(g?.invited) ? g.invited : [],
      workItems: Array.isArray(g?.workItems) ? g.workItems : [],
      workLogs: Array.isArray(g?.workLogs) ? g.workLogs : [],
      completedTaskIds: Array.isArray(g?.completedTaskIds) ? g.completedTaskIds : [],
      createdBy: g?.createdBy || "",
      createdAt: Number(g?.createdAt || Date.now()),
      updatedAt: Number(g?.updatedAt || Date.now())
    };
  }

  function randomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  // ---------- user ----------
  function loadUser() {
    return normalizeUser(load(KEYS.user, null));
  }

  function saveUser(partial) {
    const current = loadUser();
    const next = normalizeUser({ ...current, ...partial });
    save(KEYS.user, next);
    return next;
  }

  // ---------- groups ----------
  function loadGroups() {
    const arr = load(KEYS.groups, []);
    return Array.isArray(arr) ? arr.map(normalizeGroup) : [];
  }

  function saveGroups(groups) {
    save(KEYS.groups, (groups || []).map(normalizeGroup));
  }

  function getCurrentGroupId() {
    return localStorage.getItem(KEYS.currentGroupId) || "";
  }

  function setCurrentGroupId(id) {
    if (!id) return;
    localStorage.setItem(KEYS.currentGroupId, id);
  }

  function getCurrentGroup() {
    const id = getCurrentGroupId();
    const groups = loadGroups();
    return groups.find(g => g.id === id) || null;
  }

  function updateCurrentUserInAllGroups() {
    const user = loadUser();
    const groups = loadGroups();
    let changed = false;

    groups.forEach(g => {
      const idx = g.members.findIndex(m => m.id === user.id || (!!user.email && m.email === user.email));
      if (idx >= 0) {
        g.members[idx] = {
          ...g.members[idx],
          id: user.id,
          username: user.username,
          email: user.email,
          photoDataUrl: user.photoDataUrl || ""
        };
        g.updatedAt = Date.now();
        changed = true;
      }
    });

    if (changed) saveGroups(groups);
  }

  function createGroup({ name, description = "", bannerDataUrl = "", invited = [] }) {
    const user = loadUser();
    const groups = loadGroups();

    const group = normalizeGroup({
      id: uid("g"),
      code: randomCode(),
      name,
      description,
      bannerDataUrl,
      invited,
      members: [{
        id: user.id,
        username: user.username,
        email: user.email,
        photoDataUrl: user.photoDataUrl || "",
        role: "owner",
        joinedAt: Date.now()
      }],
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
    const target = groups.find(g => (g.code || "").toUpperCase() === (code || "").trim().toUpperCase());

    if (!target) throw new Error("Group not found");

    const finalName = (displayName || user.username || "Guest").trim();
    const idx = target.members.findIndex(m => m.id === user.id || (!!user.email && m.email === user.email));

    const member = {
      id: user.id,
      username: finalName,
      email: user.email,
      photoDataUrl: user.photoDataUrl || "",
      role: idx >= 0 ? (target.members[idx].role || "member") : "member",
      joinedAt: idx >= 0 ? (target.members[idx].joinedAt || Date.now()) : Date.now()
    };

    if (idx >= 0) target.members[idx] = member;
    else target.members.push(member);

    target.updatedAt = Date.now();

    saveGroups(groups);
    setCurrentGroupId(target.id);
    return target;
  }

  function addWorkLog(groupId, payload) {
    const groups = loadGroups();
    const g = groups.find(x => x.id === groupId);
    if (!g) throw new Error("Group not found");

    const user = loadUser();

    // task
    let taskId = (payload.taskId || "").trim();
    let taskName = (payload.taskName || "").trim();

    if (!taskId && taskName) {
      const task = {
        id: uid("t"),
        name: taskName,
        createdAt: Date.now()
      };
      g.workItems.unshift(task);
      taskId = task.id;
      taskName = task.name;
    }

    if (taskId && !taskName) {
      const found = g.workItems.find(t => t.id === taskId);
      taskName = found ? found.name : "Task";
    }

    if (!taskId && !taskName) {
      throw new Error("No task selected or created");
    }

    const minutes = Number(payload.minutes || 0);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      throw new Error("Invalid minutes");
    }

    const log = {
      id: uid("log"),
      taskId: taskId || uid("t_fallback"),
      taskName: taskName || "Task",
      stars: Math.max(1, Math.min(5, Number(payload.stars || 3))),
      minutes,
      photoDataUrl: payload.photoDataUrl || "",
      memberId: user.id,
      memberName: user.username || "Guest",
      memberEmail: user.email || "",
      memberPhotoDataUrl: user.photoDataUrl || "",
      createdAt: Date.now()
    };

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

  // ---------- computed ----------
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

      const key = log.taskId || log.taskName || "task";
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

  // ---------- ui helper ----------
  function applyTopRightAvatar(el) {
    if (!el) return;
    const user = loadUser();

    el.classList.add("topIconAvatar");
    if (user.photoDataUrl) {
      el.innerHTML = `<img src="${user.photoDataUrl}" alt="">`;
    } else {
      el.innerHTML = "";
    }
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

    applyTopRightAvatar
  };
})();