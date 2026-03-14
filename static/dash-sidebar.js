// static/dash-sidebar.js

/* =========================================
   THEME ENGINE (7-Step Custom Properties)
   ========================================= */
const THEME_PALETTES = {
    // 1. Dusty Blue (Richer, less gray)
    "#668BC2": {
        s100: "#F2F6FA", s200: "#E1ECF7", s300: "#BDD4EB",
        s400: "#98BADD", s500: "#668BC2", s600: "#4A6C9E", s700: "#314D75"
    },
    // 2. Sage Green (Clearer, more botanical green)
    "#80A66C": {
        s100: "#F4F9F1", s200: "#E5F2DF", s300: "#C6E0B8",
        s400: "#A5C992", s500: "#80A66C", s600: "#5F824C", s700: "#415C32"
    },
    // 3. Dusty Lavender (Deeper, true purple)
    "#9C81BD": {
        s100: "#F8F6FA", s200: "#EBE4F4", s300: "#D1BFE6",
        s400: "#B69ED6", s500: "#9C81BD", s600: "#7A5C9C", s700: "#573D73"
    },
    // 4. True Pink (Cooler rose, absolutely NO coral/peach!)
    "#D282A6": {
        s100: "#FDF4F7", s200: "#FAE3EC", s300: "#F0BED3",
        s400: "#E49BBA", s500: "#D282A6", s600: "#AA5C80", s700: "#7D3E5D"
    },
    // 5. Seafoam Teal (More saturated aqua)
    "#6FB0AC": {
        s100: "#F0F9F8", s200: "#DCF0EF", s300: "#B4DDD9",
        s400: "#8EC8C3", s500: "#6FB0AC", s600: "#4C8A86", s700: "#326360"
    },
    // 6. Slate Grey (A true slate with a tiny hint of cool blue)
    "#8D98A3": {
        s100: "#F5F7F9", s200: "#E6EAEE", s300: "#C7CED6",
        s400: "#A9B2BC", s500: "#8D98A3", s600: "#69737D", s700: "#485058"
    }
};

function applyGlobalTheme(hex) {
    // Default to the new Dusty Blue
    const theme = THEME_PALETTES[hex] || THEME_PALETTES["#668BC2"];
    const root = document.documentElement; 

    // Inject the 7-step scale into the browser
    root.style.setProperty('--theme-100', theme.s100);
    root.style.setProperty('--theme-200', theme.s200);
    root.style.setProperty('--theme-300', theme.s300);
    root.style.setProperty('--theme-400', theme.s400);
    root.style.setProperty('--theme-500', theme.s500); 
    root.style.setProperty('--theme-600', theme.s600);
    root.style.setProperty('--theme-700', theme.s700); 

    // Paint the Sidebar
    const sidebar = document.querySelector(".sidebar");
    if (sidebar) sidebar.style.background = `linear-gradient(180deg, var(--theme-500) 0%, var(--theme-500) 65%, var(--theme-700) 100%)`;

    // Paint the Sidebar Avatars
    const avatarDisplay = document.getElementById("userAvatarDisplay");
    if (avatarDisplay) {
        avatarDisplay.style.backgroundColor = "var(--theme-100)";
        avatarDisplay.style.color = "var(--theme-700)";
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