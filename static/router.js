// static/router.js

document.addEventListener("DOMContentLoaded", () => {
    // 1. Listen for ALL clicks on the document
    document.addEventListener("click", async (e) => {
        // Find if a link was clicked
        const link = e.target.closest("a");
        if (!link) return;

        const href = link.getAttribute("href");
        
        // Only intercept internal links (starts with "/")
        if (!href || !href.startsWith("/") || href.startsWith("#") || link.target === "_blank") return;

        // Stop the browser from doing a hard refresh!
        e.preventDefault();
        
        // If we are already on this page, do nothing
        if (window.location.pathname === href) return;

        // Trigger our custom navigation
        navigateTo(href);
    });

    // 2. Handle the browser's Back and Forward buttons
    window.addEventListener("popstate", () => {
        navigateTo(window.location.pathname, false);
    });
});

async function navigateTo(url, pushToHistory = true) {
    // Find the current main content area
    const currentMain = document.querySelector(".main") || document.querySelector(".main-content");
    
    // Optional: Fade out slightly to show it's loading
    if (currentMain) currentMain.style.opacity = "0.5";

    try {
        // 3. Fetch the new HTML page in the background
        const response = await fetch(url);
        if (!response.ok) throw new Error("Page not found");
        const html = await response.text();
        
        // 4. Parse the fetched HTML into a fake document
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        
        // 5. Extract the new main content
        const newMain = doc.querySelector(".main") || doc.querySelector(".main-content");
        
        if (currentMain && newMain) {
            // SWAP THE CONTENT! (The sidebar is left completely untouched)
            currentMain.replaceWith(newMain);
        }

        // 6. Update the Page Title & URL Bar
        if (doc.title) document.title = doc.title;
        if (pushToHistory) history.pushState(null, "", url);

        // 7. Update the active "highlight" state on the sidebar links
        document.querySelectorAll(".sideNav a").forEach(a => {
            if (a.getAttribute("href") === url) {
                a.classList.add("active");
            } else {
                a.classList.remove("active");
            }
        });

        // 8. Load any missing CSS files from the new page
        const existingLinks = Array.from(document.querySelectorAll("link[rel='stylesheet']")).map(l => l.href).filter(Boolean);
        doc.querySelectorAll("link[rel='stylesheet']").forEach(link => {
            if (link.href && !existingLinks.includes(link.href)) {
                const newLink = document.createElement("link");
                newLink.rel = "stylesheet";
                newLink.href = link.href;
                document.head.appendChild(newLink);
            }
        });

        // 9. Load any missing JS files from the new page
        const existingScripts = Array.from(document.querySelectorAll("script")).map(s => s.src).filter(Boolean);
        doc.querySelectorAll("script").forEach(script => {
            if (script.src && !existingScripts.includes(script.src)) {
                const newScript = document.createElement("script");
                newScript.src = script.src;
                newScript.defer = true;
                document.body.appendChild(newScript);
            }
        });

        // 10. ANNOUNCE TO THE APP THAT THE PAGE CHANGED!
        window.dispatchEvent(new CustomEvent("app:navigated"));

    } catch (err) {
        console.error("Routing error:", err);
        // Fallback: If anything breaks, just do a normal hard redirect
        window.location.href = url;
    }
}