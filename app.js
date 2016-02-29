const express = require('express');
const path = require('path');
const logger = require('morgan');
const bodyParser = require('body-parser');
const routes = require('./routes/index');
const db = require('./libs/db');
const app = express();

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// Insert the domain into the request so we can build links
app.use(function(req, res, next) {
    req.domain = req.protocol + '://' + req.get('host');
    next();
});

app.use('/', routes);
app.use('/v2', routes);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

app.use(function(err, req, res, next) {
    res.status(err.status || 500).end();
});

module.exports = app;
