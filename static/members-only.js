document.addEventListener('DOMContentLoaded', () => {
    // --- Global Variables & State ---
    const API_BASE_URL = '/api';
    let tasksCache = [];
    let guestsCache = [];
    let fullGuestListCache = []; // NEW: Cache for the detailed guest list
    let guestListState = { 
        view: 'individual',
        guestOf: [],
        relationType: [],
        filterByRehearsal: false,
        filterByBridal: false,
        status: 'all',
        meal: 'all',
        table: 'all',
        searchQuery: '',
        sortBy: 'party',
        sortOrder: 'asc'
    };
    const allAssignees = ['Emma', 'Ethan', 'Alita', 'Amy', 'Carlos', 'Carrie', 'David', 'Emily', 'Isabel', 'Jacob', 'Jesus', 'Jody', 'Memes', 'Mia', 'Olivia', 'Paps', 'Robert', 'Zack'];
    const guestAddressAssignees = ['Emma and Ethan', 'Emily', 'Carlos', 'Amy'];
    let selectedTaskAssignees = [];
    let draggedItem = null;
    let isGuestListLoading = true;
    let calendarEventsCache = [];
    let calendar = null;

    // --- Element Selectors ---
    const panel = document.getElementById('sidePanel');
    const panelTitle = document.getElementById('panelTitle');
    const panelBody = document.getElementById('panelBody');
    const panelOverlay = document.querySelector('.panel-overlay');
    const closePanelBtn = document.getElementById('closePanelBtn');
    const addTaskButton = document.getElementById('addTaskButton');
    const guestList = document.getElementById('guestList');
    const columns = document.querySelectorAll('.kanban-column');
    const assigneeFilter = document.getElementById('assigneeFilter');
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const guestSearchInput = document.getElementById('guestSearchInput');
    const guestListSearchInput = document.getElementById('guestListSearchInput');
    const openCalendarModalBtn = document.getElementById('openCalendarModalBtn');
    const calendarModal = document.getElementById('calendarModal');
    const calendarModalOverlay = document.getElementById('calendarModalOverlay');
    const calendarModalCloseBtn = document.getElementById('calendarModalCloseBtn');

    // -- Selectors for the GUEST ADDRESS TAB filter --
    const guestFilterBtn = document.getElementById('guestFilterBtn');
    const guestFilterPopover = document.getElementById('guestFilterPopover');
    const guestFilterAssignee = document.getElementById('guestFilterAssignee');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    const applyFiltersBtn = document.getElementById('applyFiltersBtn');

    // -- Selectors for the GUEST LIST MODAL --
    const openGuestListModalBtn = document.getElementById('openGuestListModalBtn');
    const guestListModal = document.getElementById('guestListModal');
    const guestListModalOverlay = document.getElementById('guestListModalOverlay');
    const guestListModalCloseBtn = document.getElementById('guestListModalCloseBtn');
    const guestListContainer = document.getElementById('guestListContainer');
    const viewSwitcherBtns = document.querySelectorAll('.view-btn');
    const exportBtn = document.getElementById('exportBtn');
    const exportOptions = document.getElementById('exportOptions');

    // -- Selectors for the GUEST LIST MODAL filter --
    const guestListModalFilterBtn = document.getElementById('guestListModalFilterBtn');
    const guestListModalFilterPopover = document.getElementById('guestListFilterPopover');
    const guestListModalApplyFiltersBtn = document.getElementById('guestListApplyFiltersBtn');
    const guestListModalClearFiltersBtn = document.getElementById('guestListClearFiltersBtn');


    // --- A robust fetch function with retry logic ---
    async function fetchWithRetry(url, options = {}, retries = 3, backoff = 500) {
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url, options);
                if (!response.ok) {
                    if (response.status >= 500 && i < retries - 1) {
                        console.warn(`Server error ${response.status}. Retrying in ${backoff / 1000}s...`);
                        await new Promise(res => setTimeout(res, backoff));
                        backoff *= 2; // Exponential backoff
                        continue;
                    }
                    const errorData = await response.json().catch(() => ({ message: "Unknown server error" }));
                    throw new Error(`Server responded with ${response.status}: ${errorData.error || errorData.message}`);
                }
                return response.json();
            } catch (error) {
                if (i < retries - 1) {
                    console.warn(`Network error. Retrying in ${backoff / 1000}s...`);
                    await new Promise(res => setTimeout(res, backoff));
                    backoff *= 2;
                } else {
                    throw error;
                }
            }
        }
    }

    // --- Initial Load ---
    async function initialize() {
        setupTabNavigation();
        populateGuestFilter();
        setupEventListeners();
        await fetchAndRenderTasks();
        await fetchAndRenderGuests();
        await fetchAndRenderFullGuestList();
        await fetchAndRenderCalendar();
    }

    // --- Tab Navigation Logic ---
    function setupTabNavigation() {
        tabLinks.forEach(link => {
            link.addEventListener('click', () => {
                const tabId = link.dataset.tab;
                tabLinks.forEach(innerLink => innerLink.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                link.classList.add('active');
                document.getElementById(tabId).classList.add('active');
            });
        });
    }

    // Replace this entire function
    function setupEventListeners() {
        // --- GUEST LIST MODAL SEARCH ---
        guestListSearchInput.addEventListener('input', () => {
            guestListState.searchQuery = guestListSearchInput.value.toLowerCase();
            renderGuestListModal();
        });

        window.addEventListener('resize', () => {
            // Check if the modal is currently open before re-rendering
            if (guestListModal.classList.contains('is-visible')) {
                renderGuestListModal();
            }
        });

        openGuestListModalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openGuestListModal();
        });

        // --- MODAL MAIN BUTTONS ---
        function openGuestListModal() {
            renderGuestListModal();
            guestListModal.classList.add('is-visible');
            guestListModalOverlay.classList.add('is-visible');
        
            // This listener handles clicks on the sortable table headers
            guestListContainer.addEventListener('click', (e) => {
                const header = e.target.closest('th[data-sort]');
                if (header) {
                    const sortKey = header.dataset.sort;
                    if (guestListState.sortBy === sortKey) {
                        guestListState.sortOrder = guestListState.sortOrder === 'asc' ? 'desc' : 'asc';
                    } else {
                        guestListState.sortBy = sortKey;
                        guestListState.sortOrder = 'asc';
                    }
                    renderGuestListModal(); // Re-render with new sort settings
                }
            });
        }

        guestListModalCloseBtn.addEventListener('click', closeGuestListModal);
        guestListModalOverlay.addEventListener('click', closeGuestListModal);

        openCalendarModalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openCalendarModal();
        });
        calendarModalCloseBtn.addEventListener('click', closeCalendarModal);
        calendarModalOverlay.addEventListener('click', closeCalendarModal);

        // --- EXPORT DROPDOWN LOGIC ---
        exportBtn.addEventListener('click', () => {
            const filteredCount = getFilteredGuests().length;
            const masterCount = fullGuestListCache.length;
            const areFiltersActive = filteredCount !== masterCount;
            const pdfFiltered = document.getElementById('exportPdfFiltered');
            const pdfMaster = document.getElementById('exportPdfMaster');
            const xlsxFiltered = document.getElementById('exportXlsxFiltered');
            const xlsxMaster = document.getElementById('exportXlsxMaster');
            pdfFiltered.textContent = `PDF (Filtered - ${filteredCount} Guests)`;
            xlsxFiltered.textContent = `Excel (Filtered - ${filteredCount} Guests)`;
            pdfMaster.textContent = `PDF (Master List - ${masterCount} Guests)`;
            xlsxMaster.textContent = `Excel (Master List - ${masterCount} Guests)`;
            if (areFiltersActive) {
                pdfFiltered.classList.remove('disabled');
                xlsxFiltered.classList.remove('disabled');
            } else {
                pdfFiltered.classList.add('disabled');
                xlsxFiltered.classList.add('disabled');
            }
            exportOptions.classList.toggle('visible');
        });
        document.getElementById('exportPdfFiltered').addEventListener('click', (e) => {
            if (e.target.classList.contains('disabled')) return;
            exportToPDF(false);
            exportOptions.classList.remove('visible');
        });
        document.getElementById('exportPdfMaster').addEventListener('click', () => {
            exportToPDF(true);
            exportOptions.classList.remove('visible');
        });
        document.getElementById('exportXlsxFiltered').addEventListener('click', (e) => {
            if (e.target.classList.contains('disabled')) return;
            exportToXLSX(false);
            exportOptions.classList.remove('visible');
        });
        document.getElementById('exportXlsxMaster').addEventListener('click', () => {
            exportToXLSX(true);
            exportOptions.classList.remove('visible');
        });
        document.addEventListener('click', (e) => {
            if (exportBtn && !exportBtn.contains(e.target) && exportOptions && !exportOptions.contains(e.target)) {
                exportOptions.classList.remove('visible');
            }
        });

        // --- GUEST LIST MODAL FILTER POPOVER LISTENERS ---
        guestListModalFilterBtn.addEventListener('click', toggleGuestListFilterPopover);
        guestListModalApplyFiltersBtn.addEventListener('click', () => {
            const guestOfFilters = [];
            if (document.getElementById('guestOfEmma').checked) guestOfFilters.push('Emma');
            if (document.getElementById('guestOfEthan').checked) guestOfFilters.push('Ethan');
            if (document.getElementById('guestOfBoth').checked) guestOfFilters.push('Both');
            guestListState.guestOf = guestOfFilters;
            const relationTypeFilters = [];
            if (document.getElementById('relationFamily').checked) relationTypeFilters.push('Family');
            if (document.getElementById('relationFriend').checked) relationTypeFilters.push('Friend');
            guestListState.relationType = relationTypeFilters;
            guestListState.filterByRehearsal = document.getElementById('filterRehearsal').checked;
            guestListState.filterByBridal = document.getElementById('filterBridal').checked;
            guestListState.status = document.querySelector('input[name="rsvpStatus"]:checked').value;
            guestListState.meal = document.getElementById('filterMeal').value;
            guestListState.table = document.getElementById('filterTable').value;
            renderGuestListModal();
            toggleGuestListFilterPopover();
        });
        guestListModalClearFiltersBtn.addEventListener('click', () => {
            document.getElementById('guestOfEmma').checked = false;
            document.getElementById('guestOfEthan').checked = false;
            document.getElementById('guestOfBoth').checked = false;
            document.getElementById('relationFamily').checked = false;
            document.getElementById('relationFriend').checked = false;
            document.getElementById('filterRehearsal').checked = false;
            document.getElementById('filterBridal').checked = false;
            document.getElementById('rsvpAll').checked = true;
            document.getElementById('filterMeal').value = 'all';
            document.getElementById('filterTable').value = 'all';
            Object.assign(guestListState, {
                guestOf: [], relationType: [], filterByRehearsal: false,
                filterByBridal: false, status: 'all', meal: 'all', table: 'all'
            });
            renderGuestListModal();
            toggleGuestListFilterPopover();
        });

        // --- VIEW SWITCHER (INSIDE MODAL) ---
        viewSwitcherBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                guestListState.view = btn.dataset.view;
                viewSwitcherBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderGuestListModal();
            });
        });

        // --- TASK BOARD LISTENERS ---
        addTaskButton.addEventListener('click', () => openTaskPanel());
        assigneeFilter.addEventListener('change', applyTaskFilter);

        // --- SIDE PANEL LISTENERS ---
        closePanelBtn.addEventListener('click', closePanel);
        panelOverlay.addEventListener('click', closePanel);

        // --- GUEST ADDRESS TAB LISTENERS ---
        guestFilterBtn.addEventListener('click', toggleFilterPopover);
        applyFiltersBtn.addEventListener('click', () => {
            renderGuestsFromCache();
            toggleFilterPopover();
        });
        clearFiltersBtn.addEventListener('click', () => {
            guestFilterAssignee.value = 'all';
            document.getElementById('statusAll').checked = true;
            guestSearchInput.value = '';
            renderGuestsFromCache();
            toggleFilterPopover();
        });
        guestSearchInput.addEventListener('input', renderGuestsFromCache);

        // --- LIST ITEM CLICK LISTENERS ---
        guestList.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-address-btn');
            if (editBtn) {
                openGuestPanel(guestsCache.find(g => g.id === editBtn.dataset.guestId));
            }
        });
        columns.forEach(column => {
            column.addEventListener('click', (e) => {
                const card = e.target.closest('.kanban-task');
                if (card && !draggedItem) {
                    openTaskPanel(tasksCache.find(t => t.id === card.getAttribute('data-id')));
                }
            });
            column.addEventListener('dragover', (e) => {
                e.preventDefault();
                const afterElement = getDragAfterElement(column, e.clientY);
                if (draggedItem) {
                    if (afterElement == null) column.appendChild(draggedItem);
                    else column.insertBefore(draggedItem, afterElement);
                }
            });
        });
    } 

    // --- Panel Management ---
    function openPanel() {
        panel.classList.add('is-open');
        panelOverlay.classList.add('is-visible');
    }
    function closePanel() {
        panel.classList.remove('is-open');
        panelOverlay.classList.remove('is-visible');
        panelBody.innerHTML = '';
    }

    // --- Task Management ---
    async function fetchAndRenderTasks() {
        try {
            const data = await fetchWithRetry(`${API_BASE_URL}/kanban_tasks`);
            tasksCache = Array.isArray(data) ? data : [];
            renderTasksFromCache();
        } catch (error) { 
            console.error("Error fetching tasks after multiple retries:", error);
            tasksCache = [];
            renderTasksFromCache();
        }
    }

    function renderTasksFromCache() {
        columns.forEach(col => {
            const currentTasks = col.querySelectorAll('.kanban-task');
            currentTasks.forEach(task => task.remove());
        });
        tasksCache.forEach(task => {
            const taskCard = createTaskCard(task);
            let statusId = (task.status || '').toLowerCase();
            if (statusId === 'to do') statusId = 'todo';
            else statusId = statusId.replace(' ', '-');
            const targetColumn = document.getElementById(`column-${statusId}`) || document.getElementById('column-todo');
            if (targetColumn) targetColumn.appendChild(taskCard);
        });
        applyTaskFilter();
    }

    function createTaskCard(task) {
        const card = document.createElement('div');
        card.className = 'kanban-task';
        card.setAttribute('draggable', 'true');
        card.setAttribute('data-id', task.id);
        card.setAttribute('data-assignee', task.assignee || 'unassigned');
        
        const assignees = (task.assignee || 'Unassigned').split(', ');
        const assigneeTags = assignees.map(name => `<span class="task-tag assignee">${name.trim()}</span>`).join('');
        const categoryTag = task.category ? `<span class="task-tag category">${task.category}</span>` : '';

        let dueDateHtml = 'N/A';
        if (task.dueDate) {
            const date = new Date(task.dueDate + 'T00:00:00');
            if (!isNaN(date)) {
                dueDateHtml = date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                });
            } else {
                dueDateHtml = task.dueDate;
            }
        }

        card.innerHTML = `
            <p>${task.description || 'No Description'}</p>
            <div class="task-tags">${assigneeTags} ${categoryTag}</div>
            <small><strong>Due:</strong> ${dueDateHtml}</small>
        `;
        addDragAndDropListeners(card);
        return card;
    }

    function openTaskPanel(task = null) {
        panelTitle.innerHTML = `<span class="panel-title-name">${task ? 'Edit Task' : 'Add a New Task'}</span>`;
        panelBody.innerHTML = getTaskFormHTML(task);
        document.getElementById('taskForm').addEventListener('submit', handleTaskFormSubmit);
        if (task) {
            document.getElementById('deleteTaskBtn').addEventListener('click', () => handleDeleteTask(task.id));
        }
        initializeAssigneeInput(task ? task.assignee : '');
        openPanel();
    }

    async function handleTaskFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const taskId = form.querySelector('#taskID').value;
        const isUpdating = !!taskId;
        const taskData = {
            id: taskId,
            description: form.querySelector('#taskDescription').value,
            assignee: selectedTaskAssignees.join(', ') || 'Unassigned',
            category: form.querySelector('#taskCategory').value,
            dueDate: form.querySelector('#taskDueDate').value,
            relatedVendors: form.querySelector('#taskVendors').value,
            comments: form.querySelector('#taskComments').value
        };
        const url = isUpdating ? `${API_BASE_URL}/kanban_tasks/update` : `${API_BASE_URL}/kanban_tasks/add`;
        const method = isUpdating ? 'PUT' : 'POST';
        try {
            await fetchWithRetry(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData)
            });
            closePanel();
            fetchAndRenderTasks();
        } catch (error) { console.error("Error saving task:", error); }
    }
    
    async function handleDeleteTask(taskId) {
        if (!taskId || !confirm('Are you sure you want to delete this task?')) return;
        try {
            await fetchWithRetry(`${API_BASE_URL}/kanban_tasks/delete`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: taskId })
            });
            closePanel();
            fetchAndRenderTasks();
        } catch (error) { console.error("Error deleting task:", error); }
    }

    // --- THIS IS THE MODIFIED FUNCTION ---
    function getTaskFormHTML(task) {
        // Helper function to format date for the input field
        const formatDateForInput = (dateString) => {
            if (!dateString) return '';
            try {
                // Handles dates like "MM/DD/YYYY" or "YYYY-MM-DD"
                const date = new Date(dateString);
                if (isNaN(date)) return ''; // Return empty if date is invalid
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            } catch (e) {
                return ''; // Return empty on error
            }
        };

        const formattedDate = task ? formatDateForInput(task.dueDate) : '';

        return `
            <form id="taskForm" autocomplete="off">
                <input type="hidden" id="taskID" value="${task ? task.id : ''}">
                <div class="form-group">
                    <label for="taskDescription">Task *</label>
                    <input type="text" id="taskDescription" value="${task ? task.description : ''}" required>
                </div>
                <div class="form-group">
                    <label for="taskAssigneeInput">Assignee(s)</label>
                    <div class="assignee-input-container" id="assigneeInputContainer">
                        <input type="text" id="taskAssigneeInput" placeholder="Type to search...">
                    </div>
                    <div class="assignee-suggestions" id="assigneeSuggestions"></div>
                </div>
                <div class="form-group">
                    <label for="taskCategory">Category</label>
                    <input type="text" id="taskCategory" value="${task ? task.category : ''}">
                </div>
                <div class="form-group">
                    <label for="taskDueDate">Due Date</label>
                    <input type="date" id="taskDueDate" value="${formattedDate}">
                </div>
                <div class="form-group">
                    <label for="taskVendors">Related Vendor(s)</label>
                    <input type="text" id="taskVendors" value="${task ? task.relatedVendors : ''}">
                </div>
                <div class="form-group">
                    <label for="taskComments">Comments</label>
                    <textarea id="taskComments" rows="2">${task ? task.comments : ''}</textarea>
                </div>
                <div class="form-actions" id="formActions">
                    ${task ? '<button type="button" id="deleteTaskBtn" class="delete-task-btn">Delete Task</button>' : ''}
                    <button type="submit" class="save-task-btn">${task ? 'Update Task' : 'Save Task'}</button>
                </div>
            </form>
        `;
    }

    // --- Guest Address Management ---
    async function fetchAndRenderGuests() {
        try {
            const data = await fetchWithRetry(`${API_BASE_URL}/guests`);
            guestsCache = Array.isArray(data) ? data : [];
            renderGuestsFromCache();
        } catch (error) { console.error("Error fetching guests after multiple retries:", error); }
    }

    function renderGuestsFromCache() {
        if (!guestList) return;
        guestList.innerHTML = '';
        const selectedAssignee = guestFilterAssignee.value;
        const selectedStatus = document.querySelector('input[name="addressStatus"]:checked').value;
        const searchQuery = guestSearchInput.value.toLowerCase();
        const assigneeFiltered = (selectedAssignee === 'all')
            ? guestsCache
            : guestsCache.filter(g => g.assignedTo === selectedAssignee);
        const statusFiltered = assigneeFiltered.filter(guest => {
            if (selectedStatus === 'all') return true;
            const hasAddress = guest.street && guest.city && guest.state && guest.zip;
            if (selectedStatus === 'pending') return !hasAddress;
            if (selectedStatus === 'complete') return hasAddress;
            return false;
        });
        const finalFilteredGuests = searchQuery
            ? statusFiltered.filter(g => g.partyname.toLowerCase().includes(searchQuery))
            : statusFiltered;

            console.log("Final guests to render:", finalFilteredGuests);

        finalFilteredGuests.sort((a, b) => {
            const aIsPending = !a.street;
            const bIsPending = !b.street;
            if (aIsPending && !bIsPending) return -1;
            if (!aIsPending && bIsPending) return 1;
            return (a.partyname ?? '').localeCompare(b.partyname ?? '');
        });
        if (finalFilteredGuests.length === 0) {
            guestList.innerHTML = '<li><p class="no-guests-message">No guests match your filters.</p></li>';
            return;
        }
        finalFilteredGuests.forEach(guest => {
            const listItem = document.createElement('li');
            listItem.className = 'guest-list-item';
            let addressHtml;
            let buttonText = 'Add Address';
            if (guest.street) {
                addressHtml = `<p>${guest.street}<br>${guest.street2 ? guest.street2 + '<br>' : ''}${guest.city}, ${guest.state} ${guest.zip}</p>`;
                buttonText = 'Edit Address';
            } else {
                addressHtml = `<p>No address has been entered yet.</p>`;
            }
            listItem.innerHTML = `
                <div class="guest-info"><h3>Guest(s)</h3><p>${guest.partyname ?? '-'}</p></div>
                <div class="address-info ${!guest.street ? 'missing' : ''}"><h3>Address</h3>${addressHtml}</div>
                <div class="action-info"><button class="edit-address-btn" data-guest-id="${guest.id}">${buttonText}</button></div>
            `;
            guestList.appendChild(listItem);
        });
    }

    function openGuestPanel(guest) {
        if (!guest) return;
        panelTitle.innerHTML = `<span class="panel-title-label">Address for </span><span class="panel-title-name">${guest.partyname}</span>`;
        panelBody.innerHTML = getGuestFormHTML(guest);
        document.getElementById('guestForm').addEventListener('submit', handleGuestFormSubmit);
        openPanel();
    }

    // JS Code - handleGuestFormSubmit function
