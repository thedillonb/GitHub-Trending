FROM google/nodejs

ADD . /app

WORKDIR /app

RUN npm install

EXPOSE 3000

CMD ["/nodejs/bin/npm", "start"]
