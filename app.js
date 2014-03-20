var express = require('express')
  , http = require('http')
  , fs = require('fs')
  , path = require('path')
  , gh = require('./github');

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
	fs.readFile('./data/languages.json', function(err, data) {
		if (err) return res.send(500);
		res.json(JSON.parse(data));
	});
});

app.get('/trending', function(req, res) {
	var language = req.query.language || 'all';
	var since = req.query.since || 'daily';
	fs.readFile('./data/' + language + '/' + since + '/data.json', function(err, data) {
		if (err) return res.send(404);
		res.json(JSON.parse(data));
	});
})

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

function trendingLoop() {
	console.log('Starting trending loop...');
	gh.getTrending(function(err) {
		if (err) console.error(err);
		setTimeout(trendingLoop, 1000 * 60 * 60 * 12);
	});
}

trendingLoop();
