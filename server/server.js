const ESVP_OPTIONS = ["Explorer", "Shopper", "Visitor", "Prisoner"];
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
    "Access-Control-Max-Age": "86400",
};

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
});

async function handleRequest(request) {
    const url = new URL(request.url);

    // 루트 엔드포인트에 대한 요청이 들어오면 클라이언트 HTML 반환
    if (url.pathname === '/' && request.method === 'GET') {
      return new Response(CLIENT_HTML, {
          headers: {
              'Content-Type': 'text/html',
              ...corsHeaders
          }
      });
  } else if (url.pathname === '/vote' && request.method === 'POST') {
        const data = await request.json();
        if (ESVP_OPTIONS.includes(data.vote)) {
          const currentVoteCount = parseInt(await ESVP.get(data.vote) || "0");
          await ESVP.put(data.vote, (currentVoteCount + 1).toString());
          return new Response('Vote recorded', {status: 200, headers: corsHeaders});      
        } else {
            return new Response('Invalid vote', {status: 400, headers: corsHeaders});
        }
    } else if (url.pathname === '/results' && request.method === 'GET') {
        let results = {};
        for (let option of ESVP_OPTIONS) {
            results[option] = await ESVP.get(option) || 0;
        }
        return new Response(JSON.stringify(results), {
            status: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });
    } else if (url.pathname === '/reset' && request.method === 'GET') {
      for (let option of ESVP_OPTIONS) {
          await ESVP.put(option, "0");
      }
      return new Response('All votes reset', {status: 200, headers: corsHeaders});
    } else if (request.method === "OPTIONS") {
        return handleOptions(request);
    } else {
        return new Response('Not found', {status: 404, headers: corsHeaders});
    }
}

function handleOptions(request) {
    let headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
        "Access-Control-Max-Age": "86400",
    };

    if (request.headers.get("Access-Control-Request-Headers")) {
        headers["Access-Control-Allow-Headers"] = request.headers.get("Access-Control-Request-Headers");
    }

    return new Response(null, { headers: headers });
}
