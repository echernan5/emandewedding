// static/dash-sidebar.js

/* =========================================
   ZONE 1: USER STATE (placeholder for now)
   -----------------------------------------
   This will later be fed by real login/auth.
   For now, it just displays a single user.
   ========================================= */

   window.AppUser = {
    // Later: replace these with real values from your session/auth
    getName: () => "Emma Hernandez",
    getInitials: () => "EH",
    getRoleLabel: () => "Bride", // optional subtitle
  };

  async function waitForAuth() {
    for (let i = 0; i < 50; i++) { // ~5 seconds
      if (window.AppAuth?.token) return window.AppAuth.token;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error("Auth not ready (AppAuth.token missing)");
  }
  
  /* =========================================
     ZONE 2: SIDEBAR UI
     ========================================= */
  
  (() => {
    // Highlight active link
    const path = (location.pathname.split("/").pop() || "").toLowerCase();
    document.querySelectorAll(".sideNav a").forEach((a) => {
      const route = (a.getAttribute("data-route") || a.getAttribute("href") || "")
        .replace("/", "")
        .toLowerCase();
      const isActive = route === path || (path === "" && route === "dashboard");
      if (isActive) a.classList.add("active");
    });
  
    // Mobile sidebar toggle
    const sidebar = document.querySelector(".sidebar");
    const overlay = document.querySelector(".mobileOverlay");
    const openBtn = document.querySelector("[data-open-sidebar]");
    const closeBtns = document.querySelectorAll("[data-close-sidebar]");
  
    function open() {
      if (!sidebar || !overlay) return;
      sidebar.classList.add("open");
      overlay.classList.add("open");
    }
    function close() {
      if (!sidebar || !overlay) return;
      sidebar.classList.remove("open");
      overlay.classList.remove("open");
    }
  
    openBtn?.addEventListener("click", open);
    overlay?.addEventListener("click", close);
    closeBtns.forEach((b) => b.addEventListener("click", close));
  
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  
    // --- BADGE LOGIC ---
    async function updateGlobalMissingBadge() {
      const badge = document.querySelector("#missingAddrBadge");
      if (!badge) return;
    
      try {
        const token = await waitForAuth();
        const res = await fetch("/api/address-book", {
          headers: { Authorization: `Bearer ${token}` },
        });
    
        if (!res.ok) return;           // 👈 important
        const rows = await res.json();  // 👈 this was missing
    
        const missingCount = rows.filter((r) => {
          const street = String(r.address_street ?? "").trim();
          const city = String(r.address_city ?? "").trim();
          const state = String(r.address_state ?? "").trim();
          const zip = String(r.address_zip ?? "").trim();
          return !(street && city && state && zip);
        }).length;
    
        if (missingCount > 0) {
          badge.textContent = `${missingCount} missing`;
          badge.style.display = "inline-flex";
        } else {
          badge.style.display = "none";
        }
      } catch (err) {
        console.error("Failed to update sidebar badge:", err);
      }
    }
  
    /* =========================================
       ZONE 3: USER CHIP DISPLAY (no switching)
       ========================================= */
  
    function renderUserChip() {
      const displayAvatar = document.getElementById("userAvatarDisplay");
      const displayName = document.getElementById("userNameDisplay");
      const displayRole = document.getElementById("userRoleDisplay");
  
      if (displayAvatar) displayAvatar.textContent = window.AppUser.getInitials?.() || "??";
      if (displayName) displayName.textContent = window.AppUser.getName?.() || "User";
      if (displayRole) displayRole.textContent = window.AppUser.getRoleLabel?.() || "";
    }
  
    document.addEventListener("DOMContentLoaded", () => {
      renderUserChip();
      updateGlobalMissingBadge();
    });
  
    window.addEventListener("addressBookUpdated", updateGlobalMissingBadge);
  })();

  /* =========================================
     ZONE 4: ROLE SWITCHER (NEW)
     ========================================= */
     document.addEventListener("DOMContentLoaded", () => {
      const trigger = document.getElementById("userMenuTrigger");
      const menu = document.getElementById("userRoleMenu");

      if (trigger && menu) {
          // Toggle menu on click
          trigger.addEventListener("click", (e) => {
              e.stopPropagation(); // Stop click from immediately closing menu
              menu.style.display = menu.style.display === "none" || !menu.style.display ? "block" : "none";
          });

          // Close menu when clicking outside
          document.addEventListener("click", () => {
              menu.style.display = "none";
          });

          // Handle Role Selection
          document.querySelectorAll(".roleMenuItem").forEach(btn => {
              btn.addEventListener("click", (e) => {
                  const newRole = e.currentTarget.dataset.role;
                  
                  // Save to local storage
                  localStorage.setItem("user_role_key", newRole);
                  
                  // Update the UI label immediately
                  const roleName = e.currentTarget.querySelector(".roleLabel").textContent.split(' ')[0];
                  document.getElementById("userRoleDisplay").textContent = roleName;
                  
                  // Tell the rest of the app the role changed
                  window.dispatchEvent(new CustomEvent("roleChanged", { detail: { role: newRole } }));
              });
          });
      }
  });
  