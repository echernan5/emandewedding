// Home.js - cleaned up
// Wrap everything in DOMContentLoaded to avoid null references

document.addEventListener("DOMContentLoaded", function() {
  // Password Checker (if modal exists)
  const pwBtn = document.getElementById("submitPassword");
  if (pwBtn) {
    pwBtn.addEventListener("click", function () {
      const enteredPassword = document.getElementById("passwordInput").value;
      const correctPassword = "PiDay"; // Change this to your password
      if (enteredPassword === correctPassword) {
        document.getElementById("passwordModal").style.display = "none";
      } else {
        document.getElementById("errorMessage").style.display = "block";
      }
    });
  }

  // Sidebar Menu Toggle
  const menuIcon = document.querySelector(".menu-icon");
  const closeIcon = document.querySelector(".close-icon");
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.querySelector(".overlay");
  const contentWrapper = document.querySelector(".content-wrapper");

  if (menuIcon && closeIcon && sidebar && overlay && contentWrapper) {
    menuIcon.addEventListener("click", () => {
      sidebar.classList.add("active");
      overlay.classList.add("active");
      contentWrapper.classList.add("content-slide");
    });
    closeIcon.addEventListener("click", () => {
      sidebar.classList.remove("active");
      overlay.classList.remove("active");
      contentWrapper.classList.remove("content-slide");
    });
  }

  // Dropdown in Sidebar
  const dropdown = document.querySelector('.sidebar .dropdown');
  if (dropdown) {
    const toggle = dropdown.querySelector('.dropdown-toggle');
    const content = dropdown.querySelector('.dropdown-content');
    toggle.addEventListener('click', () => {
      dropdown.classList.toggle('open');
      content.style.display = dropdown.classList.contains('open') ? 'block' : 'none';
    });
  }

  // Carousel Logic
  const cardContainer = document.querySelector(".card-container");
  const cards = document.querySelectorAll(".card");
  const leftArrow = document.querySelector(".carousel-arrow.left");
  const rightArrow = document.querySelector(".carousel-arrow.right");

  if (cardContainer && cards.length && leftArrow && rightArrow) {
    const gap = 20;                                 // same as your CSS gap
    let currentIndex = 0;
    const totalCards = cards.length;
    const cardWidth = cards[0].offsetWidth + gap;

    const isMobile = () => window.innerWidth <= 767;

    // Hide arrows on mobile
    if (isMobile()) {
      leftArrow.style.display = "none";
      rightArrow.style.display = "none";
    }

    const updateCarousel = () => {
      cardContainer.style.transform = `translateX(-${currentIndex * cardWidth}px)`;
    };

    const updateArrows = () => {
      const visibleWidth = cardContainer.parentElement.offsetWidth;
      const lastCard = cards[totalCards - 1];
      const lastRight = lastCard.offsetLeft + lastCard.offsetWidth;
      const scrollPos = currentIndex * cardWidth;

      leftArrow.style.display = currentIndex === 0 ? 'none' : 'block';
      rightArrow.style.display = (lastRight <= scrollPos + visibleWidth) ? 'none' : 'block';
    };

    const moveCarousel = (dir) => {
      if (dir === 'left' && currentIndex > 0) currentIndex--;
      if (dir === 'right' && currentIndex < totalCards - 1) currentIndex++;
      updateCarousel();
      updateArrows();
    };

    // Attach events if not mobile
    if (!isMobile()) {
      leftArrow.addEventListener('click', () => moveCarousel('left'));
      rightArrow.addEventListener('click', () => moveCarousel('right'));
    }

    // Init
    updateCarousel();
    updateArrows();
  }

});
