// RSVP.js

document.addEventListener("DOMContentLoaded", () => {
    // ──  A. State & Elements  ──────────────────────────
    let currentStep     = 1;
    let fetchedRecords  = [];             // ◀︎ store Airtable records for Step 4
    let acceptedMembers = [];
    let rsvpChoices     = {};
    const form               = document.getElementById("multi-step-form");
    const guestNameInput    = document.getElementById("guest-name");
    const partyMembersDiv   = document.getElementById("party-members");
    const errorMessageDiv   = document.getElementById("error-message");
  
    // ──  B. Helper: show one step at a time  ──────────
    function showStep(step) {
      document.querySelectorAll(".form-step").forEach((el,i) => {
        el.classList.toggle("active", i === step-1);
      });
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
      // highlight buttons
      Array.from(partyMembersDiv.children).forEach(div => {
        if (div.querySelector("span").textContent === member.fullName) {
          div.querySelectorAll("button").forEach(btn=>{
            btn.style.fontWeight = btn.textContent===choice?"bold":"normal";
            btn.style.backgroundColor = btn.textContent===choice?"#e0e0e0":"";
          });
        }
      });
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
      .addEventListener("click", () => showStep(3));
    document.getElementById("to-message-step")
      .addEventListener("click", () => showStep(4));

    // Generate Recap Fucntion 
    function generateRecap() {
        let recapHTML = `<strong>Your RSVP Summary:</strong><br>`;
        
        Object.entries(rsvpChoices).forEach(([name, { rsvp, mealChoice, dietaryNotes }]) => {
          recapHTML += `<br><strong>${name}</strong>: ${rsvp}`;
          
          if (rsvp === "Accept") {
            recapHTML += `<br>Meal: ${mealChoice || "Not selected"}<br>`;
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

        // Log the party field to see what it contains
        console.log(json1.records[0].fields.party);
      
        // No match?
        if (!json1.records.length) {
          errorMessageDiv.textContent = "No matching guests found.";
          return;
        }
      
        // 2️⃣ Grab the party ID from that record
        const partyId = json1.records[0].fields.party;
      
        // 3️⃣ Fetch *all* members with the same party ID
        const resp2 = await fetch(
          `https://api.airtable.com/v0/app31oPmGDUIxWmvf/RSVP%20Responses?` +
          `filterByFormula={party}="${partyId}"`,
          { headers: { Authorization: `Bearer patvhQFVk64q2Bxbx.fe59112ee4ca237d7dd233e506cc7345b26bbf020754fd437c133b862ad09f6f` } }
        );
        const json2 = await resp2.json();

        console.log(json2);
      
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
  
            // Step 5: Show the confirmation recap
            showStep(5);
            const recap = generateRecap(); // Recap of the user's selections
            document.getElementById("confirmation-recap").innerHTML = recap;

            return;
        }
    });

      // ──  I. Add listeners for your new buttons on Step 5 ──
  document.getElementById("update-response-button")
  .addEventListener("click", () => {
    // Jump back to step 2 so they can tweak their choices
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
  