// RSVP.js
document.addEventListener("DOMContentLoaded", () => {
    let currentStep = 1;
    const form = document.getElementById("multi-step-form");
    const guestNameInput = document.getElementById("guest-name");
    const partyMembersDiv = document.getElementById("party-members");
    const errorMessageDiv = document.getElementById("error-message");
    // Keep track of each guest's choice by their fullName
    const rsvpChoices = {};

  
    // Utility to show one step at a time
    function showStep(step) {
      document.querySelectorAll(".form-step").forEach((el, i) => {
        el.classList.toggle("active", i === step - 1);
      });
      currentStep = step;
    }

    function displayPartyMembers(partyMembers) {
        // This function will handle displaying the party members.
      
        // If we get an empty array or no members, we don't want to show anything
        if (!partyMembers || partyMembers.length === 0) {
          partyMembersDiv.innerHTML = "<p>No party members found.</p>";
          return;
        }

        let acceptedMembers = [];  // Track accepted members

    function handleRSVP(member, choice) {
        // 1. Save their choice
        rsvpChoices[member.fullName] = choice;

        // 2. Update the accepted members list if they accepted
        if (choice === "Accept" && !acceptedMembers.includes(member.fullName)) {
            acceptedMembers.push(member.fullName);
        } else if (choice === "Decline" && acceptedMembers.includes(member.fullName)) {
            // Remove from accepted if they decline
            acceptedMembers = acceptedMembers.filter(name => name !== member.fullName);
        }

        // 3. Find the buttons in the UI and highlight the selected one
        const selector = `.party-member:has(span:contains("${member.fullName}"))`;
        const memberDiv = Array.from(partyMembersDiv.children)
            .find(div => div.querySelector('span').textContent === member.fullName);

        if (!memberDiv) return; // safety check

        // Remove any previous highlights
        memberDiv.querySelectorAll('button').forEach(btn => {
            btn.style.fontWeight = 'normal';      // un-bold all
            btn.style.backgroundColor = '';       // reset background
        });

        // Highlight the one they clicked
        const clickedButton = Array.from(memberDiv.querySelectorAll('button'))
            .find(btn => btn.textContent === choice);
        clickedButton.style.fontWeight = 'bold';
        clickedButton.style.backgroundColor = '#e0e0e0';
        }

        function displayAcceptedMembersForMealStep() {
            const mealPreferencesDiv = document.getElementById("meal-preferences");
            mealPreferencesDiv.innerHTML = ''; // Clear existing content
        
            acceptedMembers.forEach(fullName => {
                const memberDiv = document.createElement("div");
                memberDiv.classList.add("party-member");
        
                const nameDiv = document.createElement("span");
                nameDiv.textContent = fullName;  // Display the accepted member's name
                memberDiv.appendChild(nameDiv);
        
                // Add meal options
                const mealChoiceDiv = document.createElement("div");
                mealChoiceDiv.innerHTML = `
                    <label><input type="radio" name="mealChoice-${fullName}" value="Chicken"> Chicken</label>
                    <label><input type="radio" name="mealChoice-${fullName}" value="Steak"> Steak</label>
                    <label><input type="radio" name="mealChoice-${fullName}" value="Vegetarian"> Vegetarian</label>
                `;
                memberDiv.appendChild(mealChoiceDiv);
        
                // Append member to the meal preferences div
                mealPreferencesDiv.appendChild(memberDiv);
            });
        }
        
        // Call this when navigating to Step 3
        document.getElementById("to-meal-step").addEventListener("click", () => {
            showStep(3);
            displayAcceptedMembersForMealStep();
        });
        
        // Loop through each member in the array and display their info
    partyMembers.forEach(member => {
        const memberDiv = document.createElement("div");
        memberDiv.classList.add("party-member");
        
        // Display the name
        const nameDiv = document.createElement("span");
        nameDiv.textContent = member.fullName;  // Display the name
        memberDiv.appendChild(nameDiv);
        
        // Create Accept button
        const acceptButton = document.createElement("button");
        acceptButton.textContent = "Accept";
        acceptButton.classList.add("accept-button");
        acceptButton.addEventListener("click", () => handleRSVP(member, "Accept"));
        memberDiv.appendChild(acceptButton);
        
        // Create Decline button
        const declineButton = document.createElement("button");
        declineButton.textContent = "Decline";
        declineButton.classList.add("decline-button");
        declineButton.addEventListener("click", () => handleRSVP(member, "Decline"));
        memberDiv.appendChild(declineButton);
        
        // Append the memberDiv to the partyMembersDiv
        partyMembersDiv.appendChild(memberDiv);
    });
    }
      
  
    // Handle the single form's submit
    form.addEventListener("submit", (e) => {
      e.preventDefault();
  
      if (currentStep === 1) {
        // Step 1: lookup
        const typedName = guestNameInput.value.trim();
        if (!typedName) {
          return errorMessageDiv.textContent = "Please enter a name!";
        }
        errorMessageDiv.textContent = "";
        fetch(`https://script.google.com/macros/s/AKfycbytxlXxVXYFOm9b0BikFarWOnCTRJvLpY6uAxwUbppDrfg960jaYJXhpJqt1DgITxQW/exec?name=${encodeURIComponent(typedName)}`)
          .then(r => r.json())
          .then(data => {
            console.log(data);
            if (data.error) {
              errorMessageDiv.textContent = data.error;
            } else {
              partyMembersDiv.innerHTML = "";
              displayPartyMembers(data.partyMembers);
              showStep(2);
            }
          })
          .catch(err => {
            console.error(err);
            errorMessageDiv.textContent = "Error fetching data.";
          });
  
      } else if (currentStep === 4) {
        // Step 4: final submit
        const mealChoice = document.querySelector('input[name="mealChoice"]:checked')?.value;
        const dietaryNotes = document.getElementById("dietaryNotes").value;
        const messageToHosts = document.getElementById("messageToHosts").value;
  
        const params = new URLSearchParams({
          name: guestNameInput.value.trim(),
          mealChoice,
          dietaryNotes,
          message: messageToHosts
        });
  
        fetch(`https://script.google.com/macros/s/AKfycbytxlXxVXYFOm9b0BikFarWOnCTRJvLpY6uAxwUbppDrfg960jaYJXhpJqt1DgITxQW/exec?${params}`, { method: "GET" })
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
  
    // Wire up Next buttons
    document.getElementById("to-meal-step").addEventListener("click", () => showStep(3));
    document.getElementById("to-message-step").addEventListener("click", () => showStep(4));
  
    // Initially show step 1
    showStep(1);
  });
  