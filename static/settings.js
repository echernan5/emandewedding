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
    // NEW: Helper function for the avatars
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

    // Exact same mapping function for the live preview
    function getSecondaryColor(primary) {
        const color = (primary || "").toUpperCase();
        const colorMap = {
            "#BDC9DB": "#A2B4CC", 
            "#A2B4CC": "#93A8C4", 
            "#93A8C4": "#7B95B7", 
            "#7B95B7": "#6E8AAF", 
            "#6E8AAF": "#6180A8", 
            "#6180A8": "#506C91", 
            "#506C91": "#BDC9DB"  
        };
        return colorMap[color] || "#6180A8";
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

    // 2. LIVE PAINTING (The magic theme effect)
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