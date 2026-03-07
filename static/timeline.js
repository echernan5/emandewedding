const START_HOUR = 6;
const END_HOUR = 24; 
let currentEvents = []; // Global memory for inline editing

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

function formatTimeDisplay(timeStr) {
    if (!timeStr) return "";
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
    return `${displayHour}:${m} ${ampm}`;
}

document.addEventListener("DOMContentLoaded", async () => {
    const addBtn = document.getElementById("btnAddEvent");
    const updateButtonVisibility = () => {
        const currentRole = localStorage.getItem("user_role_key") || "admin";
        addBtn.style.display = (currentRole === "admin") ? "block" : "none";
    };
    
    updateButtonVisibility();
    window.addEventListener("roleChanged", () => { updateButtonVisibility(); loadTimeline(); });

    await loadTimeline();

    // Modal Events
    addBtn.addEventListener("click", () => openModal(null));
    document.getElementById("btnCloseEventModal").addEventListener("click", closeModal);
    document.getElementById("btnCancelEvent").addEventListener("click", closeModal);
    document.getElementById("formAddEvent").addEventListener("submit", handleAddEvent);

    // INLINE EDIT AUTO-SAVE LISTENER
    document.getElementById("ganttGrid").addEventListener("change", async (e) => {
        if (e.target.classList.contains("inline-input")) {
            await handleInlineSave(e.target);
        }
    });
});

async function loadTimeline() {
    document.getElementById("statusLine").textContent = "Loading schedule...";
    try {
        const token = await waitForAuth();
        const res = await fetch("/api/timeline", { headers: { Authorization: `Bearer ${token}` } });
        currentEvents = await res.json(); 
        renderGantt(currentEvents); // <-- FIXED: Changed 't' to 'renderGantt'
        document.getElementById("statusLine").textContent = "";
    } catch (e) {
        document.getElementById("statusLine").textContent = "Failed to load timeline.";
    }
}

// Calculates exact minute-by-minute widths for the 5-minute Grid
function getGanttPlacement(startStr, endStr) {
    const parseTime = (str) => {
        if (!str) return null;
        const [h, m] = str.split(':').map(Number);
        return h * 60 + m;
    };

    let startMin = parseTime(startStr) || (START_HOUR * 60);
    let endMin = parseTime(endStr);
    
    // Default to 5 minutes if no end time is provided
    if (!endMin || endMin <= startMin) endMin = startMin + 5; 
    const startHourBound = START_HOUR * 60;
    if (startMin < startHourBound) startMin = startHourBound;

    // Grid starts at column 5. Divide by 5 for 5-minute columns
    const minutesFromStart = startMin - startHourBound;
    const blockIndex = Math.floor(minutesFromStart / 5);
    const startCol = 5 + blockIndex; 

    // Fractional offsets
    const offsetMinutes = minutesFromStart % 5;
    const marginLeftPct = (offsetMinutes / 5) * 100;
    
    const duration = endMin - startMin;
    const widthPct = (duration / 5) * 100;

    return { startCol, marginLeftPct, widthPct };
}

