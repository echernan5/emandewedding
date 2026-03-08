// static/settings.js

async function waitForAuth() {
    for (let i = 0; i < 50; i++) {
        if (window.AppAuth?.token) return window.AppAuth.token;
        await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error("Auth not ready");
}

document.addEventListener("DOMContentLoaded", async () => {
    // Elements
    const avatarPreview = document.getElementById("avatarPreview");
    const nameInput = document.getElementById("settingName");
    const roleInput = document.getElementById("settingRole");
    const emailInput = document.getElementById("settingEmail");
    const colorRadios = document.querySelectorAll("input[name='theme_color']");
    
    const formColor = document.getElementById("formColor");
    const formPassword = document.getElementById("formPassword");

    // 1. LOAD DATA
    try {
        const token = await waitForAuth();
        const res = await fetch("/api/me", { headers: { "Authorization": `Bearer ${token}` }});
        if (res.ok) {
            const data = await res.json();
            const profile = data.profile;
            
            nameInput.value = profile.full_name || "Unknown";
            roleInput.value = profile.display_role || "Viewer";
            emailInput.value = data.user.email || ""; 
            
            const savedColor = profile.theme_color || "#668BC2";
            const activeRadio = document.querySelector(`input[value="${savedColor}"]`);
            if (activeRadio) activeRadio.checked = true;
            
            const initials = (profile.full_name || "G").split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
            avatarPreview.textContent = initials;
            
            // Just force the variables!
            avatarPreview.style.backgroundColor = "var(--theme-100)";
            avatarPreview.style.color = "var(--theme-700)";
            avatarPreview.style.border = "1px solid var(--theme-300)";
        }
    } catch (e) { console.error("Failed to load profile data", e); }

    // 2. LIVE PAINTING
    colorRadios.forEach(radio => {
        radio.addEventListener("change", (e) => {
            const chosenHex = e.target.value;
            if (typeof applyGlobalTheme === "function") applyGlobalTheme(chosenHex);
            
            avatarPreview.style.backgroundColor = "var(--theme-100)";
            avatarPreview.style.color = "var(--theme-700)";
            avatarPreview.style.border = "1px solid var(--theme-300)";
        });
    });
    
    // 3. SAVE COLOR TO DATABASE
    formColor.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = document.getElementById("btnSaveColor");
        btn.textContent = "Saving...";
        
        const newColor = document.querySelector("input[name='theme_color']:checked").value;

        try {
            const token = await waitForAuth();
            const res = await fetch("/api/profile/update", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                // We are no longer sending the full_name here, just the color!
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
    });

    // 4. RESET PASSWORD VIA SUPABASE
    formPassword.addEventListener("submit", async (e) => {
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
    });
});