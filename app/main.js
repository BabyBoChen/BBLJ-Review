import { serveDir } from "https://deno.land/std@0.224.0/http/file_server.ts";
import apiServer from "./api/apiServer.js";

const handler = function(req){
    /** @type {Promise<Response>} */
    let resp;

    /** @type {string} */
    const pathname = new URL(req.url).pathname;
    if(pathname.startsWith("/api")) {
        resp = apiServer.serve(req);
    } else {
        resp = serveDir(req, {
            fsRoot: "wwwroot"
        });
    }
    return resp;
};

Deno.serve({
    port: 1993,
}, handler);