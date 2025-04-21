// RSVP.js

// Sidebar Code (kept as-is)
document.addEventListener("DOMContentLoaded", function() {
    const menuIcon = document.querySelector(".menu-icon");
    const sidebar = document.querySelector(".sidebar");
    const overlay = document.querySelector(".overlay");
    const contentWrapper = document.querySelector(".content-wrapper");
    const closeIcon = document.querySelector(".close-icon");

    menuIcon.addEventListener("click", function() {
        sidebar.classList.add("active");
        overlay.classList.add("active");
        contentWrapper.classList.add("content-slide");
    });

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

//Form JS
document.addEventListener("DOMContentLoaded", () => {
    // ──  A. State & Elements  ──────────────────────────
    let currentStep     = 1;
    let fetchedRecords  = [];
    let acceptedMembers = [];
    let rsvpChoices     = {};
    let partyId         = null;
    let submitterRecordId = null; // Store the ID of the initial submitter
    // let submitterPhoneNumber = ""; // Phone number will be read directly in step 5 submit

    const form               = document.getElementById("multi-step-form");
    const guestNameInput     = document.getElementById("guest-name"); // Only used in Step 1
    const guestPhoneInput    = document.getElementById("guest-phone"); // Used in Step 5
    const partyMembersDiv    = document.getElementById("party-members");
    const errorMessageDiv    = document.getElementById("error-message"); // Primarily for Step 1

    const step1SubmitButton = document.querySelector('#step-1 button[type="submit"]');
    const step1OriginalButtonText = step1SubmitButton ? step1SubmitButton.textContent : 'Continue';

    // --- CALCULATE HEADER HEIGHT & SET CSS VARIABLE ---
    // (Keep this section as is)
    const headerElement = document.querySelector('.hero-header');
    if (headerElement) {
        const headerHeight = headerElement.offsetHeight;
        console.log('Calculated Header Height:', headerHeight + 'px');
        document.documentElement.style.setProperty('--header-height', headerHeight + 'px');
    } else {
        console.warn('Header element (.hero-header) not found.');
    }

    // ──  B. Helper: show one step at a time  ──────────
    function showStep(step) {
        const formElement = document.getElementById("multi-step-form");
        // Ensure step is within bounds (1 to 6)
        const validStep = Math.max(1, Math.min(step, 6));

        document.querySelectorAll(".form-step").forEach((el) => {
            // Get the step number from the element's ID (e.g., "step-3" -> 3)
            const stepNum = parseInt(el.id.split('-')[1]);
            el.classList.toggle("active", stepNum === validStep);
        });
        currentStep = validStep; // Update global current step tracker

        // Optional: Add class for styling specific steps (e.g., confirmation)
        if (formElement) {
            if (validStep === 6) { // Step 6 is the confirmation/recap
                formElement.classList.add('is-long-step');
            } else {
                formElement.classList.remove('is-long-step');
            }
        } else {
            console.error("Form element not found for step class toggling.");
        }

        // --- Progress Bar Update ---
        const progressSteps = document.querySelectorAll('.progress-indicator .progress-step');
        if (progressSteps.length >= validStep) { // Check if enough steps exist
             progressSteps.forEach((stepElement, index) => {
                const stepNum = index + 1;
                stepElement.classList.remove('active', 'completed');
                if (stepNum < validStep) {
                    stepElement.classList.add('completed');
                } else if (stepNum === validStep) {
                    stepElement.classList.add('active');
                }
            });
        } else if (progressSteps.length > 0) {
             console.warn("Progress indicator steps not found or fewer than current step.");
             // Optionally handle progress bar update when steps mismatch
        }


        // Reset Step 1 controls if navigating back to it
        if (validStep === 1) {
            console.log("Navigated to Step 1, resetting controls.");
            if (guestNameInput) guestNameInput.disabled = false;
            if (step1SubmitButton) {
                step1SubmitButton.disabled = false;
                step1SubmitButton.textContent = step1OriginalButtonText;
            }
            if (errorMessageDiv) errorMessageDiv.textContent = '';
        }
        window.scrollTo(0, 0); // Scroll to top on step change
    }

    // ── C. Display party members (Keep as is) ───────────
    function displayPartyMembers(members) {
      partyMembersDiv.innerHTML = "";
      document.getElementById("member-meal-choices").innerHTML = "";
      members.forEach(member => {
        rsvpChoices[member.fullName] = { rsvp: null, mealChoice: null, dietaryNotes: "" }; // Initialize notes
        const div = document.createElement("div");
        div.className = "party-member";
        div.innerHTML = `
          <span>${member.fullName}</span>
          <button type="button" class="accept-button">Accept</button>
          <button type="button" class="decline-button">Decline</button>
        `;
        div.querySelector(".accept-button")
           .addEventListener("click", () => handleRSVP(member, "Accept"));
        div.querySelector(".decline-button")
           .addEventListener("click", () => handleRSVP(member, "Decline"));
        partyMembersDiv.append(div);
      });
    }

    // ── D. Handle RSVP click (Keep as is) ──────────────
    function handleRSVP(member, choice) {
        rsvpChoices[member.fullName].rsvp = choice; // Update RSVP status

        if (choice === "Accept") {
            if (!acceptedMembers.includes(member.fullName)) {
                acceptedMembers.push(member.fullName);
            }
            // Only display meal choices if not already displayed for this member
            if (!document.querySelector(`#member-meal-choices .meal-choice[data-name="${member.fullName}"]`)) {
                displayMealChoices(member);
            }
        } else { // choice === "Decline"
            acceptedMembers = acceptedMembers.filter(n => n !== member.fullName);
            // Remove meal choice section if it exists
            const mealChoiceEl = document.querySelector(`#member-meal-choices .meal-choice[data-name="${member.fullName}"]`);
            if (mealChoiceEl) mealChoiceEl.remove();
            // Clear meal/notes from state if they decline
            rsvpChoices[member.fullName].mealChoice = null;
            rsvpChoices[member.fullName].dietaryNotes = "";
        }

        // Style Buttons (Keep as is)
        const memberDiv = Array.from(partyMembersDiv.children).find(div =>
            div.querySelector("span").textContent === member.fullName
        );
        if (memberDiv) {
            const acceptBtn = memberDiv.querySelector(".accept-button");
            const declineBtn = memberDiv.querySelector(".decline-button");
            const selectedStyle = { bgColor: '#ffffff', textColor: '#707f5b', fontWeight: 'bold' };
            const unselectedStyle = { bgColor: 'transparent', textColor: '#ffffff', fontWeight: 'normal' };

            acceptBtn.style.backgroundColor = (choice === "Accept") ? selectedStyle.bgColor : unselectedStyle.bgColor;
            acceptBtn.style.color = (choice === "Accept") ? selectedStyle.textColor : unselectedStyle.textColor;
            acceptBtn.style.fontWeight = (choice === "Accept") ? selectedStyle.fontWeight : unselectedStyle.fontWeight;

            declineBtn.style.backgroundColor = (choice === "Decline") ? selectedStyle.bgColor : unselectedStyle.bgColor;
            declineBtn.style.color = (choice === "Decline") ? selectedStyle.textColor : unselectedStyle.textColor;
            declineBtn.style.fontWeight = (choice === "Decline") ? selectedStyle.fontWeight : unselectedStyle.fontWeight;
        }
    }

    // ── E. Show meal choices (Keep as is) ─────────────
     function displayMealChoices(member) {
        const container = document.getElementById("member-meal-choices");
        // Check if meal choice already exists for this member to avoid duplicates
        if (container.querySelector(`.meal-choice[data-name="${member.fullName}"]`)) {
            return;
        }
        const div = document.createElement("div");
        div.className = "meal-choice";
        div.dataset.name = member.fullName; // Use dataset for easy selection

        div.innerHTML = `
          <strong>${member.fullName}</strong><br>
          <label><input type="radio" name="meal-${member.fullName}" value="Chicken"> Chicken</label>
          <label><input type="radio" name="meal-${member.fullName}" value="Steak"> Steak</label>
          <label><input type="radio" name="meal-${member.fullName}" value="Vegetarian"> Vegetarian</label><br>
          <label>Any dietary needs or allergies?</label>
          <textarea name="diet-${member.fullName}" rows="2" cols="40"></textarea>
        `;

        container.append(div);

        // Add listeners to update rsvpChoices object
        div.querySelectorAll(`input[name="meal-${member.fullName}"]`).forEach(radio => {
            radio.addEventListener("change", e => {
                if (e.target.checked) {
                    rsvpChoices[member.fullName].mealChoice = e.target.value;
                }
            });
        });

        div.querySelector(`textarea[name="diet-${member.fullName}"]`).addEventListener("input", e => {
            rsvpChoices[member.fullName].dietaryNotes = e.target.value;
        });
    }

    // ── F. Step‑by‑Step Button Listeners (UPDATED)───────
    // Next from Step 2 (Party Selection) to Step 3 (Meals) or 4 (Message)
    document.getElementById("to-meal-step").addEventListener("click", () => {
        const choices = Object.values(rsvpChoices);
        const allResponded = choices.every(choice => choice.rsvp !== null);
        if (!allResponded) {
            alert("Please select 'Accept' or 'Decline' for every guest.");
            return;
        }
        const anyoneAccepted = choices.some(choice => choice.rsvp === "Accept");
        showStep(anyoneAccepted ? 3 : 4); // Go to 3 if anyone accepted, else skip to 4
    });

    // Next from Step 3 (Meals) to Step 4 (Message)
    document.getElementById("to-message-step").addEventListener("click", () => {
        // Optional: Add validation here to ensure accepted guests selected a meal
        const mealsValid = acceptedMembers.every(name => rsvpChoices[name] && rsvpChoices[name].mealChoice);
        if (!mealsValid) {
             alert("Please select a meal choice for every guest attending.");
             return;
        }
        showStep(4);
    });

    // Next from Step 4 (Message) to Step 5 (Phone) - (NEW BUTTON ID from HTML change)
    document.getElementById("to-phone-step").addEventListener("click", () => {
        showStep(5);
    });

    // Back Buttons (Generic - should work for new structure)
    document.querySelectorAll(".back-button").forEach(button => {
        button.addEventListener("click", () => {
            showStep(currentStep - 1);
        });
    });

    // ── G. Recap Generation (Keep as is) ──────────────────
    function generateRecap(records) {
        let recapHTML = `<div class="recap-container">`;
        // RSVP Status Section
        recapHTML += `<div class="recap-section rsvp-status-section"><h3>Wedding RSVP</h3><ul class="rsvp-status-list">`;
        records.forEach(record => {
            const { fullName, weddingRSVP } = record.fields;
            let icon = weddingRSVP === "Accept" ? '✔' : (weddingRSVP === "Decline" ? '❌' : '?');
            let statusClass = weddingRSVP === "Accept" ? 'status-accept' : (weddingRSVP === "Decline" ? 'status-decline' : 'status-pending');
            recapHTML += `<li class="${statusClass}"><span class="recap-icon ${statusClass.split('-')[1]}">${icon}</span> ${fullName}</li>`;
        });
        recapHTML += `</ul></div>`;
        // Meal Selections Section
        const acceptedWithMeals = records.filter(r => r.fields.weddingRSVP === "Accept" && r.fields.mealPreference);
        if (acceptedWithMeals.length > 0) {
            recapHTML += `<div class="recap-section meal-section"><h3>Meal Selections</h3><ul class="meal-list">`;
            acceptedWithMeals.forEach(record => {
                const firstName = record.fields.fullName.split(' ')[0];
                recapHTML += `<li><span class="recap-icon meal">🍽</span> ${firstName} – ${record.fields.mealPreference}</li>`;
            });
            recapHTML += `</ul></div>`;
        }
        // Dietary Notes Section
        const anyoneAccepted = records.some(r => r.fields.weddingRSVP === "Accept");
        if (anyoneAccepted) {
            const guestsWithNotes = records.filter(r => r.fields.dietaryNotes && r.fields.dietaryNotes.trim() !== "");
            const guestsWithoutNotes = records.filter(r => r.fields.weddingRSVP === "Accept" && (!r.fields.dietaryNotes || r.fields.dietaryNotes.trim() === "")).length > 0;
             if (guestsWithNotes.length > 0 || guestsWithoutNotes) { // Show section if notes exist or if summary needed
                recapHTML += `<div class="recap-section notes-section"><h3>Dietary Notes</h3>`;
                if (guestsWithNotes.length > 0) {
                    recapHTML += `<ul class="notes-list">`;
                    guestsWithNotes.forEach(record => {
                        const firstName = record.fields.fullName.split(' ')[0];
                        recapHTML += `<li><span class="recap-icon notes">💬</span> ${firstName} – ${record.fields.dietaryNotes}</li>`;
                    });
                    recapHTML += `</ul>`;
                }
                if (guestsWithoutNotes && acceptedMembers.length > guestsWithNotes.length) { // Add summary if some accepted guests had no notes
                    recapHTML += `<p class="notes-summary">(Guests without notes: None provided)</p>`;
                }
                recapHTML += `</div>`;
            }
        }
        recapHTML += `</div>`; // Close recap-container
        return recapHTML;
    }

    // ── H. Show Confirmation Page (UPDATED) ─────────────
    function showRSVPConfirmation(records, isJustSubmitted = false) {
        const recapHTML = generateRecap(records);
        const recapElement = document.getElementById("confirmation-recap");
        const mainMessageElement = document.getElementById("confirmation-main-message");
        const subMessageElement = document.getElementById("confirmation-sub-message");

        if (recapElement) recapElement.innerHTML = recapHTML;
        else console.error("Cannot find #confirmation-recap element!");

        if (mainMessageElement) {
             mainMessageElement.textContent = isJustSubmitted ? "RSVP Submitted!" : "Welcome back!";
        } else console.error("Cannot find #confirmation-main-message element!");

        if (subMessageElement) {
            subMessageElement.textContent = isJustSubmitted ? "Here's what we have down for your group:" : "Review your RSVP details below or make changes if needed.";
        } else console.error("Cannot find #confirmation-sub-message element!");

        showStep(6); // <<< CHANGED: Show Step 6 for confirmation
    }


    // ── I. Form Submit Logic (UPDATED) ─────────────────
    form.addEventListener("submit", async e => {
        e.preventDefault(); // Prevent default form submission

        // —— Step 1: Name Lookup (Submit handled by button type="submit" on Step 1)
        if (currentStep === 1) {
            errorMessageDiv.textContent = "";
            const name = guestNameInput.value.trim();
            if (!name) {
                errorMessageDiv.textContent = "Please enter your name to continue.";
                return;
            }

            // Disable button and show loading
            if (step1SubmitButton) {
                step1SubmitButton.disabled = true;
                step1SubmitButton.textContent = 'Finding...';
            }
            guestNameInput.disabled = true;

            try {
                // Fetch the single record to learn the party ID
                 const resp1 = await fetch(
                    `https://api.airtable.com/v0/app31oPmGDUIxWmvf/RSVP%20Responses?maxRecords=1&filterByFormula=OR(FIND(LOWER("${name}"),LOWER(fullName)),FIND(LOWER("${name}"),LOWER(altNames)))`,
                    { headers: { Authorization: `Bearer patvhQFVk64q2Bxbx.fe59112ee4ca237d7dd233e506cc7345b26bbf020754fd437c133b862ad09f6f` } }
                );
                 const json1 = await resp1.json();

                 if (!resp1.ok) throw new Error(`Airtable API error: ${resp1.status}`);
                 if (!json1.records || json1.records.length === 0) {
                    errorMessageDiv.textContent = "We couldn’t find your name. Please check spelling or reach out.";
                    // Re-enable controls
                    if (step1SubmitButton) {
                        step1SubmitButton.disabled = false;
                        step1SubmitButton.textContent = step1OriginalButtonText;
                    }
                    guestNameInput.disabled = false;
                    return;
                 }

                // Store submitter's record ID and party ID
                submitterRecordId = json1.records[0].id;
                partyId = json1.records[0].fields.party;

                // Fetch all members with the same party ID
                const resp2 = await fetch(
                    `https://api.airtable.com/v0/app31oPmGDUIxWmvf/RSVP%20Responses?filterByFormula={party}="${partyId}"`,
                    { headers: { Authorization: `Bearer patvhQFVk64q2Bxbx.fe59112ee4ca237d7dd233e506cc7345b26bbf020754fd437c133b862ad09f6f` } }
                );
                const json2 = await resp2.json();
                if (!resp2.ok) throw new Error(`Airtable API error fetching party: ${resp2.status}`);

                 // Check if the party has already submitted an RSVP
                const existingResponse = json2.records.find(r => r.fields.weddingRSVP);
                if (existingResponse && !window.location.search.includes('force_update=true')) { // Added check to allow forcing update if needed
                    fetchedRecords = json2.records;
                    showRSVPConfirmation(json2.records, false); // Show existing recap (Step 6)
                } else {
                    // New RSVP or forced update: Reset state and proceed
                    rsvpChoices = {};
                    acceptedMembers = [];
                    fetchedRecords = json2.records;
                    const partyMembers = json2.records.map(r => ({
                        id: r.id,
                        fullName: r.fields.fullName
                    }));
                    displayPartyMembers(partyMembers);
                    showStep(2); // Go to party selection
                }

            } catch (error) {
                console.error("Error in Step 1:", error);
                errorMessageDiv.textContent = "An error occurred. Please try again.";
                 // Re-enable controls
                if (step1SubmitButton) {
                    step1SubmitButton.disabled = false;
                    step1SubmitButton.textContent = step1OriginalButtonText;
                }
                guestNameInput.disabled = false;
            }
            return; // Stop processing after Step 1 submit
        } // End Step 1 Submit Logic

        // —— Step 5: Final RSVP Submission (Submit handled by button type="submit" on Step 5)
        if (currentStep === 5) {
            console.log("Submitting final RSVP from Step 5...");

            // Get phone number from Step 5 input
            const finalPhoneNumber = guestPhoneInput.value.trim();

            // Re-validate meal choices for accepted guests
            const mealsValid = acceptedMembers.every(name => rsvpChoices[name] && rsvpChoices[name].mealChoice);
            if (!mealsValid) {
                alert("Something went wrong. Please ensure meal choices are selected for attending guests.");
                // Consider sending user back to Step 3: showStep(3);
                return;
            }

            // Add loading state to submit button if needed
            const step5SubmitButton = document.querySelector('#step-5 button[type="submit"]');
            if (step5SubmitButton) step5SubmitButton.disabled = true;


            const message = document.getElementById("messageToHosts").value; // Get message from Step 4
            const submissionTimestamp = new Date().toISOString();

            try {
                 // Perform Airtable PATCH requests
                 await Promise.all(
                    Object.entries(rsvpChoices).map(([name, { rsvp, mealChoice, dietaryNotes }]) => {
                        const rec = fetchedRecords.find(r => r.fields.fullName === name);
                        if (!rec) return Promise.resolve(); // Skip if record missing

                        const fieldsToUpdate = {
                            weddingRSVP: rsvp,
                            mealPreference: rsvp === "Accept" ? (mealChoice || "") : "", // Only save meal if accepting
                            dietaryNotes: rsvp === "Accept" ? (dietaryNotes || "") : "", // Only save notes if accepting
                            Message: message,
                            Is_submitter: (rec.id === submitterRecordId)
                        };

                        // If this is the submitter's record, add phone and timestamp
                        if (rec.id === submitterRecordId) {
                            fieldsToUpdate.submitterPhoneNumber = finalPhoneNumber;
                            fieldsToUpdate.lastSubmissionTime = submissionTimestamp;
                        }

                        return fetch(
                            `https://api.airtable.com/v0/app31oPmGDUIxWmvf/RSVP%20Responses/${rec.id}`,
                            {
                                method: "PATCH",
                                headers: {
                                    Authorization: "Bearer patvhQFVk64q2Bxbx.fe59112ee4ca237d7dd233e506cc7345b26bbf020754fd437c133b862ad09f6f",
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({ fields: fieldsToUpdate })
                            }
                        ).then(response => {
                             if (!response.ok) console.error(`Failed to update record for ${name}`);
                             // return response.json(); // Optional: process response
                        });
                    })
                );

                console.log("Airtable updates complete.");

                // Re-fetch records to show the absolute latest data in confirmation
                 const freshResp = await fetch(
                    `https://api.airtable.com/v0/app31oPmGDUIxWmvf/RSVP%20Responses?filterByFormula={party}="${partyId}"`,
                    { headers: { Authorization: `Bearer patvhQFVk64q2Bxbx.fe59112ee4ca237d7dd233e506cc7345b26bbf020754fd437c133b862ad09f6f` } }
                );
                const freshJson = await freshResp.json();
                if (!freshResp.ok) throw new Error("Failed to re-fetch records.");
                if (freshJson.records) {
                    fetchedRecords = freshJson.records;
                }

                // Show confirmation (Step 6)
                showRSVPConfirmation(fetchedRecords, true);

            } catch (error) {
                console.error("Error during Step 5 submission:", error);
                alert("An error occurred while submitting your RSVP. Please try again.");
                 if (step5SubmitButton) step5SubmitButton.disabled = false; // Re-enable button on error
            }
            return; // Stop processing after Step 5 submit
        } // End Step 5 Submit Logic

    }); // End Form Submit Listener


    // ── J. Step 6 (Confirmation) Button Listeners (UPDATED) ──────
    // Update Response Button (on Step 6)
    document.getElementById("update-response-button").addEventListener("click", () => {
        if (!fetchedRecords || fetchedRecords.length === 0) {
            console.error("Cannot update response: fetchedRecords is empty.");
            alert("An error occurred. Please refresh and try again.");
            return;
        }

        console.log("Update Response clicked. Repopulating state from:", fetchedRecords);

        // 1. Reset temporary state and UI elements
        rsvpChoices = {};
        acceptedMembers = [];
        document.getElementById("party-members").innerHTML = ''; // Clear step 2 display
        document.getElementById("member-meal-choices").innerHTML = ""; // Clear step 3 display

        // 2. Rebuild Step 2 display structure
        const partyMembersForDisplay = fetchedRecords.map(record => ({
            id: record.id,
            fullName: record.fields.fullName
        }));
        displayPartyMembers(partyMembersForDisplay); // Creates divs, names, buttons

        // 3. Repopulate state and UI based on fetchedRecords
        const selectedStyle = { bgColor: '#ffffff', textColor: '#707f5b', fontWeight: 'bold' };
        const unselectedStyle = { bgColor: 'transparent', textColor: '#ffffff', fontWeight: 'normal' };

        fetchedRecords.forEach(record => {
            const memberName = record.fields.fullName;
            const currentRSVP = record.fields.weddingRSVP;
            const currentMeal = record.fields.mealPreference;
            const currentNotes = record.fields.dietaryNotes;

            // Update internal state (rsvpChoices)
            rsvpChoices[memberName] = {
                rsvp: currentRSVP,
                mealChoice: currentMeal || null,
                dietaryNotes: currentNotes || ""
            };

            // Find the UI elements for this member in Step 2
            const memberDiv = Array.from(partyMembersDiv.children).find(div =>
                div.querySelector("span").textContent === memberName
            );
            if (!memberDiv) return; // Skip if element not found

            const acceptButton = memberDiv.querySelector(".accept-button");
            const declineButton = memberDiv.querySelector(".decline-button");

            // Update button styles
            if (currentRSVP === "Accept") {
                 Object.assign(acceptButton.style, selectedStyle);
                 Object.assign(declineButton.style, unselectedStyle);

                 // Add to accepted members list and display meal choices in Step 3
                 if (!acceptedMembers.includes(memberName)) {
                     acceptedMembers.push(memberName);
                 }
                 // Need to pass something displayMealChoices understands, like { fullName: memberName }
                 displayMealChoices({ fullName: memberName }); // Recreate meal section

                 // Populate the meal choice section
                 const mealChoiceDiv = document.querySelector(`#member-meal-choices .meal-choice[data-name="${memberName}"]`);
                 if (mealChoiceDiv) {
                    const mealInput = mealChoiceDiv.querySelector(`input[name="meal-${memberName}"][value="${currentMeal}"]`);
                    if (mealInput) mealInput.checked = true;
                    const notesTextarea = mealChoiceDiv.querySelector(`textarea[name="diet-${memberName}"]`);
                    if (notesTextarea) notesTextarea.value = currentNotes || "";
                 }

            } else if (currentRSVP === "Decline") {
                Object.assign(declineButton.style, selectedStyle);
                Object.assign(acceptButton.style, unselectedStyle);
            } else { // No RSVP recorded
                Object.assign(acceptButton.style, unselectedStyle);
                Object.assign(declineButton.style, unselectedStyle);
            }
        });

        // 4. Navigate back to Step 2
        console.log("Repopulation complete. Showing Step 2.");
        showStep(2);
    });

    // Finish Button (on Step 6)
    document.getElementById("finish-button").addEventListener("click", () => {
        form.reset(); // Clear form inputs
        // Reset internal state completely
        rsvpChoices = {};
        acceptedMembers = [];
        fetchedRecords = [];
        partyId = null;
        submitterRecordId = null;
        // Clear dynamic UI sections
        partyMembersDiv.innerHTML = '';
        document.getElementById("member-meal-choices").innerHTML = '';
        // Go back to the start
        showStep(1);
    });

    // ── K. Kick it off at Step 1 ──────────────────────
    showStep(1);

}); // End DOMContentLoaded Wrapper