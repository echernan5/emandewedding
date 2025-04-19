// RSVP.js

document.addEventListener("DOMContentLoaded", () => {
    let currentStep = 1;  // Keeps track of the current step in the form
    const form = document.getElementById("multi-step-form");  // Form container
    const guestNameInput = document.getElementById("guest-name");  // Input field for the guest name
    const partyMembersDiv = document.getElementById("party-members");  // Div to display party members
    const errorMessageDiv = document.getElementById("error-message");  // Div to show error messages
    let acceptedMembers = [];  // List of accepted party members
    let rsvpChoices = {};  // Tracks RSVP choices (Accept/Decline) and meal choices for each member

    // Utility to show one step at a time in the form
    function showStep(step) {
        document.querySelectorAll(".form-step").forEach((el, i) => {
            el.classList.toggle("active", i === step - 1);
        });
        currentStep = step;  // Update the current step
    }

    // Function to display party members and handle their RSVP choices
    function displayPartyMembers(partyMembers) {
        if (!partyMembers || partyMembers.length === 0) {
            partyMembersDiv.innerHTML = "<p>No party members found.</p>";  // Show message if no members
            return;
        }

        // Loop through each member and create UI elements for RSVP buttons
        partyMembers.forEach(member => {
            const memberDiv = document.createElement("div");
            memberDiv.classList.add("party-member");
            const nameDiv = document.createElement("span");
            nameDiv.textContent = member.fullName;
            memberDiv.appendChild(nameDiv);

            // Create the Accept and Decline buttons for each member
            const acceptButton = document.createElement("button");
            acceptButton.textContent = "Accept";
            acceptButton.classList.add("accept-button");
            acceptButton.addEventListener("click", () => handleRSVP(member, "Accept"));
            memberDiv.appendChild(acceptButton);

            const declineButton = document.createElement("button");
            declineButton.textContent = "Decline";
            declineButton.classList.add("decline-button");
            declineButton.addEventListener("click", () => handleRSVP(member, "Decline"));
            memberDiv.appendChild(declineButton);

            partyMembersDiv.appendChild(memberDiv);  // Add the member's div to the page
        });
    }

    // Function to handle RSVP choice (Accept or Decline)
    function handleRSVP(member, choice) {
        rsvpChoices[member.fullName] = { rsvp: choice, mealChoice: null };  // Save the RSVP choice for this member

        // Update the acceptedMembers list based on the choice
        if (choice === "Accept" && !acceptedMembers.includes(member.fullName)) {
            acceptedMembers.push(member.fullName);
        } else if (choice === "Decline" && acceptedMembers.includes(member.fullName)) {
            acceptedMembers = acceptedMembers.filter(name => name !== member.fullName);
        }

        // Highlight the selected button for the member
        const memberDiv = Array.from(partyMembersDiv.children)
            .find(div => div.querySelector('span').textContent === member.fullName);
        if (!memberDiv) return;  // Safety check

        // Remove previous highlights from all buttons
        memberDiv.querySelectorAll('button').forEach(btn => {
            btn.style.fontWeight = 'normal';      // Un-bold all buttons
            btn.style.backgroundColor = '';      // Reset background color
        });

        // Highlight the clicked button
        const clickedButton = Array.from(memberDiv.querySelectorAll('button'))
            .find(btn => btn.textContent === choice);
        clickedButton.style.fontWeight = 'bold';  // Bold the clicked button
        clickedButton.style.backgroundColor = '#e0e0e0';  // Change background color

        // Show meal choices only for accepted members
        if (choice === "Accept") {
            displayMealChoices(member);  // Show meal choices for this member
        }
    }

    // Function to display meal choices for accepted members (Step 3)
    function displayMealChoices(member) {
        const mealPreferencesDiv = document.getElementById("meal-preferences");
        const mealDiv = document.createElement("div");
        mealDiv.classList.add("meal-choice");

        // Create meal options for this member
        const nameSpan = document.createElement("span");
        nameSpan.textContent = member.fullName;
        mealDiv.appendChild(nameSpan);

        const mealChoiceDiv = document.createElement("div");
        mealChoiceDiv.innerHTML = `
            <label><input type="radio" name="mealChoice-${member.fullName}" value="Chicken"> Chicken</label>
            <label><input type="radio" name="mealChoice-${member.fullName}" value="Steak"> Steak</label>
            <label><input type="radio" name="mealChoice-${member.fullName}" value="Vegetarian"> Vegetarian</label>
        `;
        mealDiv.appendChild(mealChoiceDiv);
        mealPreferencesDiv.appendChild(mealDiv);

        // Listen for changes in the meal choice
        mealChoiceDiv.addEventListener("change", (e) => {
            if (e.target.name === `mealChoice-${member.fullName}`) {
                rsvpChoices[member.fullName].mealChoice = e.target.value;  // Save the meal choice
            }
        });
    }

    // Event listeners for next/submit buttons
    document.getElementById("to-meal-step").addEventListener("click", () => {
        showStep(3);
    });

    document.getElementById("to-message-step").addEventListener("click", () => showStep(4));  // Go to Step 4

    // Handle form submission
    form.addEventListener("submit", (e) => {
        e.preventDefault();

        // Log the current step and data to check if form is being submitted
        console.log("Form submission triggered");
        console.log("Current step: ", currentStep);

        if (currentStep === 1) {
            // Step 1: Name lookup
            const typedName = guestNameInput.value.trim();
            if (!typedName) {
                return errorMessageDiv.textContent = "Please enter a name!";
            }
            errorMessageDiv.textContent = "";  // Clear previous error messages
            fetch(`https://immense-plains-30838-adb516d69898.herokuapp.com/proxy?name=${encodeURIComponent(typedName)}`)

                .then(r => r.json())
                .then(data => {
                    if (data.error) {
                        errorMessageDiv.textContent = data.error;
                    } else {
                        partyMembersDiv.innerHTML = "";  // Clear previous members
                        displayPartyMembers(data.partyMembers);  // Show party members
                        showStep(2);  // Move to Step 2
                    }
                })
                .catch(err => {
                    console.error(err);
                    errorMessageDiv.textContent = "Error fetching data.";
                });

            } else if (currentStep === 4) {
                const dietaryNotes = document.getElementById("dietaryNotes").value;
                const messageToHosts = document.getElementById("messageToHosts").value;
            
                const rsvpData = {
                    name: guestNameInput.value.trim(),
                    message: messageToHosts,
                    dietaryNotes: dietaryNotes,
                    rsvps: rsvpChoices  // This includes each guest's RSVP and meal choice
                };

                console.log("About to fetch to Heroku endpoint...");

                fetch("https://immense-plains-30838-adb516d69898.herokuapp.com/api/submit", {
                    method: "POST",
                    body: JSON.stringify(rsvpData),
                    headers: {
                        "Content-Type": "application/json"
                    }
                })

                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        alert("RSVP submitted! Thanks!");
                        showStep(1);
                        form.reset();
                    } else {
                        alert("Failed to submit RSVP.");
                    }
                })
                .catch(err => {
                    console.error(err);
                    alert("Error submitting RSVP.");
                });
            }
    });

    // Initially show Step 1
    showStep(1);
});
