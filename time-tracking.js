(function () {
    const App = window.AppState;
    if (!App) return;
  
    const group = App.getCurrentGroup();
    if (!group) {
      location.href = "./dashboard.html";
      return;
    }
  
    const $ = (sel) => document.querySelector(sel);
  
    const topLeftBtn = $("#topLeftBtn");
    const topRightBtn = $("#topRightBtn");
    const totalTimeValue = $("#totalTimeValue");
    const donutChart = $("#donutChart");
    const taskList = $("#taskList");
  
    const navGroupView = $("#navGroupView");
    const navDashboard = $("#navDashboard");
    const navTime = $("#navTime");
  
    // 与 group-view 一样的颜色逻辑（更清晰）
    // Same color logic as group-view (clearer colors)
    const COLORS = ["#F0D35B", "#66AEEF", "#F46D6D", "#8FD38F", "#B9A3FF", "#F5A25D"];
  
    init();
  
    function init() {
      if (topRightBtn) {
        App.applyTopRightAvatar(topRightBtn);
        topRightBtn.addEventListener("click", () => {
          location.href = "./profile.html";
        });
      }
  
      if (topLeftBtn) {
        topLeftBtn.addEventListener("click", () => {
          location.href = "./group-view.html";
        });
      }
  
      navGroupView?.addEventListener("click", () => location.href = "./group-view.html");
      navDashboard?.addEventListener("click", () => location.href = "./dashboard.html");
      navTime?.addEventListener("click", () => {});
  
      render();
    }
  
    function render() {
      const groupId = group.id;
      const totalMinutes = App.getMyTotalMinutesInGroup(groupId);
      const breakdown = App.getGroupTaskBreakdownForUser(groupId); // [{taskId, taskName, minutes}]
  
      if (totalTimeValue) {
        totalTimeValue.textContent = App.formatMinutes(totalMinutes);
      }
  
      renderDonut(breakdown);
      renderTaskList(groupId, breakdown, totalMinutes);
    }
  
    function renderDonut(breakdown) {
      if (!donutChart) return;
  
      const total = breakdown.reduce((sum, x) => sum + Number(x.minutes || 0), 0);
  
      if (!total || breakdown.length === 0) {
        donutChart.style.background = "conic-gradient(#e5e5e5 0deg 360deg)";
        return;
      }
  
      let start = 0;
      const segments = breakdown.map((item, i) => {
        const ratio = (item.minutes || 0) / total;
        const end = start + ratio;
        const seg = `${COLORS[i % COLORS.length]} ${start * 360}deg ${end * 360}deg`;
        start = end;
        return seg;
      });
  
      donutChart.style.background = `conic-gradient(${segments.join(", ")})`;
    }
  
    function renderTaskList(groupId, breakdown, totalMinutes) {
      if (!taskList) return;
  
      if (!breakdown.length) {
        taskList.innerHTML = `<div class="emptyText">No logged work yet</div>`;
        return;
      }
  
      const completedSet = new Set(group.completedTaskIds || []);
  
      taskList.innerHTML = breakdown.map((item, i) => {
        const pct = totalMinutes > 0 ? Math.round((item.minutes / totalMinutes) * 100) : 0;
        const checked = completedSet.has(item.taskId);
        const color = COLORS[i % COLORS.length];
  
        return `
          <div class="taskRow" data-task-id="${escapeHtml(item.taskId)}">
            <div class="taskRowTop">
              <button class="taskCheck ${checked ? "checked" : ""}" aria-label="toggle complete"></button>
              <div class="taskName">${escapeHtml(item.taskName)}</div>
              <div class="taskTime">${escapeHtml(App.formatMinutes(item.minutes))}</div>
            </div>
            <div class="taskBarTrack">
              <div class="taskBarFill" style="width:${pct}%; background:${color};"></div>
            </div>
          </div>
        `;
      }).join("");
  
      taskList.querySelectorAll(".taskRow").forEach(row => {
        const taskId = row.getAttribute("data-task-id");
        const btn = row.querySelector(".taskCheck");
        btn?.addEventListener("click", () => {
          App.toggleTaskComplete(groupId, taskId);
          // 重新取最新 group 状态再渲染
          const latest = App.getCurrentGroup();
          if (latest) {
            group.completedTaskIds = latest.completedTaskIds || [];
          }
          render();
        });
      });
    }
  
    function escapeHtml(str) {
      return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    }
  })();