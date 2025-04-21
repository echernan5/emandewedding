// RSVP.js

document.addEventListener("DOMContentLoaded", () => {
    // ──  A. State & Elements  ──────────────────────────
    let currentStep     = 1;
    let fetchedRecords  = [];             // ◀︎ store Airtable records for Step 4
    let acceptedMembers = [];
    let rsvpChoices     = {};
    let partyId      = null;
    const form               = document.getElementById("multi-step-form");
    const guestNameInput    = document.getElementById("guest-name");
    const partyMembersDiv   = document.getElementById("party-members");
    const errorMessageDiv   = document.getElementById("error-message");
  
    // ──  B. Helper: show one step at a time  ──────────
    function showStep(step) {
      document.querySelectorAll(".form-step").forEach((el,i) => {
        el.classList.toggle("active", i === step-1);
      }, false);
      currentStep = step;
    }
  
    // ──  C. Display party members  ────────────────────
    function displayPartyMembers(members) {
      partyMembersDiv.innerHTML = "";       // clear old
      document.getElementById("member-meal-choices").innerHTML = "";  // clear previous meal choices
      members.forEach(member => {
        rsvpChoices[member.fullName] = { rsvp: null, mealChoice: null };
        const div = document.createElement("div");
        div.className = "party-member";
        div.innerHTML = `
          <span>${member.fullName}</span>
          <button class="accept-button">Accept</button>
          <button class="decline-button">Decline</button>
        `;
        // Accept / Decline
        div.querySelector(".accept-button")
           .addEventListener("click", () => handleRSVP(member, "Accept"));
        div.querySelector(".decline-button")
           .addEventListener("click", () => handleRSVP(member, "Decline"));
        partyMembersDiv.append(div);
      });
    }
  
    // ──  D. Handle RSVP click  ────────────────────────
    function handleRSVP(member, choice) {
      rsvpChoices[member.fullName] = { rsvp: choice, mealChoice: null };
      if (choice === "Accept" && !acceptedMembers.includes(member.fullName)) {
        acceptedMembers.push(member.fullName);
        displayMealChoices(member);
      }
      if (choice === "Decline") {
        acceptedMembers = acceptedMembers.filter(n => n!==member.fullName);
        document.getElementById("member-meal-choices")
                .querySelectorAll(`.meal-choice[data-name="${member.fullName}"]`)
                .forEach(el => el.remove());
      }
      // --- NEW: Style Buttons ---
        // Find the specific div for the member being updated
        const memberDiv = Array.from(partyMembersDiv.children).find(div =>
            div.querySelector("span").textContent === member.fullName
        );

        if (memberDiv) {
            const acceptBtn = memberDiv.querySelector(".accept-button");
            const declineBtn = memberDiv.querySelector(".decline-button");

            // Define the styles clearly
            const selectedStyle = {
                bgColor: '#ffffff',    // White background
                textColor: '#707f5b',  // Green text
                fontWeight: 'bold'
            };
            const unselectedStyle = {
                bgColor: 'transparent', // Transparent background
                textColor: '#ffffff',   // White text
                fontWeight: 'normal'
            };

            if (choice === "Accept") {
                // Style Accept button as selected
                acceptBtn.style.backgroundColor = selectedStyle.bgColor;
                acceptBtn.style.color = selectedStyle.textColor;
                acceptBtn.style.fontWeight = selectedStyle.fontWeight;

                // Style Decline button as unselected
                declineBtn.style.backgroundColor = unselectedStyle.bgColor;
                declineBtn.style.color = unselectedStyle.textColor;
                declineBtn.style.fontWeight = unselectedStyle.fontWeight;

            } else { // choice === "Decline"
                // Style Accept button as unselected
                acceptBtn.style.backgroundColor = unselectedStyle.bgColor;
                acceptBtn.style.color = unselectedStyle.textColor;
                acceptBtn.style.fontWeight = unselectedStyle.fontWeight;

                // Style Decline button as selected
                declineBtn.style.backgroundColor = selectedStyle.bgColor;
                declineBtn.style.color = selectedStyle.textColor;
                declineBtn.style.fontWeight = selectedStyle.fontWeight;
            }
        }

    }
  
    // ──  E. Show meal choices ──────────────────────────
    function displayMealChoices(member) {
        const container = document.getElementById("member-meal-choices");
        const div = document.createElement("div");
        div.className = "meal-choice";
        div.dataset.name = member.fullName;
      
        div.innerHTML = `
          <strong>${member.fullName}</strong><br>
          <label><input type="radio" name="meal-${member.fullName}" value="Chicken"> Chicken</label>
          <label><input type="radio" name="meal-${member.fullName}" value="Steak"> Steak</label>
          <label><input type="radio" name="meal-${member.fullName}" value="Vegetarian"> Vegetarian</label><br>
          <label>Dietary Notes:</label>
          <textarea name="diet-${member.fullName}" rows="2" cols="40"></textarea>
        `;
      
        container.append(div);
      
        div.addEventListener("change", e => {
          if (e.target.name === `meal-${member.fullName}`) {
            rsvpChoices[member.fullName].mealChoice = e.target.value;
          }
        });
      
        div.querySelector(`textarea[name="diet-${member.fullName}"]`).addEventListener("input", e => {
          rsvpChoices[member.fullName].dietaryNotes = e.target.value;
        });
      }
      
  
    // ──  F. Step‑by‑Step Button Listeners  ────────────
     document.getElementById("to-meal-step")
        .addEventListener("click", () => {
            // Check if at least one RSVP is "Accept" before proceeding
            const hasAcceptedRSVP = Object.values(rsvpChoices).some(choice => choice.rsvp === "Accept");

            if (!hasAcceptedRSVP) {
            alert("Please RSVP 'Accept' for at least one guest to proceed to meal selection.");
            return; // Stop the transition to Step 3
            }

            showStep(3); // Proceed to Step 3 if validation passes
        });

        document.getElementById("to-message-step")
         .addEventListener("click", () => showStep(4));

        // Add event listeners for all "Back" buttons
         document.querySelectorAll(".back-button").forEach(button => {
            button.addEventListener("click", (event) => {
                // Get the current active step
                const currentActiveStep = parseInt(
                    Array.from(document.querySelectorAll(".form-step"))
                        .find(el => el.classList.contains("active"))
                        .id.split('-')[1] // Extract the step number from the ID (e.g., "step-2" -> 2)
                );
                showStep(currentActiveStep - 1); // Go to the previous step
            });
         });


      function showRSVPConfirmation(records) {
        const recapHTML = generateRecap(records); // Generate recap from stored records
        document.getElementById("confirmation-recap").innerHTML = recapHTML;
      
        // Show the confirmation step and update message
        const confirmationMessage = document.getElementById("confirmation-message");
        const alreadySubmitted = records.some(record => record.fields.weddingRSVP);
      
        confirmationMessage.textContent = alreadySubmitted
          ? "Welcome back! Here's a quick recap of your RSVP."
          : "RSVP Submitted! Here's a quick recap of your response.";
      
        showStep(5); // Show the confirmation step (RSVP Submitted page)
      }

     // Generate Recap Fucntion 
     function generateRecap(records) {
        let recapHTML = `<strong>Your RSVP Summary:</strong><br>`;
        
        records.forEach(record => {
          const { fullName, weddingRSVP, mealPreference, dietaryNotes } = record.fields;
          recapHTML += `<br><strong>${fullName}</strong>: ${weddingRSVP || "No response"}`;
      
          if (weddingRSVP === "Accept") {
            recapHTML += `<br>Meal: ${mealPreference || "Not selected"}<br>`;
            recapHTML += `Dietary Notes: ${dietaryNotes || "None"}<br>`;
          }
        });
        
        return recapHTML;
      }
      
  
    // ──  G. Form Submit: Step 1 & Step 4 Logic  ───────
    form.addEventListener("submit", async e => {
      e.preventDefault();
  
      // —— Step 1: Name lookup
      if (currentStep === 1) {
        const name = guestNameInput.value.trim();
        if (!name) {
          return errorMessageDiv.textContent = "Please enter your name.";
        }
        errorMessageDiv.textContent = "";
      
        // 1️⃣ Fetch the single record to learn the party ID
        const resp1 = await fetch(
          `https://api.airtable.com/v0/app31oPmGDUIxWmvf/RSVP%20Responses?` +
          `filterByFormula=OR(` +
            `FIND(LOWER("${name}"),LOWER(fullName)),` +
            `FIND(LOWER("${name}"),LOWER(altNames))` +
          `)`,
          { headers: { Authorization: `Bearer patvhQFVk64q2Bxbx.fe59112ee4ca237d7dd233e506cc7345b26bbf020754fd437c133b862ad09f6f` } }
        );
        const json1 = await resp1.json();

        // No match?
        if (!json1.records.length) {
            errorMessageDiv.textContent = "We couldn’t find your name on the guest list. Double-check your spelling, or reach out if you think we made a mistake—we’d love to help! 💌";
            console.log("Error message set:", errorMessageDiv.textContent); // Debugging log
            return;
          }
      

        // Log the party field to see what it contains
        console.log(json1.records[0].fields.party);
      
        // 2️⃣ Grab the party ID from that record
        partyId = json1.records[0].fields.party; // <-- STORE IT HERE
      
        // 3️⃣ Fetch *all* members with the same party ID
        const resp2 = await fetch(
          `https://api.airtable.com/v0/app31oPmGDUIxWmvf/RSVP%20Responses?` +
          `filterByFormula={party}="${partyId}"`,
          { headers: { Authorization: `Bearer patvhQFVk64q2Bxbx.fe59112ee4ca237d7dd233e506cc7345b26bbf020754fd437c133b862ad09f6f` } }
        );
        const json2 = await resp2.json();

        console.log(json2);

        // Check if the party has already submitted an RSVP
        const existingResponse = json2.records.find(r => r.fields.weddingRSVP); // check for RSVP status
        if (existingResponse) {
            // Guest has already submitted, skip to the confirmation page
            fetchedRecords = json2.records; // ⭐️ IMPORTANT: Store the records here!
            showRSVPConfirmation(json2.records); // Call the function to show the confirmation
            return;
            }
      
        // Store these for Step 4 and build your party member list
        fetchedRecords = json2.records;
        const partyMembers = json2.records.map(r => ({
          id: r.id,
          fullName: r.fields.fullName
        }));
      
        displayPartyMembers(partyMembers);
        showStep(2);
        return;
      }      
  
      // —— Step 4: Submit RSVP to Airtable
      if (currentStep === 4) {
        const message = document.getElementById("messageToHosts").value;

        // ✅ Validate meal choice for each accepted guest
        for (const [name, { rsvp, mealChoice }] of Object.entries(rsvpChoices)) {
            if (rsvp === "Accept" && !mealChoice) {
            alert(`Please select a meal for ${name}.`);
            return; // stop submission
            }
        }
  
        await Promise.all(
          Object.entries(rsvpChoices).map(([name, {rsvp, mealChoice, dietaryNotes}]) => {
            const rec = fetchedRecords.find(r=>r.fields.fullName===name);
            return fetch(
              `https://api.airtable.com/v0/app31oPmGDUIxWmvf/RSVP%20Responses/${rec.id}`,
              {
                method: "PATCH",
                headers: {
                  Authorization:   "Bearer patvhQFVk64q2Bxbx.fe59112ee4ca237d7dd233e506cc7345b26bbf020754fd437c133b862ad09f6f",
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  fields: {
                    weddingRSVP:   rsvp,
                    mealPreference: mealChoice || "",
                    dietaryNotes:   dietaryNotes || "",
                    Message:        message
                  }
                })
              }
            );
          })
        );

        try {
            console.log("Re-fetching records after update for party ID:", partyId);
            const freshResp = await fetch(
                `https://api.airtable.com/v0/app31oPmGDUIxWmvf/RSVP%20Responses?` +
                `filterByFormula={party}="${partyId}"`, // Use the stored partyId
                { headers: { Authorization: `Bearer patvhQFVk64q2Bxbx.fe59112ee4ca237d7dd233e506cc7345b26bbf020754fd437c133b862ad09f6f` } }
            );
            const freshJson = await freshResp.json();
            if (freshJson.records) {
                fetchedRecords = freshJson.records; // Update fetchedRecords with the latest data
                console.log("Updated fetchedRecords:", fetchedRecords);
            } else {
                console.error("Failed to re-fetch records after update.");
                // Decide how to handle this - maybe show previous data anyway?
            }
        } catch (error) {
            console.error("Error re-fetching records:", error);
            // Handle error - maybe alert the user or proceed with potentially stale data
        }
  
            // Step 5: Show the confirmation recap
            // --- Corrected code ---
            // Step 5: Show the confirmation using the potentially updated records
            showRSVPConfirmation(fetchedRecords); // Use the updated fetchedRecords here
            return; // Exit the submit handler
            // --- End Corrected code ---
        }
    });

      // ──  I. Add listeners for your new buttons on Step 5 ──
        document.getElementById("update-response-button").addEventListener("click", () => {
            if (!fetchedRecords || fetchedRecords.length === 0) {
                // Safety check: Should not happen if Step 5 displayed correctly
                console.error("Cannot update response: fetchedRecords is empty.");
                alert("An error occurred. Please refresh and try again.");
                return;
            }

            console.log("Update Response clicked. Preparing to go back to Step 2.");
            console.log("Data to repopulate from:", fetchedRecords);

            // 1. Reset temporary state variables that track user choices *during* editing
            rsvpChoices = {};
            acceptedMembers = [];
            document.getElementById("member-meal-choices").innerHTML = ""; // Clear old meal choices visually

            // 2. Display the basic structure for Step 2
            // We map just the names needed for the initial display structure
            const partyMembersForDisplay = fetchedRecords.map(record => ({
                id: record.id, // Keep the ID, might be useful later
                fullName: record.fields.fullName
            }));

            displayPartyMembers(partyMembersForDisplay); // This creates the divs and buttons

            // --- ADD THIS BLOCK START ---
            // Define the styles clearly (needed for repopulating)
            const selectedStyle = {
                bgColor: '#ffffff',    // White background
                textColor: '#707f5b',  // Green text
                fontWeight: 'bold'
            };
            const unselectedStyle = {
                bgColor: 'transparent', // Transparent background
                textColor: '#ffffff',   // White text
                fontWeight: 'normal'
            };
            // --- ADD THIS BLOCK END ---

            fetchedRecords.forEach(record => {
                const memberName = record.fields.fullName;
                const currentRSVP = record.fields.weddingRSVP; // "Accept" or "Decline"
                const currentMeal = record.fields.mealPreference;
                const currentNotes = record.fields.dietaryNotes;
                console.log(`Processing <span class="math-inline">\{memberName\}\: RSVP\=</span>{currentRSVP}, Meal=${currentMeal}`);

                // Find the UI elements for this member in Step 2
                const memberDiv = Array.from(partyMembersDiv.children).find(div =>
                    div.querySelector("span").textContent === memberName
                );
                console.log(`Found memberDiv for ${memberName}:`, memberDiv);

                if (!memberDiv) {
                    console.warn(`Could not find div for member: ${memberName} in Step 2`);
                    return; // Skip if the element wasn't found
                }

                const acceptButton = memberDiv.querySelector(".accept-button");
                const declineButton = memberDiv.querySelector(".decline-button");

                // Update the internal state (rsvpChoices)
                rsvpChoices[memberName] = {
                    rsvp: currentRSVP,
                    mealChoice: currentMeal || null, // Store meal/notes even if declined (won't be used unless they switch to Accept)
                    dietaryNotes: currentNotes || ""
                };

                 // Visually update Step 2 buttons using the CONSISTENT style objects
                if (currentRSVP === "Accept") {
                    // Style Accept button as selected
                    acceptButton.style.backgroundColor = selectedStyle.bgColor; // Use object
                    acceptButton.style.color = selectedStyle.textColor;       // Use object
                    acceptButton.style.fontWeight = selectedStyle.fontWeight; // Use object

                    // Style Decline button as unselected (Explicitly)
                    declineButton.style.backgroundColor = unselectedStyle.bgColor; // Use object
                    declineButton.style.color = unselectedStyle.textColor;         // Use object
                    declineButton.style.fontWeight = unselectedStyle.fontWeight;   // Use object

                    // Add to accepted members list and display their meal choices in Step 3
                    if (!acceptedMembers.includes(memberName)) {
                        acceptedMembers.push(memberName);
                    }
                    // Pass the whole record.fields, which includes fullName etc. needed by displayMealChoices
                    displayMealChoices(record.fields);

                    // Now, populate the meal choice section we just created - KEEP THIS
                    const mealChoiceDiv = document.querySelector(`#member-meal-choices .meal-choice[data-name="${memberName}"]`);
                    console.log(`Found mealChoiceDiv for ${memberName}:`, mealChoiceDiv);
                    if (mealChoiceDiv) {
                            const mealInput = mealChoiceDiv.querySelector(`input[name="meal-${memberName}"][value="${currentMeal}"]`);
                            console.log(`Found mealInput for ${memberName} - ${currentMeal}:`, mealInput);
                            if (mealInput) {
                                mealInput.checked = true;
                            }
                            const notesTextarea = mealChoiceDiv.querySelector(`textarea[name="diet-${memberName}"]`);
                            if (notesTextarea) {
                                notesTextarea.value = currentNotes || "";
                            }
                        } else {
                            console.warn(`Could not find meal choice div for accepted member: ${memberName}`);
                        }

                } else if (currentRSVP === "Decline") {
                    // Style Decline button as selected
                    declineButton.style.backgroundColor = selectedStyle.bgColor; // Use object
                    declineButton.style.color = selectedStyle.textColor;       // Use object
                    declineButton.style.fontWeight = selectedStyle.fontWeight; // Use object

                    // Style Accept button as unselected (Explicitly)
                    acceptButton.style.backgroundColor = unselectedStyle.bgColor; // Use object
                    acceptButton.style.color = unselectedStyle.textColor;         // Use object
                    acceptButton.style.fontWeight = unselectedStyle.fontWeight;   // Use object

                    // Note: No need to set acceptButton.style.border here, let CSS handle the default border

                } else {
                    // No RSVP recorded - set both to unselected explicitly
                    acceptButton.style.backgroundColor = unselectedStyle.bgColor;
                    acceptButton.style.color = unselectedStyle.textColor;
                    acceptButton.style.fontWeight = unselectedStyle.fontWeight;

                    declineButton.style.backgroundColor = unselectedStyle.bgColor;
                    declineButton.style.color = unselectedStyle.textColor;
                    declineButton.style.fontWeight = unselectedStyle.fontWeight;
                }
          });

          // 4. Finally, navigate the user interface to Step 2
          console.log("Repopulation complete. Showing Step 2.");
          showStep(2);
      });

      document.getElementById("finish-button")
          .addEventListener("click", () => {
              // Reset everything and go home (step 1)
              form.reset();
              // clear out any UI from steps 2–5
              showStep(1);
          });

      // ──  H. Kick it off at Step 1  ─────────────────────
      showStep(1);

  });