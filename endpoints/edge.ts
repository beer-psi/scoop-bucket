import { Context, Status } from "https://deno.land/x/oak@v12.6.0/mod.ts";
import { decode } from "https://deno.land/std@0.196.0/encoding/base64.ts";
import { bufferToHex } from "https://deno.land/x/hextools@v1.0.0/mod.ts";

const COMMON_HEADERS = new Headers({
	"content-type": "application/json; encoding=UTF-8",
	"access-control-allow-origin": "*",
});

const client = Deno.createHttpClient({ 
    caCerts: [
        await Deno.readTextFile(new URL("../assets/Microsoft Update Secure Server CA 2.1.crt", import.meta.url)),
    ]
})

export default async function handleEdge(ctx: Context) {
    ctx.response.headers = COMMON_HEADERS;

    const params = ctx.request.url.searchParams;
    if (!params.has("arch") || !params.has("channel")) {
        ctx.response.headers = COMMON_HEADERS;
        ctx.response.status = Status.BadRequest;
        ctx.response.body = JSON.stringify({
            error: "arch and channel parameter are required",
        });
        return;
    }

    const arch = params.get("arch")!.toLowerCase();
    const channel = params.get("channel")!.toLowerCase();
    const version = params.get("version");

    if (version === null) {
        const resp = await fetch(
            `https://msedge.api.cdp.microsoft.com/api/v1.1/contents/Browser/namespaces/Default/names/msedge-${channel}-win-${arch}/versions/latest?action=select`,
            {
                client,
                method: "POST",
                body: JSON.stringify({ targetingAttributes: { Updater: "MicrosoftEdgeUpdate" }}),
                headers: {
                    "content-type": "application/json",
                    "user-agent": "Microsoft Edge Update/1.3.129.35;winhttp",
                }
            }
        );
        if (!resp.ok) {
            ctx.response.status = resp.status;
    
            if (resp.status == 404) {
                ctx.response.body = JSON.stringify({
                    error: "channel not found",
                });
            } else {
                const text = await resp.text();
                if (text.startsWith("[") || text.startsWith("{")) {
                    ctx.response.body = text;
                } else {
                    ctx.response.body = JSON.stringify({
                        error: text,
                    })
                }
            }
            return;
        }
        const data = await resp.json();
        
        ctx.response.body = JSON.stringify(data.ContentId);
        return;
    } else {
        const resp = await fetch(
            `https://msedge.api.cdp.microsoft.com/api/v1.1/contents/Browser/namespaces/Default/names/msedge-${channel}-win-${arch}/versions/${version}/files?action=GenerateDownloadInfo`,
            { 
                client,
                method: "POST",
                body: JSON.stringify({ targetingAttributes: { Updater: "MicrosoftEdgeUpdate" }}),
                headers: {
                    "user-agent": "Microsoft Edge Update/1.3.129.35;winhttp",
                    "content-type": "application/json",
                }
            }
        );
        if (!resp.ok) {
            ctx.response.status = resp.status;
            if (resp.status == 404) {
                ctx.response.body = JSON.stringify({
                    error: "not found",
                });
            } else {
                ctx.response.body = JSON.stringify({
                    error: "an unknown error occured",
                })
            }
            return;
        }
        const data = await resp.json();
    
        const item = data.find((item: any) => item.FileId.split("_").length == 3);
        item.Hashes.Sha1 = bufferToHex(decode(item.Hashes.Sha1));
        item.Hashes.Sha256 = bufferToHex(decode(item.Hashes.Sha256));
        
        ctx.response.body = JSON.stringify(item);
        return;
    }
}
