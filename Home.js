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