function renderGantt(events) {
    const grid = document.getElementById("ganttGrid");
    grid.innerHTML = "";
    const isAdmin = (localStorage.getItem("user_role_key") || "admin") === "admin";

    const phaseNames = {
        "0_vendor_coverage": "Vendor Coverage", // Add this line!
        "1_getting_ready": "Getting Ready", 
        "2_setup": "Set Up", 
        "3_ceremony": "Ceremony",
        "4_cocktail_hour": "Cocktail Hour", 
        "5_reception": "Reception", 
        "6_tear_down": "Tear Down"
    };

    const renderTags = (tagsArray) => {
        let tags = Array.isArray(tagsArray) ? tagsArray : (tagsArray ? [tagsArray] : []);
        if (!tags.length) return `<span class="muted" style="font-size: 11px;">—</span>`;
        return tags.map(tag => `<span class="chip" style="padding: 1px 4px; font-size: 9px; margin: 1px 1px 0 0; display: inline-block;">${escapeHTML(tag)}</span>`).join("");
    };

    // 1. HEADERS
    let html = `
        <div class="gantt-header-cell col-desc" style="grid-column: 1; grid-row: 1;">Item Description</div>
        <div class="gantt-header-cell col-time" style="grid-column: 2; grid-row: 1;">Time</div>
        <div class="gantt-header-cell col-party" style="grid-column: 3; grid-row: 1;">Wedding Party</div>
        <div class="gantt-header-cell col-vendor" style="grid-column: 4; grid-row: 1;">Vendor</div>
    `;

    // 12 columns per hour now!
    for (let h = START_HOUR; h < END_HOUR; h++) {
        const displayHour = h > 12 ? h - 12 : (h === 0 ? 12 : h);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const startCol = 5 + ((h - START_HOUR) * 12); 
        html += `<div class="gantt-time-header" style="grid-column: ${startCol} / ${startCol + 12};">${displayHour} ${ampm}</div>`;
    }

    // 2. ROWS
    let currentRow = 2;
    const groups = Object.keys(phaseNames);
    
    const uncategorizedEvents = events.filter(e => !groups.includes(e.phase));
    const allGroupsToRender = [...groups];
    if (uncategorizedEvents.length > 0) allGroupsToRender.push("uncategorized");

    allGroupsToRender.forEach(phaseKey => {
        const isUncategorized = phaseKey === "uncategorized";
        const phaseEvents = isUncategorized ? uncategorizedEvents : events.filter(e => e.phase === phaseKey);
        if (phaseEvents.length === 0) return;

        const label = isUncategorized ? "Needs Phase Assignment" : phaseNames[phaseKey];
        html += `
            <div class="gantt-phase-header phase-${phaseKey}" style="grid-row: ${currentRow}; grid-column: 1 / -1; ${isUncategorized ? 'background:#fef2f2; color:#b91c1c;' : ''}">
                <span class="sticky-phase-label">${label}</span>
            </div>
        `;
        currentRow++;

        phaseEvents.forEach(ev => {
            if (isAdmin) {
                html += `
                    <div class="gantt-cell col-desc" style="grid-column: 1; grid-row: ${currentRow}; display:flex; align-items:center;">
                        <input type="text" class="inline-input" data-id="${ev.id}" data-field="description" value="${escapeHTML(ev.description)}">
                        <button class="btn-mini-edit edit-trigger" data-id="${ev.id}" title="Edit colors/phase">✎</button>
                    </div>
                    <div class="gantt-cell col-time" style="grid-column: 2; grid-row: ${currentRow};">
                        <div class="time-input-group">
                            <input type="time" class="inline-input time-input" data-id="${ev.id}" data-field="start_time" value="${ev.start_time}">
                            <span class="muted">-</span>
                            <input type="time" class="inline-input time-input" data-id="${ev.id}" data-field="end_time" value="${ev.end_time}">
                        </div>
                    </div>
                    <div class="gantt-cell col-party" style="grid-column: 3; grid-row: ${currentRow};">
                        <input type="text" class="inline-input" data-id="${ev.id}" data-field="wedding_party" value="${escapeHTML((ev.wedding_party||[]).join(', '))}" placeholder="Add party...">
                    </div>
                    <div class="gantt-cell col-vendor" style="grid-column: 4; grid-row: ${currentRow};">
                         <input type="text" class="inline-input" data-id="${ev.id}" data-field="vendor" value="${escapeHTML((ev.vendor||[]).join(', '))}" placeholder="Add vendor...">
                    </div>
                `;
            } else {
                html += `
                    <div class="gantt-cell col-desc" style="grid-column: 1; grid-row: ${currentRow};">${escapeHTML(ev.description)}</div>
                    <div class="gantt-cell col-time" style="grid-column: 2; grid-row: ${currentRow}; font-size:10px; font-weight:600;">
                        ${formatTimeDisplay(ev.start_time)} - ${formatTimeDisplay(ev.end_time)}
                    </div>
                    <div class="gantt-cell col-party" style="grid-column: 3; grid-row: ${currentRow};">${renderTags(ev.wedding_party)}</div>
                    <div class="gantt-cell col-vendor" style="grid-column: 4; grid-row: ${currentRow};">${renderTags(ev.vendor)}</div>
                `;
            }

            const placement = getGanttPlacement(ev.start_time, ev.end_time);
            
            // Added detailed hover title so they can read clipped text!
            const hoverText = `${escapeHTML(ev.description)} (${formatTimeDisplay(ev.start_time)} - ${formatTimeDisplay(ev.end_time)})`;
            
            html += `
                <div class="gantt-block-container phase-${phaseKey}" style="grid-column: ${placement.startCol}; grid-row: ${currentRow}; margin-left: ${placement.marginLeftPct}%; width: ${placement.widthPct}%;">
                    <div class="gantt-block" title="${hoverText}">
                        ${escapeHTML(ev.description)}
                    </div>
                </div>
            `;
            currentRow++;
        });
    });

    // 3. BACKGROUND GRID (Drawing lines for 5, 15, and 60 min intervals)
    for (let h = START_HOUR; h <= END_HOUR; h++) {
        for (let q = 0; q < 12; q++) {
            if (h === END_HOUR && q > 0) break;
            const col = 5 + ((h - START_HOUR) * 12) + q;
            
            let lineClass = "gantt-grid-line";
            if (q === 0) lineClass += " hour-line";
            else if (q % 3 === 0) lineClass += " quarter-line";
            else lineClass += " five-min-line";
            
            html += `<div class="${lineClass}" style="grid-column: ${col}; grid-row: 2 / ${currentRow};"></div>`;
        }
    }

    grid.innerHTML = html;

    if (isAdmin) {
        grid.querySelectorAll('.edit-trigger').forEach(el => {
            el.addEventListener('click', () => {
                const evData = events.find(e => String(e.id) === String(el.dataset.id));
                if (evData) openModal(evData);
            });
        });
    }
}

