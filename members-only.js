// members-only.js

document.addEventListener('DOMContentLoaded', () => {

    // --- Kanban Board Drag and Drop Functionality ---
    const columns = document.querySelectorAll('.kanban-column');
    let draggedItem = null;

    // Add event listeners to existing tasks (and newly created ones)
    function addDragAndDropListeners(task) {
        task.addEventListener('dragstart', (e) => {
            draggedItem = task;
            setTimeout(() => {
                task.style.opacity = '0.5'; // Hide the original item
            }, 0);
        });

        task.addEventListener('dragend', () => {
            draggedItem.style.opacity = '1'; // Show the item again
            draggedItem = null;
        });
    }

    // Initialize drag and drop for all existing tasks
    document.querySelectorAll('.kanban-task').forEach(addDragAndDropListeners);

    columns.forEach(column => {
        column.addEventListener('dragover', (e) => {
            e.preventDefault(); // Allow drop
            const afterElement = getDragAfterElement(column, e.clientY);
            const draggable = document.querySelector('.kanban-task.dragging'); // Get the item being dragged
            if (afterElement == null) {
                column.appendChild(draggedItem); // Append to the end if no specific element
            } else {
                column.insertBefore(draggedItem, afterElement); // Insert before the found element
            }
            column.classList.add('drag-over');
        });

        column.addEventListener('dragleave', () => {
            column.classList.remove('drag-over');
        });

        column.addEventListener('drop', (e) => {
            e.preventDefault();
            column.classList.remove('drag-over');
            if (draggedItem) {
                // The element has already been moved in dragover,
                // so we just need to finalize its state (opacity, etc.)
                draggedItem.style.opacity = '1';
                draggedItem = null;
            }
        });
    });

    // Helper function to determine where to drop the element
    function getDragAfterElement(column, y) {
        const draggableElements = [...column.querySelectorAll('.kanban-task:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }


    // --- Add New Task Functionality ---
    const newTaskInput = document.getElementById('newTaskInput');
    const addTaskButton = document.getElementById('addTaskButton');
    const todoColumn = document.getElementById('column-todo');

    addTaskButton.addEventListener('click', () => {
        addNewTask();
    });

    newTaskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addNewTask();
        }
    });

    function addNewTask() {
        const taskText = newTaskInput.value.trim();
        if (taskText === '') {
            return; // Don't add empty tasks
        }

        const newTaskDiv = document.createElement('div');
        newTaskDiv.classList.add('kanban-task');
        newTaskDiv.setAttribute('draggable', 'true');
        newTaskDiv.setAttribute('data-assignee', 'unassigned'); // Default to unassigned

        newTaskDiv.innerHTML = `
            <p>${taskText}</p>
            <span class="task-assignee">Unassigned</span>
        `;
        
        todoColumn.appendChild(newTaskDiv);
        addDragAndDropListeners(newTaskDiv); // Add drag-and-drop to the new task

        newTaskInput.value = ''; // Clear input
        applyFilter(); // Re-apply filter in case "unassigned" is selected
    }

    // --- Filter by Assignee Functionality ---
    const assigneeFilter = document.getElementById('assigneeFilter');

    assigneeFilter.addEventListener('change', () => {
        applyFilter();
    });

    function applyFilter() {
        const selectedAssignee = assigneeFilter.value;
        const tasks = document.querySelectorAll('.kanban-task');

        tasks.forEach(task => {
            const taskAssignee = task.getAttribute('data-assignee');
            if (selectedAssignee === 'all' || taskAssignee === selectedAssignee) {
                task.style.display = 'flex'; // Show the task
            } else {
                task.style.display = 'none'; // Hide the task
            }
        });
    }

    // Apply filter on initial load
    applyFilter();
});
