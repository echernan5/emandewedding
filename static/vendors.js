// static/vendors.js

// --- CONFIGURATION & DOM ELEMENTS ---

const API = {
    vendors: (status = "booked") => `/api/vendors?status=${encodeURIComponent(status)}`,
    vendorDetails: (id) => `/api/vendors/${encodeURIComponent(id)}`,
    signedUrl: (path) => `/api/vendor-files/signed-url?path=${encodeURIComponent(path)}`,
};

const els = {
    // Summary Stats
    statusLine: document.getElementById("statusLine"),
    sumBooked: document.getElementById("sumBooked"),
    sumUpcoming: document.getElementById("sumUpcoming"),
    sumOverdue: document.getElementById("sumOverdue"),
    sumTotalScheduled: document.getElementById("sumTotalScheduled"),
    sumPaid: document.getElementById("sumPaid"),
    sumRemaining: document.getElementById("sumRemaining"),

    // Filters & Controls
    searchInput: document.getElementById("searchInput"),
    filterCategory: document.getElementById("filterCategory"),
    filterPay: document.getElementById("filterPay"),
    btnClear: document.getElementById("btnClear"),
    btnRefresh: document.getElementById("btnRefresh"),
    btnAddVendor: document.getElementById("btnAddVendor"),

    // Main List
    vendorList: document.getElementById("vendorList"),
    emptyState: document.getElementById("emptyState"),

    // Drawer
    drawer: document.getElementById("drawer"),
    drawerOverlay: document.getElementById("drawerOverlay"),
    drawerClose: document.getElementById("drawerClose"),
    btnDrawerClose2: document.getElementById("btnDrawerClose2"),
    drawerAvatar: document.getElementById("drawerAvatar"),
    drawerTitle: document.getElementById("drawerTitle"),
    drawerMeta: document.getElementById("drawerMeta"),
    drawerChips: document.getElementById("drawerChips"),
    drawerPeople: document.getElementById("drawerPeople"),
    drawerFiles: document.getElementById("drawerFiles"),
    drawerPayments: document.getElementById("drawerPayments"),
    drawerNotes: document.getElementById("drawerNotes"),
    payTabs: document.getElementById("payTabs"),
};

const CATEGORY_MAP = {
    'venue_catering': 'Venue/Catering',
    'band': 'Band',
    'hair_makeup': 'Hair/Makeup',
    'photography': 'Photography',
    'videography': 'Videography',
    'planner_coordination': 'Day-of Coordination',
    'transportation': 'Transportation',
    'hotel_loding': 'Hotel/Lodging',
    'florals_decor': 'Florals/Decor'
};

// --- GLOBAL STATE ---
let companies = [];
let detailsCache = new Map();
let searchQuery = "";
let categoryFilter = "all";
let payFilter = "all"; // all | overdue | upcoming | paid
let paymentTab = "all"; // all | upcoming | paid
let selectedPayFile = null;

// --- HELPERS ---

function getCategoryDisplay(cat) {
    return CATEGORY_MAP[cat] || cat;
}

