// static/dash-sidebar.js

async function waitForAuth() {
  for (let i = 0; i < 50; i++) { 
      if (window.AppAuth?.token) return window.AppAuth.token;
      await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Auth not ready (AppAuth.token missing)");
}

/* =========================================
 ZONE 1: THE REAL PROFILE HANDSHAKE
 ========================================= */
// Helper function to keep our code clean
function updateSidebarUI(profile) {
    document.getElementById("userNameDisplay").textContent = profile.full_name || "Guest";
    document.getElementById("userRoleDisplay").textContent = profile.display_role || "Viewer";
    const initials = (profile.full_name || "G").split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    document.getElementById("userAvatarDisplay").textContent = initials;
}

async function loadRealProfile() {
    // --- 1. INSTANT UI UPDATE (The Anti-Flash Trick) ---
    // Look in the browser's backpack for saved profile data
    const cachedProfile = localStorage.getItem("cached_user_profile");
    if (cachedProfile) {
        try {
            updateSidebarUI(JSON.parse(cachedProfile));
        } catch (e) {} // Ignore if the data got corrupted
    }

    // --- 2. BACKGROUND VERIFICATION ---
    try {
        const token = await waitForAuth();
        
        // Silently verify with the server
        const res = await fetch("/api/me", {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!res.ok) {
            handleLogout(); // If token expired while they were navigating, kick them out
            return;
        }

        const data = await res.json();
        const profile = data.profile; 

        // Update the cache so it's ready for the next page click!
        localStorage.setItem("cached_user_profile", JSON.stringify(profile));
        localStorage.setItem("user_role_key", profile.role);

        // Update the UI just in case they changed their name/role since the cache was saved
        updateSidebarUI(profile);
        window.dispatchEvent(new Event("roleChanged")); 

    } catch (e) {
        console.error("Profile load failed:", e);
    }
}

/* =========================================
 ZONE 2: LOG OUT LOGIC
 ========================================= */
async function handleLogout() {
    // 1. Wipe local browser memory (including our new cache)
    localStorage.removeItem("user_role_key");
    localStorage.removeItem("supabase.auth.token"); 
    localStorage.removeItem("cached_user_profile"); 
    
    // 2. Tell Supabase to kill the session (THE FIX)
    // We have to build the Supabase client using your keys before we can call auth functions!
    if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
        const supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
        await supabaseClient.auth.signOut();
    }
    
    // 3. Redirect to login screen
    window.location.href = "/login";
}

/* =========================================
 ZONE 3: SIDEBAR UI (Mobile Toggle & Active Links)
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

  // Run missing address badge logic
  async function updateGlobalMissingBadge() {
      const badge = document.querySelector("#missingAddrBadge");
      if (!badge) return;
      try {
          const token = await waitForAuth();
          const res = await fetch("/api/address-book", { headers: { Authorization: `Bearer ${token}` } });
          if (!res.ok) return;           
          const rows = await res.json();  
          const missingCount = rows.filter((r) => {
              return !(String(r.address_street ?? "").trim() && String(r.address_city ?? "").trim() && String(r.address_state ?? "").trim() && String(r.address_zip ?? "").trim());
          }).length;
          if (missingCount > 0) {
              badge.textContent = `${missingCount} missing`;
              badge.style.display = "inline-flex";
          } else {
              badge.style.display = "none";
          }
      } catch (err) { console.error(err); }
  }

  document.addEventListener("DOMContentLoaded", () => {
      updateGlobalMissingBadge();
      document.getElementById("btnLogOut")?.addEventListener("click", handleLogout);
      loadRealProfile(); // Trigger the handshake!
  });

  window.addEventListener("addressBookUpdated", updateGlobalMissingBadge);
})();