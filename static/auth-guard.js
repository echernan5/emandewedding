console.log("AUTH GUARD LOADED");

(async function () {
  try {
    const supabaseClient = window.supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_ANON_KEY
    );

    const { data, error } = await supabaseClient.auth.getSession();

    const session = data?.session;

    if (error) {
      console.error("AUTH GUARD SESSION ERROR", error);
    }

    // Not logged in -> go to login
    if (!session) {
      window.location.replace("/login");
      return;
    }

    // ✅ THIS is the missing piece:
    // Save the token so dashboard.js can include it in /api requests
    window.AppAuth = window.AppAuth || {};
    window.AppAuth.token = session.access_token;

    // Optional but recommended: keep token updated if it refreshes
    supabaseClient.auth.onAuthStateChange((_event, newSession) => {
      if (newSession?.access_token) {
        window.AppAuth.token = newSession.access_token;
      }
    });

    console.log("AUTH OK: token set");
  } catch (e) {
    console.error("AUTH GUARD ERROR", e);
    window.location.replace("/login");
  }
})();