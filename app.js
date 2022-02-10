const fs = require("fs");
const express = require("express");
const multer = require("multer");
const OAuth2Data = require("./credentials.json");
const { google } = require("googleapis");

const app = express();

const oAuth2Client = new google.auth.OAuth2(
    OAuth2Data.web.client_id,
    OAuth2Data.web.client_secret,
    OAuth2Data.web.redirect_uris[0]
);
var isAuth = false;

const SCOPES =
    "https://www.googleapis.com/auth/youtube.force-ssl https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/youtubepartner ";

app.set("view engine", "ejs");

var Storage = multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, "./videos");
    },
    filename: function (req, file, callback) {
        callback(null, file.fieldname + "_" + Date.now() + "_" + file.originalname);
    },
});

var upload = multer({
    storage: Storage,
}).single("file");

app.get("/", (req, res) => {
    if (!isAuth) {
        var url = oAuth2Client.generateAuthUrl({
            access_type: "offline",
            scope: SCOPES,
        });
        console.log(url);
        res.render("index", { url: url });
    } else {
        var oauth2 = google.oauth2({
            auth: oAuth2Client,
            version: "v2",
        });
        oauth2.userinfo.get(function (err, response) {
            if (err) {
                console.log(err);
            } else {
                console.log(response.data);
                name = response.data.name;
                pic = response.data.picture;
                res.render("success", {
                    name: response.data.name,
                    pic: response.data.picture,
                    success: false,
                });
            }
        });
    }
});

app.post("/upload", (req, res) => {
    upload(req, res, function (err) {
        if (err) {
            console.log(err);
            return res.end("Something went wrong");
        } else {
            const { tags, title, description } = req.body;
            const youtube = google.youtube({ version: "v3", auth: oAuth2Client });
            console.log(youtube)
            youtube.videos.insert(
                {
                    resource: {
                        snippet: {
                            title: title,
                            description: description,
                            tags: tags
                        },
                        status: {
                            privacyStatus: "private",
                        },
                    },
                    part: "snippet,status",
                    media: {
                        body: fs.createReadStream(req.file.path)
                    },
                },
                (err, data) => {
                    if (err) throw err
                    fs.unlinkSync(req.file.path);
                    res.render("success", { name: name, pic: pic, success: true });
                }
            );
        }
    });
});

app.post("/playlist/insert", (req, res) => {
    upload(req, res, function (err) {
        if (err) {
            console.log(err);
            return res.end("Something went wrong");
        } else {
            const { playlistId } = req.body;
            const youtube = google.youtube({ version: "v3", auth: oAuth2Client });
            console.log(youtube)
            youtube.playlistItems.insert(
                {
                    resource: {
                        snippet: {
                            playlistId: "PL3-Wy9Q2edEYH1jZkXbXGC2xZUnJjlzJp",
                            resourceId: {
                                kind: "youtube#video",
                                videoId: playlistId,
                            }
                        },
                    },
                    part: "contentDetails,snippet",
                },
                (err, data) => {
                    if (err) throw err
                    res.render("success", { name: name, pic: pic, success: true });
                });
        }
    });
});

app.get("/logout", (req, res) => {
    isAuth = false;
    res.redirect("/");
});

app.get("/google/callback", function (req, res) {
    const code = req.query.code;
    if (code) {
        oAuth2Client.getToken(code, function (err, tokens) {
            if (err) {
                console.log(err);
            } else {
                console.log("Successfully authenticated");
                oAuth2Client.setCredentials(tokens);
                isAuth = true;
                res.redirect("/");
            }
        });
    }
});

app.listen(8000, () => {
    console.log("App is running on http://localhost:8000");
});
