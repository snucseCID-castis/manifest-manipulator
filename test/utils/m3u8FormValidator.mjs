import { expect } from "chai";
import { Parser } from "m3u8-parser";

function validateM3U8Format(chunk) {
	const parser = new Parser();
	parser.push(chunk);
	parser.end();

	const manifest = parser.manifest;
	expect(manifest).to.exist;
	return manifest;
}

export default validateM3U8Format;
