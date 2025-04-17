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

  document.addEventListener('DOMContentLoaded', function () {
    const dropdown = document.querySelector('.sidebar .dropdown');
    const toggle = dropdown.querySelector('.dropdown-toggle');
    const content = dropdown.querySelector('.dropdown-content');

    toggle.addEventListener('click', function () {
      dropdown.classList.toggle('open');
      content.style.display = dropdown.classList.contains('open') ? 'block' : 'none';
    });
  });

