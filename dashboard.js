// dashboard.js
// Dashboard page logic (My Groups)

(function () {
    const $ = (sel) => document.querySelector(sel);
  
    function safeText(v) {
      return String(v ?? "");
    }
  
    function getEls() {
      return {
        // top
        topRightBtn: $("#topRightBtn"),
        titleEl: $("#dashboardTitle"),
  
        // groups list
        groupList: $("#groupList"),
        emptyHint: $("#emptyHint"),
  
        // main buttons
        createBtn: $("#createGroupBtn"),
        joinBtn: $("#joinGroupBtn"),
  
        // bottom nav
        navLeft: $("#navLeftBtn"),   // Group View
        navCenter: $("#navCenterBtn"), // Dashboard
        navRight: $("#navRightBtn"), // Time Tracking
  
        // debug/crash
        crashText: $("#dashboardCrashText"),
      };
    }
  
    function ensureStructure() {
      const els = getEls();
  
      // 如果你的 html 里没有这些容器，这里会直接报错提示
      // If these containers are missing in HTML, show a clear message
      if (!els.groupList || !els.createBtn || !els.joinBtn) {
        throw new Error(
          "Dashboard DOM missing. Need #groupList, #createGroupBtn, #joinGroupBtn"
        );
      }
    }
  
    function renderTopRightAvatar() {
      const { topRightBtn } = getEls();
      if (!topRightBtn) return;
      if (window.AppState?.applyTopRightAvatar) {
        window.AppState.applyTopRightAvatar(topRightBtn);
      }
    }
  
    function memberDotHtml(member) {
      // member: { username, avatarDataUrl, initials }
      if (member.avatarDataUrl) {
        return `
          <div class="mini-member avatar" title="${window.AppState.escapeHtml(member.username)}">
            <img src="${member.avatarDataUrl}" alt="${window.AppState.escapeHtml(member.username)}" />
          </div>
        `;
      }
      return `
        <div class="mini-member" title="${window.AppState.escapeHtml(member.username)}">
          ${window.AppState.escapeHtml(member.initials || "?")}
        </div>
      `;
    }
  
    function buildGroupCard(group) {
      const members = window.AppState.getDisplayMembersForCard(group, 4) || [];
      const extraCount = Math.max(0, (group.members?.length || 0) - 4);
  
      const banner = window.AppState.getGroupPrimaryBanner(group);
      const memberRowHtml = `
        <div class="group-card-members">
          ${
            members.length
              ? members.map(memberDotHtml).join("")
              : `<div class="mini-member">?</div>`
          }
          ${extraCount > 0 ? `<div class="mini-member">+${extraCount}</div>` : ""}
        </div>
      `;
  
      const card = document.createElement("div");
      card.className = "group-card";
      card.dataset.groupId = group.id;
  
      // 按你的低保真样式：顶部灰条 / 头像行 / banner背景长条 / 名字与code
      // Matching your low-fi style: top gray bars / avatar row / banner strip / name & code
      card.innerHTML = `
        <div class="group-card-inner">
          <button class="group-card-enter" type="button" aria-label="Open group"></button>
  
          <div class="skeleton-line w-lg"></div>
          <div class="skeleton-line w-sm"></div>
  
          ${memberRowHtml}
  
          <div class="group-banner-strip ${banner ? "has-image" : ""}">
            ${
              banner
                ? `<img src="${banner}" alt="Group banner" />`
                : `<div class="banner-placeholder"></div>`
            }
          </div>
  
          <div class="group-card-meta">
            <div class="group-name">${window.AppState.escapeHtml(safeText(group.name || "Untitled Group"))}</div>
            <div class="group-code">Code: ${window.AppState.escapeHtml(safeText(group.code || "------"))}</div>
          </div>
        </div>
      `;
  
      // 点击整个卡片也可以进 group（更顺手）
      // Clicking the whole card also opens the group (more convenient)
      card.addEventListener("click", (e) => {
        const enterBtn = e.target.closest(".group-card-enter");
        // 不管点哪都进，只是保留按钮语义
        // Open regardless of click target; keep button semantics
        openGroup(group.id);
      });
  
      return card;
    }
  
    function renderGroups() {
      const els = getEls();
      const groups = window.AppState.getGroups();
  
      els.groupList.innerHTML = "";
  
      if (!groups.length) {
        if (els.emptyHint) {
          els.emptyHint.style.display = "block";
          els.emptyHint.textContent = "No groups yet. Create one or join with a code.";
        }
        return;
      }
  
      if (els.emptyHint) els.emptyHint.style.display = "none";
  
      groups.forEach((g) => {
        const card = buildGroupCard(g);
        els.groupList.appendChild(card);
      });
    }
  
    function openGroup(groupId) {
      const ok = window.AppState.setCurrentGroupById(groupId);
      if (!ok) return;
      location.href = "./group-view.html";
    }
  
    function goCreate() {
      location.href = "./create-group.html";
    }
  
    function goJoin() {
      location.href = "./join-group.html";
    }
  
    function goProfile() {
      location.href = "./profile.html";
    }
  
    function goGroupViewFromNav() {
      const current = window.AppState.getCurrentGroup();
      if (current) {
        location.href = "./group-view.html";
        return;
      }
  
      // 没有 current group 就默认跳第一组
      // If no current group, try the first group
      const groups = window.AppState.getGroups();
      if (groups.length > 0) {
        window.AppState.setCurrentGroupId(groups[0].id);
        location.href = "./group-view.html";
        return;
      }
  
      // 没有任何组就去创建
      // If no groups exist, go create one
      location.href = "./create-group.html";
    }
  
    function goTimeTrackingFromNav() {
      const current = window.AppState.getCurrentGroup();
      if (current) {
        location.href = "./time-tracking.html";
        return;
      }
  
      const groups = window.AppState.getGroups();
      if (groups.length > 0) {
        window.AppState.setCurrentGroupId(groups[0].id);
        location.href = "./time-tracking.html";
        return;
      }
  
      location.href = "./create-group.html";
    }
  
    function wireEvents() {
      const els = getEls();
  
      els.createBtn?.addEventListener("click", goCreate);
      els.joinBtn?.addEventListener("click", goJoin);
      els.topRightBtn?.addEventListener("click", goProfile);
  
      els.navLeft?.addEventListener("click", goGroupViewFromNav);
      els.navCenter?.addEventListener("click", () => {
        // 当前页，无操作
        // current page, do nothing
      });
      els.navRight?.addEventListener("click", goTimeTrackingFromNav);
  
      // profile 页返回后头像可能更新，页面重新获得焦点时刷新一下
      // refresh avatar when page regains focus after profile update
      window.addEventListener("focus", () => {
        try {
          renderTopRightAvatar();
          renderGroups();
        } catch (e) {
          console.error("[dashboard focus refresh error]", e);
        }
      });
    }
  
    function markBottomNavActive() {
      const { navLeft, navCenter, navRight } = getEls();
      navLeft?.classList.remove("active");
      navCenter?.classList.add("active");
      navRight?.classList.remove("active");
    }
  
    function init() {
      const els = getEls();
  
      try {
        if (!window.AppState) {
          throw new Error("AppState is not loaded. Check <script src='./state.js'> path.");
        }
  
        ensureStructure();
  
        // 顶部标题
        // top title
        if (els.titleEl) {
          els.titleEl.textContent = "My Groups";
        }
  
        renderTopRightAvatar();
        renderGroups();
        wireEvents();
        markBottomNavActive();
  
        // 清理错误文案（如果你页面里有）
        // clear crash text if present
        if (els.crashText) {
          els.crashText.textContent = "";
          els.crashText.style.display = "none";
        }
      } catch (err) {
        console.error("[dashboard.js] crash:", err);
        if (els.crashText) {
          els.crashText.style.display = "block";
          els.crashText.innerHTML =
            "Dashboard crashed. Open Console and send the red error.<br>Dashboard 报错了，请把 Console 红字发我。";
        } else {
          // 最低限度 fallback
          // minimal fallback
          document.body.innerHTML = `
            <div style="padding:20px;color:#b00020;font-family:sans-serif;">
              Dashboard crashed. Open Console and send the red error.<br/>
              Dashboard 报错了，请把 Console 红字发我。
            </div>
          `;
        }
      }
    }
  
    document.addEventListener("DOMContentLoaded", init);
  })();