import { DOMParser, NodeList } from "https://esm.sh/linkedom@0.14.7";
import { HTMLDocument } from "https://cdn.esm.sh/v78/linkedom@0.14.7/types/html/document.d.ts";
import {
  ReasonPhrases,
  StatusCodes,
} from "https://esm.sh/http-status-codes@2.2.0";

const UPSTREAM_API = "https://store.rg-adguard.net/api/GetFiles";

interface StoreData {
  id: string;
  version: string;
  arch: string;
  file: {
    url: string;
    name: string;
    extension: string;
    size: string;
    sha1sum: string;
    expiry: string;
  };
}

function parseDocument(document: HTMLDocument): StoreData[] {
  const rows: NodeList = document.querySelectorAll("tr");
  rows.shift();
  return rows.map((value) => {
    const cells: NodeList = value.querySelectorAll("td");
    const filename = cells[0].querySelector("a").textContent.trim();
    const groups = filename.split("_");
    return {
      id: groups[0],
      version: groups[1],
      arch: groups[2],
      file: {
        url: decodeURI(cells[0].querySelector("a")?.href),
        name: filename,
        extension: filename.split(".").at(-1),
        size: cells[3].textContent.trim(),
        sha1sum: cells[2].textContent.trim(),
        expiry: new Date(cells[1].textContent.trim()).toJSON(),
      },
    };
  });
}

function validateParams(sp: URLSearchParams): boolean {
  if (!sp.has("type") || !sp.has("url") || !sp.has("ring") || !sp.has("lang")) {
    return false;
  }
  if (
    !["ProductId", "CategoryId", "url", "PackageFamilyName"].includes(
      // @ts-ignore: Already validated
      sp.get("type"),
    )
  ) {
    return false;
  }
  // @ts-ignore: Already validated
  if (!["Fast", "Slow", "RP", "Retail"].includes(sp.get("ring"))) {
    return false;
  }
  if (sp.get("lang") !== "en-US") {
    return false;
  }
  return true;
}

export default async function handleRequest(
  request: Request,
): Promise<Response> {
  const sp = new URL(request.url).searchParams;
  if (!validateParams(sp)) {
    return new Response(
      JSON.stringify(
        {
          message: "invalid parameters",
          params: {
            "type": "'ProductId' | 'CategoryId' | 'url' | 'PackageFamilyName",
            "url": "string",
            "ring": "'Fast' | 'Slow' | 'RP' | 'Retail'",
            "lang": "en-US",
            "id": "?string",
            "version": "?string",
            "arch": "?string",
            "name": "?string",
            "extension": "?string",
            "dl": "any",
          },
        },
        null,
        2,
      ),
      {
        status: StatusCodes.BAD_REQUEST,
        statusText: ReasonPhrases.BAD_REQUEST,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "access-control-allow-origin": "*",
        },
      },
    );
  }
  const resp = await fetch(UPSTREAM_API, {
    method: "POST",
    body: `type=${sp.get("type")}&url=${sp.get("url")}&ring=${
      sp.get("ring")
    }&lang=${sp.get("lang")}`,
    headers: {
      "origin": "https://store.rg-adguard.net",
      "referer": "https://store.rg-adguard.net/",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36 Edg/100.0.1185.50",
      "content-type": "application/x-www-form-urlencoded",
    },
  });
  if (resp.ok) {
    const text = await resp.text();
    // console.log(text)
    const document = new DOMParser().parseFromString(text, "text/html");
    const data = parseDocument(document);
    const id = sp.get("id");
    const version = sp.get("version");
    const arch = sp.get("arch");
    const name = sp.get("name");
    const extension = sp.get("extension");
    const ret = data.filter((value) => id === null || value.id === id)
      .filter((value) => version === null || value.version === version)
      .filter((value) => arch === null || value.arch === arch)
      .filter((value) => name === null || value.file.name === name)
      .filter((value) =>
        extension === null || value.file.extension === extension
      );
    if (sp.has("dl")) {
      if (ret.length > 1) {
        return new Response(
          JSON.stringify(
            {
              message:
                "There are more than one version matching criteria. Use more filters.",
              filters: ["id", "version", "arch", "name", "extension"],
            },
            null,
            2,
          ),
          {
            status: StatusCodes.MULTIPLE_CHOICES,
            statusText: ReasonPhrases.MULTIPLE_CHOICES,
            headers: {
              "content-type": "application/json; charset=UTF-8",
              "access-control-allow-origin": "*",
            },
          },
        );
      }
      if (ret.length === 0) {
        return new Response(
          JSON.stringify({ message: "download link not found" }),
          {
            status: StatusCodes.NOT_FOUND,
            statusText: ReasonPhrases.NOT_FOUND,
            headers: {
              "content-type": "application/json; charset=utf-8",
              "access-control-allow-origin": "*",
            },
          },
        );
      }
      return Response.redirect(ret[0].file.url, StatusCodes.TEMPORARY_REDIRECT);
    }
    return new Response(
      JSON.stringify(ret),
      {
        headers: {
          "content-type": "application/json; charset=UTF-8",
          "access-control-allow-origin": "*",
        },
      },
    );
  }
  return new Response(
    JSON.stringify({ message: "couldn't process your request" }),
    {
      status: StatusCodes.INTERNAL_SERVER_ERROR,
      statusText: ReasonPhrases.INTERNAL_SERVER_ERROR,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "access-control-allow-origin": "*",
      },
    },
  );
}
