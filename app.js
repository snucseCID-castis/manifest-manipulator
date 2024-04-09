const express = require("express");
const axios = require("axios");
const m3u8Parser = require("m3u8-parser");
const app = express();
const port = 3000;

const cdnMasterM3U8Urls = [
  "http://110.35.173.88:19090/live.stream/ts.noll_master.m3u8",
];

let availableVideos = {};
let availableAudios = {};

// logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`
    );
  });
  next();
});

async function fetchAndParseM3U8(url) {
  try {
    const response = await axios.get(url);
    const parser = new m3u8Parser.Parser();
    parser.push(response.data);
    parser.end();
    return parser.manifest;
  } catch (error) {
    console.error("Failed to fetch and parse M3U8:", url);
    return null;
  }
}

function ensureAbsoluteUrl(baseUrl, url) {
  if (url.startsWith("http")) {
    return url;
  } else {
    const urlObject = new URL(url, baseUrl);
    return urlObject.href;
  }
}

function ensureRelativeUrl(url) {
  if (url.startsWith("http")) {
    const urlObject = new URL(url);
    return urlObject.pathname;
  } else {
    return url;
  }
}

// save available qualities from the cdn links
async function saveAvailableContents() {
  for (let url of cdnMasterM3U8Urls) {
    const manifest = await fetchAndParseM3U8(url);
    const baseUrl = url.substring(0, url.lastIndexOf("/") + 1);

    // save cdn video urls with same pathname (ex. /v360.m3u8)
    if (manifest && manifest.playlists) {
      manifest.playlists.forEach((playlist) => {
        vPathname = ensureRelativeUrl(playlist.uri);

        availableVideos[vPathname] = availableVideos[vPathname] || [];
        availableVideos[vPathname].push({
          bandwidth: playlist.attributes.BANDWIDTH,
          resolution: `${playlist.attributes.RESOLUTION.width}x${playlist.attributes.RESOLUTION.height}`,
          baseUrl: baseUrl,
        });
      });
    }

    // save cdn audio urls with same pathname (ex. /a360.m3u8)
    if (manifest && manifest.mediaGroups && manifest.mediaGroups.AUDIO) {
      Object.keys(manifest.mediaGroups.AUDIO).forEach((groupId) => {
        const group = manifest.mediaGroups.AUDIO[groupId];

        Object.keys(group).forEach((trackId) => {
          const track = group[trackId];

          aPathname = ensureRelativeUrl(track.uri);
          availableAudios[aPathname] = availableAudios[aPathname] || [];
          availableAudios[aPathname].push({
            groupId: groupId,
            name: trackId,
            default: track.default,
            baseUrl: baseUrl,
          });
        });
      });
    }
  }
}

// create video playlist for matching pathname
async function createVideoPlaylist(pathname) {
  const videoCDNs = availableVideos[pathname];
  if (!videoCDNs) {
    console.error("No video pathname information found for:", pathname);
    return null;
  }

  let playlistContent = "#EXTM3U\n";

  // todo: cdn selction logic (currently, just select the first cdn)
  let { baseUrl } = videoCDNs[0];

  const variantManifest = await fetchAndParseM3U8(
    ensureAbsoluteUrl(baseUrl, pathname)
  );

  // todo: can we add all the attributes automatically?
  if (variantManifest.version) {
    playlistContent += `#EXT-X-VERSION:${variantManifest.version}\n`;
  }
  if (variantManifest.mediaSequence) {
    playlistContent += `#EXT-X-MEDIA-SEQUENCE:${variantManifest.mediaSequence}\n`;
  }
  if (variantManifest.targetDuration) {
    playlistContent += `#EXT-X-TARGETDURATION:${variantManifest.targetDuration}\n`;
  }

  // video track selection
  // todo: may need to vary cdn for every segment
  if (variantManifest && variantManifest.segments) {
    variantManifest.segments.forEach((segment) => {
      playlistContent += `#EXTINF:${segment.duration},\n${ensureAbsoluteUrl(
        baseUrl,
        segment.uri
      )}\n`;
    });
  }

  return playlistContent;
}

async function createAudioPlaylist(pathname) {
  const audioCDNs = availableAudios[pathname];
  if (!audioCDNs) {
    console.error("No audio pathname information found for:", pathname);
    return null;
  }
  let playlistContent = "#EXTM3U\n";

  // todo: cdn selction logic (currently, just select the first cdn)
  let { baseUrl } = audioCDNs[0];

  const variantManifest = await fetchAndParseM3U8(
    ensureAbsoluteUrl(baseUrl, pathname)
  );

  // todo: can we add all the attributes automatically?
  if (variantManifest.version) {
    playlistContent += `#EXT-X-VERSION:${variantManifest.version}\n`;
  }
  if (variantManifest.mediaSequence) {
    playlistContent += `#EXT-X-MEDIA-SEQUENCE:${variantManifest.mediaSequence}\n`;
  }
  if (variantManifest.targetDuration) {
    playlistContent += `#EXT-X-TARGETDURATION:${variantManifest.targetDuration}\n`;
  }

  // audio track selection
  // todo: may need to vary cdn for every segment
  if (variantManifest && variantManifest.segments) {
    variantManifest.segments.forEach((segment) => {
      playlistContent += `#EXTINF:${segment.duration},\n${ensureAbsoluteUrl(
        baseUrl,
        segment.uri
      )}\n`;
    });
  }

  return playlistContent;
}

// give video playlist for requested pathname
app.get("/video/:pathname", async (req, res) => {
  const pathname = req.params.pathname;
  const playlistContent = await createVideoPlaylist(pathname);
  res.header("Content-Type", "application/vnd.apple.mpegurl");
  res.send(playlistContent);
});

// give audio playlist for requested pathname
app.get("/audio/:pathname", async (req, res) => {
  const pathname = req.params.pathname;
  const playlistContent = await createAudioPlaylist(pathname);
  res.header("Content-Type", "application/vnd.apple.mpegurl");
  res.send(playlistContent);
});

// create master playlist including our playlist urls
app.get("/master.m3u8", (req, res) => {
  let masterPlaylistContent = "#EXTM3U\n";

  Object.keys(availableVideos).forEach((pathname) => {
    // suppose that the options of video playlist are same if the pathname is same
    video = availableVideos[pathname][0];
    masterPlaylistContent += `#EXT-X-STREAM-INF:BANDWIDTH=${video.bandwidth},RESOLUTION=${video.resolution}\n`;
    masterPlaylistContent += `/video/${pathname}\n`;
  });

  Object.keys(availableAudios).forEach((pathname) => {
    // suppose that the options of audio playlist are same if the pathname is same
    audio = availableAudios[pathname][0];
    masterPlaylistContent += `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="${audio.groupId}",NAME="${audio.name}",URI="/audio/${pathname}"\n`;
  });

  res.header("Content-Type", "application/vnd.apple.mpegurl");
  res.send(masterPlaylistContent);
});

// save available video and audio urls when the server starts
saveAvailableContents().then(() => {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
});
