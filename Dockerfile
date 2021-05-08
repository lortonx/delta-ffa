#FROM node:current-alpine
FROM node:16-alpine3.11
RUN apk --no-cache add git
RUN apk add gcompat

WORKDIR .

COPY package.json .

RUN npm install

COPY . .

CMD [ "npm","start"]