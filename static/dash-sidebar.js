// static/dash-sidebar.js

/* =========================================
   THEME ENGINE (Universal Color Palettes)
   ========================================= */
   const THEME_PALETTES = {
    // 1. Baltic Blue (Your new default)
    "#6180A8": { primary: "#6180A8", secondary: "#506C91", light: "#E4EAF1", text: "#26364a" },
    // 2. Wisteria Purple
    "#936FAC": { primary: "#936FAC", secondary: "#73528A", light: "#F4F0F7", text: "#4A3B58" },
    // 3. Sage Green
    "#A1C65D": { primary: "#A1C65D", secondary: "#7A9B42", light: "#F2F8E8", text: "#3E521C" },
    // 4. Ocean Teal
    "#0CB2AF": { primary: "#0CB2AF", secondary: "#098280", light: "#E0F6F5", text: "#065A59" },
    // 5. Terracotta
    "#F29222": { primary: "#F29222", secondary: "#C46F11", light: "#FDF2E8", text: "#7A4308" },
    // 6. Blush Rose
    "#E95E50": { primary: "#E95E50", secondary: "#BD3C30", light: "#FDECED", text: "#7A241B" },
    // 7. Slate Grey
    "#ABABAB": { primary: "#ABABAB", secondary: "#71717A", light: "#F4F4F4", text: "#4B4B4B" }
};

function applyGlobalTheme(hex) {
    // Default to Baltic Blue if they haven't picked a color yet
    const theme = THEME_PALETTES[hex] || THEME_PALETTES["#6180A8"];
    const root = document.documentElement; // This targets the <html> tag

    // 1. Inject the Universal CSS Variables!
    root.style.setProperty('--theme-primary', theme.primary);
    root.style.setProperty('--theme-secondary', theme.secondary);
    root.style.setProperty('--theme-light', theme.light);
    root.style.setProperty('--theme-text', theme.text);

    // 2. Paint the Sidebar & Avatars using the new variables
    const sidebar = document.querySelector(".sidebar");
    if (sidebar) sidebar.style.background = `linear-gradient(180deg, var(--theme-primary) 0%, var(--theme-primary) 65%, var(--theme-secondary) 100%)`;

    const avatarDisplay = document.getElementById("userAvatarDisplay");
    if (avatarDisplay) {
        avatarDisplay.style.backgroundColor = "var(--theme-light)";
        avatarDisplay.style.color = "var(--theme-text)";
    }
}

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
// Helper function to keep our code clean
// Helper function to map primary colors to their gradient pairs
// Helper function to map primary colors to their gradient pairs
// Helper function to map primary colors to their gradient pairs (fading into the next shade)
function getSecondaryColor(primary) {
  const color = (primary || "").toUpperCase();
  const colorMap = {
      "#BDC9DB": "#A2B4CC", 
      "#A2B4CC": "#93A8C4", 
      "#93A8C4": "#7B95B7", 
      "#7B95B7": "#6E8AAF", 
      "#6E8AAF": "#6180A8", 
      "#6180A8": "#506C91", 
      "#506C91": "#BDC9DB"  // Loops the darkest blue back to the lightest
  };
  return colorMap[color] || "#6180A8"; // Default fallback
}

// Helper function to get the soft background and dark text colors
function getAvatarStyle(primary) {
  const color = (primary || "").toUpperCase();
  const styles = {
      "#BDC9DB": { bg: "#F7FBFF", text: "#6180A8" }, 
      "#A2B4CC": { bg: "#F7FBFF", text: "#506C91" }, 
      "#93A8C4": { bg: "#F7FBFF", text: "#425a7a" }, 
      "#7B95B7": { bg: "#E4EAF1", text: "#374b66" }, 
      "#6E8AAF": { bg: "#E4EAF1", text: "#2e4158" }, 
      "#6180A8": { bg: "#E4EAF1", text: "#26364a" }, 
      "#506C91": { bg: "#BDC9DB", text: "#1d2a3a" }  
  };
  return styles[color] || { bg: "#F7FBFF", text: "#506C91" };
}

// Helper function to keep our code clean
// Helper function to keep our code clean
function updateSidebarUI(profile) {
  document.getElementById("userNameDisplay").textContent = profile.full_name || "Guest";
  document.getElementById("userRoleDisplay").textContent = profile.display_role || "Viewer";
  
  // Update the Sidebar Avatar text
  const initials = (profile.full_name || "G").split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  const avatarDisplay = document.getElementById("userAvatarDisplay");
  if (avatarDisplay) avatarDisplay.textContent = initials;

  // Trigger the Theme Engine!
  applyGlobalTheme(profile.theme_color);
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
    
    // 2. Tell Supabase to kill the session
    // We have to build the Supabase client using your keys before we can call auth functions!
    if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
        const supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
        await supabaseClient.auth.signOut();
    }
    
    // 3. Redirect to login screen
    window.location.href = "/login";
}

/* =========================================
 ZONE 3: SIDEBAR UI (Mobile Toggle, Active Links, & Menus)
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
      
      // Wire up the logout button
      document.getElementById("btnLogOut")?.addEventListener("click", handleLogout);
      
      // Trigger the profile handshake!
      loadRealProfile(); 

      // --- NEW: POPUP MENU LOGIC ---
      const userMenuTrigger = document.getElementById("userMenuTrigger");
      const userSettingsMenu = document.getElementById("userSettingsMenu");

      if (userMenuTrigger && userSettingsMenu) {
          // 1. Toggle the menu when clicking your profile
          userMenuTrigger.addEventListener("click", (e) => {
              e.stopPropagation(); // Stops the click from immediately triggering the document listener below
              const isShowing = userSettingsMenu.style.display === "block";
              userSettingsMenu.style.display = isShowing ? "none" : "block";
              userMenuTrigger.style.background = isShowing ? "transparent" : "rgba(0,0,0,0.05)";
          });

          // 2. Close the menu if you click anywhere else on the screen
          document.addEventListener("click", (e) => {
              if (!userSettingsMenu.contains(e.target) && !userMenuTrigger.contains(e.target)) {
                  userSettingsMenu.style.display = "none";
                  userMenuTrigger.style.background = "transparent";
              }
          });
      }
  });

  window.addEventListener("addressBookUpdated", updateGlobalMissingBadge);
})();