// --- INLINE EDIT AUTO-SAVE ---
async function handleInlineSave(inputEl) {
    const id = inputEl.getAttribute("data-id");
    const field = inputEl.getAttribute("data-field");
    let value = inputEl.value;

    const ev = currentEvents.find(e => String(e.id) === String(id));
    if (!ev) return;

    // --- NEW: Safety check to prevent saving blank times ---
    if ((field === "start_time" || field === "end_time") && !value) {
        alert("Time cannot be left blank.");
        inputEl.value = ev[field]; // Reset back to the original saved time
        return; // Stop the save process
    }

    // If they typed into the array fields, convert comma-separated string back to array
    if (field === "wedding_party" || field === "vendor") {
        value = value.split(',').map(s => s.trim()).filter(Boolean);
    }

    ev[field] = value;
    inputEl.style.opacity = "0.5"; // Visual feedback that it's saving

    try {
        const token = await waitForAuth();
        const res = await fetch("/api/timeline", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify(ev) // Re-submit the whole updated object
        });
        
        if (!res.ok) {
            const errorJson = await res.json();
            throw new Error(errorJson.error || "Save failed");
        }
        
        // If they changed a time, instantly re-render the grid to move the bar
        if (field === "start_time" || field === "end_time") {
            renderGantt(currentEvents);
        }
    } catch (e) {
        alert(e.message);
    } finally {
        inputEl.style.opacity = "1";
    }
}

const modal = document.getElementById("modalAddEvent");
const form = document.getElementById("formAddEvent");

function openModal(eventData = null) {
    form.reset();
    const isEdit = eventData && eventData.id;
    document.getElementById("modalEventTitle").textContent = isEdit ? "Edit Event" : "Add Timeline Event";
    document.getElementById("btnDeleteEvent").style.display = isEdit ? "block" : "none";
    
    if (isEdit) {
        document.getElementById("evId").value = eventData.id;
        document.getElementById("evDescription").value = eventData.description || "";
        document.getElementById("evStart").value = eventData.start_time || "";
        document.getElementById("evEnd").value = eventData.end_time || "";
        document.getElementById("evColor").value = eventData.color_code || "#bbf7d0";
        document.getElementById("evPhase").value = eventData.phase || "1_getting_ready";
        
        const setMulti = (id, arr) => {
            const sel = document.getElementById(id);
            const vals = Array.isArray(arr) ? arr : (arr ? [arr] : []);
            Array.from(sel.options).forEach(opt => opt.selected = vals.includes(opt.value));
        };
        setMulti("evParty", eventData.wedding_party);
        setMulti("evVendor", eventData.vendor);
    } else {
        document.getElementById("evId").value = "";
        document.getElementById("evColor").value = "#bbf7d0";
        document.getElementById("evPhase").value = "1_getting_ready";
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

    const payload = {
        id: document.getElementById("evId").value || null,
        description: document.getElementById("evDescription").value,
        wedding_party: Array.from(document.getElementById("evParty").selectedOptions).map(o => o.value),
        vendor: Array.from(document.getElementById("evVendor").selectedOptions).map(o => o.value),      
        start_time: document.getElementById("evStart").value,
        end_time: document.getElementById("evEnd").value,
        color_code: document.getElementById("evColor").value,
        phase: document.getElementById("evPhase").value
    };

    try {
        const token = await waitForAuth();
        const res = await fetch("/api/timeline", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error("Failed to save");
        closeModal();
        await loadTimeline();
    } catch (err) { alert(err.message); } 
    finally { btn.disabled = false; btn.textContent = "Save Event"; }
}

document.getElementById("btnDeleteEvent")?.addEventListener("click", async () => {
    const evId = document.getElementById("evId").value;
    if (!evId || !confirm("Are you sure?")) return;
    try {
        const token = await waitForAuth();
        await fetch(`/api/timeline/${evId}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` }});
        closeModal();
        await loadTimeline();
    } catch (err) { alert(err.message); }
});