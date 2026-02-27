FROM node:22-alpine
WORKDIR /app

COPY package*.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/realtime/package.json apps/realtime/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/game-engines/package.json packages/game-engines/package.json

RUN npm install

COPY . .
RUN npm run build:packages && npm run build -w @multiwebgame/realtime

EXPOSE 4001
CMD ["npm", "run", "start", "-w", "@multiwebgame/realtime"]
