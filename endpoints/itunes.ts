import {
	DOMParser,
	HTMLElement,
	NodeList,
} from "https://esm.sh/linkedom@0.14.7";
import { HTMLDocument } from "https://cdn.esm.sh/v78/linkedom@0.14.7/types/html/document.d.ts";
import { LRU } from "https://deno.land/x/lru@1.0.2/mod.ts";
import {
	ReasonPhrases,
	StatusCodes,
} from "https://esm.sh/http-status-codes@2.2.0";

interface ITunesVersion {
	version: string;
	qt_version: string | null;
	amds_version: string;
	aas_version: string | null;
	url: string | null;
	sha1sum: string | null;
	size: number | null;
}

interface ITunesData {
	windows: Record<string, ITunesVersion[]>;
	macos: ITunesVersion[];
}

interface Table {
	index: number,
	numberOfCells: number,
	cellIndex: {
		version: number,
		qt_version?: number,
		amds_version: number,
		aas_version?: number,
		url: number,
		sha1sum: number,
		size: number,
	},
}

const CACHE = new LRU(1);
const CACHE_JSON = new LRU(1);

const ITUNES_VERSIONS_TABLE = "https://www.theiphonewiki.com/wiki/ITunes";
const COMMON_HEADERS = {
	"content-type": "application/json; encoding=UTF-8",
	"access-control-allow-origin": "*",
};

const Tables: Record<string, Table> = {
	MACOS: {
		index: 0,
		numberOfCells: 6,
		cellIndex: {
			version: 0,
			amds_version: 1,
			url: 2,
			sha1sum: 3,
			size: 4,
		},
	},
	WINDOWS_32BIT: {
		index: 1,
		numberOfCells: 8,
		cellIndex: {
			version: 0,
			qt_version: 1,
			amds_version: 2,
			aas_version: 3,
			url: 4,
			sha1sum: 5,
			size: 6,
		},
	},
	WINDOWS_64BIT: {
		index: 2,
		numberOfCells: 8,
		cellIndex: {
			version: 0,
			qt_version: 1,
			amds_version: 2,
			aas_version: 3,
			url: 4,
			sha1sum: 5,
			size: 6,
		},
	},
	WINDOWS_64BIT_OLDER_VIDEO_CARDS: {
		index: 3,
		numberOfCells: 7,
		cellIndex: {
			version: 0,
			amds_version: 1,
			aas_version: 2,
			url: 3,
			sha1sum: 4,
			size: 5,
		}
	}
}

function handleNullishString(value: string): string | null {
	if (value === "—" || value === "N/A") {
		return null
	}
	return value
}

function getVersions(
	document: HTMLDocument,
	table: Table,
): ITunesVersion[] {
	const rows: NodeList = document
		.querySelectorAll("table.wikitable")[table.index]
		.querySelectorAll("tr");
	rows.shift();
	return rows.map((value: HTMLElement, index: number, array: HTMLElement[]) => {
		const cells: NodeList = value.querySelectorAll("td");
		return {
			version: cells.length < table.numberOfCells
				? array[index - 1]
						.querySelectorAll("td")[table.cellIndex.version]
						.textContent
						.replaceAll(/\[\d+\]/g, "")
				: cells[table.cellIndex.version].textContent.replaceAll(/\[\d+\]/g, ""),
			qt_version: table.cellIndex.qt_version 
				? handleNullishString(cells[table.cellIndex.qt_version].textContent)
				: null,
			amds_version: cells[table.cellIndex.amds_version].textContent,
			aas_version: table.cellIndex.aas_version 
				? handleNullishString(cells[table.cellIndex.aas_version].textContent)
				: null,
			url: handleNullishString(cells[table.cellIndex.url].textContent)
				? cells[table.cellIndex.url].querySelector("a")?.href
				: null,
			sha1sum: handleNullishString(cells[table.cellIndex.sha1sum].textContent),
			size: handleNullishString(cells[table.cellIndex.size].textContent) 
				? Number(handleNullishString(cells[table.cellIndex.size].textContent)?.replaceAll(",", ""))
				: null,
		}
	});
}

