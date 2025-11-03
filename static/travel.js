// Wait for the DOM to be fully loaded before running the script
document.addEventListener("DOMContentLoaded", () => {

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
    // --- 1. DEFINE YOUR ITINERARY CONTENT HERE ---
    // Use backticks (`) to allow for multi-line HTML
  
    const itineraries = {
      
      relaxer: `
        <h2>The Relaxer's Itinerary</h2>
        
        <h4>Thursday (For Early Arrivals)</h4>
        <p>
          <strong>The Relaxer's Pick:</strong> Arrive, check into your hotel, and decompress. We recommend getting a treatment at the <strong>Gun Lake Casino Spa</strong> or simply enjoying a quiet walk along the lake to get settled in.
        </p>
        <p>
          <strong>7:00 PM (Optional Welcome Party):</strong> 
          <strong>If you're in town</strong>, we'd love for you to join us for casual drinks and bites at Charlton Park. It's very relaxed—please stop by anytime! No pressure at all if you're arriving later or on Friday.
        </p>
  
        <h4>Friday (The Big Day)</h4>
        <p>
          <strong>Morning (Your Time):</strong> 
          <strong>The Relaxer's Pick:</strong> Enjoy a leisurely breakfast. Sleep in, read a book by the water, or head to Grand Rapids to explore the stunning and serene <strong>Frederik Meijer Japanese Garden</strong>.
        </p>
        <p>
          <strong>4:30 PM (The Main Event):</strong> 
          <strong>Our Wedding:</strong> Time to get ready! Please head to the Lakefront Pavilion at Bay Pointe Inn for our 4:30 PM ceremony, followed by cocktails, dinner, and dancing.
        </p>
  
        <h4>Saturday (Farewell)</h4>
        <p>
          <strong>Morning (Your Time):</strong> 
          <strong>The Relaxer's Pick:</strong> Before you head out, grab a delicious pastry and latte from <strong>The Local Grind</strong>.
          <br>
          <em>Safe travels! We're so grateful you came.</em>
        </p>
      `,
  
      adventurer: `
        <h2>The Adventurer's Itinerary</h2>
        
        <h4>Thursday (For Early Arrivals)</h4>
        <p>
          <strong>The Adventurer's Pick:</strong> Get here and get outside! We recommend a 3-mile hike on the "Devil's Soup Bowl" trail at the <strong>Yankee Springs Recreation Area</strong>.
        </p>
        <p>
          <strong>7:00 PM (Optional Welcome Party):</strong> 
          <strong>If you're in town</strong>, join us for casual drinks and bites at Charlton Park. It's a great way to refuel! No pressure at all if you're arriving later or on Friday.
        </p>
  
        <h4>Friday (The Big Day)</h4>
        <p>
          <strong>Morning (Your Time):</strong> 
          <strong>The Adventurer's Pick:</strong> Seize the day! Rent a kayak or paddleboard from <strong>Gun Lake Rentals</strong> and get out on the water.
        </p>
        <p>
          <strong>4:30 PM (The Main Event):</strong> 
          <strong>Our Wedding:</strong> Time to clean up! Please head to the Lakefront Pavilion at Bay Pointe Inn for our 4:30 PM ceremony, followed by cocktails, dinner, and dancing.
        </p>
  
        <h4>Saturday (Farewell)</h4>
        <p>
          <strong>Morning (Your Time):</strong> 
          <strong>The Adventurer's Pick:</strong> Grab a quick, hearty breakfast burrito from <strong>[Your Fave Quick Bite]</strong> before you hit the road.
          <br>
          <em>Safe travels! We're so grateful you came.</em>
        </p>
      `,
  
      foodie: `
        <h2>The Foodie's Itinerary</h2>
        
        <h4>Thursday (For Early Arrivals)</h4>
        <p>
          <strong>The Foodie's Pick:</strong> Head straight to Grand Rapids and start your weekend at <strong>Founders Brewing Co.</strong> for a world-class tasting flight and appetizers.
        </p>
        <p>
          <strong>7:00 PM (Optional Welcome Party):</strong> 
          <strong>If you're in town</strong>, join us for casual drinks and bites at Charlton Park. No pressure at all if you're arriving later or on Friday.
        </p>
  
        <h4>Friday (The Big Day)</h4>
        <p>
          <strong>Morning (Your Time):</strong> 
          <strong>The Foodie's Pick:</strong> Explore the <strong>Grand Rapids Downtown Market</strong>. It's an indoor food hall with amazing vendors—try the tacos, chocolates, and artisan cheeses!
        </p>
        <p>
          <strong>4:30 PM (The Main Event):</strong> 
          <strong>Our Wedding:</strong> Time to get ready! Please head to the Lakefront Pavilion at Bay Pointe Inn for our 4:30 PM ceremony, followed by cocktails, dinner, and dancing.
        </p>
  
        <h4>Saturday (Farewell)</h4>
        <p>
          <strong>Morning (Your Time):</strong> 
          <strong>The Foodie's Pick:</strong> You can't leave without trying the famous donuts from <strong>[Your Fave Donut Shop]</strong>.
          <br>
          <em>Safe travels! We're so grateful you came.</em>
        </p>
      `
    };
  
    // --- 2. GET ALL THE ELEMENTS ---
  
    const modal = document.getElementById('itinerary-modal');
    const modalContent = document.getElementById('modal-itinerary-content');
    const closeModalBtn = document.querySelector('.modal-close');
    const overlay = document.querySelector('.modal-overlay');
  
    const relaxerBtn = document.getElementById('open-relaxer');
    const adventurerBtn = document.getElementById('open-adventurer');
    const foodieBtn = document.getElementById('open-foodie');
  
    // --- 3. DEFINE OUR FUNCTIONS ---
  
    /**
     * Opens the modal and injects the correct HTML content.
     * @param {string} itineraryHTML - The HTML string from the itineraries object.
     */
    function openModal(itineraryHTML) {
      // 1. Inject the content
      modalContent.innerHTML = itineraryHTML;
      
      // 2. Show the modal
      modal.classList.remove('modal-hidden');
      
      // 3. Disable body scrolling
      document.body.style.overflow = 'hidden';
    }
  
    /**
     * Closes the modal.
     */
    function closeModal() {
      // 1. Hide the modal
      modal.classList.add('modal-hidden');
      
      // 2. Re-enable body scrolling
      document.body.style.overflow = '';
      
      // 3. Clear the content (optional, but good for cleanup)
      modalContent.innerHTML = '';
    }
  
    // --- 4. ATTACH EVENT LISTENERS ---
  
    // Listen for clicks on the three "chooser" cards
    relaxerBtn.addEventListener('click', () => openModal(itineraries.relaxer));
    adventurerBtn.addEventListener('click', () => openModal(itineraries.adventurer));
    foodieBtn.addEventListener('click', () => openModal(itineraries.foodie));
  
    // Listen for clicks on the "close" button and the overlay
    closeModalBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
  
  });
  