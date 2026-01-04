// Wait for the DOM to be fully loaded before running the script
document.addEventListener("DOMContentLoaded", () => {

    // ==========================================================
    // 1. NAVBAR SCROLL LOGIC
    // ==========================================================
    const navbar = document.getElementById('navbar');
    let lastScrollY = window.scrollY;
  
    if (navbar) { // Added a check just in case
        window.addEventListener('scroll', () => {
            const currentScrollY = window.scrollY;
  
            if (currentScrollY > 0) {
            navbar.classList.add('scrolled');
  
            if (currentScrollY > lastScrollY && currentScrollY > 80) {
                navbar.classList.add('hide-on-scroll-down');
            } else {
                navbar.classList.remove('hide-on-scroll-down');
            }
            } else {
            navbar.classList.remove('scrolled');
            navbar.classList.remove('hide-on-scroll-down');
            }
  
            lastScrollY = currentScrollY;
        });
    }
  
    // ==========================================================
    // 2. MOBILE NAV TOGGLE LOGIC
    // ==========================================================
    const navToggleBtn = document.querySelector('.mobile-nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    const body = document.body; // 'body' is already defined, but this is fine
  
    if (navToggleBtn && navMenu) {
        navToggleBtn.addEventListener('click', () => {
            // Toggle the "is-active" class on the menu
            navMenu.classList.toggle('is-active');
            
            // Toggle the aria-expanded attribute for accessibility
            const isExpanded = navToggleBtn.getAttribute('aria-expanded') === 'true';
            navToggleBtn.setAttribute('aria-expanded', !isExpanded);
            
            // Prevent body scrolling when menu is open
            if (navMenu.classList.contains('is-active')) {
                body.classList.add('nav-is-active');
            } else {
                body.classList.remove('nav-is-active');
            }
        });
    }
  })

  // --- Privacy Policy Modal Logic ---
document.addEventListener("DOMContentLoaded", () => {
    const modal = document.getElementById("privacy-modal");
    const trigger = document.getElementById("privacy-trigger");
    const closeBtn = document.getElementById("privacy-close");
    const overlay = document.getElementById("privacy-overlay");
  
    // Helper to open
    function openModal() {
        if (modal) {
            modal.classList.remove("modal-hidden");
            document.body.classList.add("modal-active"); // Prevents background scrolling
        }
    }
  
    // Helper to close
    function closeModal() {
        if (modal) {
            modal.classList.add("modal-hidden");
            document.body.classList.remove("modal-active");
        }
    }
  
    // click "Privacy Policy" link
    if (trigger) {
        trigger.addEventListener("click", (e) => {
            e.preventDefault(); // Stop it from jumping to top of page
            openModal();
        });
    }
  
    // Click "X" button
    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }
  
    // Click dark background
    if (overlay) {
        overlay.addEventListener("click", closeModal);
    }
  });