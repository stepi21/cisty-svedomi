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
// DŮLEŽITÉ OMEZENÍ (zjištěno v provozu): Overpass API provozovatelé kvůli
// zneužívání v minulosti zablokovali части rozsahů Azure/AWS (viz OSM wiki,
// Overpass API/status) -- cloudové IP adresy (kam spadá i Supabase Edge
// Functions/Deno Deploy) tak mohou dostávat horší zacházení (502/blokace)
// než běžný prohlížeč z domácí IP adresy. Proto appka zkouší víc zrcadel
// a s prodlevou opakuje -- ale stoprocentní spolehlivost tohle nezaručí,
// je to vlastnost veřejné bezplatné služby, ne chyba v appce.
//
// Bezpečnost: appka posílá jen samotný OverpassQL dotaz (text) v těle
// požadavku -- žádná autentizace navíc není potřeba, jde o veřejná OSM
// data (stejná otevřenost jako u chmi-proxy).
// ----------------------------------------------------------------------------

const OVERPASS_SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

// Slušné představení appky -- některé instance берou popisný User-Agent
// v potaz při rozhodování, koho omezit přednostně (žádná záruka, ale
// nemá to nevýhody).
const USER_AGENT = "CistySvedomiApp/1.0 (rybarsky denik, kontakt v repozitari)";

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
      // Jeden pokus na server -- appka má teď 4 zrcadla v seznamu, takže
      // je rychlejší a spolehlivější jít hned na další server než čekat
      // a zkoušet ten samý znovu (a appka navíc na frontendu umožňuje
      // celé generování kdykoli zrušit, worst-case čekání by tak i tak
      // nemělo přerůst v řádu minut).
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        const upstream = await fetch(server, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": USER_AGENT,
          },
          body: "data=" + encodeURIComponent(query),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!upstream.ok) {
          lastError = `server odpověděl chybou ${upstream.status}`;
          continue; // jde na další server v seznamu
        }
        const text = await upstream.text();
        return new Response(text, {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        // jde na další server v seznamu
      }
    }

    return new Response(
      JSON.stringify({ error: lastError || "Všechny Overpass servery selhaly." }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  },
};
