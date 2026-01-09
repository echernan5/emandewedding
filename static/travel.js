// ==========================================================
// GLOBAL HELPER (Must be outside for HTML onclick="")
// ==========================================================
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
      img.classList.remove('active');
  });

  // Calculate new index
  let newIndex = activeIndex + direction;

  if (newIndex >= images.length) {
      newIndex = 0;
  } else if (newIndex < 0) {
      newIndex = images.length - 1;
  }

  images[newIndex].classList.add('active');
}

// ==========================================================
// MAIN SCRIPT (Waits for Page Load)
// ==========================================================
document.addEventListener("DOMContentLoaded", () => {

  // 1. NAVBAR SCROLL LOGIC
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

  // 2. MOBILE NAV TOGGLE LOGIC
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

  // 3. ITINERARY MODAL LOGIC
  const itineraries = {
    relaxer: `
      <h2>The Relaxer's Itinerary</h2>
      <h4>Thursday (For Early Arrivals)</h4>
      <p><strong>The Relaxer's Pick:</strong> Arrive, check into your hotel, and decompress. We recommend getting a treatment at the <strong>Gun Lake Casino Spa</strong> or simply enjoying a quiet walk along the lake to get settled in.</p>
      <p><strong>7:00 PM (Optional Welcome Party):</strong> <strong>If you're in town</strong>, we'd love for you to join us for casual drinks and bites at Charlton Park.</p>
      <h4>Friday (The Big Day)</h4>
      <p><strong>Morning:</strong> Enjoy a leisurely breakfast or head to Grand Rapids to explore the <strong>Frederik Meijer Japanese Garden</strong>.</p>
      <p><strong>4:30 PM:</strong> <strong>Our Wedding:</strong> Ceremony at the Lakefront Pavilion at Bay Pointe Inn.</p>
      <h4>Saturday (Farewell)</h4>
      <p><strong>Morning:</strong> Grab a delicious pastry and latte from <strong>The Local Grind</strong>.</p>
    `,
    adventurer: `
      <h2>The Adventurer's Itinerary</h2>
      <h4>Thursday (For Early Arrivals)</h4>
      <p><strong>The Adventurer's Pick:</strong> Hike the "Devil's Soup Bowl" trail at <strong>Yankee Springs Recreation Area</strong>.</p>
      <p><strong>7:00 PM (Optional Welcome Party):</strong> Join us for casual drinks and bites at Charlton Park.</p>
      <h4>Friday (The Big Day)</h4>
      <p><strong>Morning:</strong> Rent a kayak or paddleboard from <strong>Gun Lake Rentals</strong>.</p>
      <p><strong>4:30 PM:</strong> <strong>Our Wedding:</strong> Ceremony at the Lakefront Pavilion at Bay Pointe Inn.</p>
      <h4>Saturday (Farewell)</h4>
      <p><strong>Morning:</strong> Grab a breakfast burrito before you hit the road.</p>
    `,
    foodie: `
      <h2>The Foodie's Itinerary</h2>
      <h4>Thursday (For Early Arrivals)</h4>
      <p><strong>The Foodie's Pick:</strong> Start at <strong>Founders Brewing Co.</strong> for a tasting flight.</p>
      <p><strong>7:00 PM (Optional Welcome Party):</strong> Join us for casual drinks and bites at Charlton Park.</p>
      <h4>Friday (The Big Day)</h4>
      <p><strong>Morning:</strong> Explore the <strong>Grand Rapids Downtown Market</strong>.</p>
      <p><strong>4:30 PM:</strong> <strong>Our Wedding:</strong> Ceremony at the Lakefront Pavilion at Bay Pointe Inn.</p>
      <h4>Saturday (Farewell)</h4>
      <p><strong>Morning:</strong> Don't leave without trying the donuts from the local bakery.</p>
    `
  };

  const itinModal = document.getElementById('itinerary-modal');
  if (itinModal) {
      const modalContent = document.getElementById('modal-itinerary-content');
      const closeModalBtn = itinModal.querySelector('.modal-close');
      const overlay = itinModal.querySelector('.modal-overlay');
      const relaxerBtn = document.getElementById('open-relaxer');
      const adventurerBtn = document.getElementById('open-adventurer');
      const foodieBtn = document.getElementById('open-foodie');

      function openItinModal(html) {
          modalContent.innerHTML = html;
          itinModal.classList.remove('modal-hidden');
          document.body.classList.add('modal-active');
      }
      function closeItinModal() {
          itinModal.classList.add('modal-hidden');
          document.body.classList.remove('modal-active');
          modalContent.innerHTML = '';
      }

      relaxerBtn?.addEventListener('click', () => openItinModal(itineraries.relaxer));
      adventurerBtn?.addEventListener('click', () => openItinModal(itineraries.adventurer));
      foodieBtn?.addEventListener('click', () => openItinModal(itineraries.foodie));
      closeModalBtn?.addEventListener('click', closeItinModal);
      overlay?.addEventListener('click', closeItinModal);
  }

  // 4. ACCORDION LOGIC
  const accordionButtons = document.querySelectorAll('.accordion-button');
  accordionButtons.forEach(button => {
      button.addEventListener('click', () => {
          const content = button.nextElementSibling;
          const isExpanded = button.getAttribute('aria-expanded') === 'true';
          
          button.classList.toggle('is-active');
          button.setAttribute('aria-expanded', !isExpanded);
          content.classList.toggle('is-open');

          const container = button.closest('.accordion-container');
          if (container) {
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

  // 5. ACCOMMODATION MODAL LOGIC (With Gallery)
  const accommModal = document.getElementById('accommodation-modal');
  
  if (accommModal) {
    const accommModalContent = document.getElementById('modal-accommodation-content');
    const accommOverlay = accommModal.querySelector('.modal-overlay');
    const accommCloseBtn = accommModal.querySelector('.modal-close');
    const accommModalButtons = document.querySelectorAll('a[data-modal-id]');

    function openAccommodationModal() {
        accommModal.classList.remove('modal-hidden');
        document.body.classList.add('modal-active');
    }

    function closeAccommodationModal() {
        accommModal.classList.add('modal-hidden');
        document.body.classList.remove('modal-active');
        accommModalContent.innerHTML = ''; 
    }

    accommOverlay.addEventListener('click', closeAccommodationModal);
    accommCloseBtn.addEventListener('click', closeAccommodationModal);

    accommModalButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const modalId = button.dataset.modalId;
            const data = window.__ACCOMMODATION_DATA__[modalId];

            if (!data) return;

            // 1. Build The Gallery HTML
            let mainSlidesHTML = '';
            let thumbnailsHTML = '';

            data.images.forEach((imgSrc, index) => {
                const isActive = index === 0 ? 'active' : '';
                
                // Main Slide
                mainSlidesHTML += `
                    <div class="gallery-slide ${isActive}" id="slide-${index}">
                        <img src="${imgSrc}" alt="${data.title} view ${index + 1}">
                    </div>
                `;
                
                // Thumbnail
                thumbnailsHTML += `
                    <button class="gallery-thumb ${isActive}" data-slide-index="${index}" aria-label="View photo ${index + 1}">
                        <img src="${imgSrc}" alt="Thumbnail ${index + 1}">
                    </button>
                `;
            });

            // 2. Build Amenities HTML
            let amenitiesHTML = '';
            if (data.amenities) {
                amenitiesHTML = `
                <div class="modal-amenities-section">
                    <h4 class="modal-section-header">Amenities</h4>
                    <div class="modal-amenities-grid">
                        ${data.amenities.map(item => `
                            <div class="amenity-item">
                                <i class="bi ${item.icon}"></i>
                                <span>${item.text}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                `;
            }

            // 1. Format the numbers safely
            // We check if data.rating exists first so "Vacation Rentals" don't crash the script
            const ratingText = data.rating 
                ? `${Number(data.rating).toFixed(1)} (${Number(data.reviews).toLocaleString()} reviews)` 
                : '';

            // 2. Create the clickable link (using the class for hover effects)
            const ratingContent = data.reviewsLink 
                ? `<a href="${data.reviewsLink}" target="_blank" class="review-link">${ratingText}</a>`
                : ratingText;

            // 3. Assemble the final HTML
            const ratingHTML = data.rating 
                ? `<span class="meta-item"><i class="bi bi-star-fill"></i> ${ratingContent}</span>
                   <span class="meta-dot">•</span>` 
                : '';

            // 4. NEW: Determine Button Logic
            let actionButtonsHTML = '';

            // Check if we have the special rental links
            if (data.vrboLink && data.airbnbLink) {
                actionButtonsHTML = `
                    <a href="${data.vrboLink}" target="_blank" class="action-btn secondary-btn" style="flex: 1;">
                        <img src="https://a0.muscache.com/im/pictures/airbnb-platform-assets/AirbnbPlatformAssets-Favicons/original/0d189acb-3f82-4b2c-b95f-ad1d6a803d13.png?im_w=240" style="height:16px; margin-right:8px;"> Airbnb
                    </a>
                    <a href="${data.airbnbLink}" target="_blank" class="action-btn secondary-btn" style="flex: 1;">
                        <img src="https://www.vrbo.com/favicon.ico" style="height:16px; margin-right:8px;"> VRBO
                    </a>
                `;
            } else {
                // Standard Hotel Logic (Website + Phone)
                actionButtonsHTML = `
                    <a href="${data.website}" target="_blank" class="action-btn primary-btn">
                        Book / Visit Website
                    </a>
                    ${data.phone ? `
                        <a href="tel:${data.phone}" class="action-btn secondary-btn">
                            <i class="bi bi-telephone"></i> Call
                        </a>
                    ` : ''}
                `;
            }

            const modalContentHTML = `
                <div class="gallery-container">
                    <div class="gallery-main-view" id="gallery-main">
                        ${mainSlidesHTML}
                    </div>
                    <div class="gallery-thumbnails">
                        ${thumbnailsHTML}
                    </div>
                </div>
                
                <div class="modal-accomm-content">
                    
                    <div class="modal-header-group">
                        <h2 class="modal-accomm-title">${data.title}</h2>
                        
                        <div class="modal-meta-row">
                            ${ratingHTML}
                            <a href="${data.mapLink}" target="_blank" class="meta-item link"><i class="bi bi-geo-alt-fill"></i> ${data.address}</a>
                        </div>
                    </div>

                    ${amenitiesHTML}

                    <div class="modal-booking-note">
                        ${data.bookingNote}
                    </div>

                    <div class="modal-actions">
                        ${actionButtonsHTML}
                    </div>
                </div>
            `;

            // 3. Assemble Full Modal HTML
            accommModalContent.innerHTML = modalContentHTML;
            openAccommodationModal();
            initGallery(accommModalContent);
        });
    });

    // Helper: Gallery Interaction
    function initGallery(container) {
        const slides = container.querySelectorAll('.gallery-slide');
        const thumbs = container.querySelectorAll('.gallery-thumb');

        thumbs.forEach(thumb => {
            thumb.addEventListener('click', () => {
                const index = thumb.dataset.slideIndex;
                
                thumbs.forEach(t => t.classList.remove('active'));
                thumb.classList.add('active');
                
                slides.forEach(s => s.classList.remove('active'));
                const activeSlide = container.querySelector(`#slide-${index}`);
                if (activeSlide) {
                    activeSlide.classList.add('active');
                }
            });
        });
    }
  }

  // 6. PRIVACY POLICY MODAL
  const privacyModal = document.getElementById("privacy-modal");
  if (privacyModal) {
      const trigger = document.getElementById("privacy-trigger");
      const closeBtn = document.getElementById("privacy-close");
      const overlay = document.getElementById("privacy-overlay");

      function closePrivacy() {
          privacyModal.classList.add("modal-hidden");
          document.body.classList.remove("modal-active");
      }

      trigger?.addEventListener("click", (e) => {
          e.preventDefault();
          privacyModal.classList.remove("modal-hidden");
          document.body.classList.add("modal-active");
      });

      closeBtn?.addEventListener("click", closePrivacy);
      overlay?.addEventListener("click", closePrivacy);
  }

});