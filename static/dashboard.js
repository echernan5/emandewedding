// dashboard.js
// RSVP Dashboard
// Uses:
//  - GET   /api/dashboard/metrics
//  - GET   /api/guestlist
//  - GET   /api/parties/<party_id>
//  - PATCH /api/parties/<party_id>
//  - PATCH /api/guests/<guest_id>

const API = {
    metrics: "/api/dashboard/metrics",
    guestlist: "/api/guestlist",
    partyDetails: (partyId) => `/api/parties/${partyId}`,
    patchParty: (partyId) => `/api/parties/${partyId}`,
    patchGuest: (guestId) => `/api/guests/${guestId}`,
  };
  
  const els = {
    // summary
    sumYes: document.getElementById("sumYes"),
    sumNo: document.getElementById("sumNo"),
    sumPending: document.getElementById("sumPending"),
    sumWelcomeYes: document.getElementById("sumWelcomeYes"),
    sumMissingAddresses: document.getElementById("sumMissingAddresses"),
  
    // view toggle
    btnPartyView: document.getElementById("btnPartyView"),
    btnIndividualView: document.getElementById("btnIndividualView"),
    partyView: document.getElementById("partyView"),
    individualView: document.getElementById("individualView"),
  
    // party view
    partyList: document.getElementById("partyList"),
    partyEmpty: document.getElementById("partyEmpty"),
  
    // individual view
    guestTbody: document.getElementById("guestTbody"),
    individualEmpty: document.getElementById("individualEmpty"),
  
    // filters
    searchInput: document.getElementById("searchInput"),
    filterWedding: document.getElementById("filterWedding"),
    filterWelcome: document.getElementById("filterWelcome"),
    btnClear: document.getElementById("btnClear"),
    btnRefresh: document.getElementById("btnRefresh"),
  
    // drawer shell (party drawer)
    drawer: document.getElementById("drawer"),
    drawerOverlay: document.getElementById("drawerOverlay"),
    drawerClose: document.getElementById("drawerClose"),
    drawerTitle: document.getElementById("drawerTitle"),
    drawerSubtitle: document.getElementById("drawerSubtitle"),
  
    // address inputs (party)
    addrStreet: document.getElementById("addrStreet"),
    addrStreet2: document.getElementById("addrStreet2"),
    addrCity: document.getElementById("addrCity"),
    addrState: document.getElementById("addrState"),
    addrZip: document.getElementById("addrZip"),
  
    // members list container
    membersList: document.getElementById("membersList"),
  
    // actions
    btnDrawerSave: document.getElementById("btnDrawerSave"),
    btnDrawerCancel: document.getElementById("btnDrawerCancel"),
    drawerMsg: document.getElementById("drawerMsg"),
  };
  
  let allGuests = [];
  let filteredGuests = [];
  
  let activeParty = null; // { party, members }
  let activePartySnapshot = null;
  
  // -------------------- utils --------------------
  function escapeHTML(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  
  function normalizeStatus(raw) {
    const s = (raw ?? "").toString().toLowerCase().trim();
    if (["accepted", "yes", "y"].includes(s)) return "accepted";
    if (["declined", "no", "n"].includes(s)) return "declined";
    if (["pending", ""].includes(s)) return "pending";
    return "pending";
  }
  
  function statusLabel(status) {
    const s = normalizeStatus(status);
    if (s === "accepted") return "Yes";
    if (s === "declined") return "No";
    return "Pending";
  }
  
  function statusClass(status) {
    const s = normalizeStatus(status);
    if (s === "accepted") return "status status--yes";
    if (s === "declined") return "status status--no";
    return "status status--pending";
  }
  
  function statusHTML(status) {
    const s = normalizeStatus(status);
    return `
      <span class="${statusClass(s)}">
        <span class="statusDot"></span>${statusLabel(s)}
      </span>
    `;
  }
  
  function lodgingLabel(raw) {
    const s = (raw ?? "").toString().toLowerCase().trim();
    const map = {
      bay_pointe: "Bay Pointe Inn",
      best_western: "Best Western",
      gun_lake: "Gun Lake",
      other: "Other",
      none: "None",
    };
    return map[s] || (raw ? String(raw) : "—");
  }
  
  // Normalize “party details” member object no matter what your backend returns
  function normalizeMember(m) {
    // guest id
    const guestId = m.guest_id ?? m.id ?? m.guestId ?? null;
  
    // names
    const first = m.first_name ?? m.first ?? "";
    const last = m.last_name ?? m.last ?? "";
  
    // statuses (support multiple keys)
    const wedding = normalizeStatus(m.rsvp_status ?? m.rsvp ?? m.wedding_rsvp ?? "");
    const welcome = normalizeStatus(
      m.welcome_dinner_rsvp ?? m.welcomeRSVP ?? m.welcome_rsvp ?? ""
    );
  
    // lodging + misc
    const lodging = (m.lodging ?? "").toString().toLowerCase().trim();
    const dietary =
      m.dietary_restrictions ?? m.dietaryrequest ?? m.dietary ?? "";
    const table = m.table_number ?? m.tablenumber ?? m.table ?? "";
    const side = m.side ?? "";
    const relationship = m.relationship ?? m.relation ?? "";
  
    return {
      guest_id: guestId,
      first_name: first,
      last_name: last,
      rsvp_status: wedding,
      welcome_dinner_rsvp: welcome,
      lodging: lodging,
      dietary_restrictions: dietary,
      table_number: table,
      side,
      relationship,
    };
  }
  
  // -------------------- fetch helpers --------------------
  async function fetchJSON(url) {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`${url} failed: ${res.status}`);
    return await res.json();
  }
  
  async function patchJSON(url, body) {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `${res.status} ${res.statusText}`);
    return data;
  }
  
  // -------------------- dashboard refresh --------------------
  async function refreshDashboard() {
    try {
      const [metrics, guestlist] = await Promise.all([
        fetchJSON(API.metrics),
        fetchJSON(API.guestlist),
      ]);
  
      renderSummary(metrics);
      allGuests = normalizeGuestlist(guestlist);
      applyFiltersAndRender();
    } catch (err) {
      console.error(err);
  
      if (els.sumYes) els.sumYes.textContent = "—";
      if (els.sumNo) els.sumNo.textContent = "—";
      if (els.sumPending) els.sumPending.textContent = "—";
  
      if (els.partyList) els.partyList.innerHTML = "";
      if (els.guestTbody) els.guestTbody.innerHTML = "";
  
      if (els.partyEmpty) els.partyEmpty.classList.remove("hidden");
      if (els.individualEmpty) els.individualEmpty.classList.remove("hidden");
    }
  }
  
  function renderSummary(metrics) {
    const yes = Number(metrics?.wedding_yes ?? 0);
    const no = Number(metrics?.wedding_no ?? 0);
    const pending = Number(metrics?.wedding_pending ?? 0);
  
    els.sumYes.textContent = yes;
    els.sumNo.textContent = no;
    els.sumPending.textContent = pending;
  
    els.sumWelcomeYes.textContent = Number(metrics?.welcome_dinner_yes ?? 0);
    els.sumMissingAddresses.textContent = Number(metrics?.missing_addresses ?? 0);
  }
  
  function normalizeGuestlist(rows) {
    // Expect: guest_id + party_id to enable drawer editing.
    return (rows || []).map((r, idx) => {
      const first =
        r.first_name ??
        (r.name ? (r.name.split(" ")[0] || "") : "");
  
      const last =
        r.last_name ??
        (r.name ? (r.name.split(" ").slice(1).join(" ") || "") : "");
  
      const guestId = r.guest_id ?? r.id ?? `row_${idx}`;
      const partyId = r.party_id ?? r.partyId ?? null;
  
      return {
        guest_id: guestId,
        party_id: partyId,
  
        first,
        last,
        name: (r.name || `${first} ${last}`).trim(),
  
        party: r.party ?? r.partyName ?? "—",
  
        rsvp: normalizeStatus(r.rsvp_status ?? r.rsvp ?? ""),
        welcomeRSVP: normalizeStatus(r.welcome_dinner_rsvp ?? r.welcomeRSVP ?? ""),
  
        lodging_raw: r.lodging || "",
        lodging: r.lodging ? lodgingLabel(r.lodging) : "—",
  
        dietary: r.dietary_restrictions ?? r.dietaryrequest ?? "",
        table: r.table_number ?? r.tablenumber ?? "",
        side: r.side ?? "",
        relation: r.relationship ?? r.relation ?? "",
      };
    });
  }
  
  // -------------------- filtering --------------------
  function applyFiltersAndRender() {
    const q = (els.searchInput.value || "").toLowerCase().trim();
    const fw = els.filterWedding.value;
    const fwel = els.filterWelcome.value;
  
    filteredGuests = allGuests.filter((g) => {
      const matchesSearch =
        !q ||
        g.first.toLowerCase().includes(q) ||
        g.last.toLowerCase().includes(q) ||
        (g.party || "").toLowerCase().includes(q) ||
        (g.lodging || "").toLowerCase().includes(q) ||
        (g.dietary || "").toLowerCase().includes(q);
  
      const matchesWedding = fw === "all" || g.rsvp === fw;
      const matchesWelcome = fwel === "all" || g.welcomeRSVP === fwel;
  
      return matchesSearch && matchesWedding && matchesWelcome;
    });
  
    renderPartyView(filteredGuests);
    renderIndividualView(filteredGuests);
  }
  
  function groupByParty(guests) {
    const map = new Map();
    for (const g of guests) {
      const key = g.party || "—";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(g);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }
  
  // -------------------- render: party view --------------------
  function renderPartyView(guests) {
    els.partyList.innerHTML = "";
    const grouped = groupByParty(guests);
  
    if (grouped.length === 0) {
      els.partyEmpty.classList.remove("hidden");
      return;
    }
    els.partyEmpty.classList.add("hidden");
  
    for (const [partyName, members] of grouped) {
      const yes = members.filter((m) => m.rsvp === "accepted").length;
      const no = members.filter((m) => m.rsvp === "declined").length;
      const pending = members.filter((m) => m.rsvp === "pending").length;
  
      const partyId = members.find((m) => m.party_id)?.party_id || null;
  
      const card = document.createElement("div");
      card.className = "partyCard";
  
      const header = document.createElement("div");
      header.className = "partyCard__header";
  
      const left = document.createElement("div");
      left.innerHTML = `
        <h3 class="partyCard__title">${escapeHTML(partyName)}</h3>
        <div class="partyCard__meta">${members.length} guest${members.length === 1 ? "" : "s"}</div>
      `;
  
      const right = document.createElement("div");
      right.className = "partyCard__badges";
      right.innerHTML = `
        <span class="miniStat miniStat--yes" title="Yes"><span class="miniStat__icon">✓</span><span class="miniStat__value">${yes}</span></span>
        <span class="miniStat miniStat--no" title="No"><span class="miniStat__icon">✕</span><span class="miniStat__value">${no}</span></span>
        <span class="miniStat miniStat--pending" title="Pending"><span class="miniStat__icon">?</span><span class="miniStat__value">${pending}</span></span>
      `;
  
      header.appendChild(left);
      header.appendChild(right);
  
      const body = document.createElement("div");
      body.className = "partyCard__body";
  
      const wrap = document.createElement("div");
      wrap.className = "tableWrap";
  
      const table = document.createElement("table");
      table.className = "partyTable";
      table.innerHTML = `
        <thead>
          <tr>
            <th>First</th><th>Last</th><th>Wedding RSVP</th><th>Welcome RSVP</th><th>Lodging</th><th>Dietary</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
  
      const tbody = table.querySelector("tbody");
  
      members
        .slice()
        .sort((a, b) => (a.last + a.first).localeCompare(b.last + b.first))
        .forEach((m) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${escapeHTML(m.first)}</td>
            <td>${escapeHTML(m.last)}</td>
            <td>${statusHTML(m.rsvp)}</td>
            <td>${statusHTML(m.welcomeRSVP)}</td>
            <td>${escapeHTML(m.lodging)}</td>
            <td>${escapeHTML(m.dietary ? m.dietary : "—")}</td>
          `;
  
          tr.addEventListener("click", () => {
            if (!partyId) {
              if (els.drawerMsg) els.drawerMsg.textContent = "This guest is missing party_id from the API.";
              return;
            }
            openPartyDrawerByPartyId(partyId);
          });
  
          tbody.appendChild(tr);
        });
  
      wrap.appendChild(table);
      body.appendChild(wrap);
  
      const footer = document.createElement("div");
      footer.className = "partyCard__footer";
      footer.textContent = partyId
        ? "Click a guest to edit this party."
        : "Add party_id to your /api/guestlist to enable editing.";
  
      card.appendChild(header);
      card.appendChild(body);
      card.appendChild(footer);
  
      els.partyList.appendChild(card);
    }
  }
  
  // -------------------- render: individual view --------------------
  function renderIndividualView(guests) {
    els.guestTbody.innerHTML = "";
  
    if (!guests.length) {
      els.individualEmpty.classList.remove("hidden");
      return;
    }
    els.individualEmpty.classList.add("hidden");
  
    for (const g of guests) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHTML(g.first)}</td>
        <td>${escapeHTML(g.last)}</td>
        <td>${escapeHTML(g.party)}</td>
        <td>${statusHTML(g.rsvp)}</td>
        <td>${statusHTML(g.welcomeRSVP)}</td>
        <td>${escapeHTML(g.lodging)}</td>
        <td>${escapeHTML(g.dietary ? g.dietary : "—")}</td>
      `;
      tr.style.cursor = "pointer";
      tr.addEventListener("click", () => {
        if (!g.party_id) {
          if (els.drawerMsg) els.drawerMsg.textContent = "This guest is missing party_id from the API.";
          return;
        }
        openPartyDrawerByPartyId(g.party_id);
      });
      els.guestTbody.appendChild(tr);
    }
  }
  
  // -------------------- party drawer --------------------
  async function openPartyDrawerByPartyId(partyId) {
    if (!partyId) return;
  
    if (!els.drawer || !els.membersList) {
      console.error("Drawer markup missing. Ensure #drawer and #membersList exist in HTML.");
      return;
    }
  
    // open drawer immediately
    if (els.drawerMsg) els.drawerMsg.textContent = "";
    if (els.drawerTitle) els.drawerTitle.textContent = "Party";
    if (els.drawerSubtitle) els.drawerSubtitle.textContent = "Loading…";
    els.membersList.innerHTML = `<div class="muted">Loading…</div>`;
  
    els.drawer.classList.add("is-open");
    els.drawer.setAttribute("aria-hidden", "false");
  
    try {
      const data = await fetchJSON(API.partyDetails(partyId));
      // expect { party: {...}, members: [...] }
      activeParty = {
        party: data.party || {},
        members: (data.members || []).map(normalizeMember),
      };
      activePartySnapshot = JSON.parse(JSON.stringify(activeParty));
  
      // header
      const displayName = activeParty.party.display_name || activeParty.party.name || "Party";
      if (els.drawerTitle) els.drawerTitle.textContent = displayName;
      if (els.drawerSubtitle) {
        els.drawerSubtitle.textContent = `${activeParty.members.length} guest${activeParty.members.length === 1 ? "" : "s"}`;
      }
  
      // address
      if (els.addrStreet) els.addrStreet.value = activeParty.party.address_street || "";
      if (els.addrStreet2) els.addrStreet2.value = activeParty.party.address_street2 || "";
      if (els.addrCity) els.addrCity.value = activeParty.party.address_city || "";
      if (els.addrState) els.addrState.value = activeParty.party.address_state || "";
      if (els.addrZip) els.addrZip.value = activeParty.party.address_zip || "";
  
      renderMembersEditor(activeParty.members);
    } catch (e) {
      console.error(e);
      els.membersList.innerHTML = "";
      if (els.drawerMsg) els.drawerMsg.textContent = `Error: ${e.message}`;
    }
  }
  
  function renderMembersEditor(members) {
    // IMPORTANT: membersBody has an ID so we can reliably grab it.
    els.membersList.innerHTML = `
      <div class="membersTable">
        <div class="membersHead">
          <div>First</div>
          <div>Last</div>
          <div>Wedding</div>
          <div>Welcome</div>
          <div>Lodging</div>
          <div>Dietary</div>
          <div>Table</div>
          <div>Side</div>
          <div>Relationship</div>
        </div>
        <div class="membersBody" id="membersBody"></div>
      </div>
    `;
  
    const body = document.getElementById("membersBody");
    if (!body) {
      console.error("Drawer markup missing #membersBody (renderMembersEditor).");
      return;
    }
  
    members.forEach((m) => {
      const row = document.createElement("div");
      row.className = "membersRow";
      row.dataset.guestId = m.guest_id || "";
  
      row.innerHTML = `
        <div><input class="input input--sm" data-field="first_name" value="${escapeHTML(m.first_name)}"></div>
        <div><input class="input input--sm" data-field="last_name" value="${escapeHTML(m.last_name)}"></div>
  
        <div>
          <select class="select select--sm" data-field="rsvp_status">
            <option value="pending" ${m.rsvp_status === "pending" ? "selected" : ""}>Pending</option>
            <option value="accepted" ${m.rsvp_status === "accepted" ? "selected" : ""}>Yes</option>
            <option value="declined" ${m.rsvp_status === "declined" ? "selected" : ""}>No</option>
          </select>
        </div>
  
        <div>
          <select class="select select--sm" data-field="welcome_dinner_rsvp">
            <option value="pending" ${m.welcome_dinner_rsvp === "pending" ? "selected" : ""}>Pending</option>
            <option value="accepted" ${m.welcome_dinner_rsvp === "accepted" ? "selected" : ""}>Yes</option>
            <option value="declined" ${m.welcome_dinner_rsvp === "declined" ? "selected" : ""}>No</option>
          </select>
        </div>
  
        <div>
          <select class="select select--sm" data-field="lodging">
            <option value="" ${!m.lodging ? "selected" : ""}>—</option>
            <option value="bay_pointe" ${m.lodging === "bay_pointe" ? "selected" : ""}>Bay Pointe</option>
            <option value="best_western" ${m.lodging === "best_western" ? "selected" : ""}>Best Western</option>
            <option value="gun_lake" ${m.lodging === "gun_lake" ? "selected" : ""}>Gun Lake</option>
            <option value="other" ${m.lodging === "other" ? "selected" : ""}>Other</option>
            <option value="none" ${m.lodging === "none" ? "selected" : ""}>None</option>
          </select>
        </div>
  
        <div><input class="input input--sm" data-field="dietary_restrictions" value="${escapeHTML(m.dietary_restrictions)}"></div>
        <div><input class="input input--sm" type="number" data-field="table_number" value="${escapeHTML(m.table_number)}"></div>
        <div><input class="input input--sm" data-field="side" value="${escapeHTML(m.side)}"></div>
        <div><input class="input input--sm" data-field="relationship" value="${escapeHTML(m.relationship)}"></div>
      `;
  
      body.appendChild(row);
    });
  }
  
  function closeDrawer() {
    if (!els.drawer) return;
    els.drawer.classList.remove("is-open");
    els.drawer.setAttribute("aria-hidden", "true");
    if (els.drawerMsg) els.drawerMsg.textContent = "";
  }
  
  function collectPartyAddressPayload() {
    return {
      address_street: (els.addrStreet?.value || "").trim() || null,
      address_street2: (els.addrStreet2?.value || "").trim() || null,
      address_city: (els.addrCity?.value || "").trim() || null,
      address_state: (els.addrState?.value || "").trim() || null,
      address_zip: (els.addrZip?.value || "").trim() || null,
    };
  }
  
  function collectGuestPayloadFromRow(row) {
    const payload = {};
    const fields = [...row.querySelectorAll("[data-field]")];
  
    fields.forEach((el) => {
      const key = el.dataset.field;
      let val = el.value;
  
      if (key === "table_number") {
        val = val ? Number(val) : null;
      } else {
        val = (val ?? "").toString().trim();
        if (val === "") val = null;
      }
  
      payload[key] = val;
    });
  
    return payload;
  }
  
  // -------------------- drawer actions --------------------
  if (els.btnDrawerCancel) {
    els.btnDrawerCancel.addEventListener("click", () => {
      if (!activePartySnapshot) return closeDrawer();
  
      activeParty = JSON.parse(JSON.stringify(activePartySnapshot));
  
      const displayName = activeParty.party.display_name || activeParty.party.name || "Party";
      if (els.drawerTitle) els.drawerTitle.textContent = displayName;
      if (els.drawerSubtitle) {
        els.drawerSubtitle.textContent = `${activeParty.members.length} guest${activeParty.members.length === 1 ? "" : "s"}`;
      }
  
      if (els.addrStreet) els.addrStreet.value = activeParty.party.address_street || "";
      if (els.addrStreet2) els.addrStreet2.value = activeParty.party.address_street2 || "";
      if (els.addrCity) els.addrCity.value = activeParty.party.address_city || "";
      if (els.addrState) els.addrState.value = activeParty.party.address_state || "";
      if (els.addrZip) els.addrZip.value = activeParty.party.address_zip || "";
  
      renderMembersEditor(activeParty.members);
      if (els.drawerMsg) els.drawerMsg.textContent = "";
    });
  }
  
  if (els.btnDrawerSave) {
    els.btnDrawerSave.addEventListener("click", async () => {
      const partyId = activeParty?.party?.id;
      if (!partyId) {
        if (els.drawerMsg) els.drawerMsg.textContent = "Missing party id.";
        return;
      }
  
      els.btnDrawerSave.disabled = true;
      if (els.drawerMsg) els.drawerMsg.textContent = "Saving…";
  
      try {
        // party address update
        const partyPayload = collectPartyAddressPayload();
  
        // guest updates
        const memberRows = [...els.membersList.querySelectorAll(".membersRow")];
        if (!memberRows.length) throw new Error("No party members found to save.");
  
        const bad = memberRows.find((r) => !r.dataset.guestId);
        if (bad) throw new Error("Missing guest_id for at least one member.");
  
        const guestRequests = memberRows.map((row) => {
          const guestId = row.dataset.guestId;
          const payload = collectGuestPayloadFromRow(row);
          return patchJSON(API.patchGuest(guestId), payload);
        });
  
        await Promise.all([
          patchJSON(API.patchParty(partyId), partyPayload),
          ...guestRequests,
        ]);
  
        if (els.drawerMsg) els.drawerMsg.textContent = "Saved";
        await refreshDashboard();
      } catch (e) {
        console.error(e);
        if (els.drawerMsg) els.drawerMsg.textContent = `Error: ${e.message}`;
      } finally {
        els.btnDrawerSave.disabled = false;
      }
    });
  }
  
  // -------------------- view toggle --------------------
  function setView(which) {
    const party = which === "party";
    els.partyView.classList.toggle("view--active", party);
    els.individualView.classList.toggle("view--active", !party);
  
    els.btnPartyView.classList.toggle("is-active", party);
    els.btnIndividualView.classList.toggle("is-active", !party);
  
    els.btnPartyView.setAttribute("aria-selected", party ? "true" : "false");
    els.btnIndividualView.setAttribute("aria-selected", party ? "false" : "true");
  }
  
  if (els.btnPartyView) els.btnPartyView.addEventListener("click", () => setView("party"));
  if (els.btnIndividualView) els.btnIndividualView.addEventListener("click", () => setView("individual"));
  
  // -------------------- filters --------------------
  ["input", "change"].forEach((evt) => {
    if (els.searchInput) els.searchInput.addEventListener(evt, applyFiltersAndRender);
    if (els.filterWedding) els.filterWedding.addEventListener(evt, applyFiltersAndRender);
    if (els.filterWelcome) els.filterWelcome.addEventListener(evt, applyFiltersAndRender);
  });
  
  if (els.btnClear) {
    els.btnClear.addEventListener("click", () => {
      els.searchInput.value = "";
      els.filterWedding.value = "all";
      els.filterWelcome.value = "all";
      applyFiltersAndRender();
    });
  }
  
  if (els.btnRefresh) els.btnRefresh.addEventListener("click", refreshDashboard);
  
  // -------------------- drawer close events --------------------
  if (els.drawerOverlay) els.drawerOverlay.addEventListener("click", closeDrawer);
  if (els.drawerClose) els.drawerClose.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });
  
  // init
  refreshDashboard();
  