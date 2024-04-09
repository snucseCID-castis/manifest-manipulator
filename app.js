const express = require("express");
const axios = require("axios");
const m3u8Parser = require("m3u8-parser");
const app = express();
const port = 3000;

const cdnMasterM3U8Urls = [
  "http://110.35.173.88:19090/live.stream/ts.noll_master.m3u8",
];

let availableQualities = {};

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
  }
  const urlObject = new URL(url, baseUrl);
  return urlObject.href;
}

async function loadAvailableQualities() {
  for (let url of cdnMasterM3U8Urls) {
    const manifest = await fetchAndParseM3U8(url);
    const baseUrl = url.substring(0, url.lastIndexOf("/") + 1);
    if (manifest && manifest.playlists) {
      manifest.playlists.forEach((playlist) => {
        const { BANDWIDTH, RESOLUTION } = playlist.attributes;
        const qualityKey = `${RESOLUTION.width}x${RESOLUTION.height}`;
        availableQualities[qualityKey] = availableQualities[qualityKey] || [];
        availableQualities[qualityKey].push({
          bandwidth: BANDWIDTH,
          baseUrl: baseUrl,
          playlistUri: playlist.uri, // 각 품질별 실제 플레이리스트 URL 저장
        });
      });
    }
  }
}

// create playlist according to the quality
async function createVariantPlaylist(qualityKey) {
  const qualityInfo = availableQualities[qualityKey];
  if (!qualityInfo) {
    console.error("No quality information found for:", qualityKey);
    return null;
  }

  let playlistContent = "#EXTM3U\n#EXT-X-VERSION:3\n";

  // todo: cdn selction logic (currently, using the first cdn)
  let { baseUrl, playlistUri } = qualityInfo[0];

  const variantManifest = await fetchAndParseM3U8(
    ensureAbsoluteUrl(baseUrl, playlistUri)
  );

  if (variantManifest.targetDuration) {
    playlistContent += `#EXT-X-TARGETDURATION:${variantManifest.targetDuration}\n`;
  }
  if (variantManifest.mediaSequence) {
    playlistContent += `#EXT-X-MEDIA-SEQUENCE:${variantManifest.mediaSequence}\n`;
  }

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

app.get("/playlist/:qualityM3U8", async (req, res) => {
  const qualityKey = req.params.qualityM3U8.split(".")[0];
  const playlistContent = await createVariantPlaylist(qualityKey);
  res.header("Content-Type", "application/vnd.apple.mpegurl");
  res.send(playlistContent);
});

app.get("/master.m3u8", (req, res) => {
  let masterPlaylistContent = "#EXTM3U\n";

  Object.keys(availableQualities).forEach((qualityKey) => {
    masterPlaylistContent += `#EXT-X-STREAM-INF:BANDWIDTH=${availableQualities[qualityKey][0]},RESOLUTION=${qualityKey}\n`;
    masterPlaylistContent += `/playlist/${qualityKey}.m3u8\n`;
  });

  res.header("Content-Type", "application/vnd.apple.mpegurl");
  res.send(masterPlaylistContent);
});

// load available qualities when the server starts
loadAvailableQualities().then(() => {
  //console.log("Loaded qualities: ", availableQualities);
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
});
