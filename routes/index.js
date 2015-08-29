var express = require('express');
var db = require('../libs/db');
var _ = require('underscore');
var router = module.exports = express.Router();

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

router.get('/languages', function(req, res, next) {
    db.Trending.find({}, 'language', function(err, data) {
        if (err) return next(err);
        if (!data) return next(new Error('Unable to retrieve data from database!'));
        var languages = _.map(data, function(d) { return d.language });
        languages = _.reject(languages, function(l) { return l.slug === 'all' });
        languages = _.sortBy(languages, function(l) { return l.name });
        res.json(languages);
    });
});

// Get rid of this soon...
router.get('/trending', function(req, res, next) {
    var language = req.query.language || 'all';
    var since = req.query.since || 'daily';
    db.Trending.findOne({ 'language.slug': language }, 'repositories.' + since, function(err, data) {
        if (err) return next(err);
        if (!data) return res.status(404).end();
        res.json(_.map(data.repositories[since], transformRepositoryToV1));
    });
});

router.get('/v2/trending', function(req, res, next) {
    var language = req.query.language || 'all';
    var since = req.query.since || 'daily';
    db.Trending.findOne({ 'language.slug': language }, 'repositories.' + since, function(err, data) {
        if (err) return next(err);
        if (!data) return res.status(404).end();
        res.json(data.repositories[since]);
    });
});

router.get('/showcases', function(req, res, next) {
    db.Explore.find({}, 'slug name description image', function(err, data) {
        if (err) return next(err);
        if (!data) return next(new Error('Unable to retrieve data from database!'));
        res.json(_.map(data, function(x) {
            return {
                name: x.name,
                slug: x.slug,
                description: x.description,
                image_url: req.domain + '/' + x.image
            };
        }));
    });
});

router.get('/showcases/:id', function(req, res, next) {
    db.Explore.findOne({ slug: req.params.id }, function(err, data) {
        if (err) return next(err);
        if (!data) return res.status(404).end();
        res.json({
            name: data.name,
            slug: data.slug,
            description: data.description,
            image_url: req.domain + '/' + data.image,
            repositories: data.repositories
        });
    });
});
