// This log should appear the moment the file is loaded.
console.log("login.js script has been loaded and is running!");

document.addEventListener('DOMContentLoaded', () => {
    // This log tells us the HTML is ready.
    console.log("DOM content fully loaded. Looking for the login form...");
    
    // IMPORTANT: Replace with your actual Supabase URL and Anon Key if they are not globally defined
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const loginForm = document.getElementById('login-form');
    
    // This will tell us if the script found the form element.
    console.log("Found form element:", loginForm);

    // If the form exists, add the event listener.
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            // This is the most important line. It stops the page from reloading.
            e.preventDefault();
            console.log("Form submission intercepted by JavaScript!");

            const errorMessage = document.getElementById('error-message');
            errorMessage.style.display = 'none';

            const email = loginForm.email.value;
            const password = loginForm.password.value;

            console.log("Attempting to sign in with email:", email);

            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) {
                console.error("Supabase login error:", error.message);
                errorMessage.textContent = error.message;
                errorMessage.style.display = 'block';
            } else {
                console.log("Supabase login successful! Redirecting...");
                // Successful login, redirect to the main members only page
                window.location.href = '/members_only'; 
            }
        });
    } else {
        console.error("Could not find the login form with ID 'login-form'.");
    }
});
