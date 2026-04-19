// Handles Spotify OAuth: login URL, code exchange, token refresh
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
].join(" ");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const CLIENT_ID = Deno.env.get("SPOTIFY_CLIENT_ID");
  const CLIENT_SECRET = Deno.env.get("SPOTIFY_CLIENT_SECRET");

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return new Response(
      JSON.stringify({ error: "Spotify credentials not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const { action, code, redirect_uri, refresh_token } = body;

    if (action === "login") {
      if (!redirect_uri || typeof redirect_uri !== "string") {
        return new Response(
          JSON.stringify({ error: "redirect_uri required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const state = crypto.randomUUID();
      const url = new URL("https://accounts.spotify.com/authorize");
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", CLIENT_ID);
      url.searchParams.set("scope", SCOPES);
      url.searchParams.set("redirect_uri", redirect_uri);
      url.searchParams.set("state", state);
      return new Response(
        JSON.stringify({ url: url.toString(), state }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "exchange") {
      if (!code || !redirect_uri) {
        return new Response(
          JSON.stringify({ error: "code and redirect_uri required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const params = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri,
      });
      const basic = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
      const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) {
        console.error("Spotify token exchange failed:", tokenData);
        return new Response(
          JSON.stringify({ error: tokenData.error_description || "Token exchange failed" }),
          { status: tokenRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify(tokenData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "refresh") {
      if (!refresh_token) {
        return new Response(
          JSON.stringify({ error: "refresh_token required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const params = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token,
      });
      const basic = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
      const refreshRes = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
      const refreshData = await refreshRes.json();
      if (!refreshRes.ok) {
        console.error("Spotify token refresh failed:", refreshData);
        return new Response(
          JSON.stringify({ error: refreshData.error_description || "Token refresh failed" }),
          { status: refreshRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify(refreshData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("spotify-auth error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
