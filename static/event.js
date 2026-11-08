// Wait for the DOM to be fully loaded before running the script
document.addEventListener("DOMContentLoaded", () => {

    // ==========================================================
    // 1. NAVBAR SCROLL LOGIC
    // ==========================================================
    const navbar = document.getElementById('navbar');
    let lastScrollY = window.scrollY;
  
    if (navbar) {
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
    // 2. MOBILE HAMBURGER MENU TOGGLE
    // ==========================================================
    const mobileToggle = document.querySelector('.mobile-nav-toggle');
    const navMenu = document.querySelector('#nav-menu');

    if (mobileToggle && navMenu) {
        mobileToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            navMenu.classList.toggle('active');
            document.body.classList.toggle('menu-open'); // Locks/unlocks body scroll
            
            const isExpanded = mobileToggle.getAttribute('aria-expanded') === 'true';
            mobileToggle.setAttribute('aria-expanded', !isExpanded);
        });
    }

    // Close mobile menu automatically when any link is tapped
    const allLinks = document.querySelectorAll('.nav-link:not(.dropdown-trigger), .dropdown-item');
    allLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 992 && navMenu) {
                navMenu.classList.remove('active');
                document.body.classList.remove('menu-open'); // Restores body scroll
                if (mobileToggle) {
                    mobileToggle.setAttribute('aria-expanded', 'false');
                }
            }
        });
    });
    
    // ==========================================================
    // 3. PRIVACY POLICY MODAL LOGIC
    // ==========================================================
    const modal = document.getElementById("privacy-modal");
    const trigger = document.getElementById("privacy-trigger");
    const closeBtn = document.getElementById("privacy-close");
    const overlay = document.getElementById("privacy-overlay");
  
    function openModal() {
        if (modal) {
            modal.classList.remove("modal-hidden");
            document.body.classList.add("modal-active");
        }
    }
  
    function closeModal() {
        if (modal) {
            modal.classList.add("modal-hidden");
            document.body.classList.remove("modal-active");
        }
    }
  
    if (trigger) {
        trigger.addEventListener("click", (e) => {
            e.preventDefault();
            openModal();
        });
    }
  
    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }
  
    if (overlay) {
        overlay.addEventListener("click", closeModal);
    }
});