document.addEventListener('DOMContentLoaded', () => {
    // --- Guard Clause: Check for Supabase library ---
    if (!window.supabase) {
        console.error("Supabase client not loaded.");
        return;
    }
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // --- Global State ---
    let allVendors = [];
    let currentVendor = null; // Store the vendor being viewed/edited
    const ALL_VENDOR_CATEGORIES = [
        "Venue", "Photographer", "Videographer", "Florist", "Caterer", "Cake",
        "Music/DJ", "Officiant", "Hair & Makeup", "Wedding Planner", "Invitations"
    ];
    let visibleCategories = [...ALL_VENDOR_CATEGORIES];

    // --- Element Selectors ---
    const vendorChecklistEl = document.getElementById('vendor-checklist');
    const tabContentContainerEl = document.getElementById('tab-content-container');
    const addVendorBtn = document.getElementById('add-vendor-btn');
    const vendorSectionTitle = document.getElementById('vendor-section-title');
    
    // Modal Selectors
    const addVendorModalOverlay = document.getElementById('addVendorModalOverlay');
    const addVendorModal = document.getElementById('addVendorModal');
    const vendorDetailModalOverlay = document.getElementById('vendorDetailModalOverlay');
    const vendorDetailModal = document.getElementById('vendorDetailModal');

    // --- Main Initialization ---
    const init = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            window.location.href = '/login'; // Redirect if not logged in
            return;
        }
        await fetchDataAndRender();
        setupEventListeners();
    };
    
    // --- Data Fetching & Rendering ---
    const fetchDataAndRender = async () => {
        const { data, error } = await supabase.from('vendors').select('*');
        if (error) {
            console.error("Error fetching vendors:", error);
            return;
        }
        allVendors = data || [];
        
        renderAllComponents();
    };
    
    const renderAllComponents = () => {
        renderVendorChecklist();
        updateDashboardSummary();
        renderUpcomingPayments();
        // Render the currently active tab
        const activeTab = document.querySelector('.tab-button.active').dataset.tab;
        switchTab(activeTab, true); // true to prevent re-rendering everything
    };

    const renderVendorChecklist = () => {
        vendorChecklistEl.innerHTML = '';
        
        if (!Array.isArray(visibleCategories)) {
            console.error("DEBUG: visibleCategories is not an array:", visibleCategories);
            return;
        }
    
        console.log("--- DEBUG: Starting Checklist Render ---");
    
        visibleCategories.forEach(category => {
            const vendorsInCategory = allVendors.filter(v => v.category === category);
            const primaryVendor = vendorsInCategory.find(v => v.status === 'paid') ||
                                  vendorsInCategory.find(v => v.status === 'booked') ||
                                  vendorsInCategory.find(v => v.status === 'researching') ||
                                  vendorsInCategory[0];
            
            const status = primaryVendor ? primaryVendor.status : 'todo';
            
            // --- Debugging Logic ---
            const isPaid = status === 'paid';
            const dot1_class = ['researching', 'booked', 'paid'].includes(status) ? 'active' : '';
            const dot2_class = ['booked', 'paid'].includes(status) ? 'active' : '';
            const dot3_class = isPaid ? 'active' : '';
    
            // Print the results for each category to the console
            console.log(
                `Category: ${category.padEnd(15)} | Status: ${status.padEnd(12)} | Classes: [${dot1_class}, ${dot2_class}, ${dot3_class}]`
            );
    
            const listItem = document.createElement('li');
            listItem.className = 'checklist-item';
            listItem.dataset.status = status;
            
            listItem.innerHTML = `
                <span class="checklist-category">${category}</span>
                <div class="milestone-tracker">
                    <div class="milestone-line"></div>
                    <div class="milestone-line-progress" style="width: ${getStatusWidth(status)};"></div>
                    <div class="milestone-dots">
                        <div class="milestone-dot ${dot1_class} ${isPaid ? 'complete' : ''}"></div>
                        <div class="milestone-dot ${dot2_class} ${isPaid ? 'complete' : ''}"></div>
                        <div class="milestone-dot ${dot3_class} ${isPaid ? 'complete' : ''}"></div>
                    </div>
                </div>`;
            vendorChecklistEl.appendChild(listItem);
        });
    
        console.log("--- DEBUG: Finished Checklist Render ---");
    };
    
    const getStatusWidth = (status) => ({
        todo: '0%',
        researching: '33%',
        booked: '66%',
        paid: '100%'
    }[status] || '0%');
    
    const updateDashboardSummary = () => {
        const bookedOrPaidCount = allVendors.filter(v => ['booked', 'paid'].includes(v.status)).length;
        const totalVisible = visibleCategories.length;
        const percentage = totalVisible > 0 ? (bookedOrPaidCount / totalVisible) : 0;

        document.querySelector('.progress-ring__number').textContent = bookedOrPaidCount;
        const circle = document.querySelector('.progress-ring__circle');
        const radius = circle.r.baseVal.value;
        const circumference = 2 * Math.PI * radius;
        circle.style.strokeDasharray = `${circumference} ${circumference}`;
        circle.style.strokeDashoffset = circumference - (percentage * circumference);
        // Update stats text...
    };
    
    const renderUpcomingPayments = () => {
        // Placeholder for when you implement this feature
        document.querySelector('.upcoming-payments-list').innerHTML = '<li class="no-payments">No upcoming payments. 🎉</li>';
    };

    const renderBookedVendors = () => {
        tabContentContainerEl.innerHTML = '';
        const bookedVendors = allVendors.filter(v => ['booked', 'paid'].includes(v.status));

        if (bookedVendors.length === 0) {
            tabContentContainerEl.innerHTML = '<p class="no-vendors-message">You have no booked vendors yet.</p>';
            return;
        }

        bookedVendors.forEach(vendor => {
            const card = document.createElement('div');
            card.className = 'info-card vendor-card'; // Add a class for styling/selection
            card.dataset.vendorId = vendor.id;
            card.innerHTML = `
                <h4>${vendor.vendor_name}</h4>
                <p>${vendor.category}</p>
                `;
            tabContentContainerEl.appendChild(card);
        });
    };

    const renderProspectiveVendors = () => {
        tabContentContainerEl.innerHTML = '';
        const prospectiveVendors = allVendors.filter(v => v.status === 'researching');
        const groupedByCategory = prospectiveVendors.reduce((acc, vendor) => {
            (acc[vendor.category] = acc[vendor.category] || []).push(vendor);
            return acc;
        }, {});

        const accordionContainer = document.createElement('div');
        accordionContainer.className = 'vendor-accordion';

        visibleCategories.forEach(category => {
            const vendors = groupedByCategory[category] || [];
            const accordionItem = document.createElement('div');
            accordionItem.className = 'accordion-item';
            accordionItem.innerHTML = `
                <div class="accordion-header">
                    <div class="category-and-count">
                        <span class="category-name">${category}</span>
                        <div class="vendor-count">(${vendors.length} prospective)</div>
                    </div>
                    <span class="material-icons-round">expand_more</span>
                </div>
                <div class="accordion-body">
                    ${vendors.length === 0 ? '<p class="no-vendors-message">No prospective vendors.</p>' :
                        vendors.map(vendor => `
                            <div class="prospective-vendor-card" data-vendor-id="${vendor.id}">
                                <h4>${vendor.vendor_name}</h4>
                                <p>${vendor.website || 'No website'}</p>
                            </div>
                        `).join('')
                    }
                </div>`;
            accordionContainer.appendChild(accordionItem);
        });
        tabContentContainerEl.appendChild(accordionContainer);
    };
    
    // --- UI Interactions ---
    const switchTab = (tabName, isSilent = false) => {
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`.tab-button[data-tab="${tabName}"]`).classList.add('active');

        if (tabName === 'booked') {
            vendorSectionTitle.textContent = 'Booked Vendors';
            addVendorBtn.classList.add('hidden');
            if (!isSilent) renderBookedVendors();
        } else {
            vendorSectionTitle.textContent = 'Prospective Vendors';
            addVendorBtn.classList.remove('hidden');
            if (!isSilent) renderProspectiveVendors();
        }
    };
    
    // --- Modal Logic (Refactored) ---
    const openModal = (overlay) => overlay.classList.add('is-visible');
    const closeModal = (overlay) => overlay.classList.remove('is-visible');

    const populateVendorView = (vendor) => {
        document.getElementById('view-vendor-name').textContent = vendor.vendor_name || 'N/A';
        document.getElementById('view-vendor-quote').textContent = vendor.quote ? `$${vendor.quote.toLocaleString()}` : 'N/A';
        document.getElementById('view-contact-name').textContent = vendor.contact_name || 'N/A';
        document.getElementById('view-phone').textContent = vendor.phone || 'N/A';
        document.getElementById('view-email').textContent = vendor.email || 'N/A';
        document.getElementById('view-notes').textContent = vendor.notes || 'No notes added.';
        const websiteEl = document.getElementById('view-website');
        websiteEl.textContent = vendor.website || 'N/A';
        websiteEl.href = vendor.website || '#';
    };

    const populateVendorEditForm = (vendor) => {
        const form = document.getElementById('edit-vendor-form');
        form.querySelector('#edit-vendor-id').value = vendor.id;
        form.querySelector('#edit-vendor-name').value = vendor.vendor_name || '';
        form.querySelector('#edit-vendor-contact-name').value = vendor.contact_name || '';
        form.querySelector('#edit-vendor-phone').value = vendor.phone || '';
        form.querySelector('#edit-vendor-email').value = vendor.email || '';
        form.querySelector('#edit-vendor-website').value = vendor.website || '';
        form.querySelector('#edit-vendor-quote').value = vendor.quote || '';
        form.querySelector('#edit-vendor-notes').value = vendor.notes || '';
        
        const categorySelect = form.querySelector('#edit-vendor-category');
        categorySelect.innerHTML = ALL_VENDOR_CATEGORIES.map(cat => `<option value="${cat}" ${vendor.category === cat ? 'selected' : ''}>${cat}</option>`).join('');
        form.querySelector('#edit-vendor-status').value = vendor.status;
    };
    
    const showViewMode = () => {
        vendorDetailModal.querySelector('#view-mode-content').classList.remove('hidden');
        vendorDetailModal.querySelector('#edit-mode-content').classList.add('hidden');
        vendorDetailModal.querySelector('#edit-vendor-btn').classList.remove('hidden');
        vendorDetailModal.querySelector('.edit-actions').classList.add('hidden');
        vendorDetailModal.querySelector('#book-vendor-btn').classList.add('hidden');
    };

    const showEditMode = () => {
        vendorDetailModal.querySelector('#view-mode-content').classList.add('hidden');
        vendorDetailModal.querySelector('#edit-mode-content').classList.remove('hidden');
        vendorDetailModal.querySelector('#edit-vendor-btn').classList.add('hidden');
        vendorDetailModal.querySelector('.edit-actions').classList.remove('hidden');
        if (currentVendor && currentVendor.status === 'researching') {
            vendorDetailModal.querySelector('#book-vendor-btn').classList.remove('hidden');
        }
    };
    
    const openVendorModal = (vendor) => {
        currentVendor = vendor;
        populateVendorView(vendor);
        populateVendorEditForm(vendor);
        
        if (vendor.status === 'researching') {
            showEditMode();
        } else {
            showViewMode();
        }
        
        openModal(vendorDetailModalOverlay);
    };

    // --- Event Listeners Setup ---
    const setupEventListeners = () => {
        // Tab switching
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => switchTab(e.target.dataset.tab));
        });
        
        // Open vendor detail modal (delegated for dynamically created cards)
        tabContentContainerEl.addEventListener('click', (e) => {
            const card = e.target.closest('.prospective-vendor-card, .vendor-card');
            if (card) {
                const vendorId = parseInt(card.dataset.vendorId, 10);
                const vendor = allVendors.find(v => v.id === vendorId);
                if (vendor) openVendorModal(vendor);
            }

            const header = e.target.closest('.accordion-header');
            if(header) {
                const item = header.closest('.accordion-item');
                item.classList.toggle('open');
                const body = item.querySelector('.accordion-body');
                body.style.maxHeight = item.classList.contains('open') ? `${body.scrollHeight}px` : 0;
            }
        });

        // Add Vendor Modal
        addVendorBtn.addEventListener('click', () => {
            document.getElementById('add-vendor-form').reset();
            const categorySelect = document.getElementById('vendor-category');
            categorySelect.innerHTML = '<option value="" disabled selected>Select...</option>' + ALL_VENDOR_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
            openModal(addVendorModalOverlay);
        });
        document.getElementById('addVendorModalCloseBtn').addEventListener('click', () => closeModal(addVendorModalOverlay));
        addVendorModalOverlay.addEventListener('click', (e) => {
            if (e.target === addVendorModalOverlay) closeModal(addVendorModalOverlay);
        });
        document.getElementById('add-vendor-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const newVendor = {
                vendor_name: formData.get('vendor-name'),
                category: formData.get('vendor-category'),
                website: formData.get('vendor-website'),
                status: 'researching',
            };
            const { error } = await supabase.from('vendors').insert(newVendor);
            if (!error) {
                closeModal(addVendorModalOverlay);
                await fetchDataAndRender();
                switchTab('prospective');
            } else { console.error(error); }
        });

        // Vendor Detail Modal
        document.getElementById('vendorDetailModalCloseBtn').addEventListener('click', () => closeModal(vendorDetailModalOverlay));
        vendorDetailModalOverlay.addEventListener('click', (e) => {
            if (e.target === vendorDetailModalOverlay) closeModal(vendorDetailModalOverlay);
        });
        document.getElementById('edit-vendor-btn').addEventListener('click', showEditMode);
        document.getElementById('cancel-edit-btn').addEventListener('click', showViewMode);
        
        document.getElementById('edit-vendor-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target;
            const updatedData = {
                vendor_name: form.querySelector('#edit-vendor-name').value,
                category: form.querySelector('#edit-vendor-category').value,
                contact_name: form.querySelector('#edit-vendor-contact-name').value,
                phone: form.querySelector('#edit-vendor-phone').value,
                email: form.querySelector('#edit-vendor-email').value,
                website: form.querySelector('#edit-vendor-website').value,
                quote: parseFloat(form.querySelector('#edit-vendor-quote').value) || null,
                notes: form.querySelector('#edit-vendor-notes').value,
                status: form.querySelector('#edit-vendor-status').value,
            };
            const vendorId = form.querySelector('#edit-vendor-id').value;
            const { error } = await supabase.from('vendors').update(updatedData).eq('id', vendorId);
            if (!error) {
                closeModal(vendorDetailModalOverlay);
                await fetchDataAndRender();
            } else { console.error(error); }
        });
    };

    // --- Start the application ---
    init();
});