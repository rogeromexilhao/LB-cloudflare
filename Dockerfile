FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=3000 \
    NOME_SERVIDOR=sem-nome

WORKDIR /app

# Sem dependencias: nada de package.json nem npm install.
COPY server.js ./

# Usuario nao-root ja presente na imagem oficial.
USER node

EXPOSE 3000

CMD ["node", "server.js"]
