require("dotenv").config();
const CDN = require("./models/CDN");
const MasterPlaylist = require("./models/MasterPlaylist");
const MediaPlaylist = require("./models/MediaPlaylist");
const axios = require("axios");
const m3u8Parser = require("m3u8-parser");

const origin =
	process.env.ORIGIN_URL || "http://110.35.173.88:19090/live.stream/";

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
function getTokenizedMasterPlaylist(content, connectionId) {
	// Parse the original master playlist content
	const parsedManifest = parseManifest(content);

	// Iterate through each playlist in the parsed manifest
	for (const playlist of parsedManifest.playlists) {
		// Tokenize the URI by appending the connectionId
		playlist.uri = `${connectionId}/${playlist.uri}`;
	}

	for (const group in parsedManifest.mediaGroups.AUDIO) {
		for (const name in parsedManifest.mediaGroups.AUDIO[group]) {
			parsedManifest.mediaGroups.AUDIO[group][name].uri =
				`${connectionId}/${parsedManifest.mediaGroups.AUDIO[group][name].uri}`;
		}
	}
	let playlistStr = "#EXTM3U \n";

	// Append MediaGroups
	for (const group in parsedManifest.mediaGroups.AUDIO) {
		for (const language in parsedManifest.mediaGroups.AUDIO[group]) {
			// Audio Group Template
			playlistStr += `#EXT-X-MEDIA:TYPE=AUDIO,URI="${parsedManifest.mediaGroups.AUDIO[group][language].uri}",GROUP-ID="${group}",NAME="${language}",CHANNELS="1"\n`;
		}
	}

	// Append playlists
	for (const playlist of parsedManifest.playlists) {
		// Resolution String
		const resolutionStr = `${playlist.attributes.RESOLUTION.width}x${playlist.attributes.RESOLUTION.height}`;
		// Stream-inf line template
		playlistStr += `#EXT-X-STREAM-INF:BANDWIDTH=${playlist.attributes.BANDWIDTH},CODECS="${playlist.attributes.CODECS}",RESOLUTION=${resolutionStr},AUDIO="${playlist.attributes.AUDIO}"\n`;
		// Add uri
		playlistStr += `${playlist.uri}\n`;
	}
	return playlistStr;
}

function reconstructMediaPlaylist(m3u8, cdn, connection, mediaPlaylistName) {
	const manifest = parseManifest(m3u8);
	let playlistContent = "#EXTM3U\n";
	const strippedMediaPlaylistName = mediaPlaylistName.split(".")[0];

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

	// CDN has changed for connection
	if (
		connection.prevs[strippedMediaPlaylistName] &&
		!cdn._id.equals(connection.prevs[strippedMediaPlaylistName]?.cdn)
	) {
		const lastIndex = manifest.segments.findIndex(
			(segment) =>
				segment.uri === connection.prevs[strippedMediaPlaylistName].lastSegment,
		);
		for (let i = lastIndex + 1; i < manifest.segments.length; i++) {
			const segment = manifest.segments[i];
			playlistContent += `#EXTINF:${segment.duration.toFixed(
				3,
			)},\n${ensureAbsoluteUrl(cdn.sourceBaseUrl, segment.uri)}\n`;
		}
	} else if (manifest.segments) {
		for (const segment of manifest.segments) {
			playlistContent += `#EXTINF:${segment.duration.toFixed(
				3,
			)},\n${ensureAbsoluteUrl(cdn.sourceBaseUrl, segment.uri)}\n`;
		}
	}

	return { playlistContent, lastSegment: manifest.segments.pop()?.uri };
}

async function playlistManagerFactory() {
	const masterPlaylists = await updateAndGetMasterPlaylists();
	const mediaPlaylists = await updateandGetMediaPlaylists();
	return new PlaylistManager(masterPlaylists, mediaPlaylists);
}

class PlaylistManager {
	constructor(masterPlaylists, mediaPlaylists) {
		// On init, update master and media playlists
		this.masterPlaylists = masterPlaylists;
		this.mediaPlaylists = mediaPlaylists;
	}
	async fetchMasterPlaylist(connectionId, name) {
		const playlist = await MasterPlaylist.findOne({ name });
		return getTokenizedMasterPlaylist(playlist.contents, connectionId);
	}
	async fetchMediaPlaylist(selectedCDN, name, connection) {
		const mediaPlaylist = await MediaPlaylist.findOne({ name });
		if (!mediaPlaylist) {
			return null;
		}
		//TODO: fetch from selected CDN
		const contents = await fetchFromOrigin(name);
		if (!selectedCDN) {
			return contents;
		}
		return reconstructMediaPlaylist(contents, selectedCDN, connection, name);
	}
}

module.exports = playlistManagerFactory;