function escapeHTML(str) {
    return String(str ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function initials(name) {
    const parts = (name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "V";
    const a = parts[0][0] || "";
    const b = parts.length > 1 ? (parts[1][0] || "") : "";
    return (a + b).toUpperCase() || "V";
}

function fmtMoney(n) {
    const num = Number(n ?? 0);
    if (!Number.isFinite(num)) return "—";
    return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

// static/vendors.js - Update these two functions
function parseISODate(d) {
    if (!d) return null;
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return null;
    return dt;
}

function fmtDate(d) {
    if (!d) return "—";
    const dt = new Date(d);
    
    // Safety check: if date is invalid, return dash
    if (Number.isNaN(dt.getTime())) return "—";

    // THE FIX: Use getUTC... methods.
    // Supabase stores "2026-06-18" as UTC Midnight.
    // If we read it as Local Time, it subtracts 5 hours -> June 17th.
    // If we read it as UTC Time, it stays June 18th.
    
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const m = months[dt.getUTCMonth()];
    const day = dt.getUTCDate();
    const y = dt.getUTCFullYear();
    
    return `${m} ${day}, ${y}`;
}

async function fetchJSON(url) {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `${res.status} ${res.statusText}`);
    return data;
}

function startOfToday() {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
}

function chipHTML(kind, label) {
    const cls = kind ? `chip chip--${kind}` : "chip";
    return `<span class="${cls}"><span class="chipDot"></span>${escapeHTML(label)}</span>`;
}

// --- LOGIC: PERMISSIONS SANITIZER (NEW) ---

// --- LOGIC: PERMISSIONS SANITIZER ---

// static/vendors.js - Update this function

function sanitizeVendorForUser(vendorData) {
    // Deep copy to avoid modifying cache
    const v = JSON.parse(JSON.stringify(vendorData));
    
    // 1. ADMIN (You) - See everything
    if (AppUser.isAdmin()) {
        return v;
    }

    // 2. VIEWER (Isabel) - See NO financial info
    if (AppUser.isViewer()) {
        v.payments = []; 
        v.financials = { scheduled: null, paid: null, remaining: null };
        return v;
    }

    // 3. CONTRIBUTOR (Amy/Dave) - See ONLY their share
    if (AppUser.isContributor()) {
        const myName = (AppUser.getFilterName() || "").trim().toLowerCase();

        // Filter payments list
        v.payments = v.payments.filter(p => {
            return p.responsibilities.some(r => 
                (r.responsible_party || "").trim().toLowerCase() === myName
            );
        });

        // Calculate their specific totals
        let myScheduled = 0;
        let myPaid = 0;

        v.payments.forEach(p => {
            const myResp = p.responsibilities.find(r => 
                (r.responsible_party || "").trim().toLowerCase() === myName
            );

            if (myResp) {
                const amt = (Number(myResp.amount) || 0);
                myScheduled += amt;

                // --- THE FIX IS HERE ---
                // Check if they paid YOU back (Reimbursement Received)
                const rStatus = (myResp.reimbursement_status || "").toLowerCase();
                
                // Check if they paid the VENDOR directly (Status 'paid' with no reimbursement needed)
                const statusStr = (myResp.status || "").toLowerCase();

                const isReimbursed = rStatus === 'received'; // <--- THIS COUNTS THE $1,500
                const isDirectPay = rStatus === 'none' && (statusStr === 'paid' || p.status === 'paid');

                if (isReimbursed || isDirectPay) {
                    myPaid += amt;
                }
            }
        });

        // Attach pre-calculated financials
        v.financials = {
            scheduled: myScheduled,
            paid: myPaid,
            remaining: myScheduled - myPaid
        };
        return v;
    }

    return v; 
}


// --- LOGIC: ROLLUPS & STATUS ---

function normRespStatus(r) {
    const s = (r?.status ?? "").toString().trim().toLowerCase();
    // canonical: pending | paid | reimb_pending | reimbursed
    if (s === "paid") return "paid";
    if (s === "reimb_pending" || s === "paid_pending_reimbursement") return "reimb_pending";
    if (s === "reimbursed") return "reimbursed";
    return "pending";
}

function responsibilityNarrative(r) {
    const st = normRespStatus(r);
    const reimbStatus = (r?.reimbursement_status || "none").toLowerCase().trim();

    const responsible = (r?.responsible_party || "").trim();
    const paidBy = (r?.paid_by_party || "").trim();
    const paidDate = r?.paid_date ? fmtDate(r.paid_date) : null;
    const reimbDate = r?.reimbursement_date ? fmtDate(r.reimbursement_date) : null;

    let line1 = "";
    let line2 = "";
    let displayStatus = st;

    if (paidBy) {
        line1 = `Paid by ${paidBy}${paidDate ? ` on ${paidDate}` : ""}`;
    } else {
        line1 = st === "paid" ? `Paid${paidDate ? ` on ${paidDate}` : ""}` : "Pending payment to vendor";
    }

    if (reimbStatus === "pending") {
        displayStatus = "paid_pending_reimb"; 
        line2 = `Pending reimbursement from ${responsible}`;
    } else if (reimbStatus === "received") {
        line2 = `Reimbursement from ${responsible} received${reimbDate ? ` on ${reimbDate}` : ""}`;
    } else {
        line2 = "";
    }

    return { line1, line2, status: displayStatus };
}

function paymentTotals(p) {
    const base = Number(p.amount ?? 0) || 0;
    const resps = Array.isArray(p.responsibilities) ? p.responsibilities : [];

    let paidVendor = 0;

    if (!resps.length) {
        return { base, paidVendor: 0, remainingVendor: base };
    }

    resps.forEach((r) => {
        const amt = Number(r.amount ?? 0) || 0;
        const st = normRespStatus(r);
        if (st === "paid" || st === "reimb_pending" || st === "reimbursed") {
            paidVendor += amt;
        }
    });

    const remainingVendor = Math.max(0, base - paidVendor);
    return { base, paidVendor, remainingVendor };
}

function reimbursementRollup(p) {
    const resps = Array.isArray(p.responsibilities) ? p.responsibilities : [];
    let reimburseOutstanding = 0;
    let reimburseCompleted = 0;

    resps.forEach((r) => {
        const amt = Number(r.amount ?? 0) || 0;
        const reimbStatus = (r.reimbursement_status || "").toLowerCase().trim();

        if (reimbStatus === "pending") {
            reimburseOutstanding += amt;
        } else if (reimbStatus === "received") {
            reimburseCompleted += amt;
        } else {
            const st = normRespStatus(r);
            if (st === "reimb_pending") reimburseOutstanding += amt;
            if (st === "reimbursed") reimburseCompleted += amt;
        }
    });

    return { reimburseOutstanding, reimburseCompleted };
}

function isOverduePayment(p) {
    const due = parseISODate(p.due_date);
    if (!due) return false;
    const today = startOfToday();
    const due0 = new Date(due);
    due0.setHours(0, 0, 0, 0);

    return due0 < today && paymentTotals(p).remainingVendor > 0;
}

// static/vendors.js - Update companyRollup

function companyRollup(detail) {
    // 1. USE PRE-CALCULATED FINANCIALS (From Sanitizer)
    if (detail.financials) {
        
        // Filter to find payments that still have a balance > 0
        // (sanitizeVendorForUser has already filtered this list to only show Amy's payments)
        const unpaidPayments = detail.payments.filter(p => {
             const t = paymentTotals(p); 
             return t.remainingVendor > 0; // Only keep ones she hasn't paid yet
        });

        // Sort by date to find the true "Next" one
        const nextPayment = unpaidPayments
            .filter((p) => parseISODate(p.due_date))
            .sort((a, b) => parseISODate(a.due_date) - parseISODate(b.due_date))[0] || null;

        return {
            totalScheduled: detail.financials.scheduled,
            totalPaid: detail.financials.paid,
            remaining: detail.financials.remaining,
            
            // Recalculate counts based on the filtered list
            overdueCount: unpaidPayments.filter(p => isOverduePayment(p)).length,
            unpaidCount: unpaidPayments.length, 
            next: nextPayment 
        };
    }

    // 2. STANDARD ROLLUP (Admin) - Keep existing logic
    const payments = Array.isArray(detail?.payments) ? detail.payments : [];

    let totalScheduled = 0;
    let totalPaidVendor = 0;
    let overdueCount = 0;
    const unpaid = [];

    payments.forEach((p) => {
        const t = paymentTotals(p);
        totalScheduled += t.base;
        totalPaidVendor += t.paidVendor;

        if (t.remainingVendor > 0) unpaid.push(p);
        if (isOverduePayment(p)) overdueCount += 1;
    });

    const next = unpaid
        .filter((p) => parseISODate(p.due_date))
        .sort((a, b) => parseISODate(a.due_date) - parseISODate(b.due_date))[0] || null;

    return {
        totalScheduled,
        totalPaid: totalPaidVendor,
        remaining: Math.max(0, totalScheduled - totalPaidVendor),
        overdueCount,
        unpaidCount: unpaid.length,
        next,
    };
}

// --- FILE HELPERS ---

function isPlaceholderFile(f) {
    return (f?.file_name || "").includes(".emptyFolderPlaceholder");
}

function groupFilesByPayment(files) {
    const byPaymentId = new Map();
    const vendorDocs = [];

    (Array.isArray(files) ? files : [])
        .filter((f) => !isPlaceholderFile(f))
        .forEach((f) => {
            const pid = f.payment_id;
            if (pid) {
                if (!byPaymentId.has(pid)) byPaymentId.set(pid, []);
                byPaymentId.get(pid).push(f);
            } else {
                vendorDocs.push(f);
            }
        });

    return { byPaymentId, vendorDocs };
}

function fileTypeLabel(t) {
    const s = (t || "").toLowerCase().trim();
    if (s === "contract") return "Contract";
    if (s === "invoice") return "Invoice";
    if (s === "receipt") return "Receipt";
    return t || "File";
}

function fileRowHTML(f) {
    const label = fileTypeLabel(f.file_type);
    const sub = `${label}${f.uploaded_at ? ` • Uploaded ${fmtDate(f.uploaded_at)}` : ""}`;
    return `
      <div class="row">
        <div class="rowLeft">
          <div class="rowTitle">${escapeHTML(f.file_name || "File")}</div>
          <div class="rowSub">${escapeHTML(sub)}</div>
        </div>
        <button class="linkBtn" type="button" data-open="${escapeHTML(f.storage_path)}">Open</button>
      </div>
    `;
}

async function openSigned(storagePath) {
    try {
        const out = await fetchJSON(API.signedUrl(storagePath));
        if (out?.url) window.open(out.url, "_blank", "noopener,noreferrer");
    } catch (e) {
        console.error(e);
        alert("Could not open file. Check console.");
    }
}

// --- MAIN PAGE & LIST RENDER ---

function setStatus(msg) {
    if (!els.statusLine) return;
    els.statusLine.textContent = msg || "";
}

async function loadVendors() {
    setStatus("Loading booked vendors…");
    try {
        companies = await fetchJSON(API.vendors("booked"));
        detailsCache.clear();
        hydrateCategoryFilter(companies);
        await warmDetailsForSummary(companies);
        render();
        setStatus("");
    } catch (e) {
        console.error(e);
        setStatus("Could not load vendors. Check console + Flask logs.");
    }
}

function hydrateCategoryFilter(rows) {
    const sel = els.filterCategory;
    if (!sel) return;

    const cats = new Set();
    rows.forEach((r) => {
        const c = (r.category || "").trim();
        if (c) cats.add(c);
    });

    sel.innerHTML = `<option value="all">All</option>`;
    [...cats].sort((a, b) => a.localeCompare(b)).forEach((c) => {
        const display = getCategoryDisplay(c);
        sel.insertAdjacentHTML("beforeend", `<option value="${escapeHTML(c)}">${escapeHTML(display)}</option>`);
    });

    sel.value = categoryFilter;
}

async function warmDetailsForSummary(rows) {
    const ids = rows.map((r) => r.id).filter(Boolean);
    await Promise.all(
        ids.map(async (id) => {
            try {
                const d = await fetchJSON(API.vendorDetails(id));
                detailsCache.set(id, d);
            } catch (e) {
                console.warn("detail fetch failed", id, e);
            }
        })
    );
    renderSummary();
}

function renderSummary() {
    const data = getFilteredCompanies();
    const strip = document.querySelector(".summaryStrip");
    if (!strip) return;

    // --- 1. VIEWER VIEW (Isabel / Bridesmaids) ---
    // If user is a viewer, they don't see financial cards.
    if (AppUser.isViewer()) {
        let totalContacts = 0;
        let missingInfoCount = 0;
        const categories = new Set();

        data.forEach(c => {
            const d = detailsCache.get(c.id);
            if (d) {
                // Count unique categories
                if (c.category) categories.add(c.category);
                
                // Count total people listed across vendors
                if (d.people) totalContacts += d.people.length;

                // Flag vendors missing basic contact data
                const primary = d.people?.[0] || {};
                if (!primary.email || !primary.phone) {
                    missingInfoCount++;
                }
            }
        });

        strip.innerHTML = `
            <div class="metricCard is-blue">
                <div class="metricLabel">Booked Vendors</div>
                <div class="metricValue">${data.length}</div>
            </div>
            <div class="metricCard is-blue">
                <div class="metricLabel">Team Members</div>
                <div class="metricValue">${totalContacts}</div>
            </div>
            <div class="metricCard is-blue">
                <div class="metricLabel">Categories</div>
                <div class="metricValue">${categories.size}</div>
            </div>
        `;
        return; // Stop here for viewers
    }

    // --- 2. ADMIN & CONTRIBUTOR VIEW (Standard Financials) ---
    let upcomingCount = 0;
    let overdueCount = 0;
    let totalScheduled = 0;
    let totalPaid = 0;
    let totalRemaining = 0;

    data.forEach(c => {
        const d = detailsCache.get(c.id);
        const cleanD = sanitizeVendorForUser(d); 
        const roll = d ? companyRollup(cleanD) : null;

        if (roll) {
            if (roll.unpaidCount > 0) upcomingCount++;
            if (roll.overdueCount > 0) overdueCount++;

            // Only add financials if the user is allowed to see them
            totalScheduled += roll.totalScheduled;
            totalPaid += roll.totalPaid;
            totalRemaining += roll.remaining;
        }
    });

    const cardsHTML = `
        <div class="metricCard is-blue">
            <div class="metricLabel">Booked Vendors</div>
            <div class="metricValue">${data.length}</div>
        </div>
        <div class="metricCard ${upcomingCount > 0 ? 'is-orange' : ''}">
            <div class="metricLabel">Upcoming Payments</div>
            <div class="metricValue">${upcomingCount}</div>
        </div>
        <div class="metricCard ${overdueCount > 0 ? 'is-red' : ''}">
            <div class="metricLabel">Overdue</div>
            <div class="metricValue">${overdueCount}</div>
        </div>
    `;

    const labelSched = AppUser.isContributor() ? "My Commitment" : "Total Scheduled";
    const labelRem = AppUser.isContributor() ? "My Balance" : "Remaining";

    const finHTML = `
        <div class="stripRight">
            <div class="finStat">
                <div class="finLabel">${labelSched}</div>
                <div class="finValue">${fmtMoney(totalScheduled)}</div>
            </div>
            <div class="finStat">
                <div class="finLabel">Paid</div>
                <div class="finValue" style="color:#15803d;">${fmtMoney(totalPaid)}</div>
            </div>
            <div style="width:1px; height: 32px; background:#e5e7eb; margin:0 12px;"></div>
            <div class="finStat is-bold">
                <div class="finLabel">${labelRem}</div>
                <div class="finValue">${fmtMoney(totalRemaining)}</div>
            </div>
        </div>
    `;

    strip.innerHTML = cardsHTML + finHTML;
}

function getFilteredCompanies() {
    const q = searchQuery.trim().toLowerCase();

    return companies.filter((c) => {
        const cat = (c.category || "").trim();
        if (categoryFilter !== "all" && cat !== categoryFilter) return false;

        if (q) {
            const hay = [c.name, c.category, c.status, c.notes].filter(Boolean).join(" ").toLowerCase();
            if (!hay.includes(q)) return false;
        }

        if (payFilter === "all") return true;

        const d = detailsCache.get(c.id);
        if (!d) return true;

        // Use sanitized rollup for filtering
        const cleanD = sanitizeVendorForUser(d);
        const roll = companyRollup(cleanD);
        
        if (payFilter === "overdue") return roll.overdueCount > 0;
        if (payFilter === "upcoming") return roll.remaining > 0;
        if (payFilter === "paid") return roll.remaining === 0 && roll.totalScheduled > 0;
        return true;
    });
}

function render() {
    if (!els.vendorList) return;

    renderSummary();
    const data = getFilteredCompanies();

    if (!data.length) {
        els.vendorList.innerHTML = "";
        els.emptyState?.classList.remove("hidden");
        return;
    }
    els.emptyState?.classList.add("hidden");

    els.vendorList.innerHTML = data
        .map((c) => {
            const d = detailsCache.get(c.id);
            // SANITIZE DATA BEFORE RENDERING
            const cleanD = sanitizeVendorForUser(d);
            const roll = d ? companyRollup(cleanD) : null;

            const displayCategory = getCategoryDisplay(c.category);
            const metaBits = [displayCategory].filter(Boolean).join(" • ");

            // --- CHIP LOGIC ---
            let chips = "";
            
            // Special Check for Contributors with $0 balance
            const isZeroBalanceContributor = AppUser.isContributor() && (roll && roll.totalScheduled === 0);

            if (isZeroBalanceContributor) {
                // If Amy doesn't owe anything here, show NO CHIPS.
                chips = ""; 
            }
            else if (roll) {
                // Standard Logic for everyone else
                if (roll.overdueCount > 0) chips += chipHTML("overdue", `${roll.overdueCount} overdue`);
                else if (roll.unpaidCount > 0 && roll.next) 
                    chips += chipHTML("upcoming", `Next: ${fmtDate(roll.next.due_date)}`);
                else if (roll.totalScheduled > 0 && roll.remaining === 0)
                    chips += chipHTML("paid", "Up to date");
                else if (!AppUser.isViewer())
                    chips += chipHTML("paid", "Up to date");
            } else {
                chips = chipHTML("", "Loading…");
            }

            // --- PROGRESS BAR & NUMBERS LOGIC ---
            let numsHTML = ""; // Default to empty string

            if (AppUser.isViewer()) {
                // 1. VIEWERS: RENDER NOTHING.
                // Keeps the card clean (Header only).
                numsHTML = "";
            } 
            else if (isZeroBalanceContributor) {
                // 2. AMY (No Balance): Sees specific reassurance text.
                numsHTML = `
                <div class="vendorNums">
                  <div class="vendorStat" style="width: 100%;">
                      <span style="color:#c9c9c9; font-size:0.85rem; font-style:italic;">
                          No payment needed
                      </span> 
                  </div>
                </div>
              `;
            } 
            else if (roll) {
                // 3. EVERYONE ELSE (Admin / Active Contributor): Sees Money.
                const pct = roll.totalScheduled > 0
                    ? Math.min(100, Math.max(0, (roll.totalPaid / roll.totalScheduled) * 100))
                    : 0;

                numsHTML = `
                <div class="vendorNums">
                  <div class="vendorStat" style="width: 180px;">
                      <span>${AppUser.isContributor() ? 'My Share' : 'Scheduled'}</span> <b>${fmtMoney(roll.totalScheduled)}</b>
                  </div>
                  <div class="vendorStat" style="width: 150px;">
                      <span>Paid</span> <b>${fmtMoney(roll.totalPaid)}</b>
                  </div>
                  <div class="vendorStat" style="width: 190px;">
                      <span>${AppUser.isContributor() ? 'My Balance' : 'Remaining'}</span> <b>${fmtMoney(roll.remaining)}</b>
                  </div>
                  
                  <div class="vendorProgress" title="${pct.toFixed(0)}% Paid">
                      <div class="vendorProgressFill" style="width: ${pct}%"></div>
                  </div>
                </div>
              `;
            } else {
                 // Loading / Fallback
                 numsHTML = `<div class="vendorNums">Loading vendor details…</div>`;
            }

            // RETURN HTML
            // Logic Change: We only render <div class="vendorBottom"> if numsHTML has content.
            return `
          <article class="vendorCard" data-id="${escapeHTML(c.id)}">
            <div class="vendorTop">
              <div style="min-width:0;">
                <div class="vendorMeta">${escapeHTML(metaBits || "—")}</div>
                <h3 class="vendorName">${escapeHTML(c.name || "Vendor")}</h3>
              </div>
  
              <div class="vendorRight">
                ${chips}
                <button class="linkBtn" type="button" data-action="open">View</button>
              </div>
            </div>
  
            ${numsHTML ? `<div class="vendorBottom">${numsHTML}</div>` : ""}
          </article>
        `;
        })
        .join("");

    els.vendorList.querySelectorAll(".vendorCard").forEach((card) => {
        const id = card.getAttribute("data-id");
        card.querySelector("[data-action='open']")?.addEventListener("click", () => openDrawer(id));
        card.addEventListener("dblclick", () => openDrawer(id));
    });
}

// --- DRAWER LOGIC ---

function openDrawerShell() {
    els.drawer?.classList.add("is-open");
    els.drawer?.setAttribute("aria-hidden", "false");
}

function closeDrawer() {
    els.drawer?.classList.remove("is-open");
    els.drawer?.setAttribute("aria-hidden", "true");
}

function bindPaymentTabs() {
    if (!els.payTabs) return;

    els.payTabs.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-tab]");
        if (!btn) return;

        paymentTab = btn.getAttribute("data-tab") || "all";

        els.payTabs.querySelectorAll("button[data-tab]").forEach((b) => {
            b.classList.toggle("is-active", b.getAttribute("data-tab") === paymentTab);
        });

        const openId = els.drawer?.getAttribute("data-company-id");
        if (openId && detailsCache.has(openId)) {
            const d = detailsCache.get(openId);
            // Sanitize payments for drawer too
            const cleanD = sanitizeVendorForUser(d);
            renderPaymentsLedger(cleanD.payments || [], cleanD.company_files || []);
        }
    });
}

