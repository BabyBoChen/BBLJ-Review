const tursoDbUrl = Deno.env.get("TURSO_DB_URL");
const tursoToken = Deno.env.get("TURSO_AUTH");

const tursoDbService = {
    /** @param sql {String} @param args {[{type:String,value:String}]} */
    queryAsync: async function(sql, args){
        let result = await fetch(tursoDbUrl, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tursoToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                requests: [
                    { type: "execute", stmt: { sql: sql , args: args} },
                    { type: "close" },
                ],
            }),
        }).then(async function(resp){
            return await resp.json();
        });
        let dt = [];
        let cols = result.results[0].response.result.cols;
        result.results[0].response.result.rows.forEach(function(row){
            let r = {};
            for(let i = 0; i < cols.length; i++){
                r[cols[i].name] = row[i].value;
                if(row[i].type == "integer"){
                    r[cols[i].name] = Number(row[i].value);
                }
            }
            dt.push(r);
        });
        return dt;
    },
};

export default tursoDbService;