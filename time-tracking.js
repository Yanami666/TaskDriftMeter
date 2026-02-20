(function () {
    const btnGroup = document.getElementById("btnGroup");
    const btnProfile = document.getElementById("btnProfile");
  
    const tabGroup = document.getElementById("tabGroup");
    const tabDash = document.getElementById("tabDash");
  
    const totalBig = document.getElementById("totalBig");
    const ringCanvas = document.getElementById("ringCanvas");
    const taskBox = document.getElementById("taskBox");
  
    let currentGroup = null;
  
    function loadGroupOrRedirect() {
      currentGroup = AppState.getCurrentGroup() || AppState.loadGroups()[0] || null;
      if (!currentGroup) {
        alert("Please create or join a group first.");
        location.href = "./dashboard.html";
        return false;
      }
      AppState.setCurrentGroupId(currentGroup.id);
      return true;
    }
  
    function renderTopRight() {
      AppState.applyTopRightAvatar(btnProfile);
    }
  
    function renderTotal() {
      const mins = AppState.getMyTotalMinutesInGroup(currentGroup.id);
      totalBig.textContent = AppState.formatMinutes(mins);
    }
  
    function drawRingAndTasks() {
      const list = AppState.getGroupTaskBreakdownForUser(currentGroup.id);
      const total = list.reduce((s, x) => s + x.minutes, 0);
  
      const ctx = ringCanvas.getContext("2d");
      const w = ringCanvas.width;
      const h = ringCanvas.height;
      ctx.clearRect(0, 0, w, h);
  
      const cx = w / 2;
      const cy = h / 2;
      const r = 34;
      const lineW = 12;
  
      // outer outline
      ctx.beginPath();
      ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
      ctx.strokeStyle = "#222";
      ctx.lineWidth = 1;
      ctx.stroke();
  
      // base ring
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = "#eee";
      ctx.lineWidth = lineW;
      ctx.stroke();
  
      const colors = ["#666", "#8f8f8f", "#b0b0b0", "#d0d0d0", "#999"];
  
      if (total > 0) {
        let start = -Math.PI / 2;
        list.forEach((item, i) => {
          const angle = (item.minutes / total) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(cx, cy, r, start, start + angle);
          ctx.strokeStyle = colors[i % colors.length];
          ctx.lineWidth = lineW;
          ctx.lineCap = "round";
          ctx.stroke();
          start += angle + 0.02;
        });
      }
  
      ctx.textAlign = "center";
      ctx.fillStyle = "#bbb";
      ctx.font = "700 9px system-ui";
      ctx.fillText("All Tasks", cx, cy - 2);
  
      ctx.fillStyle = "#111";
      ctx.font = "900 18px system-ui";
      ctx.fillText(total > 0 ? "100%" : "0%", cx, cy + 18);
  
      // task list
      taskBox.innerHTML = "";
  
      if (!list.length) {
        taskBox.innerHTML = `<div style="font-size:9px;color:#999;">No tasks logged yet.</div>`;
        return;
      }
  
      const max = Math.max(...list.map(x => x.minutes), 1);
  
      list.forEach(item => {
        const row = document.createElement("div");
        row.className = "taskRow";
  
        const isDone = (currentGroup.completedTaskIds || []).includes(item.taskId);
        const width = Math.max(15, (item.minutes / max) * 100);
  
        row.innerHTML = `
          <button class="check ${isDone ? "on" : ""}" type="button">${isDone ? "✓" : ""}</button>
          <div>
            <div class="taskTrack"><div class="taskFill" style="width:${width}%"></div></div>
            <div class="taskName">${item.taskName}</div>
          </div>
          <div class="minsText">${AppState.formatMinutes(item.minutes)}</div>
        `;
  
        row.querySelector(".check").onclick = () => {
          AppState.toggleTaskComplete(currentGroup.id, item.taskId);
          currentGroup = AppState.getCurrentGroup();
          drawRingAndTasks();
        };
  
        taskBox.appendChild(row);
      });
    }
  
    btnGroup.onclick = () => (location.href = "./group-view.html");
    btnProfile.onclick = () => (location.href = "./profile.html");
    tabGroup.onclick = () => (location.href = "./group-view.html");
    tabDash.onclick = () => (location.href = "./dashboard.html");
  
    try {
      renderTopRight();
      if (loadGroupOrRedirect()) {
        renderTotal();
        drawRingAndTasks();
      }
    } catch (err) {
      console.error("[time-tracking.js] crash:", err);
      alert("Time tracking crashed. Check Console.");
    }
  })();