function bindDrawerTabs() {
    const tabs = document.getElementById("drawerTabs");
    if (!tabs) return;

    const setActive = (tabName) => {
        tabs.querySelectorAll(".tabBtn").forEach((b) => {
            b.classList.toggle("is-active", b.dataset.tab === tabName);
        });

        document.querySelectorAll(".drawerTabPanel").forEach((p) => {
            p.classList.toggle("is-active", p.id === `tab-${tabName}`);
        });
    };

    tabs.addEventListener("click", (e) => {
        const btn = e.target.closest(".tabBtn");
        if (!btn) return;
        setActive(btn.dataset.tab);
    });
}

async function openDrawer(companyId) {
    if (!companyId) return;
    openDrawerShell();
    els.drawer?.setAttribute("data-company-id", companyId);

    // --- RESET UI ---
    if (els.payTabs) {
        els.payTabs.className = "minimalTabs"; 
        paymentTab = "all";
        els.payTabs.querySelectorAll("button[data-tab]").forEach((b) => {
            b.className = "minimalTabBtn"; 
            if (b.getAttribute("data-tab") === "all") b.classList.add("is-active");
        });
    }

    // Reset Elements
    els.drawerTitle.textContent = "Vendor";
    els.drawerMeta.textContent = "Loading…";
    if (els.drawerAvatar) els.drawerAvatar.textContent = "V";
    
    // Clear our new containers
    const contactContainer = document.getElementById("drawerHeaderContact");
    const statsContainer = document.getElementById("paymentStatsLocation");
    if (contactContainer) contactContainer.innerHTML = "";
    if (statsContainer) statsContainer.innerHTML = "";

    // Reset Lists
    if (els.drawerPeople) els.drawerPeople.innerHTML = `<div class="muted">Loading…</div>`;
    if (els.drawerFiles) els.drawerFiles.innerHTML = `<div class="muted">Loading…</div>`;
    if (els.drawerPayments) els.drawerPayments.innerHTML = `<div class="muted">Loading…</div>`;
    if (els.drawerNotes) els.drawerNotes.textContent = "—";

    try {
        let d = detailsCache.get(companyId);
        if (!d) {
            d = await fetchJSON(API.vendorDetails(companyId));
            detailsCache.set(companyId, d);
            renderSummary();
            render();
        }

        const cleanD = sanitizeVendorForUser(d);
        const c = cleanD.company || {};
        const roll = companyRollup(cleanD);

        // --- 1. HEADER (IDENTITY) ---
        const displayCategory = getCategoryDisplay(c.category);
        els.drawerTitle.textContent = c.name || "Vendor";
        els.drawerMeta.textContent = [displayCategory].filter(Boolean).join(" • ") || "—";
        if (els.drawerAvatar) els.drawerAvatar.textContent = initials(c.name || "");

        // GENERATE CONTACT CHIPS
        // Note: You might need to adjust 'c.email' etc based on your actual DB schema
        let contactHTML = "";
        
        // Mocking contact data check - assuming c.contact_email exists or similar
        // If not, we can pull from the first person in the contacts list
        const primaryContact = (d.people && d.people.length > 0) ? d.people[0] : {};
        const email = c.email || primaryContact.email;
        const phone = c.phone || primaryContact.phone;
        const website = c.website;

        if (email) contactHTML += `<a href="mailto:${email}" class="contactChip">✉️ Email</a>`;
        if (phone) contactHTML += `<a href="tel:${phone}" class="contactChip">📞 Call</a>`;
        if (website) contactHTML += `<a href="${website}" target="_blank" class="contactChip">🔗 Website</a>`;
        
        // Fallback if empty
        if (!contactHTML) contactHTML = `<span class="contactChip" style="background:transparent; border:1px dashed #e5e7eb; padding:4px 10px;">No quick contacts</span>`;

        if (contactContainer) contactContainer.innerHTML = contactHTML;


        // --- 2. PAYMENT TAB (FINANCIALS) ---
        let statsHTML = "";
        
        if (roll.next && roll.remaining > 0) {
            statsHTML += `
                <div class="drawerStatItem is-hero">
                    <span class="drawerStatLabel">Next Payment Due</span>
                    <span class="drawerStatValue">${fmtDate(roll.next.due_date)}</span>
                </div>
            `;
        } else if (roll.totalScheduled > 0 && roll.remaining === 0) {
             statsHTML += `
                <div class="drawerStatItem is-hero" style="background:#f0fdf4; border-color:#bbf7d0;">
                    <span class="drawerStatLabel" style="color:#15803d;">Status</span>
                    <span class="drawerStatValue" style="color:#166534;">Paid in Full</span>
                </div>
            `;
        }

        if (!AppUser.isViewer()) {
            const labelTotal = AppUser.isContributor() ? "My Commitment" : "Total Contract";
            const labelLeft = AppUser.isContributor() ? "My Balance" : "Remaining";

            statsHTML += `
                <div class="drawerStatItem">
                    <span class="drawerStatLabel">${labelTotal}</span>
                    <span class="drawerStatValue">${fmtMoney(roll.totalScheduled)}</span>
                </div>
                <div class="drawerStatItem">
                    <span class="drawerStatLabel">${labelLeft}</span>
                    <span class="drawerStatValue">${fmtMoney(roll.remaining)}</span>
                </div>
            `;
        }

        // Only inject stats if there are numbers to show
        if (statsContainer && !AppUser.isViewer()) {
            statsContainer.innerHTML = `<div class="drawerStatsGrid">${statsHTML}</div>`;
        } else if (statsContainer) {
            statsContainer.innerHTML = ""; // Clear for viewer
        }

        // --- 3. REST OF CONTENT ---
        if (els.drawerNotes) els.drawerNotes.textContent = (c.notes || "").trim() || "—";
        renderPeople(d.people || []);
        renderPaymentsLedger(cleanD.payments || [], d.company_files || []);
        renderVendorDocs(d.files || []);

        // --- 4. TAB LOGIC ---
        const tabPayments = document.querySelector("button[data-tab='payments']");
        const tabPanelPayments = document.getElementById("tab-payments");
        const tabVendor = document.querySelector("button[data-tab='vendor']");
        const tabPanelVendor = document.getElementById("tab-vendor");

        if (AppUser.isViewer()) {
            if(tabPayments) tabPayments.style.display = "none";
            if(tabVendor) tabVendor.click(); // Click event handles class toggling in existing code
        } else {
            if(tabPayments) tabPayments.style.display = "inline-block";
            if(tabPayments) tabPayments.click();
        }

    } catch (e) {
        console.error(e);
        els.drawerMeta.textContent = "Could not load vendor.";
    }
}

