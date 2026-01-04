// Home.js - cleaned up
// Wrap everything in DOMContentLoaded to avoid null references

document.addEventListener("DOMContentLoaded", function() {

  // 1. LOCK SCROLL ON LOAD
  const modal = document.getElementById("passwordModal");
  if (modal && modal.style.display !== "none") {
    document.body.style.overflow = "hidden"; // 🔒 Disable scroll while modal is open
  }
  
  // 2. PASSWORD CHECKER LOGIC
  const pwBtn = document.getElementById("submitPassword");
  const pwInput = document.getElementById("passwordInput");

  // Helper function to check password
  function checkPassword() {
      const enteredPassword = pwInput.value;
      const correctPassword = "PiDay"; // 🔑 CHANGE THIS TO YOUR REAL PASSWORD

      if (enteredPassword === correctPassword) {
          // Success: Hide modal & Enable scroll
          if (modal) modal.style.display = "none";
          document.body.style.overflow = ""; 
      } else {
          // Failure: Show error message
          const errorMsg = document.getElementById("errorMessage");
          if (errorMsg) errorMsg.style.display = "block";
      }
  }

  // Event Listener: Click the Button
  if (pwBtn) {
      pwBtn.addEventListener("click", checkPassword);
  }

  // Event Listener: Press "Enter" in the input box
  if (pwInput) {
      pwInput.addEventListener("keypress", function (e) {
          if (e.key === "Enter") {
              checkPassword();
          }
      });
  }
});

// Navbar Scroll Behavior
document.addEventListener('DOMContentLoaded', () => {
  const navbar = document.getElementById('navbar');
  let lastScrollY = window.scrollY;

  // Safety check if navbar exists on this page
  if (!navbar) return;

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
});

//Accordion Functionality
document.addEventListener('DOMContentLoaded', function() {
  const accordionToggles = document.querySelectorAll('.accordion-toggle');

  accordionToggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
      const accordionItem = toggle.parentElement;
      const accordionContent = accordionItem.querySelector('.accordion-content');
      accordionContent.classList.toggle('active');
      toggle.classList.toggle('active-toggle');
    });
  });
});

//Our Story Photo Animation
document.addEventListener('DOMContentLoaded', () => {
  const images = document.querySelectorAll('.our-story-section .intro-column img');
  const ourStorySection = document.getElementById('our-story');

  if (!ourStorySection) return; // Exit if section doesn't exist

  const handleScroll = () => {
      const rect = ourStorySection.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom >= 0) {
          images.forEach(img => {
              img.classList.add('fade-in');
          });
          window.removeEventListener('scroll', handleScroll);
      }
  };

  window.addEventListener('scroll', handleScroll);
  handleScroll();
});

// Timeline Carousel Functionality
document.addEventListener('DOMContentLoaded', () => {
  const timeline = document.querySelector('.timeline');
  const prevArrow = document.querySelector('.timeline-arrow.prev');
  const nextArrow = document.querySelector('.timeline-arrow.next');

  if (!timeline) return;

  const items = document.querySelectorAll('.timeline-item');
  const totalItems = items.length;
  let currentIndex = 0;

  const showItem = (index) => {
      const itemWidth = items[0].offsetWidth;
      const gap = parseInt(window.getComputedStyle(timeline).gap, 10) || 0;
      const translateValue = -((itemWidth + gap) * index);
      timeline.style.transform = `translateX(${translateValue}px)`;
  };

  const nextItem = () => {
      // Loop logic: stops 2 items short so you don't scroll into empty space
      const maxIndex = Math.max(0, totalItems - 1); 
      currentIndex = (currentIndex + 1) % maxIndex; 
      showItem(currentIndex);
  };

  const prevItem = () => {
      const maxIndex = Math.max(0, totalItems - 1);
      currentIndex = (currentIndex - 1 + maxIndex) % maxIndex;
      showItem(currentIndex);
  };

  if (nextArrow) nextArrow.addEventListener('click', nextItem);
  if (prevArrow) prevArrow.addEventListener('click', prevItem);
});

// --- Scrolling Invitation Section ---
document.addEventListener('DOMContentLoaded', () => {
    const textElements = [
        document.querySelector('#text-1 .fade-in-text'),
        document.querySelector('#text-2 .fade-in-text'),
        document.querySelector('#text-3 .fade-in-text')
    ].filter(el => el !== null);

    const imagePanels = document.querySelectorAll('.image-panel');

    if (textElements.length > 0 && imagePanels.length > 0) {
        const fadeInObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                const index = Array.from(imagePanels).indexOf(entry.target);
                if (index !== -1) {
                    if (entry.isIntersecting) {
                        textElements[index].classList.add('is-visible');
                    } else {
                        textElements[index].classList.remove('is-visible');
                    }
                }
            });
        }, { threshold: 0.5 });

        imagePanels.forEach(panel => fadeInObserver.observe(panel));
    }
});

// --- Parallax Background Effect ---
document.addEventListener('DOMContentLoaded', () => {
  const section = document.querySelector('.celebration-section');
  if (!section) return;

  document.addEventListener('scroll', function() {
    const rect = section.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const totalScrollDistance = viewportHeight + rect.height;
    const scrollProgress = viewportHeight - rect.top;
    let scrollFraction = scrollProgress / totalScrollDistance;
    let clampedFraction = Math.max(0, Math.min(1, scrollFraction));
    let offset = (clampedFraction * 150) - 75;

    section.style.setProperty('--bg-y-offset', `${offset}px`);
  });
});

// --- Mobile Navigation Toggle ---
document.addEventListener('DOMContentLoaded', () => {
    const mobileToggle = document.querySelector('.mobile-nav-toggle');
    const navMenu = document.querySelector('.nav-menu');
    const body = document.body;
  
    if (mobileToggle && navMenu) {
      mobileToggle.addEventListener('click', () => {
        // Toggle the class that shows/hides the menu
        navMenu.classList.toggle('is-active');
        
        // Prevent scrolling on the background when menu is open
        body.classList.toggle('nav-is-active');
      });
  
      // Close menu when clicking a link
      const navLinks = document.querySelectorAll('.nav-link');
      navLinks.forEach(link => {
        link.addEventListener('click', () => {
          navMenu.classList.remove('is-active');
          body.classList.remove('nav-is-active');
        });
      });
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