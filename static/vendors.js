// static/vendors.js

// --- CONFIGURATION & DOM ELEMENTS ---

const API = {
    vendors: (status = "booked") => `/api/vendors?status=${encodeURIComponent(status)}`,
    vendorDetails: (id) => `/api/vendors/${encodeURIComponent(id)}`,
    signedUrl: (path) => `/api/vendor-files/signed-url?path=${encodeURIComponent(path)}`,
};

async function waitForAuth() {
    for (let i = 0; i < 50; i++) {
      if (window.AppAuth?.token) return window.AppAuth.token;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error("Auth not ready (AppAuth.token missing)");
  }

// --- ROLE / PERMISSIONS SHIM ---
(function ensureAppUserRoleHelpers() {
    window.AppUser = window.AppUser || {};

    function safeLower(v) {
      return String(v || "").toLowerCase().trim();
    }

    function syncFromCache() {
        try {
            const cached = JSON.parse(localStorage.getItem("cached_user_profile") || "{}");
            window.AppUser.roleFromProfile = cached.role || "viewer";
            window.AppUser.householdId = cached.household_id || "";
            window.AppUser.fullName = cached.full_name || "";
        } catch (e) {
            window.AppUser.roleFromProfile = "viewer";
        }
    }

    window.AppUser.isAdmin = () => safeLower(window.AppUser.roleFromProfile) === "admin";
    window.AppUser.isContributor = () => safeLower(window.AppUser.roleFromProfile) === "editor";
    window.AppUser.isViewer = () => safeLower(window.AppUser.roleFromProfile) === "viewer";
    window.AppUser.getFilterName = () => String(window.AppUser.fullName || "").trim();

    syncFromCache();

    if (!window.vendorRoleShimBound) {
        window.addEventListener("roleChanged", () => { syncFromCache(); });
        window.vendorRoleShimBound = true;
    }
})();

// --- DYNAMIC DOM ELEMENTS (SPA Fix) ---
let els = {};
let payEls = {};
let planEls = {};
let addVendorEls = {};
let uploadEls = {};

function refreshDOMReferences() {
    els = {
        statusLine: document.getElementById("statusLine"),
        sumBooked: document.getElementById("sumBooked"),
        sumUpcoming: document.getElementById("sumUpcoming"),
        sumOverdue: document.getElementById("sumOverdue"),
        sumTotalScheduled: document.getElementById("sumTotalScheduled"),
        sumPaid: document.getElementById("sumPaid"),
        sumRemaining: document.getElementById("sumRemaining"),
        scopeSeg: document.querySelector(".segmented"),
        scopeBtns: document.querySelectorAll(".segBtn[data-scope]"),
        searchInput: document.getElementById("searchInput"),
        filterCategory: document.getElementById("filterCategory"),
        filterPay: document.getElementById("filterPay"),
        btnClear: document.getElementById("btnClear"),
        btnRefresh: document.getElementById("btnRefresh"),
        btnAddVendor: document.getElementById("btnAddVendor"),
        vendorList: document.getElementById("vendorList"),
        emptyState: document.getElementById("emptyState"),
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

    payEls = {
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

    planEls = {
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

    addVendorEls = {
        modal: document.getElementById("modalAddVendor"),
        form: document.getElementById("formAddVendor"),
        btnClose: document.getElementById("btnCloseAddVendor"),
        btnCancel: document.getElementById("btnCancelAddVendor"),
        name: document.getElementById("addVendorName"),
        category: document.getElementById("addVendorCategory"),
        status: document.getElementById("addVendorStatus"),
        website: document.getElementById("addVendorWebsite"),
        contactName: document.getElementById("addVendorContactName"),
        email: document.getElementById("addVendorEmail"),
        phone: document.getElementById("addVendorPhone"),
        notes: document.getElementById("addVendorNotes")
    };

    uploadEls = {
        modal: document.getElementById("modalUploadFile"),
        form: document.getElementById("formUploadFile"),
        btnClose: document.getElementById("btnCloseUpload"),
        btnCancel: document.getElementById("btnCancelUpload"),
        companyId: document.getElementById("uploadCompanyId"),
        displayName: document.getElementById("uploadDisplayName"),
        fileType: document.getElementById("uploadFileType"),
        file: document.getElementById("uploadFile")
    };
}

const CATEGORY_MAP = {
    'venue_catering': 'Venue/Catering',
    'band': 'Band',
    'hair_makeup': 'Hair/Makeup',
    'photography': 'Photography',
    'videography': 'Videography',
    'planner_coordination': 'Day-of Coordination',
    'transportation': 'Transportation',
    'hotel_lodging': 'Hotel/Lodging',
    'florals_decor': 'Florals/Decor'
};

// --- GLOBAL STATE ---
let companies = [];
let detailsCache = new Map();
let searchQuery = "";
let categoryFilter = "all";
let payFilter = "all"; // all | overdue | upcoming | paid
let paymentTab = "all"; // all | upcoming | paid
let scopeFilter = "all";
let selectedPayFile = null;

// --- HELPERS ---
function getCategoryDisplay(cat) { return CATEGORY_MAP[cat] || cat; }

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

function parseISODate(d) {
    if (!d) return null;
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return null;
    return dt;
}

function fmtDate(d) {
    if (!d) return "—";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "—";
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const m = months[dt.getUTCMonth()];
    const day = dt.getUTCDate();
    const y = dt.getUTCFullYear();
    return `${m} ${day}, ${y}`;
}

async function fetchJSON(url, options = {}) {
    const token = await waitForAuth();
    const res = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
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

// --- LOGIC: PERMISSIONS SANITIZER ---
function sanitizeVendorForUser(vendorData) {
    if (!vendorData) return vendorData;
    let v;
    try {
      v = JSON.parse(JSON.stringify(vendorData));
    } catch (e) {
      v = { ...vendorData };
    }
  
    v.payments = Array.isArray(v.payments) ? v.payments : [];
    v.files = Array.isArray(v.files) ? v.files : [];
    v.company_files = Array.isArray(v.company_files) ? v.company_files : [];
    v.people = Array.isArray(v.people) ? v.people : [];
  
    const AU = window.AppUser || {};
    const isAdmin = typeof AU.isAdmin === "function" ? AU.isAdmin() : false;
    const isViewer = typeof AU.isViewer === "function" ? AU.isViewer() : false;
    const isContributor = typeof AU.isContributor === "function" ? AU.isContributor() : false;
  
    if (isAdmin) return v;
  
    if (isViewer) {
      v.payments = [];
      v.financials = { scheduled: null, paid: null, remaining: null };
      return v;
    }
  
    if (isContributor) {
        const myHouseholdId = String(AU.householdId || "");
        if (!myHouseholdId) {
          v.payments = [];
          v.financials = { scheduled: 0, paid: 0, remaining: 0 };
          return v;
        }
    
        v.payments = v.payments.filter((p) => {
          const resps = Array.isArray(p?.responsibilities) ? p.responsibilities : [];
          return resps.some((r) => String(r?.responsible_household_id || "") === myHouseholdId);
        });
    
        let myScheduled = 0;
        let myPaid = 0;
    
        v.payments.forEach((p) => {
          const resps = Array.isArray(p?.responsibilities) ? p.responsibilities : [];
          resps.forEach((r) => {
            if (String(r?.responsible_household_id || "") !== myHouseholdId) return;
            const amt = Number(r?.amount) || 0;
            myScheduled += amt;
    
            const reimbStatus = String(r?.reimbursement_status || "").toLowerCase().trim();
            const respStatus = String(r?.status || "").toLowerCase().trim();
            const paymentStatus = String(p?.status || "").toLowerCase().trim();
    
            const isReimbursed = reimbStatus === "received";
            const isDirectPay = (reimbStatus === "none" || !reimbStatus) && (respStatus === "paid" || paymentStatus === "paid");
    
            if (isReimbursed || isDirectPay) myPaid += amt;
          });
        });
    
        v.financials = { scheduled: myScheduled, paid: myPaid, remaining: myScheduled - myPaid };
        return v;
      }
    return v;
  }

// --- LOGIC: ROLLUPS & STATUS ---
function normRespStatus(r) {
    const s = (r?.status ?? "").toString().trim().toLowerCase();
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

    if (!resps.length) return { base, paidVendor: 0, remainingVendor: base };

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

        if (reimbStatus === "pending") reimburseOutstanding += amt;
        else if (reimbStatus === "received") reimburseCompleted += amt;
        else {
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

function companyRollup(detail) {
    const AU = window.AppUser || {};
    const isAdmin = typeof AU.isAdmin === "function" ? AU.isAdmin() : false;
    const isContributor = typeof AU.isContributor === "function" ? AU.isContributor() : false;
    const isMineScope = isAdmin && scopeFilter === "mine";
  
    const payments = Array.isArray(detail?.payments) ? detail.payments : [];

    let totalScheduled = 0;
    let totalPaid = 0;
    let overdueCount = 0;
    let nextDate = null;
    const today = startOfToday();

    payments.forEach((p) => {
        let relevantAmount = 0;
        let relevantPaid = 0;

        if (isAdmin && !isMineScope) {
            relevantAmount = Number(p.amount) || 0;
            let paidSum = 0;
            (p.responsibilities || []).forEach(r => {
                const s = normRespStatus(r);
                if (s === 'paid' || s === 'reimb_pending' || s === 'reimbursed') {
                    paidSum += (Number(r.amount) || 0);
                }
            });
            relevantPaid = paidSum;
        } else {
            const myHouseholdId = String(AU.householdId || "");
            const targetHousehold = isMineScope ? "hernandez-wlodarczyk" : myHouseholdId;

            (p.responsibilities || []).forEach(r => {
                if (String(r.responsible_household_id || "") === targetHousehold) {
                    const amt = Number(r.amount) || 0;
                    relevantAmount += amt;
                    
                    const s = normRespStatus(r);
                    if (s === 'paid' || s === 'reimbursed' || s === 'reimb_pending') {
                        relevantPaid += amt;
                    }
                }
            });
        }

        totalScheduled += relevantAmount;
        totalPaid += relevantPaid;

        const remaining = relevantAmount - relevantPaid;
        if (remaining > 0.01) {
            const due = parseISODate(p.due_date);
            if (due) {
                const due0 = new Date(due); 
                due0.setHours(0,0,0,0);
                if (due0 < today) overdueCount++;
                if (!nextDate || due0 < nextDate) nextDate = due0;
            }
        }
    });

    return {
        totalScheduled,
        totalPaid,
        remaining: totalScheduled - totalPaid,
        overdueCount,
        unpaidCount: (totalScheduled - totalPaid) > 0.01 ? 1 : 0,
        next: nextDate ? { due_date: nextDate } : null
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
    const AU = window.AppUser || {};
    const isEmmaOrEthan = typeof AU.isAdmin === "function" ? AU.isAdmin() : false;

    if (els.scopeSeg) {
        els.scopeSeg.parentElement.style.display = isEmmaOrEthan ? "flex" : "none";
    }

    try {
        companies = await fetchJSON(API.vendors("booked"));
        detailsCache.clear();
        hydrateCategoryFilter(companies);
        await warmDetailsForSummary(companies);
        render(); 
        setStatus("");
    } catch (e) {
        console.error(e);
        setStatus("Could not load vendors.");
    }
}

function hydrateCategoryFilter(rows) {
    if (!els.filterCategory) return;
    const cats = new Set();
    rows.forEach((r) => {
        const c = (r.category || "").trim();
        if (c) cats.add(c);
    });

    els.filterCategory.innerHTML = `<option value="all">All</option>`;
    [...cats].sort((a, b) => a.localeCompare(b)).forEach((c) => {
        const display = getCategoryDisplay(c);
        els.filterCategory.insertAdjacentHTML("beforeend", `<option value="${escapeHTML(c)}">${escapeHTML(display)}</option>`);
    });

    els.filterCategory.value = categoryFilter;
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
  
    const AU = window.AppUser || {};
    const isViewer = typeof AU.isViewer === "function" ? AU.isViewer() : false;
    const isContributor = typeof AU.isContributor === "function" ? AU.isContributor() : false;
  
    if (isViewer) {
      let totalContacts = 0;
      let missingInfoCount = 0; 
      const categories = new Set();
  
      data.forEach((c) => {
        const d = detailsCache.get(c.id);
        if (!d) return;
        if (c.category) categories.add(c.category);
        if (Array.isArray(d.people)) totalContacts += d.people.length;
        const primary = (d.people && d.people[0]) ? d.people[0] : {};
        if (!primary.email || !primary.phone) missingInfoCount++;
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
      return;
    }
  
    let upcomingCount = 0;
    let overdueCount = 0;
    let totalScheduled = 0;
    let totalPaid = 0;
    let totalRemaining = 0;
  
    data.forEach((c) => {
      const d = detailsCache.get(c.id);
      if (!d) return;
      const cleanD = sanitizeVendorForUser(d);
      const roll = companyRollup(cleanD);
      if (!roll) return;
      if (roll.unpaidCount > 0) upcomingCount++;
      if (roll.overdueCount > 0) overdueCount++;
      totalScheduled += Number(roll.totalScheduled || 0);
      totalPaid += Number(roll.totalPaid || 0);
      totalRemaining += Number(roll.remaining || 0);
    });
  
    const cardsHTML = `
      <div class="metricCard is-blue">
        <div class="metricLabel">Booked Vendors</div>
        <div class="metricValue">${data.length}</div>
      </div>
      <div class="metricCard ${upcomingCount > 0 ? "is-orange" : ""}">
        <div class="metricLabel">Upcoming Payments</div>
        <div class="metricValue">${upcomingCount}</div>
      </div>
      <div class="metricCard ${overdueCount > 0 ? "is-red" : ""}">
        <div class="metricLabel">Overdue</div>
        <div class="metricValue">${overdueCount}</div>
      </div>
    `;
  
    const labelSched = isContributor ? "My Commitment" : "Total Scheduled";
    const labelRem = isContributor ? "My Balance" : "Remaining";
  
    const finHTML = `
      <div class="stripRight">
        <div class="finStat">
          <div class="finLabel">${labelSched}</div>
          <div class="finValue">${fmtMoney(totalScheduled)}</div>
        </div>
        <div class="finStat">
          <div class="finLabel">Paid</div>
          <div class="finValue" style="color: var(--theme-600);">${fmtMoney(totalPaid)}</div>
        </div>
        <div style="width:1px; height: 32px; background:var(--border-soft); margin:0 12px;"></div>
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

    const rawData = getFilteredCompanies(); 
    const data = rawData.filter(c => {
        if (scopeFilter === 'mine' && AppUser.isAdmin()) {
            const d = detailsCache.get(c.id);
            if (!d) return false;
            const roll = companyRollup(d); 
            return roll.totalScheduled > 0; 
        }
        return true;
    });

    if (!data.length) {
        els.vendorList.innerHTML = "";
        els.emptyState?.classList.remove("hidden");
        return;
    }
    els.emptyState?.classList.add("hidden");

    els.vendorList.innerHTML = data.map((c) => {
        const d = detailsCache.get(c.id);
        const cleanD = sanitizeVendorForUser(d);
        const roll = d ? companyRollup(cleanD) : null; 

        const displayCategory = getCategoryDisplay(c.category);
        const metaBits = [displayCategory].filter(Boolean).join(" • ");

        let chips = "";
        if (roll) {
            if (roll.overdueCount > 0) chips += chipHTML("overdue", `${roll.overdueCount} overdue`);
            else if (roll.remaining > 0 && roll.next) chips += chipHTML("upcoming", `Next: ${fmtDate(roll.next.due_date)}`);
            else if (roll.totalScheduled > 0 && roll.remaining <= 0.01) chips += chipHTML("paid", "Up to date");
        } else {
            chips = chipHTML("", "Loading…");
        }

        let numsHTML = "";
        
        const isViewer = AppUser.isViewer();
        const isContributor = AppUser.isContributor();
        const isAdmin = AppUser.isAdmin();
        const hasFinancialStake = roll && roll.totalScheduled > 0.01;

        if (!isViewer && roll) {
            if (isAdmin || hasFinancialStake) {
                const pct = roll.totalScheduled > 0 ? Math.min(100, Math.max(0, (roll.totalPaid / roll.totalScheduled) * 100)) : 0;
                const labelSched = (scopeFilter === 'mine' || isContributor) ? "My Share" : "Scheduled";
                
                numsHTML = `
                    <div class="vendorBottom">
                        <div class="vendorNums">
                          <div class="vendorStat" style="width: 180px;"><span>${labelSched}</span> <b>${fmtMoney(roll.totalScheduled)}</b></div>
                          <div class="vendorStat" style="width: 150px;"><span>Paid</span> <b>${fmtMoney(roll.totalPaid)}</b></div>
                          <div class="vendorStat" style="width: 190px;"><span>Remaining</span> <b>${fmtMoney(roll.remaining)}</b></div>
                          <div class="vendorProgress" title="${pct.toFixed(0)}%"><div class="vendorProgressFill" style="width: ${pct}%"></div></div>
                        </div>
                    </div>
                `;
            }
        }

        return `
          <article class="vendorCard" data-id="${escapeHTML(c.id)}">
            <div class="vendorTop">
              <div><div class="vendorMeta">${escapeHTML(metaBits)}</div><h3 class="vendorName">${escapeHTML(c.name)}</h3></div>
              <div class="vendorRight">${chips}<button class="linkBtn" type="button" data-action="open">View</button></div>
            </div>
            ${numsHTML} 
          </article>
        `;
    }).join("");

    els.vendorList.querySelectorAll(".vendorCard").forEach((card) => {
        const id = card.getAttribute("data-id");
        card.querySelector("[data-action='open']")?.addEventListener("click", (e) => { e.stopPropagation(); openDrawer(id); });
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
    const cid = companyId;
    openDrawerShell();
    els.drawer?.setAttribute("data-company-id", companyId);

    if (els.payTabs) {
        els.payTabs.className = "minimalTabs"; 
        paymentTab = "all";
        els.payTabs.querySelectorAll("button[data-tab]").forEach((b) => {
            b.className = "minimalTabBtn"; 
            if (b.getAttribute("data-tab") === "all") b.classList.add("is-active");
        });
    }

    els.drawerTitle.textContent = "Vendor";
    els.drawerMeta.textContent = "Loading…";
    if (els.drawerAvatar) els.drawerAvatar.textContent = "V";
    
    const contactContainer = document.getElementById("drawerHeaderContact");
    const statsContainer = document.getElementById("paymentStatsLocation");
    if (contactContainer) contactContainer.innerHTML = "";
    if (statsContainer) statsContainer.innerHTML = "";

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

        const displayCategory = getCategoryDisplay(c.category);
        els.drawerTitle.textContent = c.name || "Vendor";
        els.drawerMeta.textContent = [displayCategory].filter(Boolean).join(" • ") || "—";
        if (els.drawerAvatar) els.drawerAvatar.textContent = initials(c.name || "");

        let contactHTML = "";
        const primaryContact = (d.people && d.people.length > 0) ? d.people[0] : {};
        const email = c.email || primaryContact.email;
        const phone = c.phone || primaryContact.phone;
        const website = c.website;

        if (website) contactHTML += `<a href="${website}" target="_blank" class="contactChip">🔗 Website</a>`;
        if (email) contactHTML += `<a href="mailto:${email}" class="contactChip">✉️ Email</a>`;
        if (phone) contactHTML += `<a href="tel:${phone}" class="contactChip">📞 Call</a>`;
        
        if (!contactHTML) contactHTML = `<span class="contactChip" style="background:transparent; border:1px dashed var(--border); padding:4px 10px;">No quick contacts</span>`;
        if (contactContainer) contactContainer.innerHTML = contactHTML;

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
                <div class="drawerStatItem is-hero" style="background: var(--theme-100); border-color: var(--theme-300);">
                    <span class="drawerStatLabel" style="color: var(--theme-600);">Status</span>
                    <span class="drawerStatValue" style="color: var(--theme-700);">Paid in Full</span>
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

        if (statsContainer && !AppUser.isViewer()) {
            statsContainer.innerHTML = `<div class="drawerStatsGrid">${statsHTML}</div>`;
        } else if (statsContainer) {
            statsContainer.innerHTML = ""; 
        }

        const notesArea = els.drawerNotes;
        const currentNotes = (c.notes || "").trim();
        
        if (AppUser.isAdmin()) {
            notesArea.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div id="noteDisplay" style="white-space: pre-wrap;">${escapeHTML(currentNotes) || "<span class='muted'>No notes.</span>"}</div>
                    <button id="btnEditNotes" class="linkBtn" style="font-size:0.8rem;">Edit</button>
                </div>
                <div id="noteEditMode" style="display:none; margin-top:8px;">
                    <textarea id="fieldVendorNotes" class="input" rows="4" style="width:100%; margin-bottom:8px;">${escapeHTML(currentNotes)}</textarea>
                    <div style="display:flex; gap:8px; justify-content:flex-end;">
                        <button id="btnCancelNote" class="btnSecondary" style="padding:4px 12px; font-size:0.8rem;">Cancel</button>
                        <button id="btnSaveNote" class="btnPrimary" style="padding:4px 12px; font-size:0.8rem;">Save</button>
                    </div>
                </div>
            `;
            
            const btnEdit = notesArea.querySelector("#btnEditNotes");
            const btnCancel = notesArea.querySelector("#btnCancelNote");
            const btnSave = notesArea.querySelector("#btnSaveNote");
            const displayDiv = notesArea.querySelector("#noteDisplay");
            const editDiv = notesArea.querySelector("#noteEditMode");
            const textArea = notesArea.querySelector("#fieldVendorNotes");

            btnEdit.addEventListener("click", () => {
                displayDiv.style.display = "none";
                btnEdit.style.display = "none";
                editDiv.style.display = "block";
                textArea.focus();
            });

            btnCancel.addEventListener("click", () => {
                editDiv.style.display = "none";
                displayDiv.style.display = "block";
                btnEdit.style.display = "inline-block";
                textArea.value = currentNotes; 
            });

            btnSave.addEventListener("click", async () => {
                const newText = textArea.value;
                btnSave.textContent = "Saving...";
                btnSave.disabled = true;
              
                try {
                  const token = await waitForAuth();
                  const res = await fetch(`/api/vendors/${cid}/notes`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ notes: newText }),
                  });
              
                  const json = await res.json().catch(() => ({}));
                  if (!res.ok) throw new Error(json.error || "Failed");
              
                  d.company = d.company || {};
                  d.company.notes = newText;
                  detailsCache.set(cid, d);
                  openDrawer(cid);
                } catch (e) {
                  console.error(e);
                  alert("Error saving notes.");
                  btnSave.textContent = "Save";
                } finally {
                  btnSave.disabled = false;
                }
              });

        } else {
            notesArea.textContent = currentNotes || "—";
        }

        renderPeople(d.people || []);
        renderPaymentsLedger(cleanD.payments || [], d.company_files || []);
        renderVendorDocs(d.files || []);

        const tabPayments = document.querySelector("button[data-tab='payments']");
        const tabVendor = document.querySelector("button[data-tab='vendor']");
        const shouldHidePayments = AppUser.isViewer() || (AppUser.isContributor() && roll.totalScheduled === 0);

        if (shouldHidePayments) {
            if (tabPayments) tabPayments.style.display = "none";
            if (tabVendor) tabVendor.click(); 
        } else {
            if (tabPayments) tabPayments.style.display = "inline-block";
            if (tabPayments) tabPayments.click();
        }

    } catch (e) {
        console.error(e);
        if (els.drawerMeta) els.drawerMeta.textContent = "Could not load vendor.";
    }
}

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
            <div style="text-align:center; padding: 32px; color:var(--muted); background:#f9fafb; border-radius:12px; border:1px dashed var(--border);">
                <div style="font-size:24px; margin-bottom:8px;">📇</div>
                <div>No contacts added yet.</div>
            </div>`;
        return;
    }

    els.drawerPeople.innerHTML = people.map(p => {
        const displayName = p.name || p.contact_name || p.full_name || "Unknown Contact";
        const displayRole = p.role || p.title || p.job_title || "";
        const init = getInitials(displayName);

        return `
        <div class="contactCard">
            <div class="contactAvatar">${init}</div>
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

    let addBtnHTML = "";
    if (AppUser.isAdmin()) {
        addBtnHTML = `
        <div style="display:flex; justify-content:flex-end; margin-bottom:12px;">
            <button class="btn btn--primary" id="btnAddNewPayment" style="padding: 6px 14px; font-size: 0.85rem; display:flex; align-items:center; gap:6px;">
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

                let displayBase = t.base;
                let displayPaid = t.paidVendor;
                let displayRemaining = t.remainingVendor;

                if (AppUser.isContributor()) {
                    const myHouseholdId = String(AppUser.householdId || "");
                    const myResp = p.responsibilities?.find(r => String(r.responsible_household_id || "") === myHouseholdId);
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
                if (AppUser.isContributor()) {
                    if (displayRemaining <= 0) statusChip = chipHTML("paid", "Paid");
                    else statusChip = chipHTML("upcoming", "Upcoming");
                } else {
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

                const metaLineHTML = AppUser.isContributor() 
                    ? "" 
                    : `<div class="paymentMetaLeft" style="margin-top: 4px; font-size: 0.85rem; color: var(--muted);">
                         <span>Paid ${fmtMoney(displayPaid)}</span> • 
                         <span>Remaining ${fmtMoney(displayRemaining)}</span>
                       </div>`;

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
        dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.style.background = "var(--theme-100)"; });
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

    let headerHTML = "";
    if (AppUser.isAdmin()) {
        headerHTML = `
            <div style="display:flex; justify-content:flex-end; margin-bottom:12px;">
                <button class="btnSmall" id="btnAddVendorFile" style="display:flex; align-items:center; gap:6px;">
                    <span>+</span> Add File
                </button>
            </div>
        `;
    }

    const { vendorDocs } = groupFilesByPayment(list);
    const filtered = vendorDocs.filter((f) => !isPlaceholderFile(f));

    if (!filtered.length) {
        els.drawerFiles.innerHTML = `${headerHTML}<div class="muted">No vendor documents yet.</div>`;
    } else {
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

        const listHTML = keys.map((k) => {
             const items = groups.get(k) || [];
             const header = `<div class="muted" style="font-weight:950; font-size:12px; letter-spacing:.06em; text-transform:uppercase;">${escapeHTML(fileTypeLabel(k))}</div>`;
             const rows = items.map(fileRowHTML).join("");
             return `<div class="stack" style="gap:8px;">${header}${rows}</div>`;
        }).join("");

        els.drawerFiles.innerHTML = `${headerHTML}<div class="stack">${listHTML}</div>`;
    }

    els.drawerFiles.querySelectorAll("button[data-open]").forEach((b) => {
        b.addEventListener("click", () => openSigned(b.getAttribute("data-open")));
    });

    const btnAdd = els.drawerFiles.querySelector("#btnAddVendorFile");
    if (btnAdd) {
        btnAdd.addEventListener("click", () => {
            openUploadModal(els.drawer.getAttribute("data-company-id"));
        });
    }
}

function openPayModal(data) {
    if (!payEls.modal) return;
    payEls.form.reset();
    selectedPayFile = null;
    if (payEls.fileName) payEls.fileName.textContent = "Drag receipt here or click to browse";
    if (payEls.splitContainer) payEls.splitContainer.innerHTML = "";
    if (payEls.toggle) payEls.toggle.checked = false;
    if (payEls.simpleMode) payEls.simpleMode.style.display = "block";
    if (payEls.splitMode) payEls.splitMode.style.display = "none";
    if (payEls.notes) payEls.notes.value = "";
    if (payEls.id) payEls.id.value = data.id;
    if (payEls.desc) payEls.desc.value = data.desc;
    if (payEls.amount) payEls.amount.value = data.amt; 
    if (payEls.date) payEls.date.valueAsDate = new Date(); 
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
    if (payEls.fileName) payEls.fileName.textContent = selectedPayFile.name;
}

function addSplitRow(defaultData = {}) {
    if (!payEls.splitContainer) return;
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

        const token = await waitForAuth();
        const res = await fetch("/api/payments/record", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
        });
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
        const token = await waitForAuth();
        const res = await fetch("/api/payments/save", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
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

function bindAddVendorEvents() {
    addVendorEls.btnClose?.addEventListener("click", closeAddVendorModal);
    addVendorEls.btnCancel?.addEventListener("click", closeAddVendorModal);
    addVendorEls.form?.addEventListener("submit", handleAddVendorSubmit);
}

function openAddVendorModal() {
    if (!addVendorEls.modal) return;
    addVendorEls.form.reset();
    if (addVendorEls.category && addVendorEls.category.children.length === 0) {
        const sortedCats = Object.entries(CATEGORY_MAP).sort((a, b) => a[1].localeCompare(b[1]));
        addVendorEls.category.innerHTML = `<option value="" disabled selected>Select a category...</option>`;
        sortedCats.forEach(([val, label]) => {
            const opt = document.createElement("option");
            opt.value = val;
            opt.textContent = label;
            addVendorEls.category.appendChild(opt);
        });
    }
    if (addVendorEls.status) addVendorEls.status.value = "booked"; 
    addVendorEls.modal.style.display = "flex";
    addVendorEls.modal.setAttribute("aria-hidden", "false");
    if (addVendorEls.name) addVendorEls.name.focus();
}

function closeAddVendorModal() {
    if (!addVendorEls.modal) return;
    addVendorEls.modal.style.display = "none";
    addVendorEls.modal.setAttribute("aria-hidden", "true");
}

async function handleAddVendorSubmit(e) {
    e.preventDefault();
    const btn = addVendorEls.form.querySelector("button[type='submit']");
    const originalText = btn.textContent;
    btn.textContent = "Creating...";
    btn.disabled = true;

    try {
        const payload = {
            name: addVendorEls.name.value,
            category: addVendorEls.category.value,
            status: addVendorEls.status.value,
            website: addVendorEls.website.value,
            contact_name: addVendorEls.contactName.value,
            email: addVendorEls.email.value,
            phone: addVendorEls.phone.value,
            notes: addVendorEls.notes.value
        };

        const token = await waitForAuth();
        const res = await fetch("/api/vendors/save", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed");

        closeAddVendorModal();
        await loadVendors();

        if (json.id) openDrawer(json.id);

    } catch (err) {
        console.error(err);
        alert(err.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

function bindUploadEvents() {
    if(!uploadEls.modal) return;
    uploadEls.btnClose?.addEventListener("click", closeUploadModal);
    uploadEls.btnCancel?.addEventListener("click", closeUploadModal);
    uploadEls.form?.addEventListener("submit", handleUploadSubmit);
}

function openUploadModal(companyId) {
    if (!uploadEls.modal) return;
    uploadEls.form.reset();
    if (uploadEls.companyId) uploadEls.companyId.value = companyId;
    uploadEls.modal.style.display = "flex";
    uploadEls.modal.setAttribute("aria-hidden", "false");
}

function closeUploadModal() {
    if (!uploadEls.modal) return;
    uploadEls.modal.style.display = "none";
    uploadEls.modal.setAttribute("aria-hidden", "true");
}

async function handleUploadSubmit(e) {
    e.preventDefault();
    const btn = uploadEls.form.querySelector("button[type='submit']");
    const originalText = btn.textContent;
    btn.textContent = "Uploading...";
    btn.disabled = true;

    try {
        const formData = new FormData();
        formData.append("company_id", uploadEls.companyId.value);
        formData.append("file_name", uploadEls.displayName.value);
        formData.append("file_type", uploadEls.fileType.value);
        formData.append("file", uploadEls.file.files[0]);

        const token = await waitForAuth();
        const res = await fetch("/api/vendor-files/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed");

        closeUploadModal();
        
        const cid = uploadEls.companyId.value;
        const d = await fetchJSON(API.vendorDetails(cid));
        detailsCache.set(cid, d);
        openDrawer(cid);

    } catch (err) {
        alert(err.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

function bindControls() {
    if (els.searchInput) els.searchInput.addEventListener("input", () => { searchQuery = els.searchInput.value || ""; render(); });
    if (els.filterCategory) els.filterCategory.addEventListener("change", () => { categoryFilter = els.filterCategory.value || "all"; render(); });
    if (els.filterPay) els.filterPay.addEventListener("change", () => { payFilter = els.filterPay.value || "all"; render(); });
    
    if (els.btnClear) {
        els.btnClear.addEventListener("click", () => {
            searchQuery = ""; categoryFilter = "all"; payFilter = "all";
            if (els.searchInput) els.searchInput.value = "";
            if (els.filterCategory) els.filterCategory.value = "all";
            if (els.filterPay) els.filterPay.value = "all";
            render();
        });
    }

    if (els.scopeSeg && els.scopeBtns?.length) {
        els.scopeSeg.addEventListener("click", (e) => {
            const btn = e.target.closest(".segBtn[data-scope]");
            if (!btn) return;

            scopeFilter = btn.dataset.scope || "all";

            els.scopeBtns.forEach(b => {
                const isActive = (b.dataset.scope === scopeFilter);
                b.classList.toggle("is-active", isActive);
                b.setAttribute("aria-selected", isActive ? "true" : "false");
            });

            render();
        });
    }
    if (els.btnRefresh) els.btnRefresh.addEventListener("click", loadVendors);
    if (els.btnAddVendor) els.btnAddVendor.addEventListener("click", openAddVendorModal);
    if (els.drawerOverlay) els.drawerOverlay.addEventListener("click", closeDrawer);
    if (els.drawerClose) els.drawerClose.addEventListener("click", closeDrawer);
    if (els.btnDrawerClose2) els.btnDrawerClose2.addEventListener("click", closeDrawer);
    
    // Safely add escape key listener once
    if (!window.vendorsKeydownBound) {
        document.addEventListener("keydown", (e) => { 
            if (e.key === "Escape" && document.getElementById("vendorList")) closeDrawer(); 
        });
        window.vendorsKeydownBound = true;
    }
}

// --- INIT & ROUTER HOOKS ---

async function initVendorsPage() {
    // 1. Refresh DOM references so they point to the newly swapped HTML
    refreshDOMReferences();

    // 2. Abort if we aren't on the Vendors page
    if (!els.vendorList) return;

    // 3. Reset internal state filters to match the UI 
    searchQuery = els.searchInput ? els.searchInput.value : "";
    categoryFilter = els.filterCategory ? els.filterCategory.value : "all";
    payFilter = els.filterPay ? els.filterPay.value : "all";
    
    // Ensure scope buttons match state
    if (els.scopeBtns) {
        els.scopeBtns.forEach(b => {
            if (b.classList.contains("is-active")) scopeFilter = b.dataset.scope;
        });
    }

    // 4. Bind all event listeners to the fresh DOM nodes
    bindControls();
    bindPaymentTabs();
    bindDrawerTabs();
    bindPayModalEvents(); 
    bindPlanModalEvents();
    bindAddVendorEvents();
    bindUploadEvents();
    
    // 5. Fetch and render
    loadVendors();
}

// Run on hard refresh
document.addEventListener("DOMContentLoaded", initVendorsPage);
// Run on soft SPA navigation
window.addEventListener("app:navigated", initVendorsPage);

// Safely bind role changes globally so it doesn't stack up
if (!window.vendorsRoleBound) {
    window.addEventListener("roleChanged", () => {
        if (document.getElementById("vendorList")) {
            loadVendors();
            closeDrawer();
        }
    });
    window.vendorsRoleBound = true;
}