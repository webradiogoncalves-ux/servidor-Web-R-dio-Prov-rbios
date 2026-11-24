const express = require("express");
const cors = require("cors");
const http = require("http");

const app = express();
const server = http.createServer(app);

app.use(cors());

const PORT = process.env.PORT || 10000;
const SOURCE_USER = process.env.SOURCE_USER || "source";
const SOURCE_PASSWORD = process.env.SOURCE_PASSWORD;

let sourceConnected = false;
let totalBytes = 0;
let listeners = new Set();

app.get("/", (req, res) => {
  res.json({
    radio: "Web Rádio Provérbios",
    status: "online",
    transmissao: sourceConnected ? "recebendo áudio" : "aguardando áudio",
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

// Receber transmissão do painel
app.all(["/source", "/live"], (req, res) => {
  if (!["POST", "PUT", "SOURCE"].includes(req.method)) {
    return res.status(405).send("Método não permitido");
  }

  if (!SOURCE_PASSWORD) {
    return res.status(503).send("Configure SOURCE_PASSWORD no Render");
  }

  const auth = req.headers.authorization || "";
  const expected = Buffer.from(
    SOURCE_USER + ":" + SOURCE_PASSWORD
  ).toString("base64");

  if (auth !== "Basic " + expected) {
    return res.status(401).send("Acesso não autorizado");
  }

  if (sourceConnected) {
    return res.status(409).send("Já existe uma transmissão conectada");
  }

  sourceConnected = true;

  console.log("Fonte de áudio conectada!");

  res.status(200);
  res.setHeader("Content-Type", "text/plain");
  res.flushHeaders();

  req.on("data", chunk => {
    totalBytes += chunk.length;

    for (const listener of listeners) {
      if (!listener.destroyed && listener.writable) {
        listener.write(chunk);
      }
    }
  });

  req.on("end", () => {
    sourceConnected = false;

    for (const listener of listeners) {
      listener.end();
    }

    listeners.clear();
    res.end();
    console.log("Transmissão encerrada");
  });

  req.on("aborted", () => {
    sourceConnected = false;

    for (const listener of listeners) {
      listener.end();
    }

    listeners.clear();
  });
});

// Link público de áudio
app.get(["/stream", "/radio.mp3"], (req, res) => {
  res.writeHead(200, {
    "Content-Type": "audio/mpeg",
    "Cache-Control": "no-cache, no-store",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*"
  });

  res.flushHeaders();

  listeners.add(res);

  req.on("close", () => {
    listeners.delete(res);
  });
});

// Página não encontrada
app.use((req, res) => {
  res.status(404).send("Página não encontrada");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    "Web Rádio Provérbios online na porta " + PORT
  );
});
