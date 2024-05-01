require("dotenv").config();
const express = require("express");
const axios = require("axios");
const m3u8Parser = require("m3u8-parser");
const { parse } = require("dotenv");
const app = express();

const origin = "http://110.35.173.88:19090/live.stream/";

// TODO: CDN urls should be stored in DB
const availableCDNs = [
	// origin url, but for test
	{
		url: "http://110.35.173.88:19090",
		playlist_uri: "/live.stream/",
		traffic_uri: null,
		detailed_traffic_uri: null,
		type: "origin",
	},
	{
		url: "http://www.castislive-cache2.com:19091",
		playlist_uri: "/live.stream/",
		traffic_uri: "/api/traffic",
		detailed_traffic_uri: "/api/traffic/detail",
		type: "cache",
	},
];

// TODO: playlists should be stored in DB
const masterPlaylists = {};
const mediaPlaylists = new Set();

const availableVideos = {};
const availableAudios = {};

// logging middleware
app.use((req, res, next) => {
	const start = Date.now();
	res.on("finish", () => {
		const duration = Date.now() - start;
		console.log(
			`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`,
		);
	});
	next();
});

// fetch master/media playlist
async function fetchPlaylist(name) {
	let content;
	// TODO: DB query
	if (name in masterPlaylists) {
		content = masterPlaylists[name];
	} else if (mediaPlaylists.has(name)) {
		content = await fetchFromOrigin(name);
	} else {
		content = await storeNewMaster(name);
	}
	return content;
}

// fetch media playlist from origin
async function fetchFromOrigin(name) {
	const url = ensureAbsoluteUrl(origin, name);
	try {
		const response = await axios.get(url);
		return response.data;
	} catch (error) {
		console.error("Failed to fetch media playlist from origin:", name);
		return null;
	}
}

// if master playlist is not in DB, fetch it from origin and store it and its media playlists in DB
async function storeNewMaster(name) {
	const url = ensureAbsoluteUrl(origin, name);
	try {
		const response = await axios.get(url);
		if (response.status === 200) {
			manifest = parseManifest(response.data);
			if (!manifest.playlists) {
				console.error("No playlists found in master playlist:", name);
				return null;
			}
			// TODO: DB insert
			masterPlaylists[name] = response.data;
			for (const playlist of manifest.playlists) {
				mediaPlaylists.add(playlist.uri);
			}
			const audios = manifest.mediaGroups.AUDIO;
			for (const audio in audios) {
				for (const track in audios[audio]) {
					mediaPlaylists.add(audios[audio][track].uri);
				}
			}
			return response.data;
		}
		console.error("Failed to fetch playlists from origin:", response.data); // invalid m3u8 request
		return null;
	} catch (error) {
		console.error("Failed to fetch and store associated playlists:", name);
		return null;
	}
}

// parse manifest
function parseManifest(m3u8) {
	const parser = new m3u8Parser.Parser();
	parser.push(m3u8);
	parser.end();
	return parser.manifest;
}

function ensureAbsoluteUrl(baseUrl, url) {
	if (url.startsWith("http")) {
		return url;
	}
	const urlObject = new URL(url, baseUrl);
	return urlObject.href;
}

function ensureRelativeUrl(url) {
	if (url.startsWith("http")) {
		const urlObject = new URL(url);
		return urlObject.pathname;
	}
	return url;
}

function reconstructMediaPlaylist(m3u8, cdnURL) {
	manifest = parseManifest(m3u8);
	let playlistContent = "#EXTM3U\n";

	// TODO: can we add all the attributes automatically?
	if (manifest.version) {
		playlistContent += `#EXT-X-VERSION:${manifest.version}\n`;
	}
	if (manifest.mediaSequence) {
		playlistContent += `#EXT-X-MEDIA-SEQUENCE:${manifest.mediaSequence}\n`;
	}
	if (manifest.targetDuration) {
		playlistContent += `#EXT-X-TARGETDURATION:${manifest.targetDuration}\n`;
	}

	// substitute cdn url to every segment uri
	// TODO: may need to vary cdn for every segment
	if (manifest?.segments) {
		for (const segment of manifest.segments) {
			playlistContent += `#EXTINF:${segment.duration.toFixed(
				3,
			)},\n${ensureAbsoluteUrl(cdnURL, segment.uri)}\n`;
		}
	}

	return playlistContent;
}

// TODO: dynamic CDN selection
async function selectCDN() {
	cdn = availableCDNs[1];
	return cdn.url + cdn.playlist_uri;
}

app.get("/:pathname", async (req, res) => {
	const name = req.params.pathname;
	const m3u8 = await fetchPlaylist(name);
	if (name in masterPlaylists) {
		res.header("Content-Type", "application/vnd.apple.mpegurl");
		return res.send(m3u8);
	}
	if (mediaPlaylists.has(name)) {
		cdnURL = await selectCDN();
		res.header("Content-Type", "application/vnd.apple.mpegurl");
		return res.send(reconstructMediaPlaylist(m3u8, cdnURL));
	}
	res.status(400).send("Bad Request");
});

module.exports = { app };
