// static/addressbook.js
// Endpoints used:
//  - GET   /api/address-book
//  - PATCH /api/parties/<party_id>

const API = {
    addressBook: "/api/address-book",
    patchParty: (partyId) => `/api/parties/${partyId}`,
  };
  
  let rows = [];
  let filterMode = "all"; // all | missing | complete
  let searchQuery = "";
  
  function $(sel) {
    return document.querySelector(sel);
  }
  
  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  
  /**
   * Required for "Collected":
   *  - street, city, state, zip
   * Street 2 is optional.
   *
   * IMPORTANT: We compute this from fields every time (don’t trust DB boolean),
   * because your DB flag might not be perfectly maintained historically.
   */
  function addressComplete(r) {
    const street = String(r.address_street ?? "").trim();
    const city = String(r.address_city ?? "").trim();
    const st = String(r.address_state ?? "").trim();
    const zip = String(r.address_zip ?? "").trim();
    return Boolean(street && city && st && zip);
  }
  
  function normalizeZip(zip) {
    return String(zip ?? "").trim();
  }
  
  function formatCityStateZip(r) {
    const city = (r.address_city || "").trim();
    const st = (r.address_state || "").trim();
    const zip = (r.address_zip || "").trim();
  
    let out = "";
    if (city) out += city;
    if (st) out += (city ? ", " : "") + st;
    if (zip) out += (out ? " " : "") + zip;
  
    return out.trim();
  }
  
  function formatOneLine(r) {
    const parts = [
      (r.address_street || "").trim(),
      (r.address_street2 || "").trim(),
      formatCityStateZip(r), // <-- City, ST ZIP
    ].filter(Boolean);
  
    return parts.join(", ");
  }  
  
  function buildMailingLabelText(r) {
    const partyName = (r.party_name || r.legacy_key || "").trim();
    const street1 = (r.address_street || "").trim();
    const street2 = (r.address_street2 || "").trim();
    const cityStateZip = formatCityStateZip(r);
  
    // IMPORTANT: no members line
    const lines = [partyName, street1, street2, cityStateZip].filter(Boolean);
    return lines.join("\n");
  }

  /**
   * Converts anonymous plus-ones:
   *  - first_name === "Guest" AND empty last_name
   * into " (+1)" appended to real member list.
   */
  function formatMembers(members = []) {
    if (!Array.isArray(members) || !members.length) return "—";
  
    const realGuests = [];
    let plusOnes = 0;
  
    for (const m of members) {
      const first = String(m.first_name ?? "").trim();
      const last = String(m.last_name ?? "").trim();
  
      const isAnonymousPlusOne =
        first.toLowerCase() === "guest" && !last;
  
      if (isAnonymousPlusOne) {
        plusOnes += 1;
        continue;
      }
  
      const full = [first, last].filter(Boolean).join(" ").trim();
      if (full) realGuests.push(full);
    }
  
    const base = realGuests.join(", ") || "Guest";
    if (plusOnes > 0) return `${base} (+${plusOnes})`;
    return base;
  }
  
  function setStatus(msg) {
    const el = $("#abStatus");
    if (!el) return;
    el.textContent = msg || "";
  }
  
  function showToast(msg) {
    const t = $("#toast");
    if (!t) return;
    t.textContent = msg;
    t.style.display = "block";
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      t.style.display = "none";
    }, 1600);
  }
  
  async function copyToClipboard(text) {
    const value = String(text ?? "").trim();
    if (!value) return;
  
    try {
      await navigator.clipboard.writeText(value);
      showToast("Copied");
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      showToast("Copied");
    }
  }
  
  async function loadAddressBook() {
    setStatus("Loading…");
    try {
      const res = await fetch(API.addressBook, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`GET /api/address-book failed (${res.status})`);
      rows = await res.json();
      setStatus("");
      render();
    } catch (err) {
      console.error(err);
      setStatus("Could not load data. Check console + Flask terminal logs.");
    }
  }
  
  function getFilteredRows() {
    const q = searchQuery.trim().toLowerCase();
  
    return rows.filter((r) => {
      const complete = addressComplete(r);
  
      if (filterMode === "missing" && complete) return false;
      if (filterMode === "complete" && !complete) return false;
  
      if (!q) return true;
  
      const members = Array.isArray(r.members) ? r.members : [];
      const memberLabel = formatMembers(members);
  
      const hay = [
        r.party_name,
        r.legacy_key,
        memberLabel,
        r.address_street,
        r.address_street2,
        r.address_city,
        r.address_state,
        r.address_zip,
        formatOneLine(r),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
  
      return hay.includes(q);
    });
  }
  
  function render() {
  
    const list = $("#abList");
    if (!list) return;
  
    const data = getFilteredRows();
  
    if (!data.length) {
      list.innerHTML = `<div class="ab-empty">No results. Try clearing filters/search.</div>`;
      return;
    }
  
    list.innerHTML = data
      .map((r) => {
        const complete = addressComplete(r);
        const isMissing = !complete;
  
        const members = Array.isArray(r.members) ? r.members : [];
        const memberText = esc(formatMembers(members));
  
        const addressLine = formatOneLine(r);
        const addrHtml = addressLine
          ? `<div class="abAddrText">${esc(addressLine)}</div>`
          : `<div class="abAddrText muted">No address on file</div>`;
  
        const statusPill = complete
          ? `<span class="abPill good">Collected</span>`
          : `<span class="abPill bad">Missing</span>`;
  
        const partyLabel = esc(r.party_name || r.legacy_key || "Party");
  
        return `
          <article class="abCard ${isMissing ? "isMissing" : ""}" data-party-id="${esc(r.id)}">
            <div class="abTop">
              <div class="abMeta">
                <div class="abParty">${partyLabel}</div>
                <div class="abMembers" title="${memberText}">${memberText}</div>
              </div>
  
              <div class="abRight">
                ${statusPill}
                <button class="abBtn" type="button" data-action="toggleEdit">Edit</button>
              </div>
            </div>
  
            <div class="abAddress">
              <div class="abAddrLeft">
                ${addrHtml}
              </div>
  
              <div class="abActions">
                <button class="abBtn" type="button" data-action="copyAddress" ${addressLine ? "" : "disabled"}>
                  Copy address
                </button>
                <button class="abBtn" type="button" data-action="copyLabel">
                  Copy label
                </button>
              </div>
            </div>
  
            <div class="abEdit">
              <form class="abForm" autocomplete="off">
                <div class="abGrid">
                  <div class="abField">
                    <label>Street</label>
                    <input name="address_street" value="${esc(r.address_street)}" placeholder="123 Main St" />
                  </div>
  
                  <div class="abField">
                    <label>Street 2 (optional)</label>
                    <input name="address_street2" value="${esc(r.address_street2)}" placeholder="Apt / Unit" />
                  </div>
  
                  <div class="abField">
                    <label>City</label>
                    <input name="address_city" value="${esc(r.address_city)}" placeholder="City" />
                  </div>
  
                  <div class="abField">
                    <label>State</label>
                    <input name="address_state" value="${esc(r.address_state)}" placeholder="MI" />
                  </div>
  
                  <div class="abField">
                    <label>ZIP</label>
                    <input name="address_zip" value="${esc(r.address_zip)}" placeholder="00000" />
                  </div>
                </div>
  
                <div class="abEditRow">
                  <button class="abBtn" type="button" data-action="cancelEdit">Cancel</button>
                  <button class="abBtn primary" type="submit">Save</button>
                  <span class="abSaveMsg" aria-live="polite"></span>
                </div>
              </form>
            </div>
          </article>
        `;
      })
      .join("");
  
    // Events
    list.querySelectorAll(".abCard").forEach((card) => {
      const partyId = card.getAttribute("data-party-id");
      const form = card.querySelector("form.abForm");
      const saveMsg = card.querySelector(".abSaveMsg");
  
      card.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;
  
        const action = btn.getAttribute("data-action");
  
        if (action === "toggleEdit") {
          card.classList.toggle("isEditing");
        }
  
        if (action === "cancelEdit") {
          const r = rows.find((x) => String(x.id) === String(partyId));
          if (r && form) {
            form.address_street.value = r.address_street || "";
            form.address_street2.value = r.address_street2 || "";
            form.address_city.value = r.address_city || "";
            form.address_state.value = r.address_state || "";
            form.address_zip.value = r.address_zip || "";
          }
          card.classList.remove("isEditing");
          if (saveMsg) saveMsg.textContent = "";
        }
  
        if (action === "copyAddress") {
          const r = rows.find((x) => String(x.id) === String(partyId));
          if (!r) return;
          const line = formatOneLine(r);
          if (line) copyToClipboard(line);
        }
  
        if (action === "copyLabel") {
        const r = rows.find((x) => String(x.id) === String(partyId));
        if (!r) return;

        const labelText = buildMailingLabelText(r);

        navigator.clipboard.writeText(labelText)
            .then(() => { if (saveMsg) saveMsg.textContent = "Copied label."; })
            .catch(() => { if (saveMsg) saveMsg.textContent = "Copy failed."; });
        }

      });
  
      form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!partyId) return;
  
        const payload = {
          address_street: form.address_street.value,
          address_street2: form.address_street2.value,
          address_city: form.address_city.value,
          address_state: form.address_state.value,
          address_zip: form.address_zip.value,
        };
  
        try {
          if (saveMsg) saveMsg.textContent = "Saving…";
  
          const res = await fetch(API.patchParty(partyId), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            credentials: "same-origin",
          });
  
          const out = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(out.error || `PATCH failed (${res.status})`);
  
          // update local cache
          const idx = rows.findIndex((x) => String(x.id) === String(partyId));
          if (idx >= 0) rows[idx] = { ...rows[idx], ...payload };
  
          if (saveMsg) saveMsg.textContent = "Saved";
          card.classList.remove("isEditing");
          render();
        } catch (err) {
          console.error(err);
          if (saveMsg) saveMsg.textContent = "Save failed";
        }
      });
    });
  }
  
  function bindControls() {
    const search = $("#abSearch");
    const expandAllBtn = $("#expandAllBtn");
  
    if (search) {
      search.addEventListener("input", () => {
        searchQuery = search.value || "";
        render();
      });
    }
  
    document.querySelectorAll(".segBtn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".segBtn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        filterMode = btn.getAttribute("data-filter") || "all";
        render();
      });
    });
  
    if (expandAllBtn) {
      expandAllBtn.addEventListener("click", () => {
        // Open edit panels for currently visible cards
        document.querySelectorAll(".abCard").forEach((card) => card.classList.add("isEditing"));
        showToast("Edit panels opened");
      });
    }
  }
  
  document.addEventListener("DOMContentLoaded", () => {
    bindControls();
    loadAddressBook();
  });
  