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
    try {
        const url = new URL(request.url);
        const ESVP_ROOMS = await ESVP.get("rooms") ? JSON.parse(await ESVP.get("rooms")) : {};
        const creatorIP = request.headers.get('CF-Connecting-IP');

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
                },
                adminIP: creatorIP  
            };
            await ESVP.put("rooms", JSON.stringify(ESVP_ROOMS));
            console.log(`Room ${roomId} created successfully.`);
            return new Response(`${roomId}`, { status: 200, headers: corsHeaders });
        } else if (url.pathname === '/vote' && request.method === 'POST') {
            const data = await request.json();

            if (ESVP_OPTIONS.includes(data.vote) && data.roomId) {
                // 고유한 키 생성
                const uniqueKey = `${data.roomId}-${data.vote}-${Date.now()}-${Math.random()}`;
        
                // 고유한 키로 투표 기록 저장
                await ESVP.put(uniqueKey, '1'); // '1'은 투표를 의미
                console.log(`Vote for option ${data.vote} in room ${data.roomId} recorded successfully.`);
                return new Response('Vote recorded', { status: 200, headers: corsHeaders });
            } else {
                console.error(`Error: Room ID ${data.roomId} not found.`);
                return new Response('Room ID not found', { status: 404, headers: corsHeaders });
            }
        } else if (url.pathname === '/results' && request.method === 'POST') {
            const requestData = await request.json();
            const roomId = requestData.roomId;

            if (!roomId) {
                console.error('Error: Room ID missing.');
                return new Response('Room ID missing', { status: 400, headers: corsHeaders });
            }

            const ESVP_ROOMS = JSON.parse(await ESVP.get("rooms") || "{}");

            if (ESVP_ROOMS[roomId]) {
                return new Response(JSON.stringify(await getVotes(roomId)), {
                    status: 200,
                    headers: {
                        ...corsHeaders,
                        'Content-Type': 'application/json'
                    }
                });
            } else {
                console.error(`Error: Room ID ${roomId} not found.`);
                return new Response('Room ID not found', { status: 404, headers: corsHeaders });
            }
        } else if (url.pathname === '/reset' && request.method === 'POST') {
            const data = await request.json();
            const roomId = data.roomId;
        
            if (ESVP_ROOMS[roomId]) {
                // 해당 roomId에 대한 모든 투표 키를 조회
                let keys = [];
                let cursor = "";
                do {
                    const response = await ESVP.list({ prefix: roomId, cursor: cursor });
                    keys = keys.concat(response.keys);
                    cursor = response.cursor;
                } while (cursor);
        
                // 투표 키를 삭제
                for (const key of keys) {
                    await ESVP.delete(key.name);
                }
        
                console.log(`Votes for room ${roomId} reset successfully.`);
                return new Response('Votes for the room reset', { status: 200, headers: corsHeaders });
            } else {
                console.error(`Error: Invalid room ID ${roomId}.`);
                return new Response('Invalid room ID', { status: 400, headers: corsHeaders });
            }
        } else if (url.pathname === '/is-admin' && request.method === 'POST') {
            const data = await request.json();
            const roomId = data.roomId;

            if (ESVP_ROOMS[roomId]) {
                if (ESVP_ROOMS[roomId].adminIP === creatorIP) {
                    return new Response('true', { status: 200, headers: corsHeaders });
                } else {
                    return new Response('false', { status: 403, headers: corsHeaders });
                }
            } else {
                console.error(`Error: Invalid room ID ${roomId}.`);
                return new Response('Invalid room ID', { status: 400, headers: corsHeaders });
            }
        } else if (request.method === "OPTIONS") {
            return handleOptions(request);
        } else {
            return new Response('Not found', { status: 404, headers: corsHeaders });
        }
    } catch (error) {
        console.error(`Unexpected error: ${error.message}`);
        return new Response('Internal server error', { status: 500, headers: corsHeaders });
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

async function getVotes(roomId) {
    // roomId로 시작하는 모든 키를 조회
    let keys = [];
    let cursor = "";
    do {
        const response = await ESVP.list({ prefix: roomId, cursor: cursor });
        keys = keys.concat(response.keys);
        cursor = response.cursor;
    } while (cursor);

    // 투표 합산
    const voteCounts = {};
    for (const key of keys) {
        const voteOption = key.name.split('-')[1];
        voteCounts[voteOption] = (voteCounts[voteOption] || 0) + 1;
    }

    return voteCounts;
}