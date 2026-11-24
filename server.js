const express = require("express");
const cors = require("cors");
const http = require("http");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

let ouvintes = 0;

app.get("/", (req, res) => {
  res.json({
    radio: "Web Rádio Provérbios",
    status: "online",
    mensagem: "Servidor de rádio iniciado",
    stream: "/stream"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    radio: "Web Rádio Provérbios",
    ouvintes: ouvintes
  });
});

app.get("/stream", (req, res) => {
  res.status(503).json({
    status: "aguardando_audio",
    radio: "Web Rádio Provérbios",
    mensagem: "Servidor online. Aguardando configuração da fonte de áudio."
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("Web Rádio Provérbios iniciada na porta " + PORT);
});
