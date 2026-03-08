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
    // NEW: Helper function for the avatars
    function getAvatarStyle(primary) {
        const color = (primary || "").toUpperCase();
        const styles = {
            "#0CB2AF": { bg: "#e0f6f5", text: "#098280" }, 
            "#A1C65D": { bg: "#f2f8e8", text: "#7a9b42" }, 
            "#FAC723": { bg: "#fef9e4", text: "#b58d0b" }, 
            "#F29222": { bg: "#fdf2e8", text: "#c46f11" }, 
            "#E95E50": { bg: "#fdeced", text: "#bd3c30" }, 
            "#936FAC": { bg: "#f4f0f7", text: "#73528a" }, 
            "#ABABAB": { bg: "#f4f4f4", text: "#6b6b6b" }  
        };
        return styles[color] || { bg: "#f1f5f9", text: "#475569" };
    }

    // Exact same mapping function for the live preview
    function getSecondaryColor(primary) {
        const color = (primary || "").toUpperCase();
        const colorMap = {
            "#0CB2AF": "#A1C65D",
            "#A1C65D": "#FAC723",
            "#FAC723": "#F29222",
            "#F29222": "#E95E50",
            "#E95E50": "#936FAC", 
            "#936FAC": "#0CB2AF", 
            "#ABABAB": "#71717A"  
        };
        return colorMap[color] || "#475569";
    }

    // 1. LOAD DATA
    try {
        const token = await waitForAuth();
        const res = await fetch("/api/me", { headers: { "Authorization": `Bearer ${token}` }});
        if (res.ok) {
            const data = await res.json();
            const profile = data.profile;
            
            // Populate read-only fields
            nameInput.value = profile.full_name || "Unknown";
            roleInput.value = profile.display_role || "Viewer";
            emailInput.value = data.user.email || ""; 
            
            // Check the correct color radio button
            const savedColor = profile.theme_color || "#0CB2AF";
            const activeRadio = document.querySelector(`input[value="${savedColor}"]`);
            if (activeRadio) activeRadio.checked = true;
            
            // Set initial avatar text & colors
            const initials = (profile.full_name || "G").split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
            avatarPreview.textContent = initials;
            
            const style = getAvatarStyle(savedColor);
            avatarPreview.style.backgroundColor = style.bg;
            avatarPreview.style.color = style.text;
        }
    } catch (e) {
        console.error("Failed to load profile data", e);
    }

    // 2. LIVE PAINTING (The magic gradient & avatar effect)
    colorRadios.forEach(radio => {
        radio.addEventListener("change", (e) => {
            const chosenColor = e.target.value;
            const secondaryColor = getSecondaryColor(chosenColor);
            const style = getAvatarStyle(chosenColor);
            
            // Paint the large preview box
            avatarPreview.style.backgroundColor = style.bg;
            avatarPreview.style.color = style.text;
            
            // Paint the sidebar avatar
            const sidebarAvatar = document.getElementById("userAvatarDisplay");
            if (sidebarAvatar) {
                sidebarAvatar.style.backgroundColor = style.bg;
                sidebarAvatar.style.color = style.text;
            }

            // Paint the sidebar gradient smoothly
            const sidebar = document.querySelector(".sidebar");
            if (sidebar) {
                sidebar.style.background = `linear-gradient(180deg, ${chosenColor} 0%, ${chosenColor} 65%, ${secondaryColor} 100%)`;
            }
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