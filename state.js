// state.js
(() => {
    const LS_USER = "gwm_user";
    const LS_GROUPS = "gwm_groups";
  
    function uid6() {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let s = "";
      for (let i = 0; i < 6; i++) {
        s += chars[Math.floor(Math.random() * chars.length)];
      }
      return s;
    }
  
    function safeParse(value, fallback) {
      try {
        return JSON.parse(value);
      } catch (e) {
        return fallback;
      }
    }
  
    function initials(name) {
      const s = String(name || "").trim();
      return s ? s[0].toUpperCase() : "?";
    }
  
    // ---------- User ----------
    function loadUser() {
      const existing = safeParse(localStorage.getItem(LS_USER), null);
      if (existing && existing.userId) return existing;
  
      const user = {
        userId: uid6(),
        email: "",
        username: "Guest",
        photoDataUrl: "",
        lastAuthMode: "skip"
      };
      localStorage.setItem(LS_USER, JSON.stringify(user));
      return user;
    }
  
    function saveUser(patch = {}) {
      const current = loadUser();
      const next = { ...current, ...patch };
      localStorage.setItem(LS_USER, JSON.stringify(next));
      return next;
    }
  
    function updateUserNameEverywhere(newName) {
      const trimmed = String(newName || "").trim();
      const next = saveUser({ username: trimmed || "Guest" });
  
      const groups = loadGroups();
      let changed = false;
  
      groups.forEach(group => {
        group.members = (group.members || []).map(member => {
          if (member.memberId === next.userId) {
            changed = true;
            return { ...member, name: next.username };
          }
          return member;
        });
      });
  
      if (changed) saveGroups(groups);
      return next;
    }
  
    function updateUserPhotoEverywhere(photoDataUrl) {
      const next = saveUser({ photoDataUrl: photoDataUrl || "" });
  
      const groups = loadGroups();
      let changed = false;
  
      groups.forEach(group => {
        group.members = (group.members || []).map(member => {
          if (member.memberId === next.userId) {
            changed = true;
            return { ...member, photoDataUrl: next.photoDataUrl };
          }
          return member;
        });
      });
  
      if (changed) saveGroups(groups);
      return next;
    }
  
    // ---------- Groups ----------
    function loadGroups() {
      const groups = safeParse(localStorage.getItem(LS_GROUPS), []);
      return Array.isArray(groups) ? groups : [];
    }
  
    function saveGroups(groups) {
        try {
          localStorage.setItem(LS_GROUPS, JSON.stringify(groups || []));
        } catch (err) {
          // If quota exceeded, try stripping heavy banner images and save again
          if (err && (String(err.name).includes("QuotaExceeded") || String(err.message).includes("quota"))) {
            const lightweight = (groups || []).map(g => ({
              ...g,
              bannerDataUrl: "" // remove banner to keep core data
            }));
            localStorage.setItem(LS_GROUPS, JSON.stringify(lightweight));
            return { quotaRecovered: true };
          }
          throw err;
        }
        return { quotaRecovered: false };
      }
  
    function createGroup({ name, desc, bannerDataUrl, inviteTags } = {}) {
      const user = loadUser();
      const groups = loadGroups();
  
      const groupId = uid6();
  
      const members = [
        {
          memberId: user.userId,
          name: user.username || "Guest",
          photoDataUrl: user.photoDataUrl || "",
          joinedAt: Date.now()
        }
      ];
  
      (inviteTags || []).forEach((tag, idx) => {
        const label = String(tag || "").trim();
        if (!label) return;
        members.push({
          memberId: `INV_${groupId}_${idx}`,
          name: label,
          photoDataUrl: "",
          joinedAt: Date.now()
        });
      });
  
      const group = {
        id: groupId,
        name: String(name || "Untitled Group").trim(),
        desc: String(desc || "").trim(),
        bannerDataUrl: bannerDataUrl || "",
        members,
        createdAt: Date.now()
      };
  
      groups.unshift(group);
      saveGroups(groups);
      return group;
    }
  
    function joinGroup({ groupCode, nameOverride } = {}) {
      const user = loadUser();
      const groups = loadGroups();
  
      const code = String(groupCode || "")
        .replace(/\s+/g, "")
        .trim()
        .toUpperCase();
  
      const group = groups.find(g => g.id === code);
      if (!group) {
        return { ok: false, error: "Group not found." };
      }
  
      const finalName = String(nameOverride || user.username || "Guest").trim() || "Guest";
      const idx = (group.members || []).findIndex(m => m.memberId === user.userId);
  
      if (idx >= 0) {
        group.members[idx].name = finalName;
        group.members[idx].photoDataUrl = user.photoDataUrl || group.members[idx].photoDataUrl || "";
      } else {
        group.members.unshift({
          memberId: user.userId,
          name: finalName,
          photoDataUrl: user.photoDataUrl || "",
          joinedAt: Date.now()
        });
      }
  
      saveGroups(groups);
      return { ok: true, group };
    }
  
    // ---------- UI helper (top-right avatar square) ----------
    function applyTopRightAvatar(el) {
      if (!el) return;
      const user = loadUser();
  
      el.innerHTML = "";
      el.style.backgroundImage = "";
      el.style.backgroundColor = "#fff";
      el.style.backgroundSize = "cover";
      el.style.backgroundPosition = "center";
      el.style.backgroundRepeat = "no-repeat";
  
      if (user.photoDataUrl) {
        el.style.backgroundImage = `url("${user.photoDataUrl}")`;
      } else {
        const span = document.createElement("span");
        span.textContent = initials(user.username);
        el.appendChild(span);
      }
    }
  
    // backward-compatible alias (你之前有的旧名字)
    // backward-compatible alias (old helper name you used earlier)
    function applyTopIcon(el) {
      applyTopRightAvatar(el);
    }
  
    window.AppState = {
      initials,
      loadUser,
      saveUser,
      updateUserNameEverywhere,
      updateUserPhotoEverywhere,
      loadGroups,
      saveGroups,
      createGroup,
      joinGroup,
      applyTopRightAvatar,
      applyTopIcon
    };
  })();