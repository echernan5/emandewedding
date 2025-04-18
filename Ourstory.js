document.addEventListener("DOMContentLoaded", function () {
    const phrases = [
        "in english class.",
        "laughing.",
        "best friends.",
        "in Italy.",
        "singing.",
        "going to college.",
        "long distance.",
        "watching Phineas and Ferb.",
        "short distance",
        "in the UPC office",
        "graduating college.",
        "moving to DC.",
        "getting married!"
    ];
    
    const animatedText = document.getElementById("animated-text");
    let index = 0;
    
    // Define timing behavior: fast for most, then slow down at the end
    const speeds = phrases.map((_, i) => 
        i < phrases.length - 3 ? 250 : (i === phrases.length - 3 ? 500 : i === phrases.length - 2 ? 600 : 1000)
    );

    function updateText() {
        animatedText.textContent = phrases[index];
        index++;

        if (index < phrases.length) {
            setTimeout(updateText, speeds[index]); // Use custom speeds for a natural slowdown
        }
    }

    updateText();
});

const leftButton = document.querySelector('.scroll-left');
const rightButton = document.querySelector('.scroll-right');
const timelineContainer = document.querySelector('.timeline-container');

rightButton.addEventListener('click', () => {
    timelineContainer.scrollBy({
        left: 900,  
        behavior: 'smooth',
    });
});

leftButton.addEventListener('click', () => {
    timelineContainer.scrollBy({
        left: -900,  
        behavior: 'smooth',
    });
});


document.addEventListener("DOMContentLoaded", function() {
    const menuIcon = document.querySelector(".menu-icon");
    const sidebar = document.querySelector(".sidebar");
    const overlay = document.querySelector(".overlay");
    const contentWrapper = document.querySelector(".content-wrapper");
    const closeIcon = document.querySelector(".close-icon");
    const menuToggle = document.querySelector(".menu-toggle");
    const menu = document.querySelector(".menu");
    const content = document.querySelector(".content");
  
    function openSidebar() {
        sidebar.classList.add("active"); 
        overlay.classList.add("active"); 
        contentWrapper.classList.add("content-slide");
    }
  
    function closeSidebar() {
        sidebar.classList.remove("active"); 
        overlay.classList.remove("active"); 
        contentWrapper.classList.remove("content-slide");
    }
  
    if (menuIcon) {
        menuIcon.addEventListener("click", function() {
            if (sidebar.classList.contains("active")) {
                closeSidebar();
            } else {
                openSidebar();
            }
        });
    }
  
    if (closeIcon) closeIcon.addEventListener("click", closeSidebar);
    if (overlay) overlay.addEventListener("click", closeSidebar);
  
    if (menuToggle && menu && content) {
        menuToggle.addEventListener("click", function() {
            menu.classList.toggle("open");
            content.classList.toggle("shifted");
        });
    }
  });
  
  document.addEventListener('DOMContentLoaded', function () {
    const dropdown = document.querySelector('.sidebar .dropdown');
    const toggle = dropdown.querySelector('.dropdown-toggle');
    const content = dropdown.querySelector('.dropdown-content');

    toggle.addEventListener('click', function () {
      dropdown.classList.toggle('open');
      content.style.display = dropdown.classList.contains('open') ? 'block' : 'none';
    });
  });

  const container = document.querySelector('.timeline-container');
const dotsContainer = document.querySelector('.timeline-dots-container');
const timelineItems = document.querySelectorAll('.timeline-item');

// Create dots for each timeline item
timelineItems.forEach((item, index) => {
  const dot = document.createElement('div');
  dot.classList.add('timeline-dot');
  dotsContainer.appendChild(dot);
});

// Function to update the active dot based on scroll position
function updateActiveDot() {
  const containerWidth = window.innerWidth;
  const currentScroll = container.scrollLeft;

  // Find the current item in view
  let activeIndex = Math.round(currentScroll / containerWidth);
  
  // Adjust for looping
  if (activeIndex >= timelineItems.length) {
    activeIndex = 0;
  }

  // Reset all dots to inactive
  const dots = document.querySelectorAll('.timeline-dot');
  dots.forEach(dot => dot.classList.remove('active'));

  // Mark the active dot as active
  dots[activeIndex].classList.add('active');
}

// Listen for scroll event to update the active dot
container.addEventListener('scroll', updateActiveDot);

// Initial update when the page loads
updateActiveDot();

