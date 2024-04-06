const express = require("express");
const app = express();
const port = 3000;

//api request log
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

app.get("/mm", (req, res) => {
  const m3u8Url = "http://110.35.173.88:19090/live.stream/ts.noll_master.m3u8";

  res.redirect(m3u8Url);
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
