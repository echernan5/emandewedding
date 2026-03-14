// --- EXPORTS LOGIC ---
(() => { 
    function renderExports() {
        const isAdmin = AppUser.isAdmin(); // Emma/Ethan
        const isContributor = AppUser.isContributor(); // Amy/Dave
        const isViewer = AppUser.isViewer(); // Isabel

        // 1. Identify cards by ID
        const myPaymentsCard = document.getElementById('myPaymentsCard');
        const fullLedgerCard = document.getElementById('fullLedgerCard');
        const vendorDirCard = document.getElementById('vendorDirCard');

        // 2. Reset visibility to a clean slate
        // Guest List and Address Book always show to everyone
        document.querySelectorAll('.exportCard').forEach(el => {
            el.style.display = 'flex'; 
        });

        // 3. Apply Restricted Logic
        if (isViewer) {
            // Isabel/Viewers see Guest List, Addresses, and Vendor Directory
            // But hide ALL payment-related exports
            if (myPaymentsCard) myPaymentsCard.style.display = 'none';
            if (fullLedgerCard) fullLedgerCard.style.display = 'none';
        } 
        else if (isContributor) {
            // Amy sees Guest List, Addresses, Vendor Directory, and HER Payment Schedule
            // But hide the Admin-only Full Ledger
            if (fullLedgerCard) fullLedgerCard.style.display = 'none';
        }
        // Admin (Emma) sees everything by default
    }

    // Ensure it runs on load and when roles switch
    document.addEventListener("DOMContentLoaded", renderExports);
    window.addEventListener("roleChanged", renderExports);

    /**
     * Trigger CSV download from server
     */
    function exportData(type) {
        const btn = event.currentTarget;
        const originalText = btn.textContent;
        
        btn.textContent = "Generating...";
        btn.disabled = true;

        window.location.href = `/api/exports/${type}`;

        setTimeout(() => {
            btn.textContent = originalText;
            btn.disabled = false;
        }, 2000);
    }
})();