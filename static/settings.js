// static/settings.js
(() => {
    async function waitForAuth() {
        for (let i = 0; i < 50; i++) {
            if (window.AppAuth?.token) return window.AppAuth.token;
            await new Promise((r) => setTimeout(r, 100));
        }
        throw new Error("Auth not ready");
    }

    // 1. Wrap everything in a named function for the DIY Router
    async function initSettingsPage() {
        // 2. Check if we are actually on the Settings page before running!
        const avatarPreview = document.getElementById("avatarPreview");
        if (!avatarPreview) return;

        // Elements
        const nameInput = document.getElementById("settingName");
        const roleInput = document.getElementById("settingRole");
        const emailInput = document.getElementById("settingEmail");
        const colorRadios = document.querySelectorAll("input[name='theme_color']");
        
        const formColor = document.getElementById("formColor");
        const formPassword = document.getElementById("formPassword");

        // 3. LOAD DATA
        try {
            const token = await waitForAuth();
            const res = await fetch("/api/me", { headers: { "Authorization": `Bearer ${token}` }});
            if (res.ok) {
                const data = await res.json();
                const profile = data.profile;
                
                // Populate read-only fields
                if (nameInput) nameInput.value = profile.full_name || "Unknown";
                if (roleInput) roleInput.value = profile.display_role || "Viewer";
                if (emailInput) emailInput.value = data.user.email || ""; 
                
                // Check the correct color radio button
                const savedColor = profile.theme_color || "#668BC2";
                const activeRadio = document.querySelector(`input[value="${savedColor}"]`);
                if (activeRadio) activeRadio.checked = true;
                
                // Set initial avatar text & colors
                const initials = (profile.full_name || "G").split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
                avatarPreview.textContent = initials;
                
                // Use the global theme variables instead of the old getAvatarStyle function
                avatarPreview.style.backgroundColor = "var(--theme-100)";
                avatarPreview.style.color = "var(--theme-700)";
                avatarPreview.style.border = "1px solid var(--theme-300)";
            }
        } catch (e) {
            console.error("Failed to load profile data", e);
        }

        // 4. LIVE PAINTING (The magic theme effect)
        colorRadios.forEach(radio => {
            radio.addEventListener("change", (e) => {
                const chosenHex = e.target.value;
                
                // 1. Tell the global engine to swap the 7 CSS variables instantly
                if (typeof applyGlobalTheme === "function") {
                    applyGlobalTheme(chosenHex);
                }
                
                // 2. Paint the large preview box using the active CSS variables!
                avatarPreview.style.backgroundColor = "var(--theme-100)";
                avatarPreview.style.color = "var(--theme-700)";
                avatarPreview.style.border = "1px solid var(--theme-300)";
            });
        });

        // 5. SAVE COLOR TO DATABASE
        if (formColor) {
            formColor.onsubmit = async (e) => {
                e.preventDefault();
                const btn = document.getElementById("btnSaveColor");
                btn.textContent = "Saving...";
                
                const newColor = document.querySelector("input[name='theme_color']:checked").value;

                try {
                    const token = await waitForAuth();
                    const res = await fetch("/api/profile/update", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                        body: JSON.stringify({ theme_color: newColor })
                    });
                    
                    if (!res.ok) throw new Error("Failed to save profile");
                    
                    btn.textContent = "Saved!";
                    // Tell the sidebar cache to pull the fresh data in the background
                    if (typeof loadRealProfile === "function") loadRealProfile(); 
                    
                    setTimeout(() => btn.textContent = "Save Preferences", 2000);
                } catch (err) {
                    alert(err.message);
                    btn.textContent = "Save Preferences";
                }
            };
        }

        // 6. RESET PASSWORD VIA SUPABASE
        if (formPassword) {
            formPassword.onsubmit = async (e) => {
                e.preventDefault();
                const btn = document.getElementById("btnSavePassword");
                const password = document.getElementById("settingPassword").value;
                
                btn.textContent = "Updating...";
                
                try {
                    const supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
                    const { error } = await supabaseClient.auth.updateUser({ password: password });
                    
                    if (error) throw error;
                    
                    btn.textContent = "Password Updated!";
                    document.getElementById("settingPassword").value = ""; 
                    setTimeout(() => btn.textContent = "Update Password", 2000);
                } catch (err) {
                    alert(err.message);
                    btn.textContent = "Update Password";
                }
            };
        }
    }

    // --- SPA ROUTER HOOKS ---
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initSettingsPage);
    } else {
        initSettingsPage(); // Run instantly if injected by the router!
    }
    window.addEventListener("app:navigated", initSettingsPage);
})();