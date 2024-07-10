import { Client } from "https://deno.land/x/postgres/mod.ts";

const apiServer = {
    /** @param req {Request} @returns {Promise<Response>} */
    serve: async function(req){
        /** @type {Promise<Response>} */
        let resp = new Response("not found", {
            status: 404
        });
        /** @type {string} */
        const pathname = new URL(req.url).pathname;
        let segments = pathname.split("/");
        //pathname.split("/")[0] == "";
        //pathname.split("/")[1] == "api";
        //pathname.split("/")[2] == "action";
        if(segments.length >= 3){
            if(segments[2] == "helloDeno"){
                resp = helloDeno(req);
            } else if(segments[2] == "giveStar" && req.method.toLowerCase() == "post"){
                resp = giveStar(req);
            } else if(segments[2] == "getLiffId" && req.method.toLowerCase() == "get"){
                resp = getLiffId(req);
            }
        }
        return resp;
    },
};

/** @param req {Request} @returns {Promise<Response>} */
async function helloDeno(req){
    return new Response("Hello Deno!", {
        status: 200,
        headers: {
            "content-type": "text/html",
        }
    });
}

/** @param req {Request} @returns {Promise<Response>} */
async function giveStar(req) {
    /** @type {Promise<Response>} */
    let resp = new Response("1|OK", {
        status: 200,
    });
    let toContinue = true;

    /** @type {FormData} */
    let formData;
    if(toContinue){
        try {
            formData = await req.formData();
        } catch (ex){
            resp = new Response(ex, {
                status: 400,
            });
            toContinue = false;
        }
    }

    let idToken = "";
    let userId = "";
    let displayName = "";
    let comment = "";
    let star = 0;
    if(toContinue){
        try {
            idToken = formData.get("id_token");
            if(!idToken){
                throw "id_token is blank";
            }
            userId = formData.get("user_id");
            if(!userId){
                throw "user_id is blank";
            }
            displayName = formData.get("display_name");
            if(!displayName){
                throw "display_name is blank";
            }
            star = new Number(formData.get("star"));
            if(star == NaN){
                throw "star is NaN";
            } else if(star == null){
                star = 0;
            }
            comment = formData.get("comment");
            if(!comment){
                comment = "";
            }
            console.log(JSON.stringify({idToken,userId,displayName,comment,star}));
        } catch (ex){
            resp = new Response(ex, {
                status: 400,
            });
            toContinue = false;
        }
    }

    let client;
    try {
        let pgUser = Deno.env.get("PG_USER");
        let pgDbName = Deno.env.get("PG_DB_NAME");
        let pgHost = Deno.env.get("PG_HOST");
        let pgPassword = Deno.env.get("PG_PASSWORD");
        let pgPort = Deno.env.get("PG_PORT");
        
        client = new Client({
            user: pgUser,
            database: pgDbName,
            hostname: pgHost,
            password: pgPassword,
            port: parseInt(pgPort),
        });
        await client.connect();
    } catch (ex){
        resp = new Response(ex, {
            status: 400,
        });
        toContinue = false;
    }

    if(toContinue){
        try {
            await client.queryObject(
                `INSERT INTO star(user_id,display_name,star,comment) VALUES($1,$2,$3,$4)`, 
                [userId,displayName,star,comment]
            );
        } catch (ex){
            resp = new Response(ex, {
                status: 400,
            });
            toContinue = false;
        }
    }

    if(toContinue){
        if(idToken != "" && idToken != "unauthorized"){
            toContinue = true;
        } else {
            toContinue = false;
        }
    }

    if(toContinue){
        try {
            let clientId = Deno.env.get("LINE_CLIENT_ID");
            let accessToken = Deno.env.get("LINE_ACCESS_TOKEN");

            let details = {
                'id_token': idToken,
                'client_id': clientId,
            };
            
            let formBody = [];
            for (let property in details) {
                let encodedKey = encodeURIComponent(property);
                let encodedValue = encodeURIComponent(details[property]);
                formBody.push(encodedKey + "=" + encodedValue);
            }
            formBody = formBody.join("&");

            let payLoad = await fetch("https://api.line.me/oauth2/v2.1/verify", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: formBody
            }).then(async function(resp){
                return await resp.json();
            });

            let messageBody = {
                to: payLoad.sub,
                messages: [
                    {
                        type: "text",
                        text: `感謝 ${payLoad.name} 給予${star}顆星評價以及寶貴的評語！`,
                    }
                ],
            };

            await fetch("https://api.line.me/v2/bot/message/push", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + accessToken,
                },
                body: JSON.stringify(messageBody)
            }).then(async function(resp){
                if(!resp.ok){
                    throw await resp.text();
                }
            });
        } catch (ex){
            resp = new Response(ex, {
                status: 400,
            });
            toContinue = false;
        }
    }

    return resp;
};

/** @param req {Request} @returns {Promise<Response>} */
async function getLiffId(req){
    let liffId = Deno.env.get("LIFF_ID");
    return new Response(liffId, {
        status: 200,
        headers: {
            "content-type": "text/html",
        }
    });
}

export default apiServer;