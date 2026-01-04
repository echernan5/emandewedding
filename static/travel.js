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

  // ==========================================================
  // 3. ITINERARY MODAL LOGIC
  // ==========================================================

  // --- 3a. ITINERARY CONTENT ---
  const itineraries = {
    
    relaxer: `
      <h2>The Relaxer's Itinerary</h2>
      
      <h4>Thursday (For Early Arrivals)</h4>
      <p>
        <strong>The Relaxer's Pick:</strong> Arrive, check into your hotel, and decompress. We recommend getting a treatment at the <strong>Gun Lake Casino Spa</strong> or simply enjoying a quiet walk along the lake to get settled in.
      </p>
      <p>
        <strong>7:00 PM (Optional Welcome Party):</strong> 
        <strong>If you're in town</strong>, we'd love for you to join us for casual drinks and bites at Charlton Park. It's very relaxed—please stop by anytime! No pressure at all if you're arriving later or on Friday.
      </p>

      <h4>Friday (The Big Day)</h4>
      <p>
        <strong>Morning (Your Time):</strong> 
        <strong>The Relaxer's Pick:</strong> Enjoy a leisurely breakfast. Sleep in, read a book by the water, or head to Grand Rapids to explore the stunning and serene <strong>Frederik Meijer Japanese Garden</strong>.
      </p>
      <p>
        <strong>4:30 PM (The Main Event):</strong> 
        <strong>Our Wedding:</strong> Time to get ready! Please head to the Lakefront Pavilion at Bay Pointe Inn for our 4:30 PM ceremony, followed by cocktails, dinner, and dancing.
      </p>

      <h4>Saturday (Farewell)</h4>
      <p>
        <strong>Morning (Your Time):</strong> 
        <strong>The Relaxer's Pick:</strong> Before you head out, grab a delicious pastry and latte from <strong>The Local Grind</strong>.
        <br>
        <em>Safe travels! We're so grateful you came.</em>
      </p>
    `,

    adventurer: `
      <h2>The Adventurer's Itinerary</h2>
      
      <h4>Thursday (For Early Arrivals)</h4>
      <p>
        <strong>The Adventurer's Pick:</strong> Get here and get outside! We recommend a 3-mile hike on the "Devil's Soup Bowl" trail at the <strong>Yankee Springs Recreation Area</strong>.
      </p>
      <p>
        <strong>7:00 PM (Optional Welcome Party):</strong> 
        <strong>If you're in town</strong>, join us for casual drinks and bites at Charlton Park. It's a great way to refuel! No pressure at all if you're arriving later or on Friday.
      </p>

      <h4>Friday (The Big Day)</h4>
      <p>
        <strong>Morning (Your Time):</strong> 
        <strong>The Adventurer's Pick:</strong> Seize the day! Rent a kayak or paddleboard from <strong>Gun Lake Rentals</strong> and get out on the water.
      </p>
      <p>
        <strong>4:30 PM (The Main Event):</strong> 
        <strong>Our Wedding:</strong> Time to clean up! Please head to the Lakefront Pavilion at Bay Pointe Inn for our 4:30 PM ceremony, followed by cocktails, dinner, and dancing.
      </p>

      <h4>Saturday (Farewell)</h4>
      <p>
        <strong>Morning (Your Time):</strong> 
        <strong>The Adventurer's Pick:</strong> Grab a quick, hearty breakfast burrito from <strong>[Your Fave Quick Bite]</strong> before you hit the road.
        <br>
        <em>Safe travels! We're so grateful you came.</em>
      </p>
    `,

    foodie: `
      <h2>The Foodie's Itinerary</h2>
      
      <h4>Thursday (For Early Arrivals)</h4>
      <p>
        <strong>The Foodie's Pick:</strong> Head straight to Grand Rapids and start your weekend at <strong>Founders Brewing Co.</strong> for a world-class tasting flight and appetizers.
      </p>
      <p>
        <strong>7:00 PM (Optional Welcome Party):</strong> 
        <strong>If you're in town</strong>, join us for casual drinks and bites at Charlton Park. No pressure at all if you're arriving later or on Friday.
      </p>

      <h4>Friday (The Big Day)</h4>
      <p>
        <strong>Morning (Your Time):</strong> 
        <strong>The Foodie's Pick:</strong> Explore the <strong>Grand Rapids Downtown Market</strong>. It's an indoor food hall with amazing vendors—try the tacos, chocolates, and artisan cheeses!
      </p>
      <p>
        <strong>4:30 PM (The Main Event):</strong> 
        <strong>Our Wedding:</strong> Time to get ready! Please head to the Lakefront Pavilion at Bay Pointe Inn for our 4:30 PM ceremony, followed by cocktails, dinner, and dancing.
      </p>

      <h4>Saturday (Farewell)</h4>
      <p>
        <strong>Morning (Your Time):</strong> 
        <strong>The Foodie's Pick:</strong> You can't leave without trying the famous donuts from <strong>[Your Fave Donut Shop]</strong>.
        <br>
        <em>Safe travels! We're so grateful you came.</em>
      </p>
    `
  };

  // --- 3b. GET ITINERARY ELEMENTS ---
  const modal = document.getElementById('itinerary-modal');
  
  // Check if modal elements exist on this page
  if (modal) {
      const modalContent = document.getElementById('modal-itinerary-content');
      const closeModalBtn = modal.querySelector('.modal-close');
      const overlay = modal.querySelector('.modal-overlay');
    
      const relaxerBtn = document.getElementById('open-relaxer');
      const adventurerBtn = document.getElementById('open-adventurer');
      const foodieBtn = document.getElementById('open-foodie');

      // --- 3c. DEFINE ITINERARY FUNCTIONS ---
      function openModal(itineraryHTML) {
        modalContent.innerHTML = itineraryHTML;
        modal.classList.remove('modal-hidden');
        document.body.classList.add('modal-active'); // Use class
      }
    
      function closeModal() {
        modal.classList.add('modal-hidden');
        document.body.classList.remove('modal-active'); // Use class
        modalContent.innerHTML = '';
      }

      // --- 3d. ATTACH ITINERARY LISTENERS ---
      relaxerBtn?.addEventListener('click', () => openModal(itineraries.relaxer));
      adventurerBtn?.addEventListener('click', () => openModal(itineraries.adventurer));
      foodieBtn?.addEventListener('click', () => openModal(itineraries.foodie));
    
      closeModalBtn?.addEventListener('click', closeModal);
      overlay?.addEventListener('click', closeModal);
  }

  // ==========================================================
  // 4. ACCORDION LOGIC
  // ==========================================================
  const accordionButtons = document.querySelectorAll('.accordion-button');

  accordionButtons.forEach(button => {
      button.addEventListener('click', () => {
          const content = button.nextElementSibling;
          const isExpanded = button.getAttribute('aria-expanded') === 'true';

          // Toggle this button
          button.classList.toggle('is-active');
          button.setAttribute('aria-expanded', !isExpanded);
          
          // Toggle the content panel
          content.classList.toggle('is-open');

          // Optional: Close other accordions in the same group
          const container = button.closest('.accordion-container');
          if (container) { // Check if container exists
              container.querySelectorAll('.accordion-button').forEach(otherButton => {
                  if (otherButton !== button) {
                      otherButton.classList.remove('is-active');
                      otherButton.setAttribute('aria-expanded', 'false');
                      otherButton.nextElementSibling.classList.remove('is-open');
                  }
              });
          }
      });
  });

  // ==========================================================
  // 5. ACCOMMODATION MODAL LOGIC
  // ==========================================================

  // --- 5b. GET ACCOMMODATION ELEMENTS ---
  const accommModal = document.getElementById('accommodation-modal');
  const accommModalContent = document.getElementById('modal-accommodation-content');
  const accommModalButtons = document.querySelectorAll('a[data-modal-id]');

  // Check if modal exists on this page
  if (accommModal) {
    const accommOverlay = accommModal.querySelector('.modal-overlay');
    const accommCloseBtn = accommModal.querySelector('.modal-close');

    // --- 5c. DEFINE ACCOMMODATION FUNCTIONS ---
    function openAccommodationModal() {
        accommModal.classList.remove('modal-hidden');
        document.body.classList.add('modal-active'); // Use existing class
    }

    function closeAccommodationModal() {
        accommModal.classList.add('modal-hidden');
        document.body.classList.remove('modal-active');
        accommModalContent.innerHTML = ''; // Clear content
    }

    // --- 5d. ATTACH ACCOMMODATION LISTENERS ---
    accommOverlay.addEventListener('click', closeAccommodationModal);
    accommCloseBtn.addEventListener('click', closeAccommodationModal);

    accommModalButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault(); // Stop the <a> tag from linking
            const modalId = button.dataset.modalId;
            const data = window.__ACCOMMODATION_DATA__[modalId];

            if (!data) return; // Exit if no data

            // Build Modal HTML
            let slidesHTML = '';
            let dotsHTML = '';
            data.images.forEach((imgSrc, index) => {
                slidesHTML += `
                    <div class="slide">
                        <img src="${imgSrc}" alt="${data.title} photo ${index + 1}">
                    </div>
                `;
                dotsHTML += `<span class="dot" data-slide-index="${index}"></span>`;
            });

            const modalContentHTML = `
                <div class="slideshow-container">
                    ${slidesHTML}
                    <a class="prev" data-slide-nav="-1">&#10094;</a>
                    <a class="next" data-slide-nav="1">&#10095;</a>
                    <div class="dot-container">
                        ${dotsHTML}
                    </div>
                </div>
                <div class="modal-accomm-content">
                    <h2 class="modal-accomm-title">${data.title}</h2>
                    <ul class="modal-accomm-highlights">
                        ${data.highlights.map(item => `<li>${item}</li>`).join('')}
                    </ul>
                    <div class="modal-accomm-booking">
                        ${data.bookingInfo}
                    </div>
                </div>
            `;

            // Inject HTML and Open
            accommModalContent.innerHTML = modalContentHTML;
            openAccommodationModal();
            
            // IMPORTANT: Initialize the slideshow
            initSlideshow(accommModalContent);
        });
    });
  }

  // ==========================================================
    // 5e. SLIDESHOW HELPER FUNCTION (AUTOPLAY)
    // ==========================================================

    // ==========================================================
