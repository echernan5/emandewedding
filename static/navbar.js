// document.addEventListener('DOMContentLoaded', () => {
//     const mobileToggle = document.querySelector('.mobile-nav-toggle');
//     const navMenu = document.querySelector('#nav-menu');
//     const dropdownTriggers = document.querySelectorAll('.dropdown-trigger');

//     // Toggle main mobile hamburger menu
//     if (mobileToggle && navMenu) {
//         mobileToggle.addEventListener('click', (e) => {
//             e.stopPropagation();
//             navMenu.classList.toggle('active');
            
//             const isExpanded = mobileToggle.getAttribute('aria-expanded') === 'true';
//             mobileToggle.setAttribute('aria-expanded', !isExpanded);
//         });
//     }

//     // Handle Mobile Dropdown Toggles cleanly without accidental click-through
//     dropdownTriggers.forEach(trigger => {
//         trigger.addEventListener('click', (e) => {
//             if (window.innerWidth <= 992) {
//                 e.preventDefault();
//                 e.stopPropagation();
                
//                 const parentDropdown = trigger.closest('.nav-item-dropdown');
//                 const isOpen = parentDropdown.classList.contains('open');
                
//                 // Close all dropdowns
//                 document.querySelectorAll('.nav-item-dropdown').forEach(item => {
//                     item.classList.remove('open');
//                     const menu = item.querySelector('.dropdown-menu');
//                     if (menu) menu.style.pointerEvents = 'none';
//                 });

//                 // If it wasn't open, open it and temporarily block link clicks for 300ms
//                 if (!isOpen) {
//                     parentDropdown.classList.add('open');
//                     const menu = parentDropdown.querySelector('.dropdown-menu');
//                     if (menu) {
//                         menu.style.pointerEvents = 'none';
//                         setTimeout(() => {
//                             menu.style.pointerEvents = 'auto';
//                         }, 300); // Prevents accidental finger-lift tap-through on the first link
//                     }
//                 }
//             }
//         });
//     });

//     // Close main menu when clicking an actual destination link
//     const destinationLinks = document.querySelectorAll('.nav-link:not(.dropdown-trigger), .dropdown-item');
//     destinationLinks.forEach(link => {
//         link.addEventListener('click', () => {
//             if (window.innerWidth <= 992 && navMenu) {
//                 navMenu.classList.remove('active');
//                 if (mobileToggle) {
//                     mobileToggle.setAttribute('aria-expanded', 'false');
//                 }
//             }
//         });
//     });
// });