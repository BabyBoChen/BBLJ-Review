import tursoDbService from "../services/tursoDbService.js";

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
            } else if(segments[2] == "getStats" && req.method.toLowerCase() == "get"){
                resp = getStats(req);
            } else if(segments[2] == "getComments" && req.method.toLowerCase() == "get") {
                resp = getComments(req);
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

    if(toContinue){
        try {
            let sql = "INSERT INTO star(user_id,display_name,star,comment) VALUES(?,?,?,?)";
            let args = [
                {
                    type:"text",
                    value:userId,
                },
                {
                    type:"text",
                    value:displayName,
                },
                {
                    type:"integer",
                    value:`${star}`,
                },
                {
                    type:"text",
                    value:comment,
                },
            ];
            await tursoDbService.queryAsync(sql, args);
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

/** @param req {Request} @returns {Promise<Response>} */
async function getStats(req){
    /** @type {Promise<Response>} */
    let resp = new Response("unknown error", {
        status: 400,
    });

    try {
        const sql = `
SELECT A.star, COUNT(B.star) AS total
FROM five_star AS A
LEFT JOIN star AS B ON A.star=B.star
GROUP BY A.star
ORDER BY A.star;`;
        let ds = await tursoDbService.queryAsync(sql);
        resp = new Response(JSON.stringify(ds), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
            },
        });
    } catch (ex){
        resp = new Response(ex, {
            status: 400,
        });
    }

    return resp;
}

/** @param req {Request} @returns {Promise<Response>} */
async function getComments(req){
    /** @type {Promise<Response>} */
    let resp = new Response("unknown error", {
        status: 400,
    });

    try {
        const sql_page = `
SELECT CEILING( COUNT(*) /10.0) AS TotalPage
FROM star;`;
        let dt = await tursoDbService.queryAsync(sql_page);
        let totalPage = dt[0].TotalPage;
        const url = new URL(req.url);
        let page = Number(url.searchParams.get("page"));
        if(page == NaN){
            page = 1;
        } else if(page <= 0){
            page = 1;
        } else if(page > totalPage){
            page = totalPage;
        } 
        const sql = `
SELECT * FROM star
ORDER BY star_id DESC
LIMIT 10 OFFSET 10*${page-1}`;
        let dt2 = await tursoDbService.queryAsync(sql);
        let ds = {
            totalPage: totalPage,
            comments: dt2,
            page,
        };
        resp = new Response(JSON.stringify(ds), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
            },
        });
    } catch (ex){
        resp = new Response(ex, {
            status: 400,
        });
    }

    return resp;
}

export default apiServer;