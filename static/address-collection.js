document.addEventListener("DOMContentLoaded", function() {
    
    // --- VARIABLES ---
    const form = document.getElementById('weddingForm');
    const nameInput = document.getElementById('guest-name');
    const partnerRadios = document.querySelectorAll('input[name="has_partner"]');
    const partnerNameInput = document.getElementById('partner-name');
    const addressInputs = document.querySelectorAll('#step-address input');
    const messageInput = document.getElementById('guest-message');

    // --- 1. ENTER KEY NAVIGATION ---
    form.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            if (event.target === messageInput && event.shiftKey) return; 
            
            // Stop form from submitting on "Enter" key
            event.preventDefault(); 
            
            const active = document.activeElement;
            if (active === nameInput) {
                scrollToStep('step-partner');
            } else if (active === partnerNameInput) {
                scrollToStep('step-address');
            } else if (active.closest('#step-address')) {
                if (active.id === 'zip-code') {
                    scrollToStep('step-message');
                } else {
                    moveFocusToNextInput(active);
                }
            } else if (active === messageInput) {
                scrollToStep('step-submit');
            }
        }
    });

    // --- 2. UNLOCK STEP 2 (PARTNER) ---
    nameInput.addEventListener('input', function() {
        const firstName = this.value.split(' ')[0];
        const displaySpan = document.getElementById('name-display');
        if(displaySpan) displaySpan.textContent = firstName ? firstName : 'there';
        revealStep('step-partner');
    });

    // --- 3. UNLOCK STEP 3 (ADDRESS) ---
    partnerRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            const isYes = this.value === 'yes';
            handlePartnerToggle(isYes);
            revealStep('step-address');
        });
    });

    // --- 4. UNLOCK STEP 4 (MESSAGE) ---
    addressInputs.forEach(input => {
        input.addEventListener('input', () => revealStep('step-message'));
    });

    // --- 5. UNLOCK STEP 5 (SUBMIT) ---
    if (messageInput) {
        messageInput.addEventListener('input', () => revealStep('step-submit'));
        messageInput.addEventListener('focus', () => revealStep('step-submit'));
    }

    // --- 6. SUBMIT TO SUPABASE (THE FIX) ---
    form.addEventListener('submit', async function(e) {
        // !!! IMPORTANT: This stops the "Method Not Allowed" error !!!
        e.preventDefault(); 
        
        const btn = document.getElementById('final-btn');
        const originalText = btn.textContent;
        btn.textContent = "Sending...";
        btn.style.opacity = "0.7";

        // Get Keys from the HTML attributes
        const supabaseUrl = form.dataset.supabaseUrl;
        const supabaseKey = form.dataset.supabaseKey;
        
        // Initialize Supabase
        const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

        // Collect Data
        const formData = new FormData(form);
        const payload = {
            guest_name: formData.get('name'),
            has_partner: formData.get('has_partner') === 'yes',
            partner_name: formData.get('partner_name'),
            address_line_1: formData.get('address'),
            address_line_2: formData.get('apt'),
            city: formData.get('city'),
            state: formData.get('state'),
            zip_code: formData.get('zip'),
            message: formData.get('message')
        };

        // Send to DB
        const { data, error } = await supabaseClient
            .from('guest_addresses')
            .insert([ payload ]);

        if (error) {
            console.error('Supabase Error:', error);
            alert("Something went wrong. Please try again!");
            btn.textContent = originalText;
            btn.style.opacity = "1";
        } else {
            // Success Animation
            document.querySelector('.editorial-form-container').innerHTML = `
                <div class="form-step visible" style="text-align:center; min-height:80vh;">
                    <h2 class="script-intro">Thank You!</h2>
                    <label>We've added you to the list.</label>
                </div>
            `;
        }
    });

    // --- OBSERVER (Animation) ---
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('visible');
        });
    }, { threshold: 0.2 });
    
    document.querySelectorAll('.form-step').forEach(step => observer.observe(step));
});

// --- HELPERS ---

function revealStep(stepId) {
    const step = document.getElementById(stepId);
    if (step && step.classList.contains('step-hidden')) {
        step.classList.remove('step-hidden');
        step.classList.add('visible'); 
    }
}

function scrollToStep(stepId) {
    const step = document.getElementById(stepId);
    if (!step) return;
    revealStep(stepId);
    step.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const input = step.querySelector('input, textarea');
    if (input) input.focus();
}

function handlePartnerToggle(isYes) {
    const container = document.getElementById('partner-input-container');
    const input = document.getElementById('partner-name');
    if (isYes) {
        container.classList.add('revealed');
        input.setAttribute('required', 'true');
        setTimeout(() => input.focus(), 300); 
    } else {
        container.classList.remove('revealed');
        input.removeAttribute('required');
        input.value = "";
    }
}

function moveFocusToNextInput(currentInput) {
    const formInputs = Array.from(document.querySelectorAll('input, textarea'));
    const index = formInputs.indexOf(currentInput);
    if (index > -1 && index < formInputs.length - 1) {
        formInputs[index + 1].focus();
    }
}