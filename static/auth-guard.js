console.log("AUTH GUARD LOADED");

(async function () {
  try {
    console.log("SUPABASE_URL:", window.SUPABASE_URL);
    const supabaseClient = window.supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_ANON_KEY
    );
    const { data } = await supabaseClient.auth.getSession();
    console.log("SESSION:", data?.session);

    if (!data?.session) window.location.replace("/login");
  } catch (e) {
    console.error("AUTH GUARD ERROR", e);
    window.location.replace("/login");
  }
})();
