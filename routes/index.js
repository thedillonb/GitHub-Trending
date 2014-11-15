var express = require('express');
var db = require('../libs/db');
var _ = require('underscore');
var router = module.exports = express.Router();

router.get('/', function(req, res) {
  res.json({
    'languages': '/languages',
    'trending': '/trending',
    'showcases': '/showcases'
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

router.get('/trending', function(req, res, next) {
    var language = req.query.language || 'all';
    var since = req.query.since || 'daily';
    db.Trending.findOne({ 'language.slug': language }, 'repositories.' + since, function(err, data) {
        if (err) return next(err);
        if (!data) return res.send(404);
        res.json(data.repositories[since]);
    });
});

router.get('/showcases', function(req, res, next) {
    db.Explore.find({}, 'slug name description image', function(err, data) {
        if (err) return next(err);
        if (!data) return next(new Error('Unable to retrieve data from database!'));
        res.json(data);
    });
});

router.get('/showcases/:id', function(req, res, next) {
    db.Explore.findOne({ slug: req.params.id }, function(err, data) {
        if (err) return next(err);
        if (!data) return res.send(404);
        res.json(data);
    });
});