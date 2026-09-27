export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // API health check
    if (url.pathname === "/api/health") {
      return json({
        success: true,
        app: "PayP2P",
        backend: "online",
        database: !!env.DB,
      }, corsHeaders);
    }

    // Basic API route
    if (url.pathname.startsWith("/api/")) {
      return json({
        success: true,
        message: "PayP2P API is working",
      }, corsHeaders);
    }

    // Serve frontend through Cloudflare Static Assets
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("PayP2P is running", {
      headers: corsHeaders,
    });
  },
};

function json(data, corsHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}
