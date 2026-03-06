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
    const addBtn = document.getElementById("btnAddEvent");
    
    // 1. Check permissions (Defaults to admin)
    const updateButtonVisibility = () => {
        const currentRole = localStorage.getItem("user_role_key") || "admin";
        if (currentRole === "admin") {
            addBtn.style.display = "block";
        } else {
            addBtn.style.display = "none";
        }
    };
    
    updateButtonVisibility();

    // Listen for the sidebar switcher!
    window.addEventListener("roleChanged", (e) => {
        updateButtonVisibility();
        loadTimeline(); // Refresh to hide/show edit links when changing roles
    });

    // 2. Load Data
    await loadTimeline();

    // 3. Bind Modal Events
    addBtn.addEventListener("click", () => openModal(null)); // Pass null explicitly for new events
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
    const currentRole = localStorage.getItem("user_role_key") || "admin";
    const isAdmin = currentRole === "admin";

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
        const renderTags = (tagsArray) => {
            let tags = Array.isArray(tagsArray) ? tagsArray : (tagsArray ? [tagsArray] : []);
            if (!tags.length) return `<span class="muted" style="font-size: 11px;">—</span>`;
            
            // Compact tags styling
            return tags.map(tag => `
                <span class="chip" style="padding: 1px 4px; font-size: 9px; margin: 1px 1px 0 0; display: inline-block;">
                    ${escapeHTML(tag)}
                </span>
            `).join("");
        };

        // Render Description column (Clickable if admin)
        const descHtml = isAdmin 
            ? `<div class="gantt-cell col-desc edit-trigger" data-id="${ev.id}" style="grid-column: 1; grid-row: ${rowNum}; cursor: pointer; color: #2563eb;">
                 <span style="border-bottom: 1px dashed #2563eb;">${escapeHTML(ev.description)}</span>
               </div>`
            : `<div class="gantt-cell col-desc" style="grid-column: 1; grid-row: ${rowNum};">${escapeHTML(ev.description)}</div>`;

        html += descHtml;
        
        html += `
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

    // Attach click listeners to edit events (Admin only)
    if (isAdmin) {
        grid.querySelectorAll('.edit-trigger').forEach(el => {
            el.addEventListener('click', () => {
                const evId = el.getAttribute('data-id');
                const evData = events.find(e => String(e.id) === String(evId));
                if (evData) openModal(evData);
            });
        });
    }
}

/** Converts "07:15:00" to CSS Grid Column Number */
function timeToCol(timeStr) {
    if (!timeStr) return 4;
    
    const parts = timeStr.split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    
    if (h < START_HOUR) return 4; 
    
    const hourDiff = h - START_HOUR;
    const minDiff = m / 15; 
    
    return 4 + (hourDiff * 4) + Math.round(minDiff);
}

// --- MODAL LOGIC ---
const modal = document.getElementById("modalAddEvent");
const form = document.getElementById("formAddEvent");

function openModal(eventData = null) {
    form.reset();
    document.getElementById("evParty").selectedIndex = -1;
    document.getElementById("evVendor").selectedIndex = -1;
    
    const isEdit = eventData && eventData.id;
    document.getElementById("modalEventTitle").textContent = isEdit ? "Edit Event" : "Add Timeline Event";
    
    const deleteBtn = document.getElementById("btnDeleteEvent");
    if(deleteBtn) deleteBtn.style.display = isEdit ? "block" : "none";
    
    if (isEdit) {
        // Populate existing data
        document.getElementById("evId").value = eventData.id;
        document.getElementById("evDescription").value = eventData.description || "";
        document.getElementById("evStart").value = eventData.start_time || "";
        document.getElementById("evEnd").value = eventData.end_time || "";
        document.getElementById("evColor").value = eventData.color_code || "#bbf7d0";
        
        // Helper to select multiple options
        const setMulti = (id, arr) => {
            const sel = document.getElementById(id);
            const vals = Array.isArray(arr) ? arr : (arr ? [arr] : []);
            Array.from(sel.options).forEach(opt => {
                opt.selected = vals.includes(opt.value);
            });
        };
        setMulti("evParty", eventData.wedding_party);
        setMulti("evVendor", eventData.vendor);
    } else {
        // Clear ID for new events
        document.getElementById("evId").value = "";
        document.getElementById("evColor").value = "#bbf7d0"; // Default green
    }
    
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

    const getSelected = (selectId) => {
        const select = document.getElementById(selectId);
        return Array.from(select.selectedOptions).map(opt => opt.value);
    };

    const payload = {
        id: document.getElementById("evId").value || null, // Include ID if editing
        description: document.getElementById("evDescription").value,
        wedding_party: getSelected("evParty"), 
        vendor: getSelected("evVendor"),      
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
        await loadTimeline();

    } catch (err) {
        alert(err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Save Event";
    }
}

// Add Delete Button Listener
document.getElementById("btnDeleteEvent")?.addEventListener("click", async () => {
    const evId = document.getElementById("evId").value;
    if (!evId || !confirm("Are you sure you want to delete this event?")) return;
    
    const btn = document.getElementById("btnDeleteEvent");
    btn.textContent = "Deleting...";
    btn.disabled = true;
    
    try {
        const token = await waitForAuth();
        const res = await fetch(`/api/timeline/${evId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Failed to delete");
        
        closeModal();
        await loadTimeline();
    } catch (err) {
        alert(err.message);
    } finally {
        btn.textContent = "Delete";
        btn.disabled = false;
    }
});