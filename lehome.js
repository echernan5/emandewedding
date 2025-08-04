document.addEventListener('DOMContentLoaded', () => {
    const accordionHeaders = document.querySelectorAll('.accordion-header');
  
    accordionHeaders.forEach(header => {
      header.addEventListener('click', () => {
        const currentItem = header.parentElement;
        const currentContent = currentItem.querySelector('.accordion-content');
        const currentToggle = header.querySelector('.accordion-toggle');
        const isOpen = currentContent.style.maxHeight && currentContent.style.maxHeight !== '0px';
  
        // Close all items
        document.querySelectorAll('.accordion-content').forEach(content => {
          content.style.maxHeight = '0';
        });
        document.querySelectorAll('.accordion-toggle').forEach(toggle => {
          toggle.textContent = '+';
        });
  
        // If clicking an already open item, after closing all, scroll to top of details section
        if (isOpen) {
          const detailsSection = document.getElementById('details');
          const navbarHeight = 70;
          const sectionTop = detailsSection.getBoundingClientRect().top + window.scrollY - navbarHeight;
  
          window.scrollTo({
            top: sectionTop,
            behavior: 'smooth'
          });
  
          return; // No need to open again since we just closed it
        }
  
        // Otherwise, open the clicked one
        currentContent.style.maxHeight = currentContent.scrollHeight + 'px';
        currentToggle.textContent = '−';
  
        const container = document.querySelector('.details-container');
        const navbarHeight = 70;
  
        setTimeout(() => {
          const rect = container.getBoundingClientRect();
          const isBelowViewport = rect.bottom > window.innerHeight;
  
          if (isBelowViewport) {
            const containerTop = rect.top + window.scrollY;
            const targetScroll = containerTop - (window.innerHeight / 2) + (rect.height / 2) - navbarHeight;
  
            window.scrollTo({
              top: targetScroll,
              behavior: 'smooth'
            });
          }
        }, 200);
      });
    });
  });

// Fade in photos in welcome    
document.addEventListener('DOMContentLoaded', () => {
    const leftImg = document.querySelector('.left-image img');
    const rightImg = document.querySelector('.right-image img');
    const welcomeSection = document.querySelector('.welcome-section');
  
    const options = {
      root: null,
      rootMargin: '0px',
      threshold: 0.1, // triggers when 10% of the section is visible
    };
  
    const observer = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          leftImg.classList.add('fade-in');
          rightImg.classList.add('fade-in');
          observer.unobserve(entry.target); // fade in only once
        }
      });
    }, options);
  
    observer.observe(welcomeSection);
  });
  