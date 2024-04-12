require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const app = express();
const port = process.env.PORT || 3000;
const databaseURI = process.env.DATABASE_URI;

app.get("/mm", (req, res) => {
  const m3u8Url = "http://110.35.173.88:19090/live.stream/ts.noll_master.m3u8";

  res.redirect(m3u8Url);
});

mongoose
  .connect(databaseURI)
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(port, "0.0.0.0", () => {
      console.log(`Server listening at port ${port}`);
    });
  })
  .catch((err) => {
    console.log("Error connecting to MongoDB", err);
  });
