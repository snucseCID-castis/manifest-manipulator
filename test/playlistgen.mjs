import { use, expect } from "chai";
import chaiHttp from "chai-http";
import nock from "nock";
import { app, saveAvailableContents } from "../app.js";
import validateM3U8Format from "./utils/m3u8FormValidator.mjs";
const chai = use(chaiHttp);

describe("[Test] Master and video/audio api validation", () => {
	let server;
	let playlistURIs = [];

	before(() => {
		nock("http://110.35.173.88:19090/live.stream")
			.get("/ts.noll_master.m3u8")
			.reply(
				200,
				`#EXTM3U
#EXT-X-MEDIA:TYPE=AUDIO,URI="noll_index-a257.m3u8",GROUP-ID="a257",NAME="ENGLISH",CHANNELS="1"
#EXT-X-STREAM-INF:BANDWIDTH=451635,CODECS="avc1.42c01e,mp4a.40.2",RESOLUTION=720x480,AUDIO="a257"
noll_index-v256.m3u8`,
				{
					"Content-Type": "application/vnd.apple.mpegurl",
				},
			);

		nock("http://110.35.173.88:19090/live.stream")
			.get("/noll_index-v256.m3u8")
			.reply(
				200,
				`#EXTM3U
#EXTINF:10,
segment1.ts
#EXTINF:10,
segment2.ts
#EXT-X-ENDLIST`,
				{
					"Content-Type": "application/vnd.apple.mpegurl",
				},
			);
	});

	before(async () => {
		server = app.listen(0);
		await saveAvailableContents();
	});

	after((done) => {
		nock.cleanAll();
		console.log(
			`[Test] Server running on port ${server.address().port} closed`,
		);
		server.close(done);
	});

	it("Get /master.m3u8 Validation", (done) => {
		chai
			.request(app)
			.get("/master.m3u8")
			.buffer()
			.parse((res, callback) => {
				let data = "";
				res.setEncoding("utf8");
				res.on("data", (chunk) => {
					data += chunk;
				});
				res.on("end", () => {
					callback(null, data);
				});
			})
			.end((err, res) => {
				expect(err).to.be.null;
				expect(res).to.have.status(200);
				expect(res.body).to.not.be.null;
				const masterManifest = validateM3U8Format(res.body);

				//save playlist URIs for future tests
				expect(masterManifest).to.have.property("playlists");
				expect(masterManifest.playlists.length).to.be.greaterThan(0);
				playlistURIs = masterManifest.playlists.map((playlist) => playlist.uri);
			});
		done();
	});

	it("Get /video/:pathname, /audio/:pathname validation", (done) => {
		playlistURIs.forEach((uri, index) => {
			chai
				.request(app)
				.get(uri)
				.end((err, res) => {
					expect(err).to.be.null;
					expect(res).to.have.status(200);
					expect(res.body).to.not.be.null;
					validateM3U8Format(res.body);
				});
		});
		done();
	});
});
