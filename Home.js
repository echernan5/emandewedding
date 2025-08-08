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

  document.addEventListener('DOMContentLoaded', () => {
    const navbar = document.getElementById('navbar');
    const welcomeSection = document.getElementById('hero');
    let lastScrollY = window.scrollY;

    const isPastWelcomeSection = () => {
      const welcomeSectionBottom = welcomeSection.offsetTop + welcomeSection.offsetHeight;
      return window.scrollY > welcomeSectionBottom;
    };

    window.addEventListener('scroll', () => {
      const currentScrollY = window.scrollY;

      if (isPastWelcomeSection()) {
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