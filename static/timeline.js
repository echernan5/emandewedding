// static/timeline.js
(() => {
    const START_HOUR = 6;
    const END_HOUR = 24; 
    let currentEvents = []; 

    // --- Global Filter State & Functions ---
    // Using window so they persist beautifully as the user navigates between pages!
    window.activeFilters = window.activeFilters || { party: [], vendor: [] };

    window.toggleFilterPopup = (type, event) => {
        event.stopPropagation();
        const popup = document.getElementById(`${type}FilterPopup`);
        if (!popup) return;
        
        document.querySelectorAll('.filter-popup').forEach(p => {
            if (p !== popup) p.classList.remove('show');
        });
        popup.classList.toggle('show');
    };

    window.applyFilter = (type) => {
        const popup = document.getElementById(`${type}FilterPopup`);
        if (!popup) return;
        
        const checked = Array.from(popup.querySelectorAll('input:checked')).map(cb => cb.value);
        window.activeFilters[type] = checked;
        renderGantt(currentEvents); 
    };

    window.clearFilter = (type) => {
        window.activeFilters[type] = [];
        renderGantt(currentEvents);
    };

    window.stopProp = (event) => {
        event.stopPropagation();
    };

    // Safely bind document-level clicks so they don't stack up with the router
    if (!window.timelineGlobalClickBound) {
        document.addEventListener('click', () => {
            document.querySelectorAll('.filter-popup').forEach(p => p.classList.remove('show'));
        });
        window.timelineGlobalClickBound = true;
    }

    // --- CORE FUNCTIONS ---
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

    // ==========================================
    // 1. THE MAIN INITIALIZATION WRAPPER
    // ==========================================
    async function initTimelinePage() {
        const gridEl = document.getElementById("ganttGrid");
        
        // SAFETY CHECK: If we aren't on the Timeline page, abort!
        if (!gridEl) return;

        const addBtn = document.getElementById("btnAddEvent");
        const currentRole = localStorage.getItem("user_role_key") || "admin";
        
        if (addBtn) {
            addBtn.style.display = (currentRole === "admin") ? "block" : "none";
        }

        await loadTimeline();

        // --- GLOBAL TOOLTIP SETUP ---
        let tooltip = document.getElementById('global-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'global-tooltip';
            document.body.appendChild(tooltip);
        }

        gridEl.addEventListener('mouseover', (e) => {
            const tt = document.getElementById('global-tooltip');
            const block = e.target.closest('.gantt-block');
            if (block && block.dataset.tooltip && tt) {
                tt.textContent = block.dataset.tooltip;
                tt.style.opacity = '1';
                tt.style.visibility = 'visible';
            }
        });

        gridEl.addEventListener('mousemove', (e) => {
            const tt = document.getElementById('global-tooltip');
            const block = e.target.closest('.gantt-block');
            if (block && block.dataset.tooltip && tt) {
                tt.style.left = (e.clientX + 15) + 'px';
                tt.style.top = (e.clientY + 15) + 'px';
            }
        });

        gridEl.addEventListener('mouseout', (e) => {
            const tt = document.getElementById('global-tooltip');
            const block = e.target.closest('.gantt-block');
            if (block && tt) {
                tt.style.opacity = '0';
                tt.style.visibility = 'hidden';
            }
        });

        // --- MODAL & ACTION EVENTS ---
        if (addBtn) addBtn.addEventListener("click", () => openModal(null));
        
        document.getElementById("btnCloseEventModal")?.addEventListener("click", closeModal);
        document.getElementById("btnCancelEvent")?.addEventListener("click", closeModal);
        document.getElementById("formAddEvent")?.addEventListener("submit", handleAddEvent);
        document.getElementById("btnDeleteEvent")?.addEventListener("click", handleDeleteEvent);

        gridEl.addEventListener("change", async (e) => {
            if (e.target.classList.contains("inline-input")) {
                await handleInlineSave(e.target);
            }
        });
    }

    // Safely bind role changes globally so it doesn't stack up
    if (!window.timelineRoleBound) {
        window.addEventListener("roleChanged", () => {
            // Only trigger the reload if we are actually viewing the timeline
            if (document.getElementById("ganttGrid")) {
                initTimelinePage();
            }
        });
        window.timelineRoleBound = true;
    }


    async function loadTimeline() {
        const statusLine = document.getElementById("statusLine");
        const grid = document.getElementById("ganttGrid");
        
        if (currentEvents.length > 0) {
            renderGantt(currentEvents);
        } else {
            if (statusLine) statusLine.textContent = "Loading schedule...";
            // INJECT SKELETONS WHILE WAITING
            if (grid) {
                grid.innerHTML = `
                    <div style="grid-column: 1 / -1; padding: 20px;">
                        <div class="skeleton skeleton-text" style="height: 40px; margin-bottom: 16px; width: 100%;"></div>
                        <div class="skeleton skeleton-text" style="height: 40px; margin-bottom: 16px; width: 100%;"></div>
                        <div class="skeleton skeleton-text" style="height: 40px; margin-bottom: 16px; width: 100%;"></div>
                        <div class="skeleton skeleton-text" style="height: 40px; margin-bottom: 16px; width: 100%;"></div>
                    </div>
                `;
            }
        }

        try {
            const token = await waitForAuth();
            const res = await fetch("/api/timeline", { headers: { Authorization: `Bearer ${token}` } });
            currentEvents = await res.json(); 
            renderGantt(currentEvents); // Overwrites skeletons!
            if (statusLine) statusLine.textContent = "";
        } catch (e) {
            if (currentEvents.length === 0 && statusLine) statusLine.textContent = "Failed to load timeline.";
        }
    }

    function getGanttPlacement(startStr, endStr) {
        const parseTime = (str) => {
            if (!str) return null;
            const [h, m] = str.split(':').map(Number);
            return h * 60 + m;
        };

        let startMin = parseTime(startStr) || (START_HOUR * 60);
        let endMin = parseTime(endStr);
        
        if (!endMin || endMin <= startMin) endMin = startMin + 5; 
        const startHourBound = START_HOUR * 60;
        if (startMin < startHourBound) startMin = startHourBound;

        const minutesFromStart = startMin - startHourBound;
        const blockIndex = Math.floor(minutesFromStart / 5);
        const startCol = 5 + blockIndex; 

        const offsetMinutes = minutesFromStart % 5;
        const marginLeftPct = (offsetMinutes / 5) * 100;
        
        const duration = endMin - startMin;
        const widthPct = (duration / 5) * 100;

        return { startCol, marginLeftPct, widthPct };
    }

    function renderGantt(events) {
        const grid = document.getElementById("ganttGrid");
        if (!grid) return;
        
        grid.innerHTML = "";
        const isAdmin = (localStorage.getItem("user_role_key") || "admin") === "admin";

        const phaseNames = {
            "0_vendor_coverage": "Vendor Coverage", 
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

        const allParties = [...new Set(events.flatMap(e => e.wedding_party || []))].filter(Boolean).sort();
        const allVendors = [...new Set(events.flatMap(e => e.vendor || []))].filter(Boolean).sort();

        const renderFilterPopup = (type, options, activeList) => {
            let listHTML = options.map(opt => {
                const checked = activeList.includes(opt) ? 'checked' : '';
                return `<label><input type="checkbox" value="${escapeHTML(opt)}" ${checked}> ${escapeHTML(opt)}</label>`;
            }).join('');
            
            return `
                <div class="filter-popup" id="${type}FilterPopup" onclick="window.stopProp(event)">
                    <div class="filter-list">${listHTML}</div>
                    <div class="filter-actions">
                        <button type="button" onclick="window.clearFilter('${type}')">Clear</button>
                        <button type="button" onclick="window.applyFilter('${type}')">Apply</button>
                    </div>
                </div>
            `;
        };

        // 1. HEADERS
        let html = `
            <div class="gantt-header-cell col-desc" style="grid-column: 1; grid-row: 1;">Item Description</div>
            <div class="gantt-header-cell col-time" style="grid-column: 2; grid-row: 1;">Time</div>
            
            <div class="gantt-header-cell col-party with-filter" style="grid-column: 3; grid-row: 1;">
                <span>Wedding Party</span>
                <button class="filter-btn ${window.activeFilters.party.length ? 'active' : ''}" onclick="window.toggleFilterPopup('party', event)">▼</button>
                ${renderFilterPopup('party', allParties, window.activeFilters.party)}
            </div>
            
            <div class="gantt-header-cell col-vendor with-filter" style="grid-column: 4; grid-row: 1;">
                <span>Vendor</span>
                <button class="filter-btn ${window.activeFilters.vendor.length ? 'active' : ''}" onclick="window.toggleFilterPopup('vendor', event)">▼</button>
                ${renderFilterPopup('vendor', allVendors, window.activeFilters.vendor)}
            </div>
        `;

        for (let h = START_HOUR; h < END_HOUR; h++) {
            const displayHour = h > 12 ? h - 12 : (h === 0 ? 12 : h);
            const ampm = h >= 12 ? 'PM' : 'AM';
            const startCol = 5 + ((h - START_HOUR) * 12); 
            html += `<div class="gantt-time-header" style="grid-column: ${startCol} / ${startCol + 12};">${displayHour} ${ampm}</div>`;
        }

        // --- FILTERING LOGIC ---
        let filteredEvents = events;
            
        if (window.activeFilters.party.length > 0) {
            filteredEvents = filteredEvents.filter(e => {
                if (!e.wedding_party) return false;
                const hasSelected = e.wedding_party.some(p => window.activeFilters.party.includes(p));
                const hasAll = e.wedding_party.some(p => p.toLowerCase() === 'all');
                return hasSelected || hasAll;
            });
        }

        if (window.activeFilters.vendor.length > 0) {
            filteredEvents = filteredEvents.filter(e => e.vendor && e.vendor.some(v => window.activeFilters.vendor.includes(v)));
        }
        
        // 2. ROWS
        let currentRow = 2;
        const groups = Object.keys(phaseNames);
        
        const uncategorizedEvents = filteredEvents.filter(e => !groups.includes(e.phase));
        const allGroupsToRender = [...groups];
        if (uncategorizedEvents.length > 0) allGroupsToRender.push("uncategorized");

        allGroupsToRender.forEach(phaseKey => {
            const isUncategorized = phaseKey === "uncategorized";
            const phaseEvents = isUncategorized ? uncategorizedEvents : filteredEvents.filter(e => e.phase === phaseKey);
            
            if (phaseEvents.length === 0) return;

            const label = isUncategorized ? "Needs Phase Assignment" : phaseNames[phaseKey];
            html += `
                <div class="gantt-phase-header phase-${phaseKey}" style="grid-row: ${currentRow}; grid-column: 1 / -1; ${isUncategorized ? 'background:#fef2f2; color:#b91c1c;' : ''}">
                    <span class="sticky-phase-label">${label}</span>
                </div>
            `;
            currentRow++;

            phaseEvents.forEach(ev => {
                const startVal = ev.start_time ? ev.start_time.substring(0,5) : "";
                const endVal = ev.end_time ? ev.end_time.substring(0,5) : "";

                if (isAdmin) {
                    html += `
                        <div class="gantt-cell col-desc" style="grid-column: 1; grid-row: ${currentRow}; display:flex; align-items:center;">
                            <input type="text" class="inline-input" data-id="${ev.id}" data-field="description" value="${escapeHTML(ev.description)}">
                            <button class="btn-mini-edit edit-trigger" data-id="${ev.id}" title="Edit colors/phase">✎</button>
                        </div>
                        <div class="gantt-cell col-time" style="grid-column: 2; grid-row: ${currentRow};">
                            <div class="time-input-group">
                                <input type="time" class="inline-input time-input" data-id="${ev.id}" data-field="start_time" value="${startVal}">
                                <span class="muted">-</span>
                                <input type="time" class="inline-input time-input" data-id="${ev.id}" data-field="end_time" value="${endVal}">
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
                const hoverText = `${escapeHTML(ev.description)} (${formatTimeDisplay(ev.start_time)} - ${formatTimeDisplay(ev.end_time)})`;
                
                html += `
                    <div class="gantt-block-container phase-${phaseKey}" style="grid-column: ${placement.startCol}; grid-row: ${currentRow}; margin-left: ${placement.marginLeftPct}%; width: ${placement.widthPct}%;">
                        <div class="gantt-block" data-tooltip="${hoverText}">
                            <span class="sticky-bar-text">
                                ${escapeHTML(ev.description)} 
                                <span class="bar-time">${formatTimeDisplay(ev.start_time)} - ${formatTimeDisplay(ev.end_time)}</span>
                            </span>
                        </div>
                    </div>
                `;
                currentRow++;
            });
        });

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

    async function handleInlineSave(inputEl) {
        const id = inputEl.getAttribute("data-id");
        const field = inputEl.getAttribute("data-field");
        let value = inputEl.value;

        const ev = currentEvents.find(e => String(e.id) === String(id));
        if (!ev) return;

        if ((field === "start_time" || field === "end_time") && !value) {
            alert("Time cannot be left blank.");
            inputEl.value = ev[field] ? ev[field].substring(0,5) : ""; 
            return; 
        }

        if (field === "wedding_party" || field === "vendor") {
            value = value.split(',').map(s => s.trim()).filter(Boolean);
        }

        ev[field] = value;
        inputEl.style.opacity = "0.5"; 

        try {
            const token = await waitForAuth();
            const res = await fetch("/api/timeline", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify(ev)
            });
            
            if (!res.ok) {
                const errorJson = await res.json();
                throw new Error(errorJson.error || "Save failed");
            }
            
            if (field === "start_time" || field === "end_time") {
                renderGantt(currentEvents);
            }
        } catch (e) {
            alert(e.message);
        } finally {
            inputEl.style.opacity = "1";
        }
    }

    // --- MODAL CONTROLS ---
    function openModal(eventData = null) {
        // Re-query dynamically to ensure we always grab the fresh elements from the router
        const modal = document.getElementById("modalAddEvent");
        const form = document.getElementById("formAddEvent");
        if (!modal || !form) return;
        
        form.reset();
        const isEdit = eventData && eventData.id;
        document.getElementById("modalEventTitle").textContent = isEdit ? "Edit Event" : "Add Timeline Event";
        document.getElementById("btnDeleteEvent").style.display = isEdit ? "block" : "none";
        
        if (isEdit) {
            document.getElementById("evId").value = eventData.id;
            document.getElementById("evDescription").value = eventData.description || "";
            document.getElementById("evStart").value = eventData.start_time ? eventData.start_time.substring(0,5) : "";
            document.getElementById("evEnd").value = eventData.end_time ? eventData.end_time.substring(0,5) : "";
            document.getElementById("evColor").value = eventData.color_code || "#bbf7d0";
            document.getElementById("evPhase").value = eventData.phase || "1_getting_ready";
            
            const setMulti = (id, arr) => {
                const sel = document.getElementById(id);
                if (!sel) return;
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
        const modal = document.getElementById("modalAddEvent");
        if (!modal) return;
        modal.style.display = "none";
        modal.setAttribute("aria-hidden", "true");
    }

    async function handleAddEvent(e) {
        e.preventDefault();
        const form = document.getElementById("formAddEvent");
        if (!form) return;

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

    async function handleDeleteEvent() {
        const evId = document.getElementById("evId")?.value;
        if (!evId || !confirm("Are you sure you want to delete this event?")) return;
        
        try {
            const token = await waitForAuth();
            await fetch(`/api/timeline/${evId}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` }});
            closeModal();
            await loadTimeline();
        } catch (err) { alert(err.message); }
    }

    // ==========================================
    // 2. ROUTER HOOKS
    // ==========================================

    // --- SPA ROUTER HOOKS ---
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initTimelinePage);
    } else {
        initTimelinePage(); // Run instantly if injected by the router!
    }
    window.addEventListener("app:navigated", initTimelinePage);
})();