// 5e. SLIDESHOW HELPER FUNCTION (AUTOPLAY CROSS-FADE)
// ==========================================================

function initSlideshow(modalContent) {
  let currentSlideIndex = 0;
  const slides = modalContent.querySelectorAll('.slide');
  
  if (slides.length === 0) {
      return; // No slides, nothing to do
  }

  // Function to show a specific slide
  function showSlide(index) {
      // Remove 'is-active' from all slides
      slides.forEach(slide => {
          slide.classList.remove('is-active');
      });
      
      // Add 'is-active' to the target slide
      if (slides[index]) {
          slides[index].classList.add('is-active');
      }
  }

  // Show the first slide immediately
  showSlide(currentSlideIndex);

  // Start the interval (4000ms = 4 seconds)
  // The image will fade in for 1.5s, be visible for 2.5s,
  // and then the next one will start fading in over it.
  const slideInterval = setInterval(() => {
      // Move to the next index
      currentSlideIndex++;
      
      // Wrap around if at the end
      if (currentSlideIndex >= slides.length) {
          currentSlideIndex = 0;
      }

      // Show the new slide
      showSlide(currentSlideIndex);
  }, 4000); // Adjust this time as needed (fade time + visible time)

  // --- IMPORTANT: Stop the slideshow when the modal is closed ---
  const accommModal = modalContent.closest('.modal');
  const accommOverlay = accommModal.querySelector('.modal-overlay');
  const accommCloseBtn = accommModal.querySelector('.modal-close');

  function stopSlideshow() {
      clearInterval(slideInterval);
      accommOverlay.removeEventListener('click', stopSlideshow);
      accommCloseBtn.removeEventListener('click', stopSlideshow);
  }

  accommOverlay.addEventListener('click', stopSlideshow);
  accommCloseBtn.addEventListener('click', stopSlideshow);
}

});


/* ===================================================================
  INLINE CARD CAROUSEL LOGIC
=================================================================== 
*/
function moveCardSlide(containerId, direction) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const images = container.querySelectorAll('img');
  let activeIndex = 0;

  // Find current active index
  images.forEach((img, index) => {
      if (img.classList.contains('active')) {
          activeIndex = index;
      }
      // Ensure only one is active just in case
      img.classList.remove('active');
  });

  // Calculate new index
  let newIndex = activeIndex + direction;

  // Loop logic
  if (newIndex >= images.length) {
      newIndex = 0;
  } else if (newIndex < 0) {
      newIndex = images.length - 1;
  }

  // Set new active image
  images[newIndex].classList.add('active');
}

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