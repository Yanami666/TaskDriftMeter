(function () {
    const btnBack = document.getElementById("btnBack");
    const btnProfile = document.getElementById("btnProfile");
  
    const bannerBox = document.getElementById("bannerBox");
    const bannerInput = document.getElementById("bannerInput");
  
    const groupName = document.getElementById("groupName");
    const groupDesc = document.getElementById("groupDesc");
  
    const memberInput = document.getElementById("memberInput");
    const btnAddMember = document.getElementById("btnAddMember");
    const chips = document.getElementById("chips");
  
    const btnCreateGroup = document.getElementById("btnCreateGroup");
    const msg = document.getElementById("msg");
  
    let invited = [];
    let bannerDataUrl = "";
  
    function compressImage(dataUrl) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const maxW = 900;
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
  
    function renderTopRight() {
      AppState.applyTopRightAvatar(btnProfile);
    }
  
    function renderChips() {
      chips.innerHTML = "";
      invited.forEach((item, idx) => {
        const chip = document.createElement("div");
        chip.className = "chip";
        chip.innerHTML = `
          <span>${item.email}</span>
          <button type="button" aria-label="remove">×</button>
        `;
        chip.querySelector("button").onclick = () => {
          invited.splice(idx, 1);
          renderChips();
        };
        chips.appendChild(chip);
      });
    }
  
    function addMemberFromInput() {
      const v = memberInput.value.trim();
      if (!v) return;
      if (invited.some(x => x.email.toLowerCase() === v.toLowerCase())) {
        msg.textContent = "Already added.";
        return;
      }
      invited.push({ email: v });
      memberInput.value = "";
      msg.textContent = "";
      renderChips();
    }
  
    bannerBox.onclick = () => bannerInput.click();
  
    bannerInput.onchange = () => {
      const file = bannerInput.files && bannerInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const raw = String(reader.result || "");
          bannerBox.innerHTML = `<img src="${raw}" alt="">`;
          bannerDataUrl = await compressImage(raw);
          msg.textContent = "";
        } catch (e) {
          console.error(e);
          msg.textContent = "Banner upload failed.";
        }
      };
      reader.readAsDataURL(file);
    };
  
    btnAddMember.onclick = addMemberFromInput;
    memberInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addMemberFromInput();
      }
    });
  
    btnCreateGroup.onclick = () => {
      msg.textContent = "";
      const name = groupName.value.trim();
      const desc = groupDesc.value.trim();
  
      if (!name) {
        msg.textContent = "Please enter group name.";
        return;
      }
  
      try {
        const g = AppState.createGroup({
          name,
          description: desc,
          bannerDataUrl,
          invited
        });
  
        AppState.setCurrentGroupId(g.id);
        location.href = "./dashboard.html";
      } catch (err) {
        console.error(err);
        msg.textContent = "Create failed. If localStorage quota is full, try a smaller image.";
      }
    };
  
    btnBack.onclick = () => (location.href = "./dashboard.html");
    btnProfile.onclick = () => (location.href = "./profile.html");
  
    renderTopRight();
  })();