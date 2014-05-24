var express = require('express')
  , http = require('http')
  , gh = require('./github')
  , async = require('async')
  , db = require('./db')
  , _  = require('underscore')
  , load = require('./loader')
  , CronJob = require('cron').CronJob;

var app = express();
app.set('port', process.env.PORT || 3000);
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);

if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/languages', function(req, res) {
	db.Trending.find({}, 'language', function(err, data) {
		if (err || !data) return res.send(500);
		var languages = _.map(data, function(d) { return d.language });
		languages = _.reject(languages, function(l) { return l.slug === 'all' });
		languages = _.sortBy(languages, function(l) { return l.name });
		res.json(languages);
	});
});

app.get('/trending', function(req, res) {
	var language = req.query.language || 'all';
	var since = req.query.since || 'daily';
	db.Trending.findOne({ 'language.slug': language }, 'repositories.' + since, function(err, data) {
		if (err) return res.send(500);
		if (!data) return res.send(404);
		res.json(data.repositories[since]);
	});
});

app.get('/showcases', function(req, res) {
	db.Explore.find({}, 'slug name description', function(err, data) {
		if (err || !data) return res.send(500);
		res.json(data);
	});
});

app.get('/showcase', function(req, res) {
	var name = req.query.name;
	db.Explore.findOne({ slug: name }, function(err, data) {
		if (err) return res.send(500);
		if (!data) return res.send(404);
		res.json(data);
	});
});

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

var work = function() {
	console.log('Beginning update job!')
	async.series([
		function(callback) { load.loadLanguages(callback); },
		function(callback) { load.loadShowcases(callback); }
	], function(err) {
		if (err) return console.error('Error during update job: %s', err);
		console.log('Update job complete.')
	});
}

new CronJob('0 */12 * * *', work, null, true);
