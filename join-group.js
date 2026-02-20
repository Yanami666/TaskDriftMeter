(function () {
    const btnBack = document.getElementById("btnBack");
    const btnProfile = document.getElementById("btnProfile");
    const groupCode = document.getElementById("groupCode");
    const displayName = document.getElementById("displayName");
    const btnJoinGroup = document.getElementById("btnJoinGroup");
    const msg = document.getElementById("msg");
  
    function renderTopRight() {
      AppState.applyTopRightAvatar(btnProfile);
    }
  
    btnBack.onclick = () => (location.href = "./dashboard.html");
    btnProfile.onclick = () => (location.href = "./profile.html");
  
    btnJoinGroup.onclick = () => {
      msg.textContent = "";
      const code = groupCode.value.trim();
      const name = displayName.value.trim();
  
      if (!code) {
        msg.textContent = "Please enter group code.";
        return;
      }
  
      try {
        const g = AppState.joinGroup({ code, displayName: name });
        AppState.setCurrentGroupId(g.id);
        location.href = "./dashboard.html";
      } catch (err) {
        console.error(err);
        msg.textContent = "Join failed. Check group code.";
      }
    };
  
    renderTopRight();
  })();