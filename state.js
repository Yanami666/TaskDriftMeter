// state.js
// Global app state helper for demo app (localStorage-based)

(function () {
  const STORAGE_KEYS = {
    user: "gwm_user",
    groups: "gwm_groups",
    currentGroupId: "gwm_current_group_id",
  };

  // =========================
  // Utilities
  // =========================
  function safeParse(json, fallback) {
    try {
      const v = JSON.parse(json);
      return v ?? fallback;
    } catch {
      return fallback;
    }
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function nowTs() {
    return Date.now();
  }

  function uid(prefix = "id") {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
  }

  // 6位邀请码（字母数字，大写）
  // 6-char invite code (uppercase alphanumeric)
  function generateGroupCode6() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 去掉易混淆字符
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  function isValidGroupCode6(code) {
    return typeof code === "string" && /^[A-Z0-9]{6}$/.test(code);
  }

  function normalizeCode(input) {
    return String(input || "").trim().toUpperCase();
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function formatMinutes(totalMinutes) {
    const m = Math.max(0, Math.floor(Number(totalMinutes) || 0));
    const h = Math.floor(m / 60);
    const mm = m % 60;
    if (h <= 0) return `${mm}m`;
    if (mm === 0) return `${h}h`;
    return `${h}h ${mm}m`;
  }

  function initials(name) {
    const txt = String(name || "").trim();
    if (!txt) return "?";
    const parts = txt.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  // =========================
  // Storage Read/Write
  // =========================
  function getUser() {
    const raw = localStorage.getItem(STORAGE_KEYS.user);
    const parsed = safeParse(raw, null);
    if (parsed && typeof parsed === "object") return parsed;

    // 默认演示用户
    // default demo user
    const demo = {
      id: uid("user"),
      username: "User",
      email: "",
      avatarDataUrl: "",
      createdAt: nowTs(),
    };
    setUser(demo);
    return demo;
  }

  function setUser(nextUser) {
    const prev = getUserUnsafe() || {};
    const merged = {
      id: nextUser?.id || prev.id || uid("user"),
      username: String(nextUser?.username ?? prev.username ?? "User"),
      email: String(nextUser?.email ?? prev.email ?? ""),
      avatarDataUrl: String(nextUser?.avatarDataUrl ?? prev.avatarDataUrl ?? ""),
      createdAt: prev.createdAt || nowTs(),
      updatedAt: nowTs(),
    };
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(merged));
    return merged;
  }

  function getUserUnsafe() {
    const raw = localStorage.getItem(STORAGE_KEYS.user);
    return safeParse(raw, null);
  }

  function getGroups() {
    const raw = localStorage.getItem(STORAGE_KEYS.groups);
    let list = safeParse(raw, []);

    if (!Array.isArray(list)) list = [];

    // 自动迁移旧 group 数据结构 + 旧 code 格式
    // auto-migrate old group shape + old code format
    let changed = false;
    const usedCodes = new Set();

    list = list.map((g, idx) => {
      const migrated = migrateGroupShape(g, idx);

      // 如果旧 code 不是 6 位，就换成 6 位（避免 GitHub 上继续看到旧格式）
      // If old code isn't 6-char, replace it with 6-char
      if (!isValidGroupCode6(migrated.code) || usedCodes.has(migrated.code)) {
        let newCode;
        do {
          newCode = generateGroupCode6();
        } while (usedCodes.has(newCode));
        migrated.code = newCode;
        changed = true;
      }

      usedCodes.add(migrated.code);
      if (JSON.stringify(migrated) !== JSON.stringify(g)) changed = true;
      return migrated;
    });

    if (changed) {
      localStorage.setItem(STORAGE_KEYS.groups, JSON.stringify(list));
    }

    return list;
  }

  function setGroups(nextGroups) {
    localStorage.setItem(STORAGE_KEYS.groups, JSON.stringify(nextGroups));
  }

  function getCurrentGroupId() {
    return localStorage.getItem(STORAGE_KEYS.currentGroupId) || "";
  }

  function setCurrentGroupId(id) {
    if (!id) {
      localStorage.removeItem(STORAGE_KEYS.currentGroupId);
      return;
    }
    localStorage.setItem(STORAGE_KEYS.currentGroupId, String(id));
  }

  function getCurrentGroup() {
    const id = getCurrentGroupId();
    if (!id) return null;
    return getGroups().find((g) => g.id === id) || null;
  }

  function setCurrentGroupById(id) {
    const g = getGroups().find((x) => x.id === id);
    if (!g) return false;
    setCurrentGroupId(g.id);
    return true;
  }

  // =========================
  // Migration / Group Shape
  // =========================
  function migrateGroupShape(g, idx = 0) {
    const user = getUser();

    const group = {
      id: String(g?.id || uid("group")),
      code: typeof g?.code === "string" ? normalizeCode(g.code) : "",
      name: String(g?.name || `Group ${idx + 1}`),
      description: String(g?.description || ""),
      bannerDataUrl: String(g?.bannerDataUrl || ""),
      createdByUserId: String(g?.createdByUserId || user.id),
      createdAt: Number(g?.createdAt || nowTs()),
      updatedAt: Number(g?.updatedAt || nowTs()),

      // member shape: { userId, username, avatarDataUrl, joinedAt }
      members: Array.isArray(g?.members) ? g.members.map((m) => ({
        userId: String(m?.userId || uid("user")),
        username: String(m?.username || "User"),
        avatarDataUrl: String(m?.avatarDataUrl || ""),
        joinedAt: Number(m?.joinedAt || nowTs()),
      })) : [],

      // tasks can be predefined from logs if missing
      // task shape: { id, name, createdAt }
      tasks: Array.isArray(g?.tasks) ? g.tasks.map((t) => ({
        id: String(t?.id || uid("task")),
        name: String(t?.name || "Task"),
        createdAt: Number(t?.createdAt || nowTs()),
      })) : [],

      // logs shape:
      // { id, taskId, taskName, description, difficulty, minutes, photoDataUrl, userId, userName, createdAt }
      logs: Array.isArray(g?.logs) ? g.logs.map((l) => ({
        id: String(l?.id || uid("log")),
        taskId: String(l?.taskId || uid("task")),
        taskName: String(l?.taskName || "Task"),
        description: String(l?.description || ""),
        difficulty: clampDifficulty(l?.difficulty),
        minutes: Math.max(0, Number(l?.minutes || 0)),
        photoDataUrl: String(l?.photoDataUrl || ""),
        userId: String(l?.userId || user.id),
        userName: String(l?.userName || user.username || "User"),
        createdAt: Number(l?.createdAt || nowTs()),
      })) : [],

      // time tracking completion UI
      completedTaskIds: Array.isArray(g?.completedTaskIds)
        ? g.completedTaskIds.map((x) => String(x))
        : [],

      // invite draft members in create page (optional, demo)
      invitedMembers: Array.isArray(g?.invitedMembers)
        ? g.invitedMembers.map((x) => String(x))
        : [],
    };

    // If no members, add current user as default member
    // 如果没有成员，默认把当前用户加进去
    if (group.members.length === 0) {
      group.members.push({
        userId: user.id,
        username: user.username || "User",
        avatarDataUrl: user.avatarDataUrl || "",
        joinedAt: nowTs(),
      });
    }

    // 补齐 tasks（从 logs 里抽取）
    // backfill tasks from logs
    const existingTaskNames = new Set(group.tasks.map((t) => t.name.trim().toLowerCase()));
    for (const log of group.logs) {
      const key = String(log.taskName || "").trim().toLowerCase();
      if (!key) continue;
      if (!existingTaskNames.has(key)) {
        group.tasks.push({
          id: log.taskId || uid("task"),
          name: log.taskName,
          createdAt: log.createdAt || nowTs(),
        });
        existingTaskNames.add(key);
      }
    }

    return group;
  }

  function clampDifficulty(v) {
    const n = Number(v || 1);
    if (Number.isNaN(n)) return 1;
    return Math.max(1, Math.min(5, Math.round(n)));
  }

  // =========================
  // User / Profile
  // =========================
  function updateProfile({ username, email, avatarDataUrl } = {}) {
    const user = getUser();
    const next = {
      ...user,
      username: username !== undefined ? String(username).trim() || user.username : user.username,
      email: email !== undefined ? String(email).trim() : user.email,
      avatarDataUrl: avatarDataUrl !== undefined ? String(avatarDataUrl) : user.avatarDataUrl,
    };
    const saved = setUser(next);

    // 同步更新所有 group 里当前 user 的显示信息
    // Sync current user's display info in all groups
    const groups = getGroups();
    let changed = false;
    for (const g of groups) {
      if (!Array.isArray(g.members)) continue;
      for (const m of g.members) {
        if (m.userId === saved.id) {
          m.username = saved.username;
          m.avatarDataUrl = saved.avatarDataUrl || "";
          changed = true;
        }
      }
      if (Array.isArray(g.logs)) {
        for (const l of g.logs) {
          if (l.userId === saved.id) {
            l.userName = saved.username;
            changed = true;
          }
        }
      }
    }
    if (changed) setGroups(groups);

    return saved;
  }

  function applyTopRightAvatar(btnEl) {
    if (!btnEl) return;
    const user = getUser();
    btnEl.innerHTML = "";
    if (user.avatarDataUrl) {
      const img = document.createElement("img");
      img.src = user.avatarDataUrl;
      img.alt = "avatar";
      btnEl.appendChild(img);
    } else {
      btnEl.textContent = "";
    }
  }

  // =========================
  // Auth Demo (fake sign-up/sign-in)
  // =========================
  function demoSignUp({ email, password, username } = {}) {
    // 演示版不做真实鉴权，只更新本地 user
    // Demo only: no real auth, just updates local user
    const user = getUser();
    return updateProfile({
      username: username || user.username || "User",
      email: email || user.email || "",
      avatarDataUrl: user.avatarDataUrl || "",
    });
  }

  function demoSignIn({ email } = {}) {
    const user = getUser();
    return updateProfile({
      username: user.username || "User",
      email: email || user.email || "",
      avatarDataUrl: user.avatarDataUrl || "",
    });
  }

  // =========================
  // Groups
  // =========================
  function createGroup({ name, description, bannerDataUrl, invitedMembers } = {}) {
    const user = getUser();
    const groups = getGroups();

    let code;
    const used = new Set(groups.map((g) => g.code));
    do {
      code = generateGroupCode6();
    } while (used.has(code));

    const group = migrateGroupShape({
      id: uid("group"),
      code, // ✅ always 6-char
      name: String(name || "").trim() || "Untitled Group",
      description: String(description || "").trim(),
      bannerDataUrl: String(bannerDataUrl || ""),
      createdByUserId: user.id,
      invitedMembers: Array.isArray(invitedMembers) ? invitedMembers : [],
      members: [{
        userId: user.id,
        username: user.username || "User",
        avatarDataUrl: user.avatarDataUrl || "",
        joinedAt: nowTs(),
      }],
      tasks: [],
      logs: [],
      completedTaskIds: [],
      createdAt: nowTs(),
      updatedAt: nowTs(),
    });

    groups.unshift(group);
    setGroups(groups);
    setCurrentGroupId(group.id);

    return clone(group);
  }

  function joinGroupByCode(codeInput, joinName = "") {
    const code = normalizeCode(codeInput);
    const groups = getGroups();
    const user = getUser();

    const group = groups.find((g) => normalizeCode(g.code) === code);
    if (!group) {
      return { ok: false, reason: "Group not found / code invalid" };
    }

    // 加入时允许临时显示名覆盖当前 user（如果提供）
    // Allow join page name to override current user display name (if provided)
    const finalName = String(joinName || "").trim() || user.username || "User";
    if (finalName !== user.username) {
      updateProfile({ username: finalName });
    }
    const latestUser = getUser();

    const exists = group.members.some((m) => m.userId === latestUser.id);
    if (!exists) {
      group.members.push({
        userId: latestUser.id,
        username: latestUser.username,
        avatarDataUrl: latestUser.avatarDataUrl || "",
        joinedAt: nowTs(),
      });
      group.updatedAt = nowTs();
      setGroups(groups);
    }

    setCurrentGroupId(group.id);
    return { ok: true, group: clone(group) };
  }

  function updateGroup(groupId, patch = {}) {
    const groups = getGroups();
    const idx = groups.findIndex((g) => g.id === groupId);
    if (idx < 0) return null;

    const g = groups[idx];
    if (patch.name !== undefined) g.name = String(patch.name).trim() || g.name;
    if (patch.description !== undefined) g.description = String(patch.description);
    if (patch.bannerDataUrl !== undefined) g.bannerDataUrl = String(patch.bannerDataUrl || "");
    if (patch.invitedMembers !== undefined && Array.isArray(patch.invitedMembers)) {
      g.invitedMembers = patch.invitedMembers.map((x) => String(x));
    }
    g.updatedAt = nowTs();

    groups[idx] = g;
    setGroups(groups);
    return clone(g);
  }

  function getGroupById(groupId) {
    return getGroups().find((g) => g.id === groupId) || null;
  }

  // =========================
  // Tasks / Logs
  // =========================
  function ensureTask(groupId, taskName) {
    const groups = getGroups();
    const idx = groups.findIndex((g) => g.id === groupId);
    if (idx < 0) return null;

    const g = groups[idx];
    const cleanName = String(taskName || "").trim();
    if (!cleanName) return null;

    const found = g.tasks.find((t) => t.name.trim().toLowerCase() === cleanName.toLowerCase());
    if (found) return found;

    const task = {
      id: uid("task"),
      name: cleanName,
      createdAt: nowTs(),
    };
    g.tasks.push(task);
    g.updatedAt = nowTs();
    setGroups(groups);
    return task;
  }

  function addWorkLog(groupId, payload = {}) {
    const groups = getGroups();
    const idx = groups.findIndex((g) => g.id === groupId);
    if (idx < 0) {
      return { ok: false, reason: "Group not found" };
    }

    const g = groups[idx];
    const user = getUser();

    let taskId = String(payload.taskId || "");
    let taskName = String(payload.taskName || "").trim();

    // Allow selecting existing or creating new task
    if (!taskName && taskId) {
      const t = g.tasks.find((x) => x.id === taskId);
      if (t) taskName = t.name;
    }
    if (!taskName) {
      return { ok: false, reason: "Task name required" };
    }

    let task = g.tasks.find((t) => t.name.trim().toLowerCase() === taskName.toLowerCase());
    if (!task) {
      task = { id: uid("task"), name: taskName, createdAt: nowTs() };
      g.tasks.push(task);
    }
    taskId = task.id;

    const hours = Math.max(0, Number(payload.hours || 0));
    const minutes = Math.max(0, Number(payload.minutes || 0));
    const totalMinutes = Math.round(hours * 60 + minutes);

    if (totalMinutes <= 0) {
      return { ok: false, reason: "Time must be greater than 0" };
    }

    const log = {
      id: uid("log"),
      taskId,
      taskName: task.name,
      description: String(payload.description || "").trim(),
      difficulty: clampDifficulty(payload.difficulty || 1),
      minutes: totalMinutes,
      photoDataUrl: String(payload.photoDataUrl || ""),
      userId: user.id,
      userName: user.username || "User",
      createdAt: nowTs(),
    };

    g.logs.push(log);
    g.updatedAt = nowTs();

    // 确保用户在成员里
    // Ensure user is in members
    if (!g.members.some((m) => m.userId === user.id)) {
      g.members.push({
        userId: user.id,
        username: user.username || "User",
        avatarDataUrl: user.avatarDataUrl || "",
        joinedAt: nowTs(),
      });
    }

    groups[idx] = g;
    setGroups(groups);
    return { ok: true, log: clone(log), group: clone(g) };
  }

  function getLogsForGroup(groupId) {
    const g = getGroupById(groupId);
    if (!g) return [];
    return [...(g.logs || [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  function getLogsForGroupByUser(groupId, userId) {
    return getLogsForGroup(groupId).filter((l) => l.userId === userId);
  }

  function getMyLogsInGroup(groupId) {
    const user = getUser();
    return getLogsForGroupByUser(groupId, user.id);
  }

  function getMyTotalMinutesInGroup(groupId) {
    return getMyLogsInGroup(groupId).reduce((sum, l) => sum + Number(l.minutes || 0), 0);
  }

  function getGroupTaskBreakdownForUser(groupId, userIdParam) {
    const userId = userIdParam || getUser().id;
    const logs = getLogsForGroupByUser(groupId, userId);

    const map = new Map();
    for (const l of logs) {
      const key = l.taskId || l.taskName;
      if (!map.has(key)) {
        map.set(key, {
          taskId: l.taskId || key,
          taskName: l.taskName || "Task",
          minutes: 0,
          count: 0,
        });
      }
      const item = map.get(key);
      item.minutes += Number(l.minutes || 0);
      item.count += 1;
    }

    return [...map.values()].sort((a, b) => b.minutes - a.minutes);
  }

  function getRecentActivityRowsForGroup(groupId, limit = 20) {
    // Group View用：默认显示当前组所有成员日志，最新在前
    // For Group View: show all members' logs in current group, newest first
    const g = getGroupById(groupId);
    if (!g) return [];

    const memberMap = new Map((g.members || []).map((m) => [m.userId, m]));
    const rows = (g.logs || [])
      .slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, limit)
      .map((log) => {
        const member = memberMap.get(log.userId);
        return {
          ...log,
          avatarDataUrl: member?.avatarDataUrl || "",
          displayName: member?.username || log.userName || "User",
        };
      });

    return rows;
  }

  // =========================
  // Completion / Tracking UI
  // =========================
  function toggleTaskComplete(groupId, taskId) {
    const groups = getGroups();
    const idx = groups.findIndex((g) => g.id === groupId);
    if (idx < 0) return false;

    const g = groups[idx];
    if (!Array.isArray(g.completedTaskIds)) g.completedTaskIds = [];

    const set = new Set(g.completedTaskIds.map(String));
    const key = String(taskId);
    if (set.has(key)) set.delete(key);
    else set.add(key);

    g.completedTaskIds = [...set];
    g.updatedAt = nowTs();
    setGroups(groups);
    return true;
  }

  // =========================
  // UI Helpers for page rendering
  // =========================
  function getDisplayMembersForCard(group, max = 4) {
    const members = Array.isArray(group?.members) ? group.members : [];
    return members.slice(0, max).map((m) => ({
      userId: m.userId,
      username: m.username || "User",
      avatarDataUrl: m.avatarDataUrl || "",
      initials: initials(m.username || "User"),
    }));
  }

  function getGroupPrimaryBanner(group) {
    return String(group?.bannerDataUrl || "");
  }

  // =========================
  // Demo reset (optional)
  // =========================
  function clearAllDemoData() {
    localStorage.removeItem(STORAGE_KEYS.user);
    localStorage.removeItem(STORAGE_KEYS.groups);
    localStorage.removeItem(STORAGE_KEYS.currentGroupId);
  }

  // =========================
  // Public API
  // =========================
  window.AppState = {
    // storage keys (optional debug)
    STORAGE_KEYS,

    // utilities
    uid,
    formatMinutes,
    initials,
    escapeHtml,
    normalizeCode,

    // user
    getUser,
    setUser,
    updateProfile,
    applyTopRightAvatar,

    // auth demo
    demoSignUp,
    demoSignIn,

    // groups
    getGroups,
    setGroups,
    getGroupById,
    getCurrentGroupId,
    setCurrentGroupId,
    getCurrentGroup,
    setCurrentGroupById,
    createGroup,
    joinGroupByCode,
    updateGroup,
    getDisplayMembersForCard,
    getGroupPrimaryBanner,

    // tasks/logs
    ensureTask,
    addWorkLog,
    getLogsForGroup,
    getMyLogsInGroup,
    getMyTotalMinutesInGroup,
    getGroupTaskBreakdownForUser,
    getRecentActivityRowsForGroup,

    // completion
    toggleTaskComplete,

    // reset
    clearAllDemoData,
  };

  // 初始化时触发一次迁移（非常关键）
  // Trigger migration once on load (very important)
  try {
    getGroups();
    getUser();
  } catch (e) {
    console.error("[state.js init] error:", e);
  }
})();