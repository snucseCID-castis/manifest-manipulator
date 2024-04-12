const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

app.get("/mm", (req, res) => {
  const m3u8Url = "http://110.35.173.88:19090/live.stream/ts.noll_master.m3u8";

  res.redirect(m3u8Url);
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Server listening at http://0.0.0.0:${port}`);
});
