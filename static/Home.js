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

// --- NEW Members Only Password Modal ---
const membersOnlyModal = document.getElementById("membersOnlyModal");
const closeMembersOnlyModal = document.getElementById("closeMembersOnlyModal");
const membersOnlyPasswordInput = document.getElementById("membersOnlyPasswordInput");
const submitMembersOnlyPasswordBtn = document.getElementById("submitMembersOnlyPassword");
const membersOnlyErrorMessage = document.getElementById("membersOnlyErrorMessage");

// Define the URL for the members-only area
const membersOnlyTrigger = document.getElementById("membersOnlyTrigger");
// Define the password for the members-only area
const membersOnlyURL = membersOnlyTrigger.dataset.membersUrl;
const correctMembersOnlyPassword = "Blackjack2001"; // <<<--- SET YOUR MEMBERS ONLY PASSWORD HERE!

if (membersOnlyTrigger && membersOnlyModal) {
  membersOnlyTrigger.addEventListener("click", function(event) {
    event.preventDefault(); // Prevent default link behavior
    membersOnlyModal.style.display = "flex"; // Show the modal
    // Optionally disable body scroll when this modal is open, if not already handled by initial modal
    // document.body.style.overflow = "hidden";
    membersOnlyPasswordInput.focus(); // Focus on the input field
  });

  closeMembersOnlyModal.addEventListener("click", function() {
    membersOnlyModal.style.display = "none"; // Hide the modal
    membersOnlyErrorMessage.style.display = "none"; // Hide error message
    membersOnlyPasswordInput.value = ""; // Clear input
    // Optionally re-enable body scroll
    // document.body.style.overflow = "";
  });

  submitMembersOnlyPasswordBtn.addEventListener("click", function() {
    const enteredPassword = membersOnlyPasswordInput.value.trim();
    if (enteredPassword === correctMembersOnlyPassword) {
      window.open(membersOnlyURL, '_blank'); // Open link in new tab
      membersOnlyModal.style.display = "none"; // Hide the modal
      membersOnlyErrorMessage.style.display = "none"; // Hide error message
      membersOnlyPasswordInput.value = ""; // Clear input
      // Optionally re-enable body scroll
      // document.body.style.overflow = "";
    } else {
      membersOnlyErrorMessage.style.display = "block"; // Show error message
      membersOnlyPasswordInput.value = ""; // Clear input
      membersOnlyPasswordInput.focus(); // Keep focus for re-entry
    }
  });

  membersOnlyPasswordInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      submitMembersOnlyPasswordBtn.click();
    }
  });
}

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