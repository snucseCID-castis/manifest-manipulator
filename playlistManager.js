require("dotenv").config();
const MasterPlaylist = require("./models/MasterPlaylist");
const MediaPlaylist = require("./models/MediaPlaylist");
const axios = require("axios");
const m3u8Parser = require("m3u8-parser");

const origin =
	process.env.ORIGIN_URL || "http://110.35.173.88:19090/live.stream/";

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

async function updateAndGetMasterPlaylists() {
	const masterPlaylists = await MasterPlaylist.find();
	for (const playlist of masterPlaylists) {
		const content = await fetchFromOrigin(playlist.name);
		playlist.contents = content;
		await playlist.save();
	}
	return masterPlaylists;
}

async function updateandGetMediaPlaylists() {
	// Purge all media playlists
	await MediaPlaylist.deleteMany();

	const masterPlaylists = await MasterPlaylist.find();
	const createdMediaPlaylists = []; // Array to store created media playlists

	for (const playlist of masterPlaylists) {
		const content = playlist.contents;
		const manifest = parseManifest(content);

		for (const mediaPlaylist of manifest.playlists) {
			const name = ensureRelativeUrl(mediaPlaylist.uri);
			const createdPlaylist = await MediaPlaylist.create({ name });
			createdMediaPlaylists.push(createdPlaylist);
		}

		const audios = manifest.mediaGroups.AUDIO;
		for (const audio in audios) {
			for (const track in audios[audio]) {
				const name = ensureRelativeUrl(audios[audio][track].uri);
				const createdPlaylist = await MediaPlaylist.create({ name });
				createdMediaPlaylists.push(createdPlaylist);
			}
		}
	}

	return createdMediaPlaylists;
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

// TODO: modularize
async function selectCDN() {
	cdn = availableCDNs[1];
	return cdn.url + cdn.playlist_uri;
}

async function playlistManagerFactory() {
	const [masterPlaylists, mediaPlaylists] = await Promise.all([
		updateAndGetMasterPlaylists(),
		updateandGetMediaPlaylists(),
	]);
	return new PlaylistManager(masterPlaylists, mediaPlaylists);
}

class PlaylistManager {
	constructor(masterPlaylists, mediaPlaylists) {
		// On init, update master and media playlists
		this.masterPlaylists = masterPlaylists;
		this.mediaPlaylists = mediaPlaylists;
	}
	async fetchPlaylist(name) {
		//check if document with name exists in masterPlaylists or mediaPlaylists

		const masterPlaylist = await MasterPlaylist.findOne({ name });
		if (masterPlaylist) {
			return masterPlaylist.contents;
		}
		const mediaPlaylist = await MediaPlaylist.findOne({ name });
		if (!mediaPlaylist) {
			return null;
		}
		CDNURL = await selectCDN();
		// TODO: fetch from selected CDN
		contents = await fetchFromOrigin(mediaPlaylist.name);
		return reconstructMediaPlaylist(contents, CDNURL);
	}
}

module.exports = playlistManagerFactory();