async function fetchWikiWithCache(url: string): Promise<Response> {
	const respHead = await fetch(url, {
		method: "HEAD",
		headers: {
			"user-agent": "Deno/1.0 (Deno Deploy)",
		},
	});
	if (respHead.ok && respHead.headers.get("last-modified")) {
		const lastModified = String(
			new Date(respHead.headers.get("last-modified")!).getTime(),
		);
		if (!CACHE.has(lastModified)) {
			const resp = await fetch(url, {
				method: "GET",
				headers: {
					"user-agent": "Deno/1.0 (Deno Deploy)",
				},
			});
			CACHE.set(lastModified, await resp.text());
		}
		return new Response(
			<string> CACHE.get(lastModified),
			{
				status: StatusCodes.OK,
				statusText: ReasonPhrases.OK,
				headers: new Headers({
					"last-modified": new Date(Number(lastModified)).toISOString(),
				}),
			},
		);
	}
	return fetch(url, {
		method: "GET",
		headers: {
			"user-agent": "Deno/1.0 (Deno Deploy)",
		},
	});
}

function fetchTableWithCache(text: string, lastModified: string): ITunesData {
	if (!CACHE_JSON.has(lastModified)) {
		const document = new DOMParser().parseFromString(text, "text/html");
		const response = {
			windows: {
				x86: getVersions(document, Tables.WINDOWS_32BIT),
				x64: getVersions(document, Tables.WINDOWS_64BIT),
				older_video_cards: getVersions(
					document,
					Tables.WINDOWS_64BIT_OLDER_VIDEO_CARDS,
				),
			},
			macos: getVersions(document, Tables.MACOS),
		};
		CACHE_JSON.set(lastModified, response);
	}
	return <ITunesData> CACHE_JSON.get(lastModified);
}

export default async function handleRequest(
	request: Request,
): Promise<Response> {
	const resp = await fetchWikiWithCache(ITUNES_VERSIONS_TABLE);
	const sp = new URL(request.url).searchParams;
	if (resp.ok && resp.headers.get("last-modified")) {
		const allVersions = fetchTableWithCache(
			(await resp.text()).replaceAll(/\n/gm, ""),
			String(new Date(resp.headers.get("last-modified")!).getTime()),
		);
		if (Array.from(sp.keys()).length === 0) {
			return new Response(
				JSON.stringify(allVersions),
				{
					status: StatusCodes.OK,
					statusText: ReasonPhrases.OK,
					headers: COMMON_HEADERS,
				},
			);
		}
		const os: string | null = sp.get("os");
		const type: string | null = sp.get("type");
		let data;
		if (os === "windows" || os === "macos") {
			if (type === null) {
				data = allVersions[os];
			} else if (
				os === "windows" && type !== null &&
				Object.prototype.hasOwnProperty.call(allVersions[os], type)
			) {
				data = allVersions[os][type];
			} else {
				return new Response(
					JSON.stringify({
						message: "invalid type for os",
						valid: os === "windows" ? ["x86", "x64", "older_video_cards"] : [],
					}),
					{
						status: StatusCodes.BAD_REQUEST,
						statusText: ReasonPhrases.BAD_REQUEST,
						headers: COMMON_HEADERS,
					},
				);
			}
		} else {
			return new Response(
				JSON.stringify({ message: "invalid os", valid: ["windows", "macos"] }),
				{
					status: StatusCodes.BAD_REQUEST,
					statusText: ReasonPhrases.BAD_REQUEST,
					headers: COMMON_HEADERS,
				},
			);
		}
		if (sp.has("dl")) {
			if (os === "windows" && !sp.has("type")) {
				return new Response(
					JSON.stringify({
						message: "Need to specify a build type",
						valid: ["x86", "x64", "older_video_cards"],
					}),
					{
						status: StatusCodes.MULTIPLE_CHOICES,
						statusText: ReasonPhrases.MULTIPLE_CHOICES,
						headers: COMMON_HEADERS,
					},
				);
			}
			const version = sp.get("dl");
			const versions = <ITunesVersion[]> data;
			const url = version
				? versions.filter((value) => value.version === version)[0].url
				: versions.map((value) => value.url).filter((value) => value).at(-1);
			if (url) {
				return Response.redirect(url, StatusCodes.TEMPORARY_REDIRECT);
			} else {
				return new Response(
					JSON.stringify({ message: "download link not found" }),
					{
						status: StatusCodes.NOT_FOUND,
						statusText: ReasonPhrases.NOT_FOUND,
						headers: COMMON_HEADERS,
					},
				);
			}
		} else {
			return new Response(
				JSON.stringify(data),
				{
					status: StatusCodes.OK,
					statusText: ReasonPhrases.OK,
					headers: COMMON_HEADERS,
				},
			);
		}
	}
	return new Response(
		JSON.stringify({ message: "couldn't process your request" }),
		{
			status: StatusCodes.INTERNAL_SERVER_ERROR,
			statusText: ReasonPhrases.INTERNAL_SERVER_ERROR,
			headers: COMMON_HEADERS,
		},
	);
}
