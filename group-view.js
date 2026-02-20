(function () {
    const btnBack = document.getElementById("btnBack");
    const btnProfile = document.getElementById("btnProfile");
    const groupTitle = document.getElementById("groupTitle");
  
    const tabDash = document.getElementById("tabDash");
    const tabTime = document.getElementById("tabTime");
  
    const overviewCanvas = document.getElementById("overviewCanvas");
    const recentList = document.getElementById("recentList");
  
    const btnFab = document.getElementById("btnFab");
    const modalMask = document.getElementById("modalMask");
    const btnCloseModal = document.getElementById("btnCloseModal");
    const btnCancel = document.getElementById("btnCancel");
    const btnSubmit = document.getElementById("btnSubmit");
  
    const taskSelect = document.getElementById("taskSelect");
    const newTaskInput = document.getElementById("newTaskInput");
    const photoPick = document.getElementById("photoPick");
    const photoPreview = document.getElementById("photoPreview");
    const photoInput = document.getElementById("photoInput");
    const starsLine = document.getElementById("starsLine");
    const hoursInput = document.getElementById("hoursInput");
    const minsInput = document.getElementById("minsInput");
    const hintMsg = document.getElementById("hintMsg");
  
    let currentGroup = null;
    let starValue = 3;
    let photoDataUrl = "";
  
    function loadGroupOrRedirect() {
      currentGroup = AppState.getCurrentGroup() || AppState.loadGroups()[0] || null;
      if (!currentGroup) {
        alert("Please create or join a group first.");
        location.href = "./dashboard.html";
        return false;
      }
      AppState.setCurrentGroupId(currentGroup.id);
      groupTitle.textContent = currentGroup.name || "Group";
      return true;
    }
  
    function renderTopRight() {
      AppState.applyTopRightAvatar(btnProfile);
    }
  
    function renderTaskOptions() {
      taskSelect.innerHTML = '<option value="">Select</option>';
      (currentGroup.workItems || []).forEach(item => {
        const op = document.createElement("option");
        op.value = item.id;
        op.textContent = item.name;
        taskSelect.appendChild(op);
      });
    }
  
    function renderStars() {
      starsLine.innerHTML = "";
      for (let i = 1; i <= 5; i++) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "starBtn" + (i <= starValue ? " on" : "");
        b.textContent = "★";
        b.onclick = () => {
          starValue = i;
          renderStars();
        };
        starsLine.appendChild(b);
      }
    }
  
    function drawOverview() {
      const ctx = overviewCanvas.getContext("2d");
      const w = overviewCanvas.width;
      const h = overviewCanvas.height;
      ctx.clearRect(0, 0, w, h);
  
      const logs = currentGroup.workLogs || [];
      const map = new Map();
  
      logs.forEach(log => {
        const key = log.memberId || log.memberName || "M";
        if (!map.has(key)) {
          map.set(key, {
            memberName: log.memberName || "?",
            minutes: 0
          });
        }
        map.get(key).minutes += Number(log.minutes) || 0;
      });
  
      const arr = Array.from(map.values()).sort((a, b) => b.minutes - a.minutes).slice(0, 4);
      const total = arr.reduce((s, x) => s + x.minutes, 0);
  
      const cx = w / 2;
      const cy = h / 2;
      const r = 22;
      const lineW = 8;
      const colors = ["#F1D45D", "#69AEFF", "#FF7575", "#8FD38A"];
  
      if (!total) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = "#ddd";
        ctx.lineWidth = lineW;
        ctx.stroke();
        return;
      }
  
      let start = -Math.PI / 2;
      arr.forEach((item, i) => {
        const angle = (item.minutes / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, start, start + angle);
        ctx.strokeStyle = colors[i % colors.length];
        ctx.lineWidth = lineW;
        ctx.lineCap = "round";
        ctx.stroke();
        start += angle + 0.04;
      });
    }
  
    function renderRecent() {
      recentList.innerHTML = "";
      const logs = (currentGroup.workLogs || []).slice(0, 10);
  
      if (!logs.length) {
        recentList.innerHTML = `<div style="font-size:9px;color:#999;">No activity yet.</div>`;
        return;
      }
  
      const max = Math.max(...logs.map(l => Number(l.minutes) || 1), 1);
      const colors = ["#F1D45D", "#69AEFF", "#FF7575", "#8FD38A"];
  
      logs.forEach((log, idx) => {
        const row = document.createElement("div");
        row.className = "recentRow";
  
        const width = Math.max(15, ((Number(log.minutes) || 0) / max) * 100);
  
        let avatar = "";
        if (log.memberPhotoDataUrl) {
          avatar = `<div class="memberDot"><img src="${log.memberPhotoDataUrl}" alt=""></div>`;
        } else {
          avatar = `<div class="memberDot" style="background:${colors[idx % colors.length]}">${(log.memberName || "?").charAt(0).toUpperCase()}</div>`;
        }
  
        row.innerHTML = `
          ${avatar}
          <div>
            <div class="barTrack"><div class="barFill" style="width:${width}%"></div></div>
            <div class="barSub">${log.taskName || "Task"}</div>
          </div>
          <div class="minsText">${AppState.formatMinutes(log.minutes)}</div>
        `;
        recentList.appendChild(row);
      });
    }
  
    function openModal() {
      hintMsg.textContent = "";
      taskSelect.value = "";
      newTaskInput.value = "";
      hoursInput.value = "";
      minsInput.value = "";
      starValue = 3;
      photoDataUrl = "";
      photoPreview.textContent = "Add photo";
      renderStars();
      modalMask.style.display = "flex";
    }
  
    function closeModal() {
      modalMask.style.display = "none";
    }
  
    function compressImage(dataUrl) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const maxW = 700;
          let w = img.width;
          let h = img.height;
          if (w > maxW) {
            const ratio = maxW / w;
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          const c = document.createElement("canvas");
          c.width = w;
          c.height = h;
          const ctx = c.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL("image/jpeg", 0.72));
        };
        img.onerror = reject;
        img.src = dataUrl;
      });
    }
  
    photoPick.onclick = () => photoInput.click();
  
    photoInput.onchange = () => {
      const file = photoInput.files && photoInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const raw = String(reader.result || "");
          photoPreview.innerHTML = `<img src="${raw}" alt="">`;
          photoDataUrl = await compressImage(raw);
        } catch (e) {
          console.error(e);
          hintMsg.textContent = "Image failed.";
        }
      };
      reader.readAsDataURL(file);
    };
  
    btnSubmit.onclick = () => {
      hintMsg.textContent = "";
  
      const taskId = taskSelect.value;
      const newTask = newTaskInput.value.trim();
  
      const h = Number(hoursInput.value || 0);
      const m = Number(minsInput.value || 0);
      const totalMinutes = h * 60 + m;
  
      if (!taskId && !newTask) {
        hintMsg.textContent = "Select a task or add a task.";
        return;
      }
  
      if (totalMinutes <= 0) {
        hintMsg.textContent = "Please enter time.";
        return;
      }
  
      try {
        AppState.addWorkLog(currentGroup.id, {
          taskId: taskId || "",
          taskName: newTask,
          stars: starValue,
          minutes: totalMinutes,
          photoDataUrl
        });
  
        if (!loadGroupOrRedirect()) return;
        renderTaskOptions();
        drawOverview();
        renderRecent();
        closeModal();
      } catch (e) {
        console.error(e);
        hintMsg.textContent = "Save failed.";
      }
    };
  
    btnFab.onclick = openModal;
    btnCloseModal.onclick = closeModal;
    btnCancel.onclick = closeModal;
    modalMask.onclick = (e) => {
      if (e.target === modalMask) closeModal();
    };
  
    btnBack.onclick = () => (location.href = "./dashboard.html");
    btnProfile.onclick = () => (location.href = "./profile.html");
    tabDash.onclick = () => (location.href = "./dashboard.html");
    tabTime.onclick = () => {
      if (!currentGroup) return;
      AppState.setCurrentGroupId(currentGroup.id);
      location.href = "./time-tracking.html";
    };
  
    try {
      renderTopRight();
      if (loadGroupOrRedirect()) {
        renderTaskOptions();
        renderStars();
        drawOverview();
        renderRecent();
      }
    } catch (err) {
      console.error("[group-view.js] crash:", err);
      alert("Group view crashed. Check Console.");
    }
  })();