FROM node:18-alpine 

RUN apk update
RUN apk upgrade
RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY package*.json .
COPY .env .
RUN npm install

COPY index.js .

CMD [ "npm" , "start" ]
