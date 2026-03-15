// static/addressbook.js
(() => {  
  const API = {
    addressBook: "/api/address-book",
    patchParty: (partyId) => `/api/parties/${partyId}`,
    assignParty: (partyId) => `/api/parties/${partyId}/assign`
  };

  async function waitForAuth() {
    for (let i = 0; i < 50; i++) { // ~5 seconds
      if (window.AppAuth?.token) return window.AppAuth.token;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error("Auth not ready (AppAuth.token missing)");
  }

  // --- DEFINITIONS ---
  const ASSIGNMENT_GROUPS = [
      { id: 'group_emma_ethan', label: 'Emma & Ethan', color: '#fce7f3', text: '#be185d' }, 
      { id: 'group_amy_dave',   label: 'Amy & Dave',   color: '#dbeafe', text: '#1e40af' }, 
      { id: 'user_emily',       label: 'Emily',        color: '#f3f4f6', text: '#374151' }, 
      { id: 'user_carlos',      label: 'Carlos',       color: '#fef3c7', text: '#92400e' }, 
      { id: 'user_isabel',      label: 'Isabel',       color: '#d1fae5', text: '#065f46' }  
  ];

  const SYSTEM_USERS = [
    { id: '1', name: 'Emma Hernandez', role: 'admin', sidebarRole: 'admin', matchesGroups: ['group_emma_ethan'] },
    { id: '2', name: 'Ethan Wlodarczyk', role: 'admin', sidebarRole: 'admin', matchesGroups: ['group_emma_ethan'] },
    { id: '3', name: 'Amy Eiduke', role: 'contributor', sidebarRole: 'family', matchesGroups: ['group_amy_dave'] }, 
    { id: '4', name: 'Isabel Hernandez', role: 'contributor', sidebarRole: 'viewer', matchesGroups: ['user_isabel'] }
  ];

  // --- STATE ---
  let state = {
    rows: [],
    scope: 'assigned', // 'assigned' | 'all' | OR a specific group_id like 'group_amy_dave'
    filter: 'missing', // 'missing' | 'complete' | 'all'
    search: '',
    currentUser: null 
  };

  // --- HELPERS ---
  function detectCurrentUser() {
      const activeRole = localStorage.getItem('user_role_key') || 'admin';
      if (activeRole === 'family') return SYSTEM_USERS.find(u => u.sidebarRole === 'family');
      if (activeRole === 'viewer') return SYSTEM_USERS.find(u => u.sidebarRole === 'viewer');
      return SYSTEM_USERS.find(u => u.sidebarRole === 'admin');
  }

  function $(sel) { return document.querySelector(sel); }
  function esc(s) { return String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
  function setStatus(msg) { const el = $("#abStatus"); if (el) el.textContent = msg || ""; }
  function showToast(msg) {
    const t = $("#toast"); if (!t) return;
    t.textContent = msg; t.style.display = "block";
    setTimeout(() => { t.style.display = "none"; }, 1600);
  }

  function addressComplete(r) {
    return Boolean((r.address_street || "").trim() && (r.address_city || "").trim() && (r.address_state || "").trim() && (r.address_zip || "").trim());
  }

  function formatOneLine(r) {
    let csz = "";
    if (r.address_city) csz += r.address_city;
    if (r.address_state) csz += (csz ? ", " : "") + r.address_state;
    if (r.address_zip) csz += (csz ? " " : "") + r.address_zip;
    return [(r.address_street || "").trim(), (r.address_street2 || "").trim(), csz].filter(Boolean).join(", ");
  }

  function formatMembers(members = []) {
    if (!Array.isArray(members) || !members.length) return "—";
    let real = [], plus = 0;
    for (const m of members) {
      const f = String(m.first_name ?? "").trim(), l = String(m.last_name ?? "").trim();
      if (f.toLowerCase() === "guest" && !l) { plus++; continue; }
      const full = [f, l].filter(Boolean).join(" ").trim();
      if (full) real.push(full);
    }
    const base = real.join(", ") || "Guest";
    return plus > 0 ? `${base} (+${plus})` : base;
  }

  function buildMailingLabelText(r) {
      let csz = "";
      if (r.address_city) csz += r.address_city;
      if (r.address_state) csz += (csz ? ", " : "") + r.address_state;
      if (r.address_zip) csz += (csz ? " " : "") + r.address_zip;
      return [(r.party_name || r.legacy_key || "").trim(), (r.address_street || "").trim(), (r.address_street2 || "").trim(), csz].filter(Boolean).join("\n");
  }

  async function copyToClipboard(text, msg = "Copied") {
    try { await navigator.clipboard.writeText(text); showToast(msg); } 
    catch { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); showToast(msg); }
  }

  // --- DATA & SETUP ---
  async function loadAddressBook() {
    setStatus("Loading…");
    state.currentUser = detectCurrentUser();
    
    // Initialize Dropdown based on Role
    initViewDropdown();

    try {
      const token = await waitForAuth();
      const res = await fetch(`${API.addressBook}?scope=all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Load failed");
      state.rows = await res.json();
      setStatus("");
      render();
    } catch (err) {
      console.error(err);
      setStatus("Error loading data.");
    }
  }

  function initViewDropdown() {
      const sel = $("#addrScope");
      if (!sel) return;

      const currentVal = sel.value || 'assigned';

      let html = `
          <option value="assigned">Your Guests</option>
          <option value="all">All Guests</option>
      `;

      if (state.currentUser.role === 'admin') {
          html += `<optgroup label="Filter by Assignee">`;
          ASSIGNMENT_GROUPS.forEach(g => {
              html += `<option value="${g.id}">${esc(g.label)}</option>`;
          });
          html += `</optgroup>`;
      }

      sel.innerHTML = html;
      
      if (sel.querySelector(`option[value="${currentVal}"]`)) {
          sel.value = currentVal;
      } else {
          sel.value = 'assigned';
          state.scope = 'assigned';
      }
  }

  function getFilteredRows() {
    const q = state.search.trim().toLowerCase();
    return state.rows.filter((r) => {
      // 1. SCOPE LOGIC
      if (state.scope === 'assigned') {
          const rowAssignments = r.assigned_users || [];
          const userGroups = state.currentUser.matchesGroups || [];
          if (!rowAssignments.some(groupId => userGroups.includes(groupId))) return false;
      } 
      else if (state.scope !== 'all') {
          const rowAssignments = r.assigned_users || [];
          if (!rowAssignments.includes(state.scope)) return false;
      }

      // 2. STATUS
      const complete = addressComplete(r);
      if (state.filter === 'missing' && complete) return false;
      if (state.filter === 'complete' && !complete) return false;
      
      // 3. SEARCH
      if (!q) return true;
      const members = Array.isArray(r.members) ? r.members : [];
      const hay = [r.party_name, r.legacy_key, formatMembers(members), r.address_street].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }

  function render() {
    const list = $("#abList");
    if (!list || !state.currentUser) return;

    const data = getFilteredRows();

    // --- EMPTY STATES ---
    if (!data.length) {
      let html = "";
      
      if (state.search) {
          // Search Active
          if (state.scope === 'assigned') {
              html = `<div class="emptyState"><div class="emptyIcon">🤔</div><h3>"${esc(state.search)}" isn't assigned to you</h3><p>They might be in the main list.</p><div style="display:flex; gap:10px; justify-content:center;"><button class="emptyActionBtn" data-action="clearSearch">Clear Search</button><button class="emptyActionBtn primaryAction" data-action="viewAllScope">Search All Guests</button></div></div>`;
          } else {
              html = `<div class="emptyState"><div class="emptyIcon">🔍</div><h3>No results for "${esc(state.search)}"</h3><p>Check spelling or try a different keyword.</p><button class="emptyActionBtn" data-action="clearSearch">Clear Search</button></div>`;
          }
      } 
      else if (state.scope === 'assigned') {
          // Your Guests Empty
          if (state.filter === 'missing') {
              html = `<div class="emptyState"><div class="emptyIcon">🎉</div><h3>You're all set!</h3><p>No missing addresses currently assigned to ${esc(state.currentUser.name)}.</p><button class="emptyActionBtn primaryAction" data-action="viewAllScope">View All Guests</button></div>`;
          } else {
              html = `<div class="emptyState"><div class="emptyIcon">📇</div><h3>No guests found</h3><p>No guests match the current filters.</p><button class="emptyActionBtn primaryAction" data-action="viewAllScope">View All Guests</button></div>`;
          }
      } 
      else if (state.scope !== 'all') {
          // Specific Group Empty
          const group = ASSIGNMENT_GROUPS.find(g => g.id === state.scope);
          const name = group ? group.label : "this group";
          html = `<div class="emptyState"><div class="emptyIcon">👤</div><h3>No guests assigned to ${esc(name)}</h3><p>This list is currently empty for the selected status.</p><button class="emptyActionBtn primaryAction" data-action="viewAllScope">View All Guests</button></div>`;
      }
      else {
          // Global Empty
          html = `<div class="emptyState"><div class="emptyIcon">📂</div><h3>Address Book is Empty</h3><p>It looks like you haven't added any guests yet.</p></div>`;
      }

      list.innerHTML = html;
      return;
    }

    // --- LIST RENDERING ---
    const isAdmin = state.currentUser.role === 'admin';

    list.innerHTML = data.map((r) => {
      const complete = addressComplete(r);
      const addressLine = formatOneLine(r);
      const assignedIds = r.assigned_users || [];
      
      let chipsHtml = "";
      if (isAdmin && state.scope !== 'assigned' && assignedIds.length > 0) {
          chipsHtml = `<div class="assignmentChips" style="margin-bottom: 4px;">`;
          assignedIds.forEach(gid => {
              const group = ASSIGNMENT_GROUPS.find(g => g.id === gid);
              if (group) {
                  chipsHtml += `
                      <span class="assignChip" style="
                          display: inline-block; 
                          padding: 2px 8px; 
                          margin-right: 4px;
                          border-radius: 12px; 
                          font-size: 0.75rem; 
                          font-weight: 600; 
                          background:${group.color}; 
                          color:${group.text};
                      ">
                          ${esc(group.label)}
                      </span>`;
              }
          });
          chipsHtml += `</div>`;
      }

      let adminAssignUI = "";
      if (isAdmin) {
          const checkboxes = ASSIGNMENT_GROUPS.map(g => {
              const isChecked = assignedIds.includes(g.id) ? 'checked' : '';
              return `
                  <label class="assignTile" style="display:flex; align-items:center; gap:10px; padding:8px; border:1px solid #e5e7eb; border-radius:6px; cursor:pointer; border-left:4px solid ${g.text||'#ccc'};">
                      <input type="checkbox" name="assign_group" value="${g.id}" ${isChecked}>
                      <span style="font-size:0.9rem; font-weight:500;">${esc(g.label)}</span>
                  </label>`;
          }).join('');
          
          adminAssignUI = `
              <div class="abField" style="margin-bottom:24px; padding:16px; background:#f9fafb; border-radius:8px;">
                  <label style="display:block; font-size:0.75rem; font-weight:700; color:#9ca3af; margin-bottom:8px; text-transform:uppercase;">Assigned Responsibility</label>
                  <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap:10px;">${checkboxes}</div>
              </div>`;
      }

      return `
        <article class="abCard ${!complete ? "isMissing" : ""}" data-party-id="${esc(r.id)}">
          <div class="abTop">
            <div class="abMeta">
              <div class="abParty">${esc(r.party_name || "Party")}</div>
              ${chipsHtml}
              <div class="abMembers">${esc(formatMembers(r.members))}</div>
            </div>
            <div class="abRight">
              ${complete ? '<span class="abPill good">Collected</span>' : '<span class="abPill bad">Missing</span>'}
              <button class="abBtn" type="button" data-action="toggleEdit">Edit</button>
            </div>
          </div>

          <div class="abAddress">
            <div class="abAddrLeft">${addressLine ? esc(addressLine) : '<span class="muted">No address on file</span>'}</div>
            <div class="abActions">
              <button class="abBtn" type="button" data-action="copyAddress" ${addressLine ? "" : "disabled"}>Copy</button>
              <button class="abBtn" type="button" data-action="copyLabel" ${addressLine ? "" : "disabled"}>Copy Label</button>
            </div>
          </div>

          <div class="abEdit">
            <form class="abForm" autocomplete="off">
              ${adminAssignUI}
              <div class="abGrid">
                <div class="abField"><label>Street</label><input name="address_street" value="${esc(r.address_street)}" /></div>
                <div class="abField"><label>Street 2</label><input name="address_street2" value="${esc(r.address_street2)}" /></div>
                <div class="abField"><label>City</label><input name="address_city" value="${esc(r.address_city)}" /></div>
                <div class="abField"><label>State</label><input name="address_state" value="${esc(r.address_state)}" /></div>
                <div class="abField"><label>ZIP</label><input name="address_zip" value="${esc(r.address_zip)}" /></div>
              </div>
              <div class="abEditRow">
                <button class="abBtn" type="button" data-action="cancelEdit">Cancel</button>
                <button class="abBtn primary" type="submit">Save Changes</button>
                <span class="abSaveMsg"></span>
              </div>
            </form>
          </div>
        </article>
      `;
    }).join("");

    bindListEvents(list);
  }

  function bindListEvents(list) {
    list.onclick = (e) => {
        const emptyBtn = e.target.closest('[data-action]');
        if (emptyBtn && emptyBtn.classList.contains('emptyActionBtn')) {
            const action = emptyBtn.dataset.action;
            if (action === 'clearSearch') {
                state.search = '';
                const input = $("#addrSearch");
                if(input) input.value = '';
                render();
            } 
            else if (action === 'viewAllScope') {
                state.scope = 'all';
                const sel = $("#addrScope");
                if(sel) sel.value = 'all';
                render();
            } 
            return;
        }
    };

    list.querySelectorAll(".abCard").forEach((card) => {
      const partyId = card.getAttribute("data-party-id");
      const form = card.querySelector("form.abForm");
      const saveMsg = card.querySelector(".abSaveMsg");

      card.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;
        const action = btn.getAttribute("data-action");

        if (action === "toggleEdit") card.classList.toggle("isEditing");
        if (action === "cancelEdit") card.classList.remove("isEditing");
        if (action === "copyAddress") {
            const r = state.rows.find(x => String(x.id) === String(partyId));
            if(r) copyToClipboard(formatOneLine(r));
        }
        if (action === "copyLabel") {
            const r = state.rows.find(x => String(x.id) === String(partyId));
            if(r) copyToClipboard(buildMailingLabelText(r), "Label Copied");
        }
      });

      form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const addrPayload = {
          address_street: form.address_street.value,
          address_street2: form.address_street2.value,
          address_city: form.address_city.value,
          address_state: form.address_state.value,
          address_zip: form.address_zip.value,
        };

        try {
          if(saveMsg) saveMsg.textContent = "Saving...";

          const token = await waitForAuth();

          if (state.currentUser.role === 'admin') {
              const checkboxes = form.querySelectorAll('input[name="assign_group"]:checked');
              const newAssignments = Array.from(checkboxes).map(cb => cb.value);
              
              await fetch(API.assignParty(partyId), {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ assigned_users: newAssignments })
              });
              
              const r = state.rows.find(x => String(x.id) === String(partyId));
              if(r) r.assigned_users = newAssignments;
          }

          const res = await fetch(API.patchParty(partyId), {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(addrPayload)
          });
          if (!res.ok) throw new Error("Save failed");

          const idx = state.rows.findIndex(x => String(x.id) === String(partyId));
          if (idx >= 0) {
              state.rows[idx] = { ...state.rows[idx], ...addrPayload };
          }

          if(saveMsg) saveMsg.textContent = "Saved";
          setTimeout(() => { card.classList.remove("isEditing"); render(); }, 600);

        } catch (err) {
          console.error(err);
          if(saveMsg) saveMsg.textContent = "Error";
        }
      });
    });
  }

  function bindControls() {
    const search = $("#addrSearch");
    const scopeSelect = $("#addrScope");
    const filterBtns = document.querySelectorAll(".filterBtn");

    if(search) search.addEventListener("input", () => { state.search = search.value || ""; render(); });
    
    if(scopeSelect) {
        scopeSelect.addEventListener("change", (e) => { 
            state.scope = e.target.value; 
            render(); 
        });
    }

    filterBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        filterBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.filter = btn.getAttribute("data-filter") || "all";
        render();
      });
    });
  }

  window.forceScopeAll = function() { 
      state.scope = 'all'; 
      const sel = $("#addrScope");
      if(sel) sel.value = 'all'; 
      render(); 
  };

  // ==========================================
  // INIT & ROUTER HOOKS
  // ==========================================

  async function initAddressBookPage() {
      const abList = document.getElementById("abList");
      if (!abList) return; // Abort if we aren't on the Address Book page!

      // Sync UI with existing state if they navigated away and back
      const searchInput = document.getElementById("addrSearch");
      if (searchInput && state.search) searchInput.value = state.search;

      bindControls();
      await loadAddressBook();
  }

  // --- SPA ROUTER HOOKS ---
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAddressBookPage);
  } else {
    initAddressBookPage(); // Run instantly if injected by the router!
  }
  window.addEventListener("app:navigated", initAddressBookPage);

  if (!window.addressBookRoleBound) {
    window.addEventListener("roleChanged", (e) => {
        localStorage.setItem('user_role_key', e.detail.role);
        if (document.getElementById("abList")) loadAddressBook();
    });
    window.addressBookRoleBound = true;
  }
})();