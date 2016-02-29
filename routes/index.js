'use strict';
const express = require('express');
const co = require('co');
const db = require('../libs/db');
const _ = require('underscore');
const router = express.Router();

function wrap(fn) {
  return (req, res, next) => co(fn(req, res, next)).catch(err => next(err));
}

function transformRepositoryToV1(r) {
  return {
    owner: (r.owner || {}).login,
    name: r.name,
    url: r.url,
    avatarUrl: (r.owner || {}).avatar_url,
    description: r.description,
    stars: r.stargazers_count,
    forks: r.forks_count
  };
}

router.get('/', function(req, res) {
  res.json({
    'languages_url': req.domain + '/languages',
    'trending_url': req.domain + '/trending',
    'showcases_url': req.domain + '/showcases'
  });
});

router.get('/languages', wrap(function *(req, res) {
  let languages = yield db.getLanguages();
  languages = _.reject(languages, function(l) { return l.slug === 'all' });
  languages = _.sortBy(languages, function(l) { return l.name });
  res.json(languages);
}));

// Get rid of this soon...
router.get('/trending', wrap(function *(req, res) {
  const language = req.query.language || 'all';
  const since = req.query.since || 'daily';
  const trending = yield db.getTrending(language, since);
  if (!trending) return res.status(404).end();
  res.json(trending.map(transformRepositoryToV1));
}));

router.get('/v2/trending', wrap(function *(req, res, next) {
  const language = req.query.language || 'all';
  const since = req.query.since || 'daily';
  const trending = yield db.getTrending(language, since);
  if (!trending) return res.status(404).end();
  res.json(trending);
}));

router.get('/showcases', wrap(function *(req, res, next) {
  res.json((yield db.getShowcases()).map(x => {
    return {
      name: x.name,
      slug: x.slug,
      description: x.description,
      image_url: req.domain + '/' + x.image
    };
  }));
}));

router.get('/showcases/:id', wrap(function*(req, res, next) {
  const showcase = yield db.getShowcase(req.params.id);
  if (!showcase) return res.status(404).end();
  res.json(showcase);
}));

module.exports = router;