async function handleGuestFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const guestId = form.dataset.guestId;
    const originalGuest = guestsCache.find(g => g.id === guestId);
    
    // Create the data object to send to the server
    const guestData = {
        id: guestId,
        street: form.querySelector('#street').value,
        street2: form.querySelector('#street2').value,
        city: form.querySelector('#city').value,
        state: form.querySelector('#state').value,
        zip: form.querySelector('#zip').value,
    };
    
    try {
        await fetchWithRetry(`${API_BASE_URL}/guests/update`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(guestData)
        });
        
        // Find the guest in the cache and update only the relevant fields.
        const guestIndex = guestsCache.findIndex(g => g.id === guestId);
        if (guestIndex !== -1) {
            // Keep the existing partyname and assignedTo, and update the others
            guestsCache[guestIndex].street = guestData.street;
            guestsCache[guestIndex].street2 = guestData.street2;
            guestsCache[guestIndex].city = guestData.city;
            guestsCache[guestIndex].state = guestData.state;
            guestsCache[guestIndex].zip = guestData.zip;
        }

        closePanel();
        renderGuestsFromCache();
    } catch (error) { console.error("Error updating guest:", error); }
}

    function getGuestFormHTML(guest) {
        const states = [ 'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY' ];
        const selectedState = guest.state || 'IL';
        const stateOptions = states.map(state => 
            `<option value="${state}" ${selectedState === state ? 'selected' : ''}>${state}</option>`
        ).join('');
        return `
            <div class="form-info-display">
                <p><strong>Party Name:</strong> ${guest.partyname}</p>
                <p><strong>Assigned To:</strong> ${guest.assignedTo}</p>
            </div>
            <form id="guestForm" data-guest-id="${guest.id}" autocomplete="off">
                <div class="form-group">
                    <label for="street">Street Address</label>
                    <input type="text" id="street" value="${guest.street || ''}">
                </div>
                <div class="form-group">
                    <label for="street2">Street Address 2 (Optional)</label>
                    <input type="text" id="street2" value="${guest.street2 || ''}">
                </div>
                <div class="form-group">
                    <label for="city">City</label>
                    <input type="text" id="city" value="${guest.city || ''}">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="state">State</label>
                        <select id="state">${stateOptions}</select>
                    </div>
                    <div class="form-group">
                        <label for="zip">Zip Code</label>
                        <input type="text" id="zip" value="${guest.zip || ''}" maxlength="5" pattern="[0-9]{5}">
                    </div>
                </div>
                <div class="form-actions">
                    <button type="submit" class="save-task-btn">Save Address</button>
                </div>
            </form>
        `;
    }
    
    function populateGuestFilter() {
        if (!guestFilterAssignee) return;
        guestFilterAssignee.innerHTML = '<option value="all">All Members</option>';
        guestAddressAssignees.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            guestFilterAssignee.appendChild(option);
        });
    }

    function toggleFilterPopover() {
        guestFilterPopover.classList.toggle('visible');
    }

    async function fetchAndRenderFullGuestList() {
        isGuestListLoading = true;
        updateDashboardStats(); // Show the spinner
    
        try {
            const data = await fetchWithRetry(`${API_BASE_URL}/guestlist`);
            fullGuestListCache = Array.isArray(data) ? data : [];
        } catch (error) {
            console.error("Error fetching full guest list:", error);
            fullGuestListCache = [];
        } finally {
            isGuestListLoading = false;
            updateDashboardStats(); // Hide spinner and show data
            populateFilterOptions();
            
            // If the modal is already open, refresh its content with the new data
            if (guestListModal.classList.contains('is-visible')) {
                renderGuestListModal();
            }
        }
    }

    function updateDashboardStats() {
        const rsvpLoader = document.getElementById('rsvpLoader');
        const statElements = document.querySelectorAll('.rsvp-stats .stat');
    
        if (isGuestListLoading) {
            rsvpLoader.style.display = 'flex';
            statElements.forEach(el => el.style.visibility = 'hidden');
        } else {
            rsvpLoader.style.display = 'none';
            statElements.forEach(el => el.style.visibility = 'visible');
    
            const totalInvited = fullGuestListCache.length;
            const totalYes = fullGuestListCache.filter(g => g.rsvp === 'Yes').length;
            const totalNo = fullGuestListCache.filter(g => g.rsvp === 'No').length;
            const totalPending = fullGuestListCache.filter(g => g.rsvp === 'Pending' || !g.rsvp).length;
    
            document.getElementById('totalInvited').textContent = totalInvited;
            document.getElementById('totalYes').textContent = totalYes;
            document.getElementById('totalNo').textContent = totalNo;
            document.getElementById('totalPending').textContent = totalPending;
            document.getElementById('modalAttending').textContent = totalYes;
            document.getElementById('modalPending').textContent = totalPending;
        }
    }

    function renderGuestListModal() {
        // If data is still loading, show a spinner inside the modal
        if (isGuestListLoading) {
            guestListContainer.innerHTML = '<div class="stat-loader" style="position: static; display: flex; background: transparent;"><div class="spinner"></div></div>';
            return;
        }
    
        const filteredGuests = getFilteredGuests();
        guestListContainer.innerHTML = ''; // Clear previous content
    
        if (guestListState.view === 'individual') {
            renderIndividualView(filteredGuests);
        } else {
            renderPartyView(filteredGuests);
        }
    }

    function closeGuestListModal() {
        guestListModal.classList.remove('is-visible');
        guestListModalOverlay.classList.remove('is-visible');
    }

    function toggleGuestListFilterPopover() {
        guestListModalFilterPopover.classList.toggle('visible');
    }
    
    function populateFilterOptions() {
        const mealFilter = document.getElementById('filterMeal');
        const tableFilter = document.getElementById('filterTable');
    
        const uniqueMeals = [...new Set(fullGuestListCache.map(g => g.dietaryrequest).filter(Boolean))];
        const uniqueTables = [...new Set(fullGuestListCache.map(g => g.tablenumber).filter(Boolean))].sort((a,b) => a - b);
    
        uniqueMeals.forEach(meal => {
            mealFilter.innerHTML += `<option value="${meal}">${meal}</option>`;
        });
        uniqueTables.forEach(table => {
            tableFilter.innerHTML += `<option value="${table}">${table}</option>`;
        });
    }

    // Replace this entire function
    function getFilteredGuests() {
        let filtered = [...fullGuestListCache];
    
        // Checkboxes for "Guest Of"
        if (guestListState.guestOf.length > 0) {
            filtered = filtered.filter(g => guestListState.guestOf.includes(g.guestOf));
        }
    
        // Checkboxes for "Relation"
        if (guestListState.relationType.length > 0) {
            filtered = filtered.filter(g => guestListState.relationType.includes(g.relation));
        }
    
        // Checkboxes for Events
        if (guestListState.filterByRehearsal) {
            filtered = filtered.filter(g => String(g.rehearsalDinner).toLowerCase() === 'true');
        }
        if (guestListState.filterByBridal) {
            filtered = filtered.filter(g => String(g.bridalShower).toLowerCase() === 'true');
        }
    
        // Other dropdown/radio filters
        if (guestListState.status !== 'all') {
            filtered = filtered.filter(g => (g.rsvp || 'Pending') === guestListState.status);
        }
        if (guestListState.meal !== 'all') {
            filtered = filtered.filter(g => g.dietaryrequest === guestListState.meal);
        }
        if (guestListState.table !== 'all') {
            filtered = filtered.filter(g => g.tablenumber === guestListState.table);
        }
    
        // --- NEW: Search Query Filter (applied last) ---
        if (guestListState.searchQuery) {
            filtered = filtered.filter(g => 
                g.name.toLowerCase().includes(guestListState.searchQuery)
            );
        }
    
        return filtered;
    } 
    
    function renderIndividualView(guests) {
        // Check if the user is on a mobile device based on your breakpoint
        const isMobile = window.innerWidth <= 768; 
    
        // Sorting logic (no changes needed)
        const { sortBy, sortOrder } = guestListState;
        const rsvpOrder = { 'Yes': 1, 'Pending': 2, 'No': 3 };
    
        guests.sort((a, b) => {
            let valA, valB;
            switch (sortBy) {
                case 'rsvp':
                    valA = rsvpOrder[a.rsvp] || 4;
                    valB = rsvpOrder[b.rsvp] || 4;
                    return valA - valB;
                case 'tablenumber':
                    valA = parseInt(a.tablenumber, 10) || 999;
                    valB = parseInt(b.tablenumber, 10) || 999;
                    return valA - valB;
                default: // Handles name, meal, and the new party column
                    valA = a[sortBy] || '';
                    valB = b[sortBy] || '';
                    return valA.localeCompare(valB);
            }
        });
    
        if (sortOrder === 'desc') {
            guests.reverse();
        }
    
        let tableHTML = `
            <table class="guest-table">
                <thead>
                    <tr>
                        <th data-sort="name" class="${sortBy === 'name' ? 'sort-active' : ''}">Name
                            ${sortBy === 'name' ? (sortOrder === 'asc' ? '<i class="bi bi-sort-up"></i>' : '<i class="bi bi-sort-down"></i>') : '<i class="bi bi-arrow-down-up"></i>'}
                        </th>
                        ${!isMobile ? `<th data-sort="party" class="${sortBy === 'party' ? 'sort-active' : ''}">Party
                            ${sortBy === 'party' ? (sortOrder === 'asc' ? '<i class="bi bi-sort-up"></i>' : '<i class="bi bi-sort-down"></i>') : '<i class="bi bi-arrow-down-up"></i>'}
                        </th>` : ''}
                        <th data-sort="rsvp" class="${sortBy === 'rsvp' ? 'sort-active' : ''}">RSVP Status
                            ${sortBy === 'rsvp' ? (sortOrder === 'asc' ? '<i class="bi bi-sort-up"></i>' : '<i class="bi bi-sort-down"></i>') : '<i class="bi bi-arrow-down-up"></i>'}
                        </th>
                        <th data-sort="dietaryrequest" class="${sortBy === 'dietaryrequest' ? 'sort-active' : ''}">Meal
                            ${sortBy === 'dietaryrequest' ? (sortOrder === 'asc' ? '<i class="bi bi-sort-up"></i>' : '<i class="bi bi-sort-down"></i>') : '<i class="bi bi-arrow-down-up"></i>'}
                        </th>
                        <th data-sort="tablenumber" class="${sortBy === 'tablenumber' ? 'sort-active' : ''}">Table
                            ${sortBy === 'tablenumber' ? (sortOrder === 'asc' ? '<i class="bi bi-sort-up"></i>' : '<i class="bi bi-sort-down"></i>') : '<i class="bi bi-arrow-down-up"></i>'}
                        </th>
                    </tr>
                </thead>
                <tbody>
        `;
    
        if (guests.length === 0) {
            tableHTML += `<tr><td colspan="${isMobile ? 3 : 5}" style="text-align:center; padding: 2rem;">No guests match the current filters.</td></tr>`;
        } else {
            guests.forEach(guest => {
                const rsvp = guest.rsvp || 'Pending';
                const rsvpClass = rsvp.toLowerCase();
                const rsvpIcon = {
                    'Yes': '<i class="bi bi-check-circle-fill"></i>',
                    'No': '<i class="bi bi-x-circle-fill"></i>',
                    'Pending': '<i class="bi bi-question-circle-fill"></i>'
                }[rsvp];
                
                if (isMobile) {
                    // Mobile-specific row layout
                    tableHTML += `
                        <tr>
                            <td>
                                <div class="guest-name-mobile-container">
                                    <div class="name-and-status">
                                        <span>${guest.name || 'N/A'}</span>
                                        <span class="rsvp-status ${rsvpClass}">${rsvpIcon} <span class="status-text">${rsvp}</span></span>
                                    </div>
                                    <div class="party-name-mobile">${guest.party || '-'}</div>
                                </div>
                            </td>
                            <td class="meal-column">${guest.dietaryrequest || '-'}</td>
                            <td class="table-column">${guest.tablenumber || '-'}</td>
                        </tr>
                    `;
                } else {
                    // Desktop-specific row layout
                    tableHTML += `
                        <tr>
                            <td>${guest.name || 'N/A'}</td>
                            <td>${guest.party || '-'}</td>
                            <td><span class="rsvp-status ${rsvpClass}">${rsvpIcon} ${rsvp}</span></td>
                            <td>${guest.dietaryrequest || '-'}</td>
                            <td>${guest.tablenumber || '-'}</td>
                        </tr>
                    `;
                }
            });
        }
    
        tableHTML += '</tbody></table>';
        guestListContainer.innerHTML = tableHTML;
    }
    
    // Replace this entire function
    function renderPartyView(guests) {
        if (guests.length === 0) {
            guestListContainer.innerHTML = '<p style="text-align:center; padding: 2rem;">No guests match the current filters.</p>';
            return;
        }
    
        const guestsByParty = guests.reduce((acc, guest) => {
            const partyname = guest.party || 'Unassigned';
            if (!acc[partyname]) {
                acc[partyname] = [];
            }
            acc[partyname].push(guest);
            return acc;
        }, {});
    
        let partyHTML = '';
        for (const partyname in guestsByParty) {
            const partyMembers = guestsByParty[partyname];
            const attendingCount = partyMembers.filter(p => p.rsvp === 'Yes').length;
    
            partyHTML += `
                <div class="party-group">
                    <div class="party-header">
                        <span class="party-name">${partyname}</span>
                        <span class="party-rsvp-summary">${attendingCount} / ${partyMembers.length} Attending</span>
                    </div>
                    <ul class="party-guest-list">
                        <li class="party-guest-subheader">
                            <span>Name</span>
                            <span>RSVP Status</span>
                            <span>Meal</span>
                            <span>Table</span>
                        </li>
            `;
            partyMembers.forEach(member => {
                // --- DELETED: The 'isPrimary' variable calculation has been removed. ---
                
                const rsvp = member.rsvp || 'Pending';
                const rsvpClass = rsvp.toLowerCase();
                const rsvpIcon = {
                    'Yes': '<i class="bi bi-check-circle-fill"></i>',
                    'No': '<i class="bi bi-x-circle-fill"></i>',
                    'Pending': '<i class="bi bi-question-circle-fill"></i>'
                }[rsvp];
    
                partyHTML += `
                    <li class="party-guest-item">
                        <span class="party-guest-name">${member.name}</span>
                        <span class="rsvp-status ${rsvpClass}">${rsvpIcon} ${rsvp}</span>
                        <span>${member.dietaryrequest || '-'}</span>
                        <span>${member.tablenumber || '-'}</span>
                    </li>
                `;
            });
            partyHTML += '</ul></div>';
        }
        guestListContainer.innerHTML = partyHTML;
    }
    
    function exportToXLSX(useMasterList = false) {
        const guestsToExport = useMasterList ? fullGuestListCache : getFilteredGuests();
        const dataForSheet = guestsToExport.map(g => ({
            Name: g.name,
            Party: g.party,
            RSVP: g.rsvp,
            Meal: g.dietaryrequest,
            Table: g.tablenumber,
            Relation: g.relation,
            'Guest Of': g.guestOf,
            'Rehearsal Dinner': String(g.rehearsalDinner).toLowerCase() === 'true' ? 'Yes' : 'No',
            'Bridal Shower': String(g.bridalShower).toLowerCase() === 'true' ? 'Yes' : 'No'
        }));
        
        const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "GuestList");
        XLSX.writeFile(workbook, "EmmaAndEthan_GuestList.xlsx");
    }

    // Replace this entire function
    // Replace this entire function
    function exportToPDF(useMasterList = false) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const guestsToExport = useMasterList ? fullGuestListCache : getFilteredGuests();

        const tableColumn = ["NAME", "PARTY", "RSVP", "MEAL", "TABLE"];
        const tableRows = [];

        guestsToExport.forEach(guest => {
            const guestData = [
                guest.name,
                guest.party,
                guest.rsvp || 'Pending',
                guest.dietaryrequest || '-',
                guest.tablenumber || '-'
            ];
            tableRows.push(guestData);
        });

        const leftMargin = 15;
        doc.setFont('times', 'normal');
        doc.setFontSize(22);
        doc.text('Wedding Guest List', leftMargin, 35);
        
        doc.setFontSize(14);
        doc.text(useMasterList ? 'Master list' : 'Filtered list', leftMargin, 43);


        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 55,
            margin: { top: 35, bottom: 20 },
            
            didDrawPage: function (data) {
                // --- HEADER ---
                doc.setFillColor(108, 115, 76);
                doc.rect(0, 0, doc.internal.pageSize.getWidth(), 8, 'F');
                const today = new Date();
                const dateStr = today.toLocaleDateString('en-US', { 
                    year: 'numeric', month: 'long', day: 'numeric' 
                }).toUpperCase();
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(0, 0, 0);
                doc.text(dateStr, data.settings.margin.left, 20, { charSpace: 1 });

                // MODIFIED: Monogram size changed to 0.25x0.25 inches (18x18 points)
                doc.addImage('monogram.jpg', 'JPG', doc.internal.pageSize.getWidth() - data.settings.margin.right - 6, 15, 7, 7);

                // --- FOOTER ---
                const pageHeight = doc.internal.pageSize.getHeight();
                const pageWidth = doc.internal.pageSize.getWidth();
                
                // MODIFIED: Logotype size changed to 2.11x0.27 inches (151.92x19.44 points)
                doc.addImage('logotype.jpg', 'JPG', data.settings.margin.left, pageHeight - 15, 49, 6.23);
                
                const footerTitle = "GUEST LIST";
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(0, 0, 0);
                doc.text(footerTitle, pageWidth / 2, pageHeight - 10, { 
                    charSpace: 1, 
                    align: 'center' 
                });

                const pageNumStr = String(data.pageNumber);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.text(pageNumStr, pageWidth - data.settings.margin.right, pageHeight - 10, { align: 'right' });
            },
            
            theme: 'plain',
            styles: { font: 'times', fontSize: 9 },
            headStyles: { font: 'helvetica', fontStyle: 'normal', textColor: [0, 0, 0], fontSize: 8 },
            bodyStyles: { cellPadding: { top: 3, bottom: 3 } },
            didDrawCell: function(data) {
                if (data.section === 'body') {
                    doc.setDrawColor(220, 220, 220);
                    doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
                }
            }
        });

        const fileName = `EmmaAndEthan_GuestList_${useMasterList ? 'Master' : 'Filtered'}.pdf`;
        doc.save(fileName);
    }
    
    // --- Assignee Input & Drag/Drop & Filter Logic (Helper functions) ---
    function initializeAssigneeInput(initialValue) {
        const input = document.getElementById('taskAssigneeInput');
        const container = document.getElementById('assigneeInputContainer');
        const suggestions = document.getElementById('assigneeSuggestions');
        selectedTaskAssignees = (initialValue || '').split(', ').filter(Boolean);
        renderSelectedAssignees();
        input.addEventListener('input', () => {
            const query = input.value.toLowerCase();
            if (!query) { suggestions.innerHTML = ''; return; }
            const filtered = allAssignees.filter(a => !selectedTaskAssignees.includes(a) && a.toLowerCase().includes(query));
            renderSuggestions(filtered);
        });
        container.addEventListener('click', () => input.focus());
    }
    function renderSuggestions(suggestions) {
        const suggestionsPanel = document.getElementById('assigneeSuggestions');
        if (!suggestions.length) { suggestionsPanel.innerHTML = ''; return; }
        const ul = document.createElement('ul');
        suggestions.forEach(name => {
            const li = document.createElement('li');
            li.textContent = name;
            li.addEventListener('click', () => selectAssignee(name));
            ul.appendChild(li);
        });
        suggestionsPanel.innerHTML = '';
        suggestionsPanel.appendChild(ul);
    }
    function selectAssignee(name) {
        selectedTaskAssignees.push(name);
        renderSelectedAssignees();
        document.getElementById('taskAssigneeInput').value = '';
        document.getElementById('assigneeSuggestions').innerHTML = '';
    }
    function renderSelectedAssignees() {
        const container = document.getElementById('assigneeInputContainer');
        const input = document.getElementById('taskAssigneeInput');
        container.querySelectorAll('.selected-assignee-tag').forEach(tag => tag.remove());
        selectedTaskAssignees.forEach(name => {
            const tag = document.createElement('span');
            tag.className = 'selected-assignee-tag';
            tag.textContent = name;
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-tag-btn';
            removeBtn.innerHTML = '&times;';
            removeBtn.addEventListener('click', () => removeAssignee(name));
            tag.appendChild(removeBtn);
            container.insertBefore(tag, input);
        });
    }
    function removeAssignee(name) {
        selectedTaskAssignees = selectedTaskAssignees.filter(a => a !== name);
        renderSelectedAssignees();
    }
    function addDragAndDropListeners(task) {
        task.addEventListener('dragstart', () => {
            draggedItem = task;
            setTimeout(() => task.style.opacity = '0.5', 0);
        });
        task.addEventListener('dragend', async () => {
            if (!draggedItem) return;
            draggedItem.style.opacity = '1';
            const taskId = draggedItem.getAttribute('data-id');
            const newColumn = draggedItem.closest('.kanban-column');
            let newStatus;
            if (newColumn.id === 'column-todo') newStatus = 'To Do';
            else if (newColumn.id === 'column-in-progress') newStatus = 'In Progress';
            else if (newColumn.id === 'column-done') newStatus = 'Done';
            
            const taskInCache = tasksCache.find(t => t.id === taskId);
            if (taskInCache) taskInCache.status = newStatus;

            try {
                await fetchWithRetry(`${API_BASE_URL}/kanban_tasks/update_status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: taskId, status: newStatus })
                });
            } catch (error) {
                console.error("Error updating task status:", error);
                fetchAndRenderTasks();
            }
            draggedItem = null;
        });
    }
    function getDragAfterElement(column, y) {
        const draggableElements = [...column.querySelectorAll('.kanban-task:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
            else return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
    function applyTaskFilter() {
        const selectedAssignee = assigneeFilter.value;
        document.querySelectorAll('.kanban-task').forEach(task => {
            const taskAssignees = task.getAttribute('data-assignee').split(', ');
            if (selectedAssignee === 'all' || taskAssignees.includes(selectedAssignee)) {
                task.style.display = 'flex';
            } else {
                task.style.display = 'none';
            }
        });
    }

    async function fetchAndRenderCalendar() {
        try {
            const data = await fetchWithRetry(`${API_BASE_URL}/calendar_events`);
            calendarEventsCache = Array.isArray(data) ? data : [];
            // The calendar will be initialized when the modal is first opened
        } catch (error) {
            console.error("Error fetching calendar events:", error);
        }
    }

    function initializeCalendar() {
        const calendarEl = document.getElementById('calendarContainer');
        calendar = new FullCalendar.Calendar(calendarEl, {
            // MODIFIED: The 'left' and 'right' properties have been swapped
            headerToolbar: {
                left: 'dayGridMonth,listYear',
                center: 'title',
                right: 'prev,next today'
            },
            initialView: 'dayGridMonth',
            events: calendarEventsCache,
            
            views: {
                listYear: {
                    listDayFormat: { month: 'long', day: 'numeric', year: 'numeric' },
                    listHeaderFormat: { month: 'long', year: 'numeric' }
                }
            },
            
            eventClick: function(info) {
                let details = `Description: ${info.event.extendedProps.description || 'N/A'}\n`;
                details += `Location: ${info.event.extendedProps.locationName || 'TBD'}`;
                alert(`${info.event.title}\n\n${details}`);
            }
        });
        calendar.render();
    }
    function openCalendarModal() {
        calendarModal.classList.add('is-visible');
        calendarModalOverlay.classList.add('is-visible');
        // Initialize the calendar only the first time the modal is opened
        if (!calendar) {
            initializeCalendar();
        }
    }
    
    function closeCalendarModal() {
        calendarModal.classList.remove('is-visible');
        calendarModalOverlay.classList.remove('is-visible');
    }

    // --- Initial Load ---
    initialize();
});
