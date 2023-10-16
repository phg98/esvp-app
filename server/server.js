const ESVP_OPTIONS = ["Explorer", "Shopper", "Vacationer", "Prisoner"];
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
    const ESVP_ROOMS = await ESVP.get("rooms") ? JSON.parse(await ESVP.get("rooms")) : {};

    // 루트 엔드포인트에 대한 요청이 들어오면 클라이언트 HTML 반환
    if (url.pathname === '/' && request.method === 'GET') {
        return new Response("This ESVP App", {
            headers: {
                'Content-Type': 'text/html',
                ...corsHeaders
            }
        });
    } else if (url.pathname.startsWith('/create-room') && request.method === 'POST') {
        const roomId = `${Object.keys(ESVP_ROOMS).length + 1}`;
        ESVP_ROOMS[roomId] = {
            votes: {
                "Explorer": "0",
                "Shopper": "0",
                "Vacationer": "0",
                "Prisoner": "0",
            }
        };
        await ESVP.put("rooms", JSON.stringify(ESVP_ROOMS));
        return new Response(`${roomId}`, { status: 200, headers: corsHeaders });
    } else if (url.pathname === '/vote' && request.method === 'POST') {
        const data = await request.json();

        if (ESVP_OPTIONS.includes(data.vote) && data.roomId) {
            // 현재 저장된 모든 방의 정보를 가져옴
            const ESVP_ROOMS = JSON.parse(await ESVP.get("rooms") || "{}");

            // 해당 방의 정보가 있는지 확인
            if (ESVP_ROOMS[data.roomId]) {
                // 해당 방의 현재 투표 수를 가져오고 증가
                const currentVoteCount = parseInt(ESVP_ROOMS[data.roomId].votes[data.vote] || "0");
                ESVP_ROOMS[data.roomId].votes[data.vote] = (currentVoteCount + 1).toString();

                // 방의 정보를 갱신하여 저장
                await ESVP.put("rooms", JSON.stringify(ESVP_ROOMS));
                return new Response('Vote recorded', { status: 200, headers: corsHeaders });
            } else {
                return new Response('Room ID not found', { status: 404, headers: corsHeaders });
            }
        } else {
            return new Response('Invalid vote or Room ID missing', { status: 400, headers: corsHeaders });
        }
    } else if (url.pathname === '/results' && request.method === 'POST') {
        // POST 요청의 본문에서 roomId를 추출
        const requestData = await request.json();
        const roomId = requestData.roomId;
    
        if (!roomId) {
            return new Response('Room ID missing', { status: 400, headers: corsHeaders });
        }
    
        // 현재 저장된 모든 방의 정보를 가져옴
        const ESVP_ROOMS = JSON.parse(await ESVP.get("rooms") || "{}");
    
        if (ESVP_ROOMS[roomId]) {
            // 해당 방의 투표 결과 반환
            return new Response(JSON.stringify(ESVP_ROOMS[roomId].votes), {
                status: 200,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        } else {
            return new Response('Room ID not found', { status: 404, headers: corsHeaders });
        }
    }else if (url.pathname === '/reset' && request.method === 'POST') {
        const data = await request.json();
        const roomId = data.roomId;
    
        if (ESVP_ROOMS[roomId]) {
            ESVP_ROOMS[roomId].votes = {
                "Explorer": "0",
                "Shopper": "0",
                "Vacationer": "0",
                "Prisoner": "0"
            };
            await ESVP.put("rooms", JSON.stringify(ESVP_ROOMS));
            return new Response('Votes for the room reset', { status: 200, headers: corsHeaders });
        } else {
            return new Response('Invalid room ID', { status: 400, headers: corsHeaders });
        }
    } else if (request.method === "OPTIONS") {
        return handleOptions(request);
    } else {
        return new Response('Not found', { status: 404, headers: corsHeaders });
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
