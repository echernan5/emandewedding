// Carousel Code
document.addEventListener("DOMContentLoaded", function () {
    // Define isMobile function locally so it's available here
    function isMobile() {
      return window.innerWidth <= 767;
    }
  
    const cardContainer = document.querySelector(".card-container");
    const cards = document.querySelectorAll(".card");
    const leftArrow = document.querySelector(".carousel-arrow.left");
    const rightArrow = document.querySelector(".carousel-arrow.right");
  
    let currentIndex = 0;
    const totalCards = cards.length;
    const cardWidth = cards[0].offsetWidth + 20; // Adjust gap if needed
  
    // Immediately hide arrows on mobile
    if (isMobile()) {
      leftArrow.style.display = "none";
      rightArrow.style.display = "none";
    }
  
    function updateCarousel() {
      cardContainer.style.transform = `translateX(-${currentIndex * cardWidth}px)`;
    }
  
    function updateArrows() {
      // These arrow updates are used when not on mobile.
      leftArrow.style.display = (currentIndex === 0) ? 'none' : 'block';
      rightArrow.style.display =
        (currentIndex === totalCards - 1) ? 'none' : 'block';
    }
  
    function moveCarousel(direction) {
      if (direction === 'left' && currentIndex > 0) {
        currentIndex--;
      } else if (direction === 'right' && currentIndex < totalCards - 1) {
        currentIndex++;
      }
      updateCarousel();
      updateArrows();
    }
  
    // Only attach arrow click events if not on mobile
    if (!isMobile()) {
      leftArrow.addEventListener('click', () => moveCarousel('left'));
      rightArrow.addEventListener('click', () => moveCarousel('right'));
    }
  
    // Initialize carousel position and arrows
    updateCarousel();
    updateArrows();
  });
  
  // Sidebar Code (kept as-is)
  document.addEventListener("DOMContentLoaded", function() {
      const menuIcon = document.querySelector(".menu-icon");
      const sidebar = document.querySelector(".sidebar");
      const overlay = document.querySelector(".overlay");
      const contentWrapper = document.querySelector(".content-wrapper");
      const closeIcon = document.querySelector(".close-icon");
  
      // Open Sidebar
      menuIcon.addEventListener("click", function() {
          sidebar.classList.add("active");
          overlay.classList.add("active");
          contentWrapper.classList.add("content-slide");
      });
  
      // Close Sidebar with smooth transition
      closeIcon.addEventListener("click", function() {
          sidebar.classList.remove("active");
          overlay.classList.remove("active");
          contentWrapper.classList.remove("content-slide");
      });
  });
  