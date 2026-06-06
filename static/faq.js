document.addEventListener('DOMContentLoaded', () => {

    // ==========================================================
    // 1. ACCORDION LOGIC & TRACKING
    // ==========================================================
    const triggers = document.querySelectorAll('.accordion-trigger');
  
    triggers.forEach(button => {
      button.addEventListener('click', () => {
        const panel = button.nextElementSibling;
        const isActive = button.classList.contains('active');
  
        // A. Close ALL other panels first
        triggers.forEach(otherBtn => {
          if (otherBtn !== button) {
            otherBtn.classList.remove('active');
            const otherPanel = otherBtn.nextElementSibling;
            otherPanel.classList.remove('open');
            otherPanel.style.maxHeight = null;
          }
        });
  
        // B. Toggle the clicked panel
        button.classList.toggle('active');
        panel.classList.toggle('open');
  
        if (panel.style.maxHeight) {
          // If it was open, close it
          panel.style.maxHeight = null;
        } else {
          // If it was closed, open it to its full scroll height
          panel.style.maxHeight = panel.scrollHeight + "px";

          // --- GA4 TRACKING: Fire only when opening ---
          const questionText = button.querySelector('span').innerText.trim();
          const categoryElement = button.closest('.faq-section').querySelector('.script-category');
          const categoryText = categoryElement ? categoryElement.innerText.trim() : 'General';

          if (typeof gtag === 'function') {
            gtag('event', 'viewed_faq', {
              'faq_category': categoryText,
              'faq_question': questionText
            });
          }
          // --------------------------------------------
        }
      });
    });
  
    // ==========================================================
    // 2. NAVBAR SCROLL LOGIC
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
    // 3. MOBILE NAV TOGGLE LOGIC
    // ==========================================================
    const navToggleBtn = document.querySelector('.mobile-nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    const body = document.body;
  
    if (navToggleBtn && navMenu) {
        navToggleBtn.addEventListener('click', () => {
            navMenu.classList.toggle('is-active');
            
            const isExpanded = navToggleBtn.getAttribute('aria-expanded') === 'true';
            navToggleBtn.setAttribute('aria-expanded', !isExpanded);
            
            if (navMenu.classList.contains('is-active')) {
                body.classList.add('nav-is-active');
            } else {
                body.classList.remove('nav-is-active');
            }
        });
    }
  
    // ==========================================================
    // 4. TIMELINE CAROUSEL (If applicable)
    // ==========================================================
    const timeline = document.querySelector('.timeline');
    const prevArrow = document.querySelector('.timeline-arrow.prev');
    const nextArrow = document.querySelector('.timeline-arrow.next');
    const items = document.querySelectorAll('.timeline-item');
  
    if (timeline && items.length > 0) {
        const totalItems = items.length;
        const maxIndex = totalItems > 3 ? totalItems - 3 : 0; 
        let currentIndex = 0;
  
        const showItem = (index) => {
            if (items.length === 0) return;
            const itemWidth = items[0].offsetWidth;
            const computedStyle = window.getComputedStyle(timeline);
            const gap = parseInt(computedStyle.gap, 10) || 0;
            const translateValue = -((itemWidth + gap) * index);
            timeline.style.transform = `translateX(${translateValue}px)`;
        };
  
        const nextItem = () => {
            if (currentIndex < maxIndex) {
                currentIndex++;
            } else {
                currentIndex = 0; 
            }
            showItem(currentIndex);
        };
  
        const prevItem = () => {
            if (currentIndex > 0) {
                currentIndex--;
            } else {
                currentIndex = maxIndex; 
            }
            showItem(currentIndex);
        };
  
        if (nextArrow) nextArrow.addEventListener('click', nextItem);
        if (prevArrow) prevArrow.addEventListener('click', prevItem);
    }
  
    // ==========================================================
    // 5. PRIVACY POLICY MODAL
    // ==========================================================
    const modal = document.getElementById("privacy-modal");
    const trigger = document.getElementById("privacy-trigger");
    const closeBtn = document.querySelector(".modal-close"); // Fixed selector
    const overlay = document.querySelector(".modal-overlay"); // Fixed selector
  
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
  
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (overlay) overlay.addEventListener("click", closeModal);
  });

  