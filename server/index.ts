export interface Env {
    // If you set another name in wrangler.toml as the value for 'binding',
    // replace "DB" with the variable name you defined.
    DB: D1Database;
    MY_OPENAI_API_KEY: string;
}

const ESVP_OPTIONS = ["Explorer", "Shopper", "Vacationer", "Prisoner"];
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
    "Access-Control-Max-Age": "86400",
};

export default {
    async fetch(request: Request, env: Env) {
        const { pathname } = new URL(request.url);
        const url = new URL(request.url);
        const ip = request.headers.get('CF-Connecting-IP') || '127.0.0.1';

        if (url.pathname === '/' && request.method === 'GET') {
            // 여기서 DB를 사용하는 로직을 추가할 수 있습니다. 
            // 예를 들어, 데이터베이스에서 일부 데이터를 가져와 응답에 포함시킬 수 있습니다.
            // 현재로서는 단순한 응답만 반환합니다.
            return new Response("This ESVP App", {
                headers: {
                    'Content-Type': 'text/html',
                    ...corsHeaders
                }
            });
        }
        else if (url.pathname === '/create-room' && request.method === 'POST') {
            try {
                // 현재 저장된 모든 방의 개수를 데이터베이스에서 가져와서 새로운 방 ID를 생성합니다.
                const countResult = await env.DB.prepare("SELECT COUNT(*) as count FROM Rooms").all();

                if (!countResult.success) {
                    throw new Error("Failed to fetch count from database.");
                }

                const roomId = countResult.results[0].count + 1;

                // 새로운 방 정보를 데이터베이스에 저장합니다.
                const insertResult = await env.DB.prepare(
                    "INSERT INTO Rooms (RoomId, CreatorIp, Explorer, Shopper, Vacationer, Prisoner) VALUES (?, ?, 0, 0, 0, 0)"
                ).bind(roomId, ip).run();

                if (!insertResult.success) {
                    throw new Error("Failed to insert new room into database.");
                }

                console.log(`Room ${roomId} created successfully in ${insertResult.meta.duration} ms.`);

                // 디비의 모든 방 정보를 가져와 콘솔에 출력합니다.
                const allRoomsResult = await env.DB.prepare("SELECT * FROM Rooms").all();

                if (allRoomsResult.success) {
                    console.log("Current Database Contents:", JSON.stringify(allRoomsResult.results, null, 2));
                } else {
                    console.error("Failed to fetch all rooms from database.");
                }

                return new Response(`${roomId}`, { status: 200, headers: corsHeaders });
            } catch (error) {
                console.error(`Error creating room: ${error.message}`);
                return new Response('Internal server error', { status: 500, headers: corsHeaders });
            }
        }
        else if (url.pathname === '/vote' && request.method === 'POST') {
            try {
                const data = await request.json();

                if (ESVP_OPTIONS.includes(data.vote) && data.roomId) {
                    // 투표 옵션에 따라 해당 컬럼의 값을 증가시킵니다.
                    const updateVoteQuery = `
                            UPDATE Rooms 
                            SET ${data.vote} = ${data.vote} + 1 
                            WHERE RoomId = ?
                        `;

                    const result = await env.DB.prepare(updateVoteQuery).bind(data.roomId).run();

                    // SQL 쿼리를 통해 변경된 행의 수가 1인지 확인하여 성공적으로 투표되었는지 확인합니다.
                    console.log(JSON.stringify(result));
                    if (result.meta.changes === 1) {
                        console.log(`Vote for option ${data.vote} in room ${data.roomId} recorded successfully.`);
                        return new Response('Vote recorded', { status: 200, headers: corsHeaders });
                    } else {
                        console.error(`Error: Room ID ${data.roomId} not found or vote not updated. rows_written ${result.meta.rows_written}`);
                        return new Response('Room ID not found or vote not updated', { status: 404, headers: corsHeaders });
                    }
                } else {
                    console.error(`Error: Invalid vote option or Room ID.`);
                    return new Response('Invalid vote option or Room ID', { status: 400, headers: corsHeaders });
                }
            } catch (error) {
                console.error(`Error processing vote: ${error.message}`);
                return new Response('Internal server error', { status: 500, headers: corsHeaders });
            }
        }
        else if (url.pathname === '/is-admin' && request.method === 'POST') {
            const data = await request.json();
            const roomId = data.roomId;

            try {
                const { results } = await env.DB.prepare("SELECT CreatorIp FROM Rooms WHERE RoomId = ?").bind(roomId).all();

                if (results && results.length > 0) {
                    const roomData = results[0];

                    if (roomData.CreatorIp === ip) {
                        return new Response('true', { status: 200, headers: corsHeaders });
                    } else {
                        return new Response('false', { status: 403, headers: corsHeaders });
                    }
                } else {
                    console.error(`Error: Invalid room ID ${roomId}.`);
                    return new Response('Invalid room ID', { status: 400, headers: corsHeaders });
                }
            } catch (error) {
                console.error(`Error checking admin status: ${error.message}`);
                return new Response('Internal server error', { status: 500, headers: corsHeaders });
            }
        }
        else if (url.pathname === '/results' && request.method === 'POST') {
            const requestData = await request.json();
            const roomId = requestData.roomId;

            if (!roomId) {
                console.error('Error: Room ID missing.');
                return new Response('Room ID missing', { status: 400, headers: corsHeaders });
            }

            try {
                const { results } = await env.DB.prepare("SELECT * FROM Rooms WHERE RoomId = ?").bind(roomId).all();

                if (results && results.length > 0) {
                    const roomData = results[0];
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
            } catch (error) {
                console.error(`Error fetching results: ${error.message}`);
                return new Response('Internal server error', { status: 500, headers: corsHeaders });
            }
        }
        else if (url.pathname === '/reset' && request.method === 'POST') {
            const data = await request.json();
            const roomId = data.roomId;

            const { results } = await env.DB.prepare("SELECT * FROM Rooms WHERE RoomId = ?").bind(roomId).all();

            if (results && results.length === 1) {
                // 투표를 초기화
                const setClauses = ESVP_OPTIONS.map(option => `${option} = 0`).join(', ');

                const updateQuery = `UPDATE Rooms SET ${setClauses} WHERE RoomId = ?`;

                await env.DB.prepare(updateQuery).bind(roomId).run();

                console.log(`Votes for room ${roomId} reset successfully.`);
                return new Response('Votes for the room reset', { status: 200, headers: corsHeaders });
            } else {
                console.error(`Error: Invalid room ID ${roomId}.`);
                return new Response('Invalid room ID', { status: 400, headers: corsHeaders });
            }
        }
        else if (url.pathname === '/check-room' && request.method === 'POST') {
            const data = await request.json();
            const roomId = data.roomId;

            const { results } = await env.DB.prepare("SELECT RoomId FROM Rooms WHERE RoomId = ?").bind(roomId).all();

            if (results && results.length === 1) {
                return new Response(null, { status: 200, headers: corsHeaders });
            } else {
                return new Response(null, { status: 404, headers: corsHeaders });
            }
        }
        else if (url.pathname === '/suggestion' && request.method === 'POST') {
            const requestData = await request.json();
            const roomId = requestData.roomId;
            if (!roomId) {
                console.error('Error: Room ID missing.');
                return new Response('Room ID missing', { status: 400, headers: corsHeaders });
            }
            const voteResult = requestData.voteResult;
            console.log(voteResult);

            // OpenAI API를 통해 투표 결과에 따른 회의진행 방향 제안을 받아옵니다.
            try {
                let suggestions = await getAIResponse(voteResult);
                console.log('AI Suggestions for the meeting:', suggestions);
                try {
                    const results = { suggestion: suggestions };

                    if (results.suggestion && results.suggestion.length > 0) {
                        return new Response(JSON.stringify(results), {
                            status: 200,
                            headers: {
                                ...corsHeaders,
                                'Content-Type': 'application/json'
                            }
                        });
                    } else {
                        console.error(`Suggestion Error`);
                        return new Response('Suggestion Error', { status: 404, headers: corsHeaders });
                    }
                } catch (error) {
                    console.error(`Error fetching results: ${error.message}`);
                    return new Response('Internal server error', { status: 500, headers: corsHeaders });
                }

            } catch (error) {
                console.error(`Error getting suggestion: ${error.message}`);
                return new Response('Error getting suggestion', { status: 500, headers: corsHeaders });
            }

        }
        else if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    ...corsHeaders,
                    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                }
            });
        }
        else {
            return new Response('Not found', { status: 404, headers: corsHeaders });
        }

        async function getVotes(roomId) {
            let votes = {};

            try {
                const { results } = await env.DB.prepare("SELECT * FROM Rooms WHERE RoomId = ?").bind(roomId).all();

                if (results && results.length === 1) {
                    const roomData = results[0];
                    for (let category of ESVP_OPTIONS) {
                        votes[category] = roomData[category];
                    }
                } else {
                    throw new Error(`Expected 1 row for RoomId ${roomId}, but found ${results ? results.length : 0}.`);
                }
            } catch (error) {
                console.error(`Error fetching votes: ${error.message}`);
                throw error;  // 함수를 호출한 곳으로 에러를 다시 던집니다.
            }

            return votes;
        }

        async function getAIResponse(voteResults) {
            const prompt = `Given the following ESVP voting results for an upcoming meeting, provide suggestions on how to conduct the meeting effectively:
            ${voteResults}\nUsing this data, please suggest how to design the meeting to ensure all participants are engaged and the meeting's objectives are achieved.\n
            Do not give suggestions for each type. Include 3 specific strategies for conducting the meeting. Use the following format and fill in {}.\n
            The answer will be shown as HTML so use <br> instead of new line as in the format:\n
            현재 회의참석자들의 상태는 {Overall mood of total participants}<br>
            다음과 같은 방법으로 회의 진행을 제안드립니다.<br><br>
            1. <strong>{Suggestion title 1}</strong><br>
               {Suggestion description 1}<br><br>
            2. <strong>{Suggestion title 2}</strong><br>
                {Suggestion description 2}<br><br>
            3. <strong>{Suggestion title 3}</strong><br>
                {Suggestion description 3}<br><br>`;


            const data = {
                temperature: 0.5,
                // max_tokens: 150,
                model: 'gpt-4-1106-preview',
                messages: [
                    {
                        "role": "system",
                        "content": "You are a helpful assistant. Reply formally and reply in Korean."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            };

            try {
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${env.MY_OPENAI_API_KEY}` // Replace with your actual API key
                    },
                    body: JSON.stringify(data)
                });
                // const responseData = {
                //     choices: [{ text: "test 1 choice" }, { text: "test 2 choice" }]
                // };

                // if (!response.ok) {
                //     throw new Error(`HTTP error! status: ${response.status}`);
                // }

                const responseData = await response.json();
                console.log('AI Response:', responseData.choices[0]);
                console.log('AI Response2:', responseData.usage);
                return responseData.choices[0].message.content.trim();
            } catch (error) {
                console.error('Error calling the AI API:', error);
                return null;
            }
        }

    },
};