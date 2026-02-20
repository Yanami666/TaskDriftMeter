(function () {
    const groupsWrap = document.getElementById("groupsWrap");
    const btnProfile = document.getElementById("btnProfile");
    const btnCreate = document.getElementById("btnCreate");
    const btnJoin = document.getElementById("btnJoin");
  
    const tabGroup = document.getElementById("tabGroup");
    const tabTime = document.getElementById("tabTime");
  
    function renderTopRight() {
      AppState.applyTopRightAvatar(btnProfile);
    }
  
    function memberDotHTML(m) {
      if (m.photoDataUrl) {
        return `<div class="memberDot"><img src="${m.photoDataUrl}" alt=""></div>`;
      }
      return `<div class="memberDot">${AppState.initials(m.name)}</div>`;
    }
  
    function renderGroups() {
      const groups = AppState.loadGroups();
      groupsWrap.innerHTML = "";
  
      if (!groups.length) {
        const empty = document.createElement("div");
        empty.className = "emptyMsg";
        empty.textContent = "No groups yet. Create or join one.";
        groupsWrap.appendChild(empty);
        return;
      }
  
      groups.forEach(g => {
        const card = document.createElement("div");
        card.className = "groupCard";
  
        const members = (g.members || []);
        const shown = members.slice(0, 3);
        const extra = Math.max(0, members.length - shown.length);
  
        const memberHTML = shown.map(memberDotHTML).join("") +
          (extra > 0 ? `<div class="memberDot">+${extra}</div>` : "");
  
        card.innerHTML = `
          <button class="cardPin" type="button" title="Copy Group Code"></button>
          <div class="lineA"></div>
          <div class="lineB"></div>
          <div class="memberRow">${memberHTML}</div>
          <div class="barRow">
            <div class="barX"><i style="width:72%"></i></div>
            <div class="barX"><i style="width:42%"></i></div>
          </div>
          <div class="cardMeta"><b style="color:#111;">${g.name}</b> · Code: ${g.id}</div>
        `;
  
        card.addEventListener("click", () => {
          AppState.setCurrentGroupId(g.id);
          location.href = "./group-view.html";
        });
  
        const pin = card.querySelector(".cardPin");
        pin.addEventListener("click", async (e) => {
          e.stopPropagation();
          try {
            await navigator.clipboard.writeText(g.id);
            pin.style.background = "#666";
            setTimeout(() => (pin.style.background = "#fff"), 250);
          } catch {}
        });
  
        groupsWrap.appendChild(card);
      });
    }
  
    function ensureGroupThenGo(target) {
      const g = AppState.getCurrentGroup() || AppState.loadGroups()[0];
      if (!g) {
        alert("Please create or join a group first.");
        return;
      }
      AppState.setCurrentGroupId(g.id);
      location.href = target;
    }
  
    function bindEvents() {
      btnProfile.onclick = () => (location.href = "./profile.html");
      btnCreate.onclick = () => (location.href = "./create-group.html");
      btnJoin.onclick = () => (location.href = "./join-group.html");
  
      tabGroup.onclick = () => ensureGroupThenGo("./group-view.html");
      tabTime.onclick = () => ensureGroupThenGo("./time-tracking.html");
    }
  
    try {
      bindEvents();
      renderTopRight();
      renderGroups();
    } catch (err) {
      console.error("[dashboard.js] crash:", err);
      document.body.innerHTML = `
        <div style="padding:20px;color:#b00020;font-family:system-ui">
          Dashboard crashed. Open Console and send the red error.<br/>
          Dashboard 报错了，请把 Console 红字发我。
        </div>
      `;
    }
  })();