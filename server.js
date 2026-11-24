const express = require("express");
const cors = require("cors");
const http = require("http");

const app = express();
const server = http.createServer(app);

app.use(cors());

const PORT = process.env.PORT || 3000;
const SOURCE_USER = process.env.SOURCE_USER || "source";
const SOURCE_PASSWORD = process.env.SOURCE_PASSWORD;

let sourceConnected = false;
let totalBytes = 0;
const listeners = new Set();

app.get("/", (req, res) => {
  res.json({
    radio: "Web Rádio Provérbios",
    status: "online",
    transmission: sourceConnected ? "recebendo áudio" : "aguardando conexão",
    stream: "/stream"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    radio: "Web Rádio Provérbios",
    sourceConnected,
    listeners: listeners.size,
    receivingAudio: sourceConnected,
    totalBytes
  });
});

// Entrada de áudio do painel
server.on("request", (req, res) => {
  const path = req.url.split("?")[0];

  if (
    ["/source", "/live"].includes(path) &&
    ["SOURCE", "PUT", "POST"].includes(req.method)
  ) {
    if (!SOURCE_PASSWORD) {
      res.writeHead(503);
      return res.end("Configure SOURCE_PASSWORD no Render");
    }

    const auth = req.headers.authorization || "";
    const expected = Buffer.from(
      SOURCE_USER + ":" + SOURCE_PASSWORD
    ).toString("base64");

    if (auth !== "Basic " + expected) {
      res.writeHead(401, {
        "WWW-Authenticate": 'Basic realm="Radio Source"'
      });
      return res.end("Unauthorized");
    }

    if (sourceConnected) {
      res.writeHead(409);
      return res.end("Já existe uma transmissão conectada");
    }

    sourceConnected = true;
    console.log("Fonte de áudio conectada!");

    res.writeHead(200, {
      "Content-Type": "text/plain",
      "Connection": "keep-alive"
    });
    res.flushHeaders();

    req.on("data", chunk => {
      totalBytes += chunk.length;

      for (const listener of listeners) {
        if (!listener.destroyed) {
          listener.write(chunk);
        }
      }
    });

    req.on("end", () => {
      sourceConnected = false;
      for (const listener of listeners) listener.end();
      listeners.clear();
      res.end();
    });

    req.on("close", () => {
      sourceConnected = false;
      for (const listener of listeners) listener.end();
      listeners.clear();
      res.end();
    });

    return;
  }

  if (req.method === "GET" &&
      ["/stream", "/radio.mp3"].includes(path)) {

    res.writeHead(200, {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*"
    });

    res.flushHeaders();
    listeners.add(res);

    req.on("close", () => {
      listeners.delete(res);
    });

    return;
  }

  if (req.method === "GET" && path === "/") {
    return;
  }

  if (req.method === "GET" && path === "/api/health") {
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("Web Rádio Provérbios online na porta " + PORT);
});
