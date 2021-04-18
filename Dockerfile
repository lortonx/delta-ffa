FROM node:current-alpine
RUN apk --no-cache add git
RUN apk add gcompat

WORKDIR .

COPY package.json .

RUN npm install

COPY . .

CMD [ "npm","start"]