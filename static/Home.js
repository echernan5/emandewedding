// Home.js - cleaned up
// Wrap everything in DOMContentLoaded to avoid null references

document.addEventListener("DOMContentLoaded", function() {

  const modal = document.getElementById("passwordModal");
  if (modal && modal.style.display !== "none") {
    document.body.style.overflow = "hidden"; // 🔒 Disable scroll while modal is open
  }
  
  // Password Checker (if modal exists)
  const pwBtn = document.getElementById("submitPassword");
  if (pwBtn) {
    pwBtn.addEventListener("click", function () {
      const enteredPassword = document.getElementById("passwordInput").value;
      const correctPassword = "PiDay"; // Change this to your password
      if (enteredPassword === correctPassword) {
        document.getElementById("passwordModal").style.display = "none";
        document.body.style.overflow = ""; // ✅ Re-enable scroll
      } else {
        document.getElementById("errorMessage").style.display = "block";
      }      
    });
  }
}

)

// Navbar Scroll Behavior
document.addEventListener('DOMContentLoaded', () => {
  const navbar = document.getElementById('navbar');
  let lastScrollY = window.scrollY;

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
      // Find the parent .accordion-item
      const accordionItem = toggle.parentElement;
      // Find the .accordion-content within that item
      const accordionContent = accordionItem.querySelector('.accordion-content');

      // Toggle the 'active' class on the content
      accordionContent.classList.toggle('active');

      // Optional: Add a class to the button to change the arrow icon's direction
      toggle.classList.toggle('active-toggle');
    });
  });
});

//Our Story Photo Animation
document.addEventListener('DOMContentLoaded', () => {
  const images = document.querySelectorAll('.our-story-section .intro-column img');
  const ourStorySection = document.getElementById('our-story');

  const handleScroll = () => {
      // Get the position of the our-story-section relative to the viewport
      const rect = ourStorySection.getBoundingClientRect();
      
      // Check if the section is in the viewport
      if (rect.top < window.innerHeight && rect.bottom >= 0) {
          images.forEach(img => {
              img.classList.add('fade-in');
          });
          // Optional: Remove the scroll event listener once the animation is done
          window.removeEventListener('scroll', handleScroll);
      }
  };

  // Add the scroll event listener
  window.addEventListener('scroll', handleScroll);

  // Run once on page load to check if the section is already visible
  handleScroll();
});

// Timeline Carousel Functionality
document.addEventListener('DOMContentLoaded', () => {
  // Select the timeline and arrows from the DOM
  const timeline = document.querySelector('.timeline');
  const prevArrow = document.querySelector('.timeline-arrow.prev');
  const nextArrow = document.querySelector('.timeline-arrow.next');

  // Get all the timeline items
  const items = document.querySelectorAll('.timeline-item');
  const totalItems = items.length;
  let currentIndex = 0;

  // This function updates the carousel's position
  const showItem = (index) => {
      // Find the width of one item to calculate the translation distance
      // The `offsetWidth` includes padding and border
      const itemWidth = items[0].offsetWidth;
      
      // Use the gap value from your CSS to calculate the correct spacing
      // `getComputedStyle` gets the applied styles from the CSS
      const gap = parseInt(window.getComputedStyle(timeline).gap, 10);
      
      // Calculate the translation value to show the item at the given index
      const translateValue = -((itemWidth + gap) * index);
      
      // Apply the transform to the timeline element
      timeline.style.transform = `translateX(${translateValue}px)`;
  };

  // This function handles the 'Next' arrow click
  const nextItem = () => {
      // Loop back to the start if we reach the end
      currentIndex = (currentIndex + 1) % (totalItems - 2); 
      showItem(currentIndex);
  };

  // This function handles the 'Previous' arrow click
  const prevItem = () => {
      // Loop back to the end if we go past the start
      currentIndex = (currentIndex - 1 + (totalItems - 2)) % (totalItems - 2);
      showItem(currentIndex);
  };

  // Add event listeners to the arrows
  if (nextArrow) {
      nextArrow.addEventListener('click', nextItem);
  }
  if (prevArrow) {
      prevArrow.addEventListener('click', prevItem);
  }
});

// --- NEW: Scrolling Invitation Section ---
document.addEventListener('DOMContentLoaded', () => {
    // Select all the text containers and image panels for the invitation
    const textElements = [
        document.querySelector('#text-1 .fade-in-text'),
        document.querySelector('#text-2 .fade-in-text'),
        document.querySelector('#text-3 .fade-in-text')
    ].filter(el => el !== null); // Filter out nulls if elements don't exist

    const imagePanels = document.querySelectorAll('.image-panel');

    // Only run if the necessary elements are on the page
    if (textElements.length > 0 && imagePanels.length > 0) {
        const fadeInObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                // Find the index of the target panel
                const index = Array.from(imagePanels).indexOf(entry.target);
                if (index !== -1) {
                    if (entry.isIntersecting) {
                        textElements[index].classList.add('is-visible');
                    } else {
                        textElements[index].classList.remove('is-visible');
                    }
                }
            });
        }, {
            threshold: 0.5 
        });

        imagePanels.forEach(panel => {
            fadeInObserver.observe(panel);
        });
    }
});

// --- UPDATED: Parallax Background Effect for Celebration Section ---
document.addEventListener('DOMContentLoaded', () => {

  const section = document.querySelector('.celebration-section');
  if (!section) return; // Exit if the section isn't here

  document.addEventListener('scroll', function() {
    const rect = section.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // === NEW LOGIC ===
    // 1. Calculate total scroll distance for the effect:
    //    (viewportHeight) = distance to get the section's top to the viewport's top
    //    (rect.height)    = additional distance to get the section's bottom to the viewport's top
    const totalScrollDistance = viewportHeight + rect.height;

    // 2. Calculate how far we've scrolled *into* this total distance
    //    (viewportHeight - rect.top) = pixels scrolled since the top of the
    //                                  section first appeared at the bottom of the screen.
    const scrollProgress = viewportHeight - rect.top;

    // 3. Calculate the fraction (0 to 1) of how far we are through the effect
    let scrollFraction = scrollProgress / totalScrollDistance;
    // === END NEW LOGIC ===

    
    // Clamp the value between 0 and 1 (so it doesn't go below 0 or above 1)
    let clampedFraction = Math.max(0, Math.min(1, scrollFraction));

    // This is the same as before:
    // It maps your 0-1 progress to a -50px to +50px range.
    // (0 * 100) - 50 = -50px (start)
    // (1 * 100) - 50 = +50px (end)
    let offset = (clampedFraction * 150) - 75;

    // Apply this new pixel value to the CSS variable
    section.style.setProperty('--bg-y-offset', `${offset}px`);
  });

});