// Helper to get initials (e.g., "Kathryn Puzevic" -> "KP")
// Helper to get initials (Safety checked)
function getInitials(name) {
    if (!name || name === "Unknown Contact") return "?";
    return name
        .trim()
        .split(" ")
        .map(n => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
}

function renderPeople(people) {
    if (!els.drawerPeople) return;

    if (!people || people.length === 0) {
        els.drawerPeople.innerHTML = `
            <div style="text-align:center; padding: 32px; color:#9ca3af; background:#f9fafb; border-radius:12px; border:1px dashed #e5e7eb;">
                <div style="font-size:24px; margin-bottom:8px;">📇</div>
                <div>No contacts added yet.</div>
            </div>`;
        return;
    }

    els.drawerPeople.innerHTML = people.map(p => {
        // --- DATA MAPPING FIX ---
        // We check multiple possibilities to ensure we find the right data
        const displayName = p.name || p.contact_name || p.full_name || "Unknown Contact";
        const displayRole = p.role || p.title || p.job_title || "";
        
        // Generate Initials from the found name
        const init = getInitials(displayName);
        const isBlue = (init.charCodeAt(0) % 2 === 0); 

        return `
        <div class="contactCard">
            <div class="contactAvatar ${isBlue ? 'is-blue' : 'is-green'}">${init}</div>
            
            <div class="contactMain">
                <div class="contactHeader">
                    <div>
                        <div class="contactName">${escapeHTML(displayName)}</div>
                        ${displayRole ? `<span class="contactRole">${escapeHTML(displayRole)}</span>` : ""}
                    </div>
                </div>

                <div class="contactMethods">
                    ${p.email ? `
                        <a href="mailto:${p.email}" class="contactMethodRow">
                            <span class="contactIcon">✉️</span>
                            <span>${escapeHTML(p.email)}</span>
                        </a>
                    ` : ""}
                    
                    ${p.phone ? `
                        <a href="tel:${p.phone}" class="contactMethodRow">
                            <span class="contactIcon">📞</span>
                            <span>${escapeHTML(p.phone)}</span>
                        </a>
                    ` : ""}
                </div>
            </div>
        </div>
        `;
    }).join("");
}

function renderPaymentsLedger(payments, allFiles) {
    const list = Array.isArray(payments) ? payments : [];
    if (!els.drawerPayments) return;

    // 1. ADD NEW BUTTON (ONLY FOR ADMIN)
    let addBtnHTML = "";
    if (AppUser.isAdmin()) {
        addBtnHTML = `
        <div style="display:flex; justify-content:flex-end; margin-bottom:12px;">
            <button class="btnSmall" id="btnAddNewPayment" style="display:flex; align-items:center; gap:6px;">
                <span>+</span> Add Payment
            </button>
        </div>
      `;
    }

    if (!list.length) {
        els.drawerPayments.innerHTML = `${addBtnHTML}<div class="muted">No payments visible.</div>`;
        return;
    }

    const { byPaymentId } = groupFilesByPayment(allFiles || []);

    const filtered = list.filter((p) => {
        const t = paymentTotals(p);
        if (paymentTab === "paid") return t.remainingVendor <= 0;
        if (paymentTab === "upcoming") return t.remainingVendor > 0;
        return true;
    });

    const sorted = filtered.slice().sort((a, b) => {
        const da = parseISODate(a.due_date)?.getTime() ?? 9e15;
        const db = parseISODate(b.due_date)?.getTime() ?? 9e15;
        return da - db;
    });

    // Helper for Relative Time
    function getRelativeTimeHTML(isoDate, isPaid) {
        if (!isoDate || isPaid) return "";
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(isoDate);
        due.setHours(0, 0, 0, 0);
        const diffTime = due - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        let text = "";
        let colorClass = "";
        if (diffDays < 0) {
            text = `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''}`;
            colorClass = "text-red";
        } else if (diffDays === 0) {
            text = "Due today";
            colorClass = "text-orange";
        } else if (diffDays === 1) {
            text = "Due tomorrow";
            colorClass = "text-orange";
        } else {
            if (diffDays > 60) {
                const months = Math.round(diffDays / 30);
                text = `Due in ~${months} months`;
                colorClass = "text-muted";
            } else {
                text = `Due in ${diffDays} days`;
                if (diffDays <= 14) colorClass = "text-orange";
            }
        }
        return `<span class="paymentRelative ${colorClass}"> • ${text}</span>`;
    }

    els.drawerPayments.innerHTML = `
      ${addBtnHTML}
      <div class="stack">
        ${sorted
            .map((p) => {
                const t = paymentTotals(p);
                const overdue = isOverduePayment(p);
                const reimb = reimbursementRollup(p);
                const isPaid = t.remainingVendor <= 0;

                // --- CALCULATE DISPLAY VALUES BASED ON ROLE ---
                let displayBase = t.base;
                let displayPaid = t.paidVendor;
                let displayRemaining = t.remainingVendor;

                // If Contributor, calculate MY share only
                if (AppUser.isContributor()) {
                    const myName = (AppUser.getFilterName() || "").trim().toLowerCase();
                    const myResp = p.responsibilities?.find(r => 
                        (r.responsible_party || "").trim().toLowerCase() === myName
                    );
                    
                    displayBase = myResp ? (Number(myResp.amount) || 0) : 0;
                    
                    const st = normRespStatus(myResp || {});
                    if (st === 'paid' || st === 'reimbursed' || st === 'reimb_pending') {
                        displayPaid = displayBase;
                    } else {
                        displayPaid = 0;
                    }
                    displayRemaining = displayBase - displayPaid;
                }

                let statusChip;
                // Simplified status logic for Contributors
                if (AppUser.isContributor()) {
                    if (displayRemaining <= 0) statusChip = chipHTML("paid", "Paid");
                    // CHANGE: Text is now "Upcoming", uses the "upcoming" (orange) style
                    else statusChip = chipHTML("upcoming", "Upcoming");
                } else {
                    // Standard Logic for Admin
                    if (isPaid) {
                        if (reimb.reimburseOutstanding > 0) statusChip = chipHTML("reimb-pending", "Paid (Pending Reimbursement)");
                        else statusChip = chipHTML("paid", "Paid");
                    } else {
                        if (overdue) statusChip = chipHTML("overdue", "Overdue");
                        else statusChip = chipHTML("upcoming", "Upcoming");
                    }
                }

                const relativeTime = getRelativeTimeHTML(p.due_date, displayRemaining <= 0);

                const resps = Array.isArray(p.responsibilities) ? p.responsibilities : [];
                const filesForPayment = Array.isArray(p.files) ? p.files : [];
                const invoices = filesForPayment.filter((f) => (f.file_type || "").toLowerCase() === "invoice");
                const receipts = filesForPayment.filter((f) => (f.file_type || "").toLowerCase() === "receipt");

                const chevronIcon = `
            <svg class="paymentChevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          `;

                // --- NEW: HIDE REDUNDANT SUBTEXT FOR CONTRIBUTORS ---
                const metaLineHTML = AppUser.isContributor() 
                    ? "" // HIDE for Amy (Clean look)
                    : `<div class="paymentMetaLeft" style="margin-top: 4px; font-size: 0.85rem; color: #6b7280;">
                         <span>Paid ${fmtMoney(displayPaid)}</span> • 
                         <span>Remaining ${fmtMoney(displayRemaining)}</span>
                       </div>`;

                // Button Logic (Hidden for contributors)
                const markPaidBtn = (t.remainingVendor > 0 && AppUser.isAdmin())
                    ? `<button class="btnSmall btnMarkPaid" type="button" 
                data-id="${escapeHTML(p.id)}" 
                data-desc="${escapeHTML(p.description)}" 
                data-amt="${t.remainingVendor.toFixed(2)}">Mark Paid</button>`
                    : "";
                
                const editBtn = (!isPaid && AppUser.isAdmin()) 
                    ? `<button class="iconBtn btnEditPayment" type="button" data-id="${p.id}" title="Edit Payment">
                        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                       </button>` 
                    : "";

                return `
            <article class="paymentCard ${overdue ? "is-overdue" : ""} ${isPaid ? "is-paid" : "is-open"
                    }" data-payment-id="${escapeHTML(p.id)}">
              <div class="paymentCard__body">

                <div class="paymentHeader" style="cursor: pointer;">
                  <div class="paymentHeader__top">
                    
                    <div class="paymentHeader__left">
                      <div class="paymentTitle">${escapeHTML(p.description || "Payment")}</div>
                      
                      <div class="paymentSub">
                        <span class="paymentStatus">${statusChip}</span>
                        <span class="paymentDue">Due ${fmtDate(p.due_date)}</span>
                        ${relativeTime} 
                      </div>

                      ${metaLineHTML}
                    </div>

                    <div class="paymentHeader__right" style="text-align: right; margin-left: auto; min-width: 120px;">
                      <div class="paymentTotalLabel">${AppUser.isContributor() ? 'My Contribution' : 'Total'}</div>
                      <div class="paymentTotal">${fmtMoney(displayBase)}</div>
                      
                      <div style="margin-top: 8px; display: flex; justify-content: flex-end; gap:8px;">
                         ${editBtn}
                         ${markPaidBtn}
                      </div>
                    </div>
                    
                    <div style="margin-left: 16px; color: #999; display: flex; align-items: center;">
                        ${chevronIcon}
                    </div>
                  </div>

                  ${p.notes ? `<div class="paymentNotes">${escapeHTML(p.notes)}</div>` : ``}
                </div>

                <div class="paymentDetails">
                    <section class="paymentSection paymentSection--responsibilities">
                      <div class="paymentSection__title">Responsibility</div>
                      <div class="responsibilityList">
                        ${resps.length
                        ? resps
                            .map((r) => {
                                const narr = responsibilityNarrative(r);
                                const displayStatus = narr.status;

                                let chip;
                                if (displayStatus === "paid_pending_reimb") {
                                    chip = chipHTML("reimb-pending", "Paid (Pending Reimb)");
                                } else if (displayStatus === "paid" || displayStatus === "reimbursed") {
                                    chip = chipHTML("paid", "Paid");
                                } else {
                                    chip = chipHTML("upcoming", "Pending");
                                }

                                return `
                                  <div class="responsibilityRow ${displayStatus === 'paid_pending_reimb' ? 'is-reimb-pending' : ''}">
                                      <div class="responsibilityRow__left">
                                      <div class="responsibilityName">${escapeHTML(r.responsible_party || "—")}</div>
                                      <div class="responsibilityMeta">
                                          <div class="responsibilityLine1">${escapeHTML(narr.line1)}</div>
                                          ${narr.line2 ? `<div class="responsibilityLine2">${escapeHTML(narr.line2)}</div>` : ""}
                                      </div>
                                      </div>
                                      <div class="responsibilityRow__right">
                                      <div class="responsibilityStatus">${chip}</div>
                                      <div class="responsibilityAmount">${fmtMoney(r.amount)}</div>
                                      </div>
                                  </div>
                                  `;
                            })
                            .join("")
                        : `<div class="paymentEmpty">No responsibilities added yet for this payment.</div>`
                    }
                      </div>
                    </section>

                    <section class="paymentSection paymentSection--files">
                      <div class="paymentSection__title">Invoices & receipts</div>
                      <div class="paymentFiles">
                        ${!invoices.length && !receipts.length
                        ? `<div class="paymentEmpty">No invoices/receipts tied to this payment yet.</div>`
                        : `
                              <div class="paymentFiles__list">
                                ${invoices.map((f) => `<div class="paymentFileRow paymentFileRow--invoice">${fileRowHTML(f)}</div>`).join("")}
                                ${receipts.map((f) => `<div class="paymentFileRow paymentFileRow--receipt">${fileRowHTML(f)}</div>`).join("")}
                              </div>
                            `
                    }
                      </div>
                    </section>
                </div>
              </div>
            </article>
          `;
            })
            .join("")}
    </div>
  `;

    // Re-attach Events
    els.drawerPayments.querySelectorAll(".paymentHeader").forEach((header) => {
        header.addEventListener("click", () => {
            const card = header.closest(".paymentCard");
            card.classList.toggle("is-expanded");
        });
    });

    els.drawerPayments.querySelectorAll("button[data-open]").forEach((b) => {
        b.addEventListener("click", (e) => {
            e.stopPropagation();
            openSigned(b.getAttribute("data-open"))
        });
    });
}

// ... (renderVendorDocs, openSigned, etc. same as before) ...

// --- PAY MODAL & PLAN MODAL (Admin Only logic handled by button hiding) ---
// (We keep these functions as is, because users can't open them if buttons are hidden)

const payEls = {
    modal: document.getElementById("modalPay"),
    form: document.getElementById("formPay"),
    btnClose: document.getElementById("btnClosePay"),
    btnCancel: document.getElementById("btnCancelPay"),
    id: document.getElementById("payPaymentId"),
    desc: document.getElementById("payDesc"),
    amount: document.getElementById("payAmount"),
    date: document.getElementById("payDate"),
    method: document.getElementById("payMethod"),
    notes: document.getElementById("payNotes"),
    toggle: document.getElementById("toggleSplit"),
    simpleMode: document.getElementById("paySimpleMode"),
    splitMode: document.getElementById("paySplitMode"),
    payerSimple: document.getElementById("payPayerSimple"),
    splitContainer: document.getElementById("splitRowsContainer"),
    btnAddSplit: document.getElementById("btnAddSplitRow"),
    dropZone: document.getElementById("payDropZone"),
    fileInput: document.getElementById("payFile"),
    fileName: document.getElementById("payFileName")
};

function bindPayModalEvents() {
    if (els.drawerPayments) {
        els.drawerPayments.addEventListener("click", (e) => {
            const btn = e.target.closest(".btnMarkPaid");
            if (btn) {
                e.stopPropagation(); 
                openPayModal(btn.dataset);
            }
        });
    }
    payEls.btnClose?.addEventListener("click", closePayModal);
    payEls.btnCancel?.addEventListener("click", closePayModal);
    payEls.toggle?.addEventListener("change", (e) => {
        const isSplit = e.target.checked;
        payEls.simpleMode.style.display = isSplit ? "none" : "block";
        payEls.splitMode.style.display = isSplit ? "block" : "none";
        if (isSplit && payEls.splitContainer.children.length === 0) addSplitRow();
    });
    payEls.btnAddSplit?.addEventListener("click", () => addSplitRow());
    const dz = payEls.dropZone;
    if (dz) {
        dz.addEventListener("click", () => payEls.fileInput.click());
        payEls.fileInput.addEventListener("change", (e) => handleFileSelect(e.target.files[0]));
        dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.style.background = "#ecfdf5"; });
        dz.addEventListener("dragleave", (e) => { e.preventDefault(); dz.style.background = ""; });
        dz.addEventListener("drop", (e) => {
            e.preventDefault();
            dz.style.background = "";
            handleFileSelect(e.dataTransfer.files[0]);
        });
    }
    payEls.form?.addEventListener("submit", handlePaySubmit);
}

function renderVendorDocs(files) {
    const list = Array.isArray(files) ? files : [];
    if (!els.drawerFiles) return;

    // Use existing helper to group/filter
    const { vendorDocs } = groupFilesByPayment(list);
    const filtered = vendorDocs.filter((f) => !isPlaceholderFile(f));

    if (!filtered.length) {
        els.drawerFiles.innerHTML = `<div class="muted">No vendor documents yet.</div>`;
        return;
    }

    const groups = new Map();
    filtered.forEach((f) => {
        const key = (f.file_type || "file").toLowerCase();
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(f);
    });

    const order = ["contract", "invoice", "receipt"];
    const keys = [...groups.keys()].sort((a, b) => {
        const ia = order.indexOf(a);
        const ib = order.indexOf(b);
        if (ia === -1 && ib === -1) return a.localeCompare(b);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
    });

    els.drawerFiles.innerHTML = `
      <div class="stack">
        ${keys
            .map((k) => {
                const items = groups.get(k) || [];
                const header = `<div class="muted" style="font-weight:950; font-size:12px; letter-spacing:.06em; text-transform:uppercase;">${escapeHTML(
                    fileTypeLabel(k)
                )}</div>`;
                const rows = items.map(fileRowHTML).join("");
                return `<div class="stack" style="gap:8px;">${header}${rows}</div>`;
            })
            .join("")}
      </div>
    `;

    els.drawerFiles.querySelectorAll("button[data-open]").forEach((b) => {
        b.addEventListener("click", () => openSigned(b.getAttribute("data-open")));
    });
}

function openPayModal(data) {
    if (!payEls.modal) return;
    payEls.form.reset();
    selectedPayFile = null;
    payEls.fileName.textContent = "Drag receipt here or click to browse";
    payEls.splitContainer.innerHTML = "";
    payEls.toggle.checked = false;
    payEls.simpleMode.style.display = "block";
    payEls.splitMode.style.display = "none";
    payEls.notes.value = "";
    payEls.id.value = data.id;
    payEls.desc.value = data.desc;
    payEls.amount.value = data.amt; 
    payEls.date.valueAsDate = new Date(); 
    payEls.modal.style.display = "flex";
    payEls.modal.setAttribute("aria-hidden", "false");
}

function closePayModal() {
    if (!payEls.modal) return;
    payEls.modal.style.display = "none";
    payEls.modal.setAttribute("aria-hidden", "true");
}

function handleFileSelect(file) {
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
        alert("Please upload a PDF or Image file.");
        return;
    }
    const cleanName = file.name.trim().replace(/\s+/g, "_");
    selectedPayFile = new File([file], cleanName, { type: file.type });
    payEls.fileName.textContent = selectedPayFile.name;
}

function addSplitRow(defaultData = {}) {
    const div = document.createElement("div");
    div.className = "splitRow";
    div.innerHTML = `
          <select class="splitResp">
              <option value="Emma">Emma</option>
              <option value="Ethan">Ethan</option>
              <option value="Dad">Dad</option>
              <option value="Mom">Mom</option>
              <option value="Dad (Ethan)">Ethan's Dad</option>
              <option value="Mom (Ethan)">Ethan's Mom</option>
          </select>
          <input type="number" step="0.01" class="splitAmt" placeholder="0.00" value="${defaultData.amt || ''}">
          <select class="splitStatus">
              <option value="pending">Pending</option>
              <option value="received">Received</option>
              <option value="none">None (Self)</option>
          </select>
          <button type="button" class="removeRow" onclick="this.parentElement.remove()">×</button>
      `;
    payEls.splitContainer.appendChild(div);
}

async function handlePaySubmit(e) {
    e.preventDefault();
    const btn = payEls.form.querySelector("button[type='submit']");
    const originalText = btn.textContent;
    btn.textContent = "Posting...";
    btn.disabled = true;

    try {
        const totalAmount = parseFloat(payEls.amount.value);
        const paymentId = payEls.id.value;
        const paidBy = payEls.simpleMode.style.display !== "none" ? payEls.payerSimple.value : "Split";
        const paymentMethod = payEls.method.value;
        const datePaid = payEls.date.value;
        const notes = payEls.notes.value;

        let responsibilities = [];
        if (payEls.toggle.checked) {
            let runningTotal = 0;
            const rows = payEls.splitContainer.querySelectorAll(".splitRow");
            rows.forEach(row => {
                const rParty = row.querySelector(".splitResp").value;
                const rAmt = parseFloat(row.querySelector(".splitAmt").value) || 0;
                const rStatus = row.querySelector(".splitStatus").value;
                runningTotal += rAmt;
                responsibilities.push({
                    responsible_party: rParty,
                    amount: rAmt,
                    reimbursement_status: rStatus,
                    paid_by_party: payEls.payerSimple.value,
                    payment_method: paymentMethod
                });
            });
            if (Math.abs(runningTotal - totalAmount) > 0.02) throw new Error("Split amounts mismatch.");
        } else {
            responsibilities.push({
                responsible_party: payEls.payerSimple.value,
                amount: totalAmount,
                reimbursement_status: 'none',
                paid_by_party: payEls.payerSimple.value,
                payment_method: paymentMethod
            });
        }

        const formData = new FormData();
        formData.append("payment_id", paymentId);
        formData.append("amount", totalAmount);
        formData.append("paid_date", datePaid);
        formData.append("notes", notes);
        formData.append("responsibilities", JSON.stringify(responsibilities));
        if (selectedPayFile) formData.append("file", selectedPayFile);

        const res = await fetch("/api/payments/record", { method: "POST", body: formData });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed");

        alert("Payment recorded successfully!");
        closePayModal();
        const openId = els.drawer.getAttribute("data-company-id");
        if (openId) {
            const d = await fetchJSON(API.vendorDetails(openId));
            detailsCache.set(openId, d);
            openDrawer(openId);
        }
        loadVendors();
    } catch (err) {
        console.error(err);
        alert(err.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

const planEls = {
    modal: document.getElementById("modalPlan"),
    form: document.getElementById("formPlan"),
    btnClose: document.getElementById("btnClosePlan"),
    btnCancel: document.getElementById("btnCancelPlan"),
    title: document.getElementById("planTitle"),
    id: document.getElementById("planPaymentId"),
    companyId: document.getElementById("planCompanyId"),
    desc: document.getElementById("planDesc"),
    amount: document.getElementById("planAmount"),
    date: document.getElementById("planDate"),
    notes: document.getElementById("planNotes"),
    toggle: document.getElementById("togglePlanSplit"),
    simpleMode: document.getElementById("planSimpleMode"),
    splitMode: document.getElementById("planSplitMode"),
    respSimple: document.getElementById("planRespSimple"),
    splitRows: document.getElementById("planSplitRows"),
    btnAddSplit: document.getElementById("btnAddPlanSplit")
};

function bindPlanModalEvents() {
    if (els.drawerPayments) {
        els.drawerPayments.addEventListener("click", (e) => {
            if (e.target.closest("#btnAddNewPayment")) {
                const companyId = els.drawer.getAttribute("data-company-id");
                openPlanModal({ companyId: companyId }); 
            }
            const editBtn = e.target.closest(".btnEditPayment");
            if (editBtn) {
                e.stopPropagation();
                const pid = editBtn.dataset.id;
                const companyId = els.drawer.getAttribute("data-company-id");
                const d = detailsCache.get(companyId);
                const payment = d.payments.find(x => x.id === pid);
                if(payment) openPlanModal(payment, true);
            }
        });
    }
    planEls.btnClose?.addEventListener("click", () => planEls.modal.style.display = "none");
    planEls.btnCancel?.addEventListener("click", () => planEls.modal.style.display = "none");
    planEls.toggle?.addEventListener("change", (e) => {
        const isSplit = e.target.checked;
        planEls.simpleMode.style.display = isSplit ? "none" : "block";
        planEls.splitMode.style.display = isSplit ? "block" : "none";
        if(isSplit && planEls.splitRows.children.length === 0) addPlanSplitRow();
    });
    planEls.btnAddSplit?.addEventListener("click", () => addPlanSplitRow());
    planEls.form?.addEventListener("submit", handlePlanSubmit);
}

function openPlanModal(data, isEdit = false) {
    if(!planEls.modal) return;
    planEls.form.reset();
    planEls.splitRows.innerHTML = "";
    planEls.toggle.checked = false;
    planEls.simpleMode.style.display = "block";
    planEls.splitMode.style.display = "none";
    planEls.title.textContent = isEdit ? "Edit Payment Details" : "Add New Payment";
    planEls.id.value = isEdit ? data.id : "";
    planEls.companyId.value = data.company_id || data.companyId;

    if (isEdit) {
        planEls.desc.value = data.description || "";
        planEls.amount.value = data.amount || "";
        const dt = parseISODate(data.due_date);
        if (dt) {
            const yyyy = dt.getFullYear();
            const mm = String(dt.getMonth() + 1).padStart(2, '0');
            const dd = String(dt.getDate()).padStart(2, '0');
            planEls.date.value = `${yyyy}-${mm}-${dd}`;
        } else {
            planEls.date.value = "";
        }
        planEls.notes.value = data.notes || "";
        const resps = data.responsibilities || [];
        if (resps.length > 1) {
            planEls.toggle.checked = true;
            planEls.simpleMode.style.display = "none";
            planEls.splitMode.style.display = "block";
            resps.forEach(r => addPlanSplitRow(r));
        } else if (resps.length === 1) {
            planEls.respSimple.value = resps[0].responsible_party;
        }
    }
    planEls.modal.style.display = "flex";
}

function addPlanSplitRow(data = {}) {
    const div = document.createElement("div");
    div.className = "splitRow";
    div.innerHTML = `
        <select class="planRespItem">
            <option value="Emma/Ethan">Emma & Ethan</option>
            <option value="Dad">Carlos</option>
            <option value="Mom">Emily</option>
            <option value="Amy/Dave">Amy & Dave</option>
        </select>
        <input type="number" step="0.01" class="planAmtItem" placeholder="0.00" value="${data.amount || ''}">
        <button type="button" class="removeRow" onclick="this.parentElement.remove()">×</button>
    `;
    if(data.responsible_party) div.querySelector("select").value = data.responsible_party;
    planEls.splitRows.appendChild(div);
}

async function handlePlanSubmit(e) {
    e.preventDefault();
    const btn = planEls.form.querySelector("button[type='submit']");
    const originalText = btn.textContent;
    btn.textContent = "Saving...";
    btn.disabled = true;
    try {
        const payload = {
            payment_id: planEls.id.value || null,
            company_id: planEls.companyId.value,
            description: planEls.desc.value,
            amount: parseFloat(planEls.amount.value),
            due_date: planEls.date.value,
            notes: planEls.notes.value,
            responsibilities: []
        };
        if (planEls.toggle.checked) {
            let total = 0;
            planEls.splitRows.querySelectorAll(".splitRow").forEach(row => {
                const amt = parseFloat(row.querySelector(".planAmtItem").value) || 0;
                total += amt;
                payload.responsibilities.push({
                    responsible_party: row.querySelector(".planRespItem").value,
                    amount: amt
                });
            });
            if (Math.abs(total - payload.amount) > 0.02) throw new Error("Split amounts mismatch.");
        } else {
            payload.responsibilities.push({
                responsible_party: planEls.respSimple.value,
                amount: payload.amount
            });
        }
        const res = await fetch("/api/payments/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed");
        planEls.modal.style.display = "none";
        const companyId = payload.company_id;
        const d = await fetchJSON(API.vendorDetails(companyId));
        detailsCache.set(companyId, d);
        openDrawer(companyId);
        loadVendors();
    } catch (err) {
        alert(err.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// --- INIT ---

function bindControls() {
    if (els.searchInput) els.searchInput.addEventListener("input", () => { searchQuery = els.searchInput.value || ""; render(); });
    if (els.filterCategory) els.filterCategory.addEventListener("change", () => { categoryFilter = els.filterCategory.value || "all"; render(); });
    if (els.filterPay) els.filterPay.addEventListener("change", () => { payFilter = els.filterPay.value || "all"; render(); });
    if (els.btnClear) els.btnClear.addEventListener("click", () => {
        searchQuery = ""; categoryFilter = "all"; payFilter = "all";
        if (els.searchInput) els.searchInput.value = "";
        if (els.filterCategory) els.filterCategory.value = "all";
        if (els.filterPay) els.filterPay.value = "all";
        render();
    });
    if (els.btnRefresh) els.btnRefresh.addEventListener("click", loadVendors);
    if (els.btnAddVendor) els.btnAddVendor.addEventListener("click", () => alert("Next: Add Vendor flow."));
    if (els.drawerOverlay) els.drawerOverlay.addEventListener("click", closeDrawer);
    if (els.drawerClose) els.drawerClose.addEventListener("click", closeDrawer);
    if (els.btnDrawerClose2) els.btnDrawerClose2.addEventListener("click", closeDrawer);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });
}

document.addEventListener("DOMContentLoaded", () => {
    bindControls();
    bindPaymentTabs();
    bindDrawerTabs();
    bindPayModalEvents(); 
    bindPlanModalEvents();
    loadVendors();
});

// LISTEN FOR ROLE CHANGES FROM SIDEBAR
window.addEventListener("roleChanged", (e) => {
    // Reload vendors with new role permissions applied
    loadVendors();
    closeDrawer();
});