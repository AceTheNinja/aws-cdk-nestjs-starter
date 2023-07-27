FROM node:18.17.0-slim

RUN npm i -g @nestjs/cli

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

CMD npm run start:prod