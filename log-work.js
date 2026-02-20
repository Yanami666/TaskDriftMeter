(function () {
    const App = window.AppState;
    if (!App) return;
  
    const group = App.getCurrentGroup();
    if (!group) {
      location.href = "./dashboard.html";
      return;
    }
  
    const $ = (sel) => document.querySelector(sel);
  
    const taskSelect = $("#taskSelect");
    const newTaskInput = $("#newTaskInput");
    const descInput = $("#descInput");
    const fileInput = $("#fileInput");
    const cameraInput = $("#cameraInput");
    const uploadBtn = $("#uploadBtn");
    const cameraBtn = $("#cameraBtn");
    const photoPreview = $("#photoPreview");
    const starRow = $("#starRow");
    const hoursInput = $("#hoursInput");
    const minutesInput = $("#minutesInput");
    const submitBtn = $("#submitBtn");
    const cancelBtn = $("#cancelBtn");
    const closeBtn = $("#closeBtn");
    const hint = $("#hint");
  
    let photoDataUrl = "";
    let stars = 3;
  
    init();
  
    function init() {
      renderTaskOptions();
      renderStars();
  
      uploadBtn?.addEventListener("click", () => fileInput?.click());
      cameraBtn?.addEventListener("click", () => cameraInput?.click());
  
      fileInput?.addEventListener("change", onImageSelected);
      cameraInput?.addEventListener("change", onImageSelected);
  
      starRow?.addEventListener("click", (e) => {
        const target = e.target.closest(".star");
        if (!target) return;
        stars = Number(target.dataset.v || 3);
        renderStars();
      });
  
      submitBtn?.addEventListener("click", handleSubmit);
      cancelBtn?.addEventListener("click", () => location.href = "./group-view.html");
      closeBtn?.addEventListener("click", () => location.href = "./group-view.html");
    }
  
    function renderTaskOptions() {
      if (!taskSelect) return;
  
      const items = Array.isArray(group.workItems) ? group.workItems : [];
      taskSelect.innerHTML = `<option value="">Select</option>`;
  
      items.forEach(t => {
        const op = document.createElement("option");
        op.value = t.id;
        op.textContent = t.name;
        taskSelect.appendChild(op);
      });
    }
  
    function renderStars() {
      if (!starRow) return;
      starRow.querySelectorAll(".star").forEach((el) => {
        const v = Number(el.dataset.v);
        el.classList.toggle("active", v <= stars);
      });
    }
  
    function onImageSelected(e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
  
      const reader = new FileReader();
      reader.onload = () => {
        photoDataUrl = String(reader.result || "");
  
        // 压一压图，避免 localStorage 超限
        // Compress image a bit to avoid localStorage quota issues
        compressImage(photoDataUrl, 900, 0.78).then((compressed) => {
          photoDataUrl = compressed;
          renderPhotoPreview();
        }).catch(() => {
          renderPhotoPreview();
        });
      };
      reader.readAsDataURL(file);
  
      // reset value so same file can be picked again
      e.target.value = "";
    }
  
    function renderPhotoPreview() {
      if (!photoPreview) return;
      if (!photoDataUrl) {
        photoPreview.textContent = "No photo";
        return;
      }
      photoPreview.innerHTML = `<img src="${photoDataUrl}" alt="photo">`;
    }
  
    async function handleSubmit() {
      if (!hint) return;
      hint.textContent = "";
  
      const selectedTaskId = String(taskSelect?.value || "").trim();
      const newTaskName = String(newTaskInput?.value || "").trim();
      const description = String(descInput?.value || "").trim();
  
      const h = Number(hoursInput?.value || 0);
      const m = Number(minutesInput?.value || 0);
      const totalMinutes = (Math.max(0, h) * 60) + Math.max(0, m);
  
      if (!selectedTaskId && !newTaskName) {
        hint.textContent = "Please select a task or add a new task.";
        return;
      }
  
      if (totalMinutes <= 0) {
        hint.textContent = "Please enter a valid time.";
        return;
      }
  
      try {
        App.addWorkLog(group.id, {
          taskId: selectedTaskId,
          taskName: newTaskName,
          stars,
          minutes: totalMinutes,
          photoDataUrl,
          description
        });
  
        location.href = "./group-view.html";
      } catch (err) {
        console.error(err);
        hint.textContent = "Save failed. Try a smaller image or shorter text.";
      }
    }
  
    function compressImage(dataUrl, maxSide = 900, quality = 0.8) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          const scale = Math.min(1, maxSide / Math.max(width, height));
          width = Math.round(width * scale);
          height = Math.round(height * scale);
  
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
  
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = reject;
        img.src = dataUrl;
      });
    }
  })();