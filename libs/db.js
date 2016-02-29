'use strict';
const path = require('path');
const dbPath = path.join(__dirname, '..', '.db');
const fs = require('fs');

function readFile(path) {
  return new Promise((res, rej) => {
    fs.readFile(path, (err, data) => err ? rej(err) : res(data));
  });
}

function access(path, flags) {
  return new Promise((res, rej) => {
    fs.access(path, flags, (err) => err ? rej(err) : res());
  });
}

module.exports.getLanguages = function() {
  return readFile(path.join(dbPath, 'trending', 'languages.json')).then(JSON.parse);
};

module.exports.getTrending = function(language, since) {
  const db = path.join(dbPath, 'trending', `${language}.${since}.json`);
  return access(db, fs.F_OK | fs.R_OK).then(x => readFile(db).then(y => JSON.parse(y)), err => null);
}

module.exports.getShowcases = function() {
  const db = path.join(dbPath, 'showcase', 'showcases.json');
  return readFile(db).then(JSON.parse);
}

module.exports.getShowcase = function(showcase) {
  const db = path.join(dbPath, 'showcase', `${showcase}.json`);
  return access(db, fs.F_OK | fs.R_OK).then(x => readFile(db).then(y => JSON.parse(y)), err => null);
}
