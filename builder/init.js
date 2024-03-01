const http = require("http");
const https = require("https");
const path = require("path");
const fs = require("fs");
const setPic = require("./getPic");
const genIndex = require("./genIndex");
const {
  generateMarkupLocal,
  generateMarkupRemote,
} = require("./generateMarkup");

require("dotenv").config();

if (!process.env.NAME) throw new Error("Please specify NAME in environment.");
if (!process.env.PIC) throw new Error("Please specify PIC in environment.");

const picPath = process.env.PIC;
const msgPath = process.env.SCROLL_MSG;

// Local initialization
const setLocalData = async () => {
  try {
    const pic = path.join(__dirname, "../local/", picPath);
    let markup = "";
    if (msgPath) {
      const text = fs.readFileSync(path.join(__dirname, "../local/", msgPath), {
        encoding: "utf-8",
      });
      markup = generateMarkupLocal(text);
    }
    await setPic(pic);
    genIndex(markup);
  } catch (e) {
    throw new Error(e.message);
  }
};

// Remote initialization
const setRemoteData = async () => {
  try {
    // Log the URL before making the request
    console.log("Attempting to fetch pic from:", picPath);

    // Determine the protocol based on the URL
    const protocol = picPath.startsWith("https") ? https : http;

    // Perform HTTP GET request for the picPath
    const res = await new Promise((resolve, reject) => {
      const request = protocol.get(picPath, (response) => {
        let data = [];

        response.on("data", (chunk) => {
          data.push(chunk);
        });

        response.on("end", () => {
          resolve({
            data: Buffer.concat(data),
            headers: response.headers,
          });
        });
      });

      request.on("error", (error) => {
        reject(error);
      });

      request.end();
    });

    const pic = res.data;
    let markup = "";

    if (msgPath) {
      const article = msgPath.split("/").pop();

      // Log the URL before making the second request
      const secondUrl = `https://api.telegra.ph/getPage/${article}?return_content=true`;
      console.log("Attempting to fetch content from:", secondUrl);

      // Perform HTTP GET request for the secondUrl
      const contentRes = await new Promise((resolve, reject) => {
        https.get(secondUrl, (response) => {
          let contentData = [];

          response.on("data", (chunk) => {
            contentData.push(chunk);
          });

          response.on("end", () => {
            resolve({
              content: Buffer.concat(contentData).toString(),
            });
          });
        }).on("error", (error) => {
          reject(error);
        });
      });

      const { content } = JSON.parse(contentRes.content);
      markup = content.reduce(
        (string, node) => string + generateMarkupRemote(node),
        ""
      );
    }

    await setPic(pic);
    genIndex(markup);
  } catch (e) {
    console.error("Error in setRemoteData:", e);
    throw new Error(e.message);
  }
};

if (process.argv[2] === "--local") setLocalData();
else if (process.argv[2] === "--remote") setRemoteData();
else console.log("Fetch mode not specified.");
