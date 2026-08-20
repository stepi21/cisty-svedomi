// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// ----------------------------------------------------------------------------
// overpass-proxy
// ----------------------------------------------------------------------------
// Proč tohle existuje: veřejné Overpass API servery (overpass-api.de a
// zrcadla jako overpass.kumi.systems) běží na víc fyzických instancích přes
// DNS round-robin a ne všechny spolehlivě posílají CORS hlavičky
// (Access-Control-Allow-Origin) -- prohlížeč proto volání appky občas
// zablokuje úplně (i bez ohledu na to, jak appka nastaví timeout), i když
// jindy ze stejné appky/stejného místa projde. Tahle funkce běží na
// Supabase (server-server, žádné CORS) a přeposílá Overpass dotaz -- se
// stejným fallbackem na záložní server jako dřív, jen teď na straně
// serveru místo v prohlížeči, kde na CORS vůbec nezáleží.
//
// Bezpečnost: appka posílá jen samotný OverpassQL dotaz (text) v těle
// požadavku -- žádná autentizace navíc není potřeba, jde o veřejná OSM
// data (stejná otevřenost jako u chmi-proxy).
// ----------------------------------------------------------------------------

const OVERPASS_SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

export default {
  fetch: async (req: Request) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Použij POST." }), {
        status: 405,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    let query: string;
    try {
      const body = await req.json();
      query = body.query;
      if (!query || typeof query !== "string") throw new Error("missing query");
    } catch {
      return new Response(
        JSON.stringify({ error: "Chybí platné pole 'query' (text OverpassQL dotazu) v těle požadavku." }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    let lastError: string | null = null;
    for (const server of OVERPASS_SERVERS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);
        const upstream = await fetch(server, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: "data=" + encodeURIComponent(query),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!upstream.ok) {
          lastError = `server odpověděl chybou ${upstream.status}`;
          continue; // zkusí další server v seznamu
        }
        const text = await upstream.text();
        return new Response(text, {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        // zkusí další server v seznamu
      }
    }

    return new Response(
      JSON.stringify({ error: lastError || "Všechny Overpass servery selhaly." }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  },
};
