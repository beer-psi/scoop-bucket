import { Context, Status } from "https://deno.land/x/oak@v12.6.0/mod.ts";
import { decode } from "https://deno.land/std@0.196.0/encoding/base64.ts";
import { bufferToHex } from "https://deno.land/x/hextools@v1.0.0/mod.ts";
import {
    BufReader,
    BufWriter,
} from "https://deno.land/std@0.196.0/io/mod.ts";
import { TextProtoReader } from "https://deno.land/std@0.158.0/textproto/mod.ts";

const ALLOWED_ARCHITECTURES = [
    "86",
    "64",
    "arm64",
    "aarch64",
    "amd64",
    "ia32",
    "x86",
    "x64"
]
const ALLOWED_CHANNELS = [
    "stable",
    "beta",
    "dev",
    "canary",
]

const COMMON_HEADERS = new Headers({
	"content-type": "application/json; encoding=UTF-8",
	"access-control-allow-origin": "*",
});

const caCert = await Deno.readTextFile(new URL("../assets/Microsoft Update Secure Server CA 2.1.crt", import.meta.url));

interface DownloadInfo {
    FileId: string;
    Url: string;
    TimeLimitedUrl: boolean;
    Hashes: {
        Sha1: string;
        Sha256: string;
    };
}

export async function fetchVersion(channel: string, arch: string, version?: string | null): Promise<Response> {
    const conn = await Deno.connectTls({
        hostname: "msedge.api.cdp.microsoft.com",
        port: 443,
        caCerts: [caCert],
    });
    const writer = new BufWriter(conn);
    const encoder = new TextEncoder();

    const path = version === undefined || version === null
        ? "/latest?action=select"
        : `/${version}/files?action=GenerateDownloadInfo`;

    const lines = [
        `POST /api/v1.1/contents/Browser/namespaces/Default/names/msedge-${channel}-win-${arch.toUpperCase()}/versions/${path} HTTP/1.1`,
        "Host: msedge.api.cdp.microsoft.com",
        "Connection: keep-alive",
        `Content-Length: 57`,
        "Content-Type: application/json",
        "User-Agent: Microsoft Edge Update/1.3.129.35;winhttp",
        "",
        '{"targetingAttributes":{"Updater":"MicrosoftEdgeUpdate"}}',
    ]
    await writer.write(encoder.encode(lines.join("\r\n") + "\r\n\r\n"));
    await writer.flush();

    const bufReader = new BufReader(conn);
    const tpReader = new TextProtoReader(bufReader);
    const statusLine = await tpReader.readLine();
    if (statusLine === null) {
        throw new Error("Malformed HTTP response");
    }
    const [_, status, statusText] = statusLine.match(/HTTP\/1.1 (\d{3}) (.*)/) ?? [];
    const headers = await tpReader.readMimeHeader();

    if (headers === null) {
        return new Response(null, {
            status: Number(status),
            statusText,
        });
    }
    const body = new Uint8Array(Number(headers.get("content-length")));
    await bufReader.readFull(body);

    return new Response(body, {
        status: Number(status),
        statusText,
        headers: headers ?? undefined,
    });
}

export default async function handleEdge(ctx: Context) {
    ctx.response.headers = COMMON_HEADERS;

    const params = ctx.request.url.searchParams;
    if (!params.has("arch") || !params.has("channel")) {
        ctx.response.headers = COMMON_HEADERS;
        ctx.response.status = Status.BadRequest;
        ctx.response.body = JSON.stringify({
            code: "-1",
            error: "arch and channel parameter are required",
            allowedArchitecture: ALLOWED_ARCHITECTURES,
            allowedChannel: ALLOWED_CHANNELS,
        });
        return;
    }

    let arch = params.get("arch")!.toLowerCase();
    if (arch === "86" || arch === "64") {
        arch = "x" + arch;
    }
    if (arch === "amd64" || arch === "aarch64") {
        arch = "x64";
    }
    if (arch === "ia32") {
        arch = "x86";
    }

    const channel = params.get("channel")!.toLowerCase();
    const version = params.get("version");

    if (!ALLOWED_ARCHITECTURES.includes(arch)) {
        ctx.response.status = Status.BadRequest;
        ctx.response.body = JSON.stringify({
            code: "-1",
            message: "invalid architecture",
            allowedArchitecture: ALLOWED_ARCHITECTURES,
        });
        return;
    }
    if (!ALLOWED_CHANNELS.includes(channel)) {
        ctx.response.status = Status.BadRequest;
        ctx.response.body = JSON.stringify({
            code: "-1",
            message: "invalid channel",
            allowedChannel: ALLOWED_CHANNELS,
        });
        return;
    }

    const resp = await fetchVersion(channel, arch, version);
    if (!resp.ok) {
        ctx.response.status = resp.status;
        if (resp.status == 404) {
            ctx.response.body = JSON.stringify({
                code: "2001",
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
    if (!version) {
        ctx.response.body = JSON.stringify(data.ContentId);
        return;
    }

    const item = data.find((item: DownloadInfo) => item.FileId.split("_").length == 3);
    if (params.has("dl")) {
        ctx.response.redirect(item.Url);
        return;
    }

    item.Hashes.Sha1 = bufferToHex(decode(item.Hashes.Sha1));
    item.Hashes.Sha256 = bufferToHex(decode(item.Hashes.Sha256));
    item.Version = version;
    delete item.DeliveryOptimization;

    ctx.response.body = JSON.stringify(item);
}
