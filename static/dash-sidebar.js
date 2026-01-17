// static/dash-sidebar.js

/* =========================================
   ZONE 1: USER STATE (The "Brain")
   -----------------------------------------
   This acts as the single source of truth for
   user permissions. Currently mocks data,
   but will later bridge to Supabase Auth.
   ========================================= */

// The Raw Mock State (Internal use only)
window._MOCK_STATE = {
    role: 'admin',      // 'admin', 'family', 'viewer'
    id: 'user_123',
    name: 'Emma',
    familyFilter: 'Amy/Dave' // Used when role is 'family'
};

// The Public API (Use this in your other scripts like vendors.js)
window.AppUser = {
    // Returns the current role
    getRole: () => window._MOCK_STATE.role,

    // Returns the name to filter by (for Contributors)
    getFilterName: () => window._MOCK_STATE.familyFilter,

    // Helper booleans for cleaner code
    isAdmin: () => window._MOCK_STATE.role === 'admin',
    isContributor: () => window._MOCK_STATE.role === 'family',
    isViewer: () => window._MOCK_STATE.role === 'viewer'
};

// Backward compatibility for existing code using MOCK_USER direct access
// (We map it to the new state object so old code still works if not updated)
window.MOCK_USER = window._MOCK_STATE; 


/* =========================================
   ZONE 2: SIDEBAR UI (The "Body")
   -----------------------------------------
   Standard sidebar behavior: highlighting,
   mobile toggles, and badges.
   ========================================= */

(() => {
    // Highlight active link
    const path = (location.pathname.split("/").pop() || "").toLowerCase();
    document.querySelectorAll(".sideNav a").forEach(a => {
        const route = (a.getAttribute("data-route") || a.getAttribute("href") || "").replace("/", "").toLowerCase();
        // Simple matching logic
        const isActive = route === path || (path === "" && route === "dashboard");
        if(isActive) a.classList.add("active");
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
    closeBtns.forEach(b => b.addEventListener("click", close));
  
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });

    // --- BADGE LOGIC ---
    async function updateGlobalMissingBadge() {
        const badge = document.querySelector("#missingAddrBadge");
        if (!badge) return;

        try {
            const res = await fetch("/api/address-book", { credentials: "same-origin" });
            if (!res.ok) return;
            const rows = await res.json();

            const missingCount = rows.filter(r => {
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
   ZONE 3: DEV TOOLS (The "Switcher")
   -----------------------------------------
   Handles the user profile menu at the bottom
   of the sidebar for switching views.
   ========================================= */

    function initRoleSwitcher() {
        const trigger = document.getElementById("userMenuTrigger");
        const menu = document.getElementById("userRoleMenu");
        
        // UI Elements to update in the sidebar
        const displayAvatar = document.getElementById("userAvatarDisplay");
        const displayName = document.getElementById("userNameDisplay");
        const displayRole = document.getElementById("userRoleDisplay");
    
        if (!trigger || !menu) return;
    
        // Toggle Menu
        trigger.addEventListener("click", (e) => {
            e.stopPropagation();
            const isHidden = menu.style.display === "none";
            menu.style.display = isHidden ? "block" : "none";
        });
    
        // Close menu when clicking outside
        document.addEventListener("click", (e) => {
            if (!trigger.contains(e.target) && !menu.contains(e.target)) {
                menu.style.display = "none";
            }
        });
    
        // Handle Role Selection
        menu.querySelectorAll(".roleMenuItem").forEach(btn => {
            btn.addEventListener("click", () => {
                const role = btn.dataset.role;
                
                // 1. Update Global State
                window._MOCK_STATE.role = role;
    
                // 2. Update Sidebar Visuals
                if (role === 'admin') {
                    displayAvatar.textContent = "EH";
                    displayAvatar.style.background = "#f7f7f7";
                    displayAvatar.style.color = "#5d7996";
                    displayName.textContent = "Emma Hernandez";
                    displayRole.textContent = "Bride";
                } 
                else if (role === 'family') {
                    displayAvatar.textContent = "AD";
                    displayAvatar.style.background = "#e0f2fe";
                    displayAvatar.style.color = "#0369a1";
                    displayName.textContent = "Amy Eiduke";
                    displayRole.textContent = "Mother of the Groom";
                }
                else if (role === 'viewer') {
                    displayAvatar.textContent = "IS";
                    displayAvatar.style.background = "#f0fdf4";
                    displayAvatar.style.color = "#15803d";
                    displayName.textContent = "Isabel";
                    displayRole.textContent = "Viewer";
                }
    
                // 3. Dispatch Global Event (So vendors.js knows to refresh)
                console.log("Switched Role to:", role);
                menu.style.display = "none";
                
                const event = new CustomEvent('roleChanged', { detail: { role: role } });
                window.dispatchEvent(event);
            });
        });
    }

    // Run on load
    document.addEventListener("DOMContentLoaded", () => {
        updateGlobalMissingBadge();
        initRoleSwitcher();
    });

    // Listen for custom address updates
    window.addEventListener("addressBookUpdated", updateGlobalMissingBadge);
})();