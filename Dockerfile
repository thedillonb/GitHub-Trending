FROM node:10

ADD dist /app
ADD package-lock.json /app
ADD package.json /app

WORKDIR /app

RUN npm install

EXPOSE 3000

CMD ["npm", "start"]
