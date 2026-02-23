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

  // RSVP visual bar
  rsvpBarYes: document.getElementById("rsvpBarYes"),
  rsvpBarNo: document.getElementById("rsvpBarNo"),
  rsvpBarPending: document.getElementById("rsvpBarPending"),
  rsvpYesN: document.getElementById("rsvpYesN"),
  rsvpNoN: document.getElementById("rsvpNoN"),
  rsvpPendingN: document.getElementById("rsvpPendingN"),

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

  // NEW summary fields
  sumUnder21: document.getElementById("sumUnder21"),
  sumLodgingAssigned: document.getElementById("sumLodgingAssigned"),
  sumLodgeBayPointe: document.getElementById("sumLodgeBayPointe"),
  sumLodgeBestWestern: document.getElementById("sumLodgeBestWestern"),
  sumLodgeGunLake: document.getElementById("sumLodgeGunLake"),
  sumLodgeOther: document.getElementById("sumLodgeOther"),
  sumLodgeNone: document.getElementById("sumLodgeNone"),
};

// -------------------- auth helpers --------------------
// Expects something else to set window.AppAuth.token (Supabase access token)
async function waitForAuth() {
  for (let i = 0; i < 50; i++) { // up to ~5s
    if (window.AppAuth?.token) return window.AppAuth.token;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Auth not ready (AppAuth.token missing)");
}

// -------------------- fetch helpers (AUTH'D) --------------------
async function fetchJSON(url) {
  const token = await waitForAuth();
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error(`${url} failed: ${res.status}`);
  return await res.json();
}

async function patchJSON(url, body) {
  const token = await waitForAuth();
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${res.status} ${res.statusText}`);
  return data;
}

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

  let icon = "?";
  if (s === "accepted") icon = "✓";
  if (s === "declined") icon = "✕";

  return `
    <span class="status status--${s}" title="${statusLabel(s)}">
      <span class="statusBadge">${icon}</span>
    </span>
  `;
}

function lodgingKey(raw) {
  const s = (raw ?? "").toString().toLowerCase().trim();
  if (!s) return "";
  // Normalize display labels back to keys if needed
  if (s.includes("bay pointe")) return "bay_pointe";
  if (s.includes("best western")) return "best_western";
  if (s.includes("gun lake")) return "gun_lake";
  if (s === "other") return "other";
  if (s === "none" || s === "—") return "none";
  return s; // already a key like bay_pointe
}

function lodgingPillHTML(raw) {
  const key = lodgingKey(raw);

  // Treat blank as empty
  if (!key || key === "none") {
    return `<span class="lodgePill lodgePill--none">None</span>`;
  }

  const label = lodgingLabel(key); // uses your existing map
  return `<span class="lodgePill lodgePill--${escapeHTML(key)}">${escapeHTML(label)}</span>`;
}

function initialsFromName(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "P";
  const a = parts[0][0] || "";
  const b = parts.length > 1 ? (parts[1][0] || "") : "";
  return (a + b).toUpperCase() || "P";
}

function compactAddress(party) {
  const city = (party?.address_city || "").trim();
  const state = (party?.address_state || "").trim();
  const zip = (party?.address_zip || "").trim();
  const line = [city, state].filter(Boolean).join(", ");
  return [line, zip].filter(Boolean).join(" ") || "Address not set";
}

function parseAgeFromGuest(g) {
  // If your API already sends age (best case)
  const age = g.age ?? g.guest_age ?? null;
  if (age !== null && age !== undefined && age !== "") {
    const n = Number(age);
    return Number.isFinite(n) ? n : null;
  }

  // If your API sends dob/birthdate
  const dobRaw = g.dob ?? g.birthdate ?? g.date_of_birth ?? null;
  if (!dobRaw) return null;

  const d = new Date(dobRaw);
  if (Number.isNaN(d.getTime())) return null;

  const now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) years--;
  return years;
}

function computeUnder21Count(guests) {
  return guests.reduce((acc, g) => {
    // If API gives a direct boolean/flag, honor it
    const flag = g.under21 ?? g.under_21 ?? g.is_under_21 ?? null;
    if (flag === true) return acc + 1;
    if (flag === false) return acc;

    const age = parseAgeFromGuest(g);
    if (age === null) return acc; // unknown age -> don’t count
    return acc + (age < 21 ? 1 : 0);
  }, 0);
}

function lodgingKeyFromGuest(g) {
  const raw = (g.lodging_raw ?? g.lodging ?? "").toString().toLowerCase().trim();

  if (!raw) return "none";
  if (raw.includes("bay_pointe") || raw.includes("bay pointe")) return "bay_pointe";
  if (raw.includes("best_western") || raw.includes("best western")) return "best_western";
  if (raw.includes("gun_lake") || raw.includes("gun lake")) return "gun_lake";
  if (raw === "other") return "other";
  if (raw === "none" || raw === "—") return "none";

  // fallback: if something unexpected comes in, treat as "other"
  return "other";
}

function computeLodgingCounts(guests) {
  const counts = {
    bay_pointe: 0,
    best_western: 0,
    gun_lake: 0,
    other: 0,
    none: 0,
  };

  guests.forEach((g) => {
    const key = lodgingKeyFromGuest(g);
    counts[key] = (counts[key] || 0) + 1;
  });

  const assigned = counts.bay_pointe + counts.best_western + counts.gun_lake + counts.other;

  return { counts, assigned };
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
  const dietary = m.dietary_restrictions ?? m.dietaryrequest ?? m.dietary ?? "";
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

// -------------------- dashboard refresh --------------------
async function refreshDashboard() {
  try {
    const [metrics, guestlist] = await Promise.all([
      fetchJSON(API.metrics),
      fetchJSON(API.guestlist),
    ]);

    // Save + normalize guest list (used for views + filters)
    allGuests = normalizeGuestlist(guestlist);

    // Update summary + bar + meta counts
    renderSummary(metrics, allGuests);

    // Apply filters and render both views
    applyFiltersAndRender();
  } catch (err) {
    console.error(err);

    // Summary fallbacks
    if (els.sumYes) els.sumYes.textContent = "—";
    if (els.sumNo) els.sumNo.textContent = "—";
    if (els.sumPending) els.sumPending.textContent = "—";
    if (els.sumUnder21) els.sumUnder21.textContent = "—";

    if (els.sumWelcomeYes) els.sumWelcomeYes.textContent = "—";
    if (els.sumMissingAddresses) els.sumMissingAddresses.textContent = "—";
    if (els.sumLodgingAssigned) els.sumLodgingAssigned.textContent = "—";

    if (els.sumLodgeBayPointe) els.sumLodgeBayPointe.textContent = "—";
    if (els.sumLodgeBestWestern) els.sumLodgeBestWestern.textContent = "—";
    if (els.sumLodgeGunLake) els.sumLodgeGunLake.textContent = "—";
    if (els.sumLodgeOther) els.sumLodgeOther.textContent = "—";
    if (els.sumLodgeNone) els.sumLodgeNone.textContent = "—";

    // Bar fallbacks
    if (els.rsvpYesN) els.rsvpYesN.textContent = "—";
    if (els.rsvpNoN) els.rsvpNoN.textContent = "—";
    if (els.rsvpPendingN) els.rsvpPendingN.textContent = "—";

    if (els.rsvpBarYes) els.rsvpBarYes.style.width = "0%";
    if (els.rsvpBarNo) els.rsvpBarNo.style.width = "0%";
    if (els.rsvpBarPending) els.rsvpBarPending.style.width = "0%";

    // Clear lists
    if (els.partyList) els.partyList.innerHTML = "";
    if (els.guestTbody) els.guestTbody.innerHTML = "";

    if (els.partyEmpty) els.partyEmpty.classList.remove("hidden");
    if (els.individualEmpty) els.individualEmpty.classList.remove("hidden");
  }
}

function renderSummary(metrics, guestRows) {
  // Wedding counts from metrics
  const yes = Number(metrics?.wedding_yes ?? 0);
  const no = Number(metrics?.wedding_no ?? 0);
  const pending = Number(metrics?.wedding_pending ?? 0);
  const total = yes + no + pending;

  // Cards
  if (els.sumYes) els.sumYes.textContent = yes;
  if (els.sumNo) els.sumNo.textContent = no;
  if (els.sumPending) els.sumPending.textContent = pending;

  // Right meta
  if (els.sumWelcomeYes) els.sumWelcomeYes.textContent = Number(metrics?.welcome_dinner_yes ?? 0);
  if (els.sumMissingAddresses) els.sumMissingAddresses.textContent = Number(metrics?.missing_addresses ?? 0);

  // Under 21 (computed from guest rows if possible)
  if (els.sumUnder21) {
    const under21 = computeUnder21Count(guestRows);
    els.sumUnder21.textContent = String(under21);
  }

  // Lodging (computed from guest rows)
  const { counts, assigned } = computeLodgingCounts(guestRows);
  if (els.sumLodgingAssigned) els.sumLodgingAssigned.textContent = String(assigned);

  if (els.sumLodgeBayPointe) els.sumLodgeBayPointe.textContent = String(counts.bay_pointe || 0);
  if (els.sumLodgeBestWestern) els.sumLodgeBestWestern.textContent = String(counts.best_western || 0);
  if (els.sumLodgeGunLake) els.sumLodgeGunLake.textContent = String(counts.gun_lake || 0);
  if (els.sumLodgeOther) els.sumLodgeOther.textContent = String(counts.other || 0);
  if (els.sumLodgeNone) els.sumLodgeNone.textContent = String(counts.none || 0);

  // Bar numbers
  if (els.rsvpYesN) els.rsvpYesN.textContent = yes;
  if (els.rsvpNoN) els.rsvpNoN.textContent = no;
  if (els.rsvpPendingN) els.rsvpPendingN.textContent = pending;

  // Bar widths
  const pct = (n) => (total > 0 ? (n / total) * 100 : 0);

  if (els.rsvpBarYes) els.rsvpBarYes.style.width = `${pct(yes)}%`;
  if (els.rsvpBarNo) els.rsvpBarNo.style.width = `${pct(no)}%`;
  if (els.rsvpBarPending) els.rsvpBarPending.style.width = `${pct(pending)}%`;
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
          <th>First</th><th>Last</th><th>Wedding</th><th>Welcome</th><th>Lodging</th><th>Dietary</th>
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
          <td>${lodgingPillHTML(m.lodging_raw || m.lodging)}</td>
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
      <td>${lodgingPillHTML(g.lodging_raw || g.lodging)}</td>
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
  els.membersList.innerHTML = `
    <div class="drawerCard">
      <div class="drawerCard__head">
        <div class="drawerCard__title">Party members</div>
        <div class="muted" style="font-size:12px;">Edit RSVPs, lodging, dietary, table</div>
      </div>
      <div class="drawerCard__body">
        <div class="membersCards" id="membersCards"></div>
      </div>
    </div>
  `;

  const wrap = document.getElementById("membersCards");
  if (!wrap) return;

  members.forEach((m) => {
    const card = document.createElement("div");
    card.className = "memberCard membersRow"; // keep membersRow for save querySelector
    card.dataset.guestId = m.guest_id || "";

    const name = `${m.first_name || ""} ${m.last_name || ""}`.trim() || "Guest";

    card.innerHTML = `
      <div class="memberCard__top">
        <div style="min-width:0;">
          <div class="memberName">${escapeHTML(name)}</div>
          <div class="memberSub">${escapeHTML(m.relationship || "—")}</div>
        </div>
        <div class="muted" style="font-size:12px; white-space:nowrap;">
          Guest ID: ${escapeHTML(m.guest_id || "—")}
        </div>
      </div>

      <div class="memberCard__grid">
        <div class="miniField">
          <div class="miniLabel">First</div>
          <input class="input" data-field="first_name" value="${escapeHTML(m.first_name)}">
        </div>

        <div class="miniField">
          <div class="miniLabel">Last</div>
          <input class="input" data-field="last_name" value="${escapeHTML(m.last_name)}">
        </div>

        <div class="miniField">
          <div class="miniLabel">Wedding</div>
          <select class="select" data-field="rsvp_status">
            <option value="pending" ${m.rsvp_status === "pending" ? "selected" : ""}>Pending</option>
            <option value="accepted" ${m.rsvp_status === "accepted" ? "selected" : ""}>Yes</option>
            <option value="declined" ${m.rsvp_status === "declined" ? "selected" : ""}>No</option>
          </select>
        </div>

        <div class="miniField">
          <div class="miniLabel">Welcome</div>
          <select class="select" data-field="welcome_dinner_rsvp">
            <option value="pending" ${m.welcome_dinner_rsvp === "pending" ? "selected" : ""}>Pending</option>
            <option value="accepted" ${m.welcome_dinner_rsvp === "accepted" ? "selected" : ""}>Yes</option>
            <option value="declined" ${m.welcome_dinner_rsvp === "declined" ? "selected" : ""}>No</option>
          </select>
        </div>

        <div class="miniField">
          <div class="miniLabel">Lodging</div>
          <select class="select" data-field="lodging">
            <option value="" ${!m.lodging ? "selected" : ""}>—</option>
            <option value="bay_pointe" ${m.lodging === "bay_pointe" ? "selected" : ""}>Bay Pointe</option>
            <option value="best_western" ${m.lodging === "best_western" ? "selected" : ""}>Best Western</option>
            <option value="gun_lake" ${m.lodging === "gun_lake" ? "selected" : ""}>Gun Lake</option>
            <option value="other" ${m.lodging === "other" ? "selected" : ""}>Other</option>
            <option value="none" ${m.lodging === "none" ? "selected" : ""}>None</option>
          </select>
        </div>

        <div class="miniField">
          <div class="miniLabel">Dietary</div>
          <input class="input" data-field="dietary_restrictions" value="${escapeHTML(m.dietary_restrictions)}">
        </div>

        <div class="miniField">
          <div class="miniLabel">Table</div>
          <input class="input" type="number" data-field="table_number" value="${escapeHTML(m.table_number)}">
        </div>

        <div class="miniField">
          <div class="miniLabel">Side</div>
          <input class="input" data-field="side" value="${escapeHTML(m.side)}">
        </div>

        <div class="miniField" style="grid-column: 1 / -1;">
          <div class="miniLabel">Relationship</div>
          <input class="input" data-field="relationship" value="${escapeHTML(m.relationship)}">
        </div>
      </div>
    `;

    wrap.appendChild(card);
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

    // avatar + address hint + chips
    const avatarEl = document.getElementById("drawerAvatar");
    if (avatarEl) avatarEl.textContent = initialsFromName(displayName);

    const hintEl = document.getElementById("drawerAddressHint");
    if (hintEl) hintEl.textContent = compactAddress(activeParty.party);

    // chips: quick party stats (wedding RSVP)
    const chipWrap = document.getElementById("drawerChips");
    if (chipWrap) {
      const yes = activeParty.members.filter((m) => m.rsvp_status === "accepted").length;
      const no = activeParty.members.filter((m) => m.rsvp_status === "declined").length;
      const pending = activeParty.members.filter((m) => m.rsvp_status === "pending").length;

      chipWrap.innerHTML = `
        <span class="chip chip--yes"><span class="chipDot"></span>Yes ${yes}</span>
        <span class="chip chip--no"><span class="chipDot"></span>No ${no}</span>
        <span class="chip chip--pending"><span class="chipDot"></span>Pending ${pending}</span>
      `;
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

// init (wait for auth first so we don’t race)
(async () => {
  try {
    await waitForAuth();
    await refreshDashboard();
  } catch (e) {
    console.error(e);
  }
})();
