document.addEventListener('DOMContentLoaded', () => {
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


  // --- 3. Timeline Carousel Functionality ---
  const timeline = document.querySelector('.timeline');
  const prevArrow = document.querySelector('.timeline-arrow.prev');
  const nextArrow = document.querySelector('.timeline-arrow.next');
  const items = document.querySelectorAll('.timeline-item');

  // Only run carousel logic if the necessary elements are present
  if (timeline && items.length > 0) {
      const totalItems = items.length;
      // We display 3 items at a time, so the maximum index to scroll to is totalItems - 3.
      const maxIndex = totalItems > 3 ? totalItems - 3 : 0; 
      let currentIndex = 0;

      const showItem = (index) => {
          if (items.length === 0) return;

          // Find the width of one item + the gap to calculate the translation distance
          const itemWidth = items[0].offsetWidth;
          
          // Get the gap value from the CSS
          const computedStyle = window.getComputedStyle(timeline);
          const gap = parseInt(computedStyle.gap, 10) || 0; // Use 0 if gap is not set
          
          // Calculate the translation value (item width + gap) * index
          const translateValue = -((itemWidth + gap) * index);
          
          timeline.style.transform = `translateX(${translateValue}px)`;
      };

      const nextItem = () => {
          if (currentIndex < maxIndex) {
              currentIndex++;
          } else {
              currentIndex = 0; // Loop back to the start
          }
          showItem(currentIndex);
      };

      const prevItem = () => {
          if (currentIndex > 0) {
              currentIndex--;
          } else {
              currentIndex = maxIndex; // Loop back to the end
          }
          showItem(currentIndex);
      };

      // Add event listeners to the arrows
      if (nextArrow) {
          nextArrow.addEventListener('click', nextItem);
      }
      if (prevArrow) {
          prevArrow.addEventListener('click', prevItem);
      }
  }
});

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