'use strict';

const http = require('node:http');
const fs = require('node:fs');

const NOME_SERVIDOR = process.env.NOME_SERVIDOR || 'sem-nome';
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

// Interruptor de saude. Criado/removido por `docker exec`, nunca por rota HTTP.
const ARQUIVO_SAUDE_OFF = '/tmp/health_off';

// Toda resposta precisa passar intacta pelo CDN: sem cache, sempre JSON.
function responder(res, status, corpo) {
  const payload = JSON.stringify(corpo);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(payload),
    // Identifica a origem sem depender do corpo da resposta.
    'X-Skale-Node': NOME_SERVIDOR,
  });
  res.end(payload);
}

function saudeDesligada() {
  // Checado a cada requisicao, sem cache em memoria.
  try {
    return fs.existsSync(ARQUIVO_SAUDE_OFF);
  } catch {
    return false;
  }
}

function caminhoDe(url) {
  const fim = url.search(/[?#]/);
  return fim === -1 ? url : url.slice(0, fim);
}

const server = http.createServer((req, res) => {
  const hora = new Date().toISOString();
  const host = req.headers.host || '';
  const caminho = caminhoDe(req.url || '/');

  let status;
  // /check e apelido de /health: o monitor usa um caminho so para todas as origens.
  if (caminho === '/health' || caminho === '/check') {
    status = saudeDesligada() ? 500 : 200;
    responder(res, status, {
      status: status === 200 ? 'ok' : 'off',
      servidor: NOME_SERVIDOR,
    });
  } else {
    status = 200;
    responder(res, status, {
      servidor: NOME_SERVIDOR,
      host,
      metodo: req.method,
      url: req.url,
      hora,
    });
  }

  console.log(
    `${hora} ${req.method} ${req.url} host=${host || '-'} status=${status}`
  );
});

server.listen(PORT, HOST, () => {
  console.log(
    `${new Date().toISOString()} servidor=${NOME_SERVIDOR} escutando em ${HOST}:${PORT}`
  );
});

let encerrando = false;
function encerrar(sinal) {
  if (encerrando) return;
  encerrando = true;
  console.log(`${new Date().toISOString()} ${sinal} recebido, encerrando`);

  // Para de aceitar conexoes novas; sai quando as em andamento terminarem.
  server.close(() => {
    console.log(`${new Date().toISOString()} encerrado`);
    process.exit(0);
  });

  // Conexoes keep-alive ociosas nao seguram o processo.
  server.closeIdleConnections();

  // Rede de seguranca: nao ficar preso para sempre numa requisicao travada.
  const limite = setTimeout(() => {
    console.log(`${new Date().toISOString()} timeout de encerramento, saindo`);
    process.exit(0);
  }, 10000);
  limite.unref();
}

process.on('SIGTERM', () => encerrar('SIGTERM'));
process.on('SIGINT', () => encerrar('SIGINT'));
