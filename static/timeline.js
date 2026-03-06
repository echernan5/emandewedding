// Configuration: 6 AM to Midnight
const START_HOUR = 6;
const END_HOUR = 24; 

async function waitForAuth() {
    for (let i = 0; i < 50; i++) {
        if (window.AppAuth?.token) return window.AppAuth.token;
        await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error("Auth not ready");
}

function escapeHTML(str) {
    return String(str ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Role Check
    const AU = window.AppUser || {};
    const isAdmin = typeof AU.isAdmin === "function" ? AU.isAdmin() : false;
    if (isAdmin) {
        document.getElementById("btnAddEvent").style.display = "block";
    }

    // 2. Load Data
    await loadTimeline();

    // 3. Bind Modal Events
    document.getElementById("btnAddEvent").addEventListener("click", openModal);
    document.getElementById("btnCloseEventModal").addEventListener("click", closeModal);
    document.getElementById("btnCancelEvent").addEventListener("click", closeModal);
    document.getElementById("formAddEvent").addEventListener("submit", handleAddEvent);
});

async function loadTimeline() {
    document.getElementById("statusLine").textContent = "Loading schedule...";
    try {
        const token = await waitForAuth();
        const res = await fetch("/api/timeline", {
            headers: { Authorization: `Bearer ${token}` }
        });
        const events = await res.json();
        renderGantt(events);
        document.getElementById("statusLine").textContent = "";
    } catch (e) {
        console.error(e);
        document.getElementById("statusLine").textContent = "Failed to load timeline.";
    }
}

function renderGantt(events) {
    const grid = document.getElementById("ganttGrid");
    grid.innerHTML = "";

    // --- 1. RENDER HEADERS ---
    let html = `
        <div class="gantt-header-cell col-desc" style="grid-column: 1; grid-row: 1;">Item Description</div>
        <div class="gantt-header-cell col-party" style="grid-column: 2; grid-row: 1;">Wedding Party</div>
        <div class="gantt-header-cell col-vendor" style="grid-column: 3; grid-row: 1;">Vendor</div>
    `;

    // Time Headers (Spans 4 columns per hour)
    for (let h = START_HOUR; h < END_HOUR; h++) {
        const displayHour = h > 12 ? h - 12 : (h === 0 ? 12 : h);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const startCol = 4 + ((h - START_HOUR) * 4);
        const endCol = startCol + 4;
        
        html += `<div class="gantt-time-header" style="grid-column: ${startCol} / ${endCol};">${displayHour} ${ampm}</div>`;
    }

    // Background Grid Lines
    for (let h = START_HOUR; h <= END_HOUR; h++) {
        for (let q = 0; q < 4; q++) {
            if (h === END_HOUR && q > 0) break; // Don't draw past midnight
            const col = 4 + ((h - START_HOUR) * 4) + q;
            const lineClass = q === 0 ? "gantt-grid-line hour-line" : "gantt-grid-line";
            html += `<div class="${lineClass}" style="grid-column: ${col};"></div>`;
        }
    }

    // --- 2. RENDER ROWS ---
    events.forEach((ev, idx) => {
        const rowNum = idx + 2; // Row 1 is the header

        // Helper to generate the HTML for the tags
        // Helper to generate the HTML for the tags
        const renderTags = (tagsArray) => {
            // Safety check: force it to be an array even if the DB returns a string
            let tags = Array.isArray(tagsArray) ? tagsArray : (tagsArray ? [tagsArray] : []);
            
            if (!tags.length) return `<span class="muted" style="font-size: 11px;">—</span>`;
            return tags.map(tag => `
                <span class="chip" style="padding: 2px 6px; font-size: 10px; margin: 2px 2px 0 0; display: inline-block;">
                    ${escapeHTML(tag)}
                </span>
            `).join("");
        };
        
        // Left Sidebar Texts (Updated to use renderTags)
        html += `
            <div class="gantt-cell col-desc" style="grid-column: 1; grid-row: ${rowNum};">${escapeHTML(ev.description)}</div>
            <div class="gantt-cell col-party" style="grid-column: 2; grid-row: ${rowNum}; flex-wrap: wrap;">
                ${renderTags(ev.wedding_party)}
            </div>
            <div class="gantt-cell col-vendor" style="grid-column: 3; grid-row: ${rowNum}; flex-wrap: wrap;">
                ${renderTags(ev.vendor)}
            </div>
        `;

        // Chart Block Placement
        const startCol = timeToCol(ev.start_time);
        const endCol = Math.max(startCol + 1, timeToCol(ev.end_time)); // Ensure it spans at least 1 cell

        html += `
            <div class="gantt-block-container" style="grid-column: ${startCol} / ${endCol}; grid-row: ${rowNum};">
                <div class="gantt-block" style="background-color: ${escapeHTML(ev.color_code)};">
                    ${escapeHTML(ev.description)}
                </div>
            </div>
        `;
    });

    grid.innerHTML = html;
}

/** Converts "07:15:00" to CSS Grid Column Number */
function timeToCol(timeStr) {
    if (!timeStr) return 4;
    
    const parts = timeStr.split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    
    // Safety clamp to our start hour
    if (h < START_HOUR) return 4; 
    
    const hourDiff = h - START_HOUR;
    const minDiff = m / 15; // 15 min increments
    
    // Column 1,2,3 are text. Time starts at column 4.
    return 4 + (hourDiff * 4) + Math.round(minDiff);
}

// --- MODAL LOGIC ---
const modal = document.getElementById("modalAddEvent");
const form = document.getElementById("formAddEvent");

function openModal() {
    form.reset();
    document.getElementById("evColor").value = "#bbf7d0"; // Default green
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
}

async function handleAddEvent(e) {
    e.preventDefault();
    const btn = form.querySelector("button[type='submit']");
    btn.disabled = true;
    btn.textContent = "Saving...";

    // Helper function to get all selected values from a multi-select
    const getSelected = (selectId) => {
        const select = document.getElementById(selectId);
        return Array.from(select.selectedOptions).map(opt => opt.value);
    };

    const payload = {
        description: document.getElementById("evDescription").value,
        wedding_party: getSelected("evParty"), // Now returns an array like ["Emma/Ethan", "Family"]
        vendor: getSelected("evVendor"),       // Now returns an array
        start_time: document.getElementById("evStart").value,
        end_time: document.getElementById("evEnd").value,
        color_code: document.getElementById("evColor").value
    };

    try {
        const token = await waitForAuth();
        const res = await fetch("/api/timeline", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}` 
            },
            body: JSON.stringify(payload)
        });
        
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to save");

        closeModal();
        await loadTimeline(); // Refresh grid

    } catch (err) {
        alert(err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Save Event";
    }
}