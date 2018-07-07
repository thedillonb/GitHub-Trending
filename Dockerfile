FROM node:10

ADD . /app

WORKDIR /app

RUN npm install && npm run build

EXPOSE 3000

CMD ["npm", "start"]
