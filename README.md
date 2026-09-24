# LB-cloudflare

Servidor HTTP falso para usar como origem de teste num Cloudflare Load Balancer.
Sem banco, sem autenticação, sem dependências — só se identifica e responde.

Rode duas instâncias em domínios diferentes, derrube a saúde de uma e confira
se o tráfego vai para a outra.

## Variáveis de ambiente

| Nome | Padrão | Para que |
|---|---|---|
| `NOME_SERVIDOR` | `sem-nome` | Identifica qual instância respondeu |
| `PORT` | `3000` | Porta HTTP |

## Rotas

**`GET /health`** e **`GET /check`** — é o que o Cloudflare consulta. Os dois
caminhos são equivalentes: mesmo status, mesmo corpo, mesmos headers. `/check`
existe para o monitor usar um caminho só em todas as origens, já que o serviço
real expõe o health check nesse caminho.

- Arquivo `/tmp/health_off` existe → **500** `{"status":"off","servidor":"<NOME_SERVIDOR>"}`
- Caso contrário → **200** `{"status":"ok","servidor":"<NOME_SERVIDOR>"}`

O arquivo é verificado a cada requisição, nunca em cache.

**Qualquer outra rota** — **200** com:

```json
{
  "servidor": "origem-a",
  "host": "a.exemplo.com",
  "metodo": "GET",
  "url": "/qualquer/coisa",
  "hora": "2026-09-24T18:40:00.000Z"
}
```

`host` é o header `Host` recebido — serve para conferir se o override de Host
header do load balancer está chegando certo.

## Headers

Todas as respostas — inclusive as de erro e as do health check — saem com:

| Header | Valor | Para que |
|---|---|---|
| `Content-Type` | `application/json` | Corpo é sempre JSON |
| `Cache-Control` | `no-store` | CDN não cacheia e não falseia o teste de failover |
| `X-Skale-Node` | `<NOME_SERVIDOR>` | Identifica a origem sem depender do corpo |

```bash
curl -sS -D- -o/dev/null https://a.exemplo.com/check
```

## Build e run

```bash
docker build -t lb-origem .
```

```bash
docker run -d --name origem-a -p 3000:3000 -e NOME_SERVIDOR=origem-a lb-origem
```

```bash
docker run -d --name origem-b -p 3001:3000 -e NOME_SERVIDOR=origem-b lb-origem
```

## Ligar e desligar a saúde

O interruptor é só o arquivo `/tmp/health_off`. Não existe rota HTTP que ligue ou
desligue a saúde — seria um botão público de derrubar o serviço.

```bash
docker exec <container> touch /tmp/health_off
```

```bash
docker exec <container> rm /tmp/health_off
```

## Logs

Uma linha por requisição no stdout, com hora, método, URL, host e status:

```
2026-09-24T18:40:00.000Z GET /health host=a.exemplo.com status=200
```

```bash
docker logs -f origem-a
```

## Encerramento

Em `SIGTERM` (`docker stop`) o servidor para de aceitar conexões novas, termina as
em andamento e sai com código 0. Há um limite de 10s antes da saída forçada.
