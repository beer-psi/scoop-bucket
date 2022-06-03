# scoop-bucket

The Deno API that powers my scoop bucket. Hosted on
[Deno Deploy](https://deno.com/deploy).

## Endpoints

Base URL: `https://beerpsi-scoop.deno.dev`

<details>
    <summary>GET /itunes</summary>

Information source: [The iPhone Wiki](https://www.theiphonewiki.com/wiki/ITunes)

Query parameters:

```ts
interface Parameters {
	os: "windows" | "macos";

	// Required if using `dl` and `os` is Windows
	type?: "x86" | "x64" | "older_video_cards";

	// Leave blank to download latest version **with a download**, or specify a version yourself
	dl?: string | boolean;
}
```

If `dl` isn't specified, return JSON with information about iTunes versions,
filtered by `os` and `type`:

```ts
interface ITunesVersion {
	version: string;
	qt_version: string | null;
	amds_version: string;
	aas_version: string | null;
	url: string | null;
	sha1sum: string | null;
	size: number | null;
}
```

Example: `GET /itunes?os=windows&type=x64`

```json
[
	{
		"version": "12.12.2.2",
		"qt_version": null,
		"amds_version": "15.0.0.16",
		"aas_version": null,
		"url": "https://secure-appldnld.apple.com/itunes12/002-16263-20211027-C3421E95-F58B-4691-BD76-672A0D346AFB/iTunes64Setup.exe",
		"sha1sum": "3f7bc94532951707939c9ab2c509297bb9422545",
		"size": 210241608
	},
	{
		"version": "12.12.3.5",
		"qt_version": null,
		"amds_version": "15.5.0.16",
		"aas_version": null,
		"url": "https://secure-appldnld.apple.com/itunes12/002-35070-20220304-5521E72A-137B-4F09-9844-45BEBA5C3B40/iTunes64Setup.exe",
		"sha1sum": "16292cc7627ddad126e5237a0c0801f1f659e055",
		"size": 209718344
	}
	// ...
]
```

</details>

<details>
    <summary>GET /store</summary>

Information source: https://store.rg-adguard.net

Query parameters:

```ts
interface Parameters {
	// Parameters passed upstream
	type: "ProductId" | "CategoryId" | "url" | "PackageFamilyName";
	url: string;
	ring: "Fast" | "Slow" | "RP" | "Retail";
	lang: "en-US";

	// Filtering returned results
	id?: string;
	version?: string;
	arch?: string;
	name?: string;
	extension?: string;

	// Download
	dl?: boolean;
}
```

Response: `StoreData[]`

```ts
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
```

Example:
`GET /store?type=url&url=https://www.microsoft.com/en-us/p/icloud/9pktq5699m62&ring=Retail&lang=en-US`

```json
[
	{
		"id": "AppleInc.iCloud",
		"version": "13.0.201.0",
		"arch": "x86",
		"file": {
			"url": "http://dl.delivery.mp.microsoft.com/filestreamingservice/files/029d5d56-67bb-4449-8d8e-d1bcf20fff22",
			"name": "AppleInc.iCloud_13.0.201.0_x86__nzyj5cx40ttqa.BlockMap",
			"extension": "BlockMap",
			"size": "315.63 KB",
			"sha1sum": "43fa28a7d2d7ac847ca530c65d299dfd6aadbddd",
			"expiry": "1970-01-01T00:00:00.000Z"
		}
	},
	{
		"id": "AppleInc.iCloud",
		"version": "13.0.201.0",
		"arch": "x86",
		"file": {
			"url": "http://tlu.dl.delivery.mp.microsoft.com/filestreamingservice/files/174bf1fc-865a-4ce2-af40-31e451020d6b?P1=1650855982&P2=404&P3=2&P4=TWk7dn720hd1nXRsyaW9G56e%252b8V0eKAie7SjClJlRquGqDlrVIzi5glZ%252foP2ZCHkUuvsAnLRtX9gj7sRh2ZXMQ%253d%253d",
			"name": "AppleInc.iCloud_13.0.201.0_x86__nzyj5cx40ttqa.appx",
			"extension": "appx",
			"size": "254.87 MB",
			"sha1sum": "c184b17f7edf695321a70d82f2ef1dbaab9c4fa2",
			"expiry": "2022-04-25T03:06:22.000Z"
		}
	}
	// ...
]
```

</details>
