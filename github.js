var cheerio = require('cheerio'),
    request = require('request'),
    async 	= require('async'),
    _ 		= require('underscore'),
    path    = require('path'),
    fs  	= require('fs'),
    mkdirp  = require('mkdirp'),
    appDir  = path.dirname(require.main.filename),
    outDir = path.join(appDir, 'data');

var times = ['daily', 'weekly', 'monthly'];

function getTrendingRepositories(time, language, callback) {
	var queryString = { 'since': time };
	if (language != null) {
		queryString.l = language;
	}

	request({
		method: 'GET',
		url: 'https://github.com/trending',
		qs: queryString,
		headers: {
			'X-PJAX': 'true'
		}
	},
	function(err, response, body) {
		if (err) return callback(err);
		$ = cheerio.load(body);
		var data = [];
		$('.container.explore-page .explore-content > ol > li').each(function() {
			var stars = $('.repo-leaderboard-meta-item .octicon-star-add', this).parent().text();
			var forks = $('.repo-leaderboard-meta-item .octicon-git-branch-create', this).parent().text();
			stars = stars.length > 0 ? parseInt(stars) : 0;
			forks = forks.length > 0 ? parseInt(forks) : 0;

			data.push({
				url: $('.repository-name', this).attr('href'),
				owner: $('.repository-name .owner-name', this).text(),
				name: $('.repository-name strong', this).text(),
				description: $('p.repo-leaderboard-description', this).text(),
				stars: stars,
				forks: forks,
			})
		});
		callback(null, data);
	});
};

function getLanguages(callback) {
	request({
		method: 'GET',
		url: 'https://github.com/trending',
		headers: {
			'X-PJAX': 'true'
		}
	},
	function(err, response, body) {
		if (err) return callback(err);
		$ = cheerio.load(body);
		var languages = [];
		$('.column.one-fourth .select-menu .select-menu-list .select-menu-item > a').each(function() {
			var href = $(this).attr('href');
			if (href.indexOf('=') > 0) {
				languages.push({
					name: $(this).text(),
					slug: href.substring(href.indexOf('=') + 1)
				});
			}
		});
		callback(null, languages);
	});
};


exports.getTrending = function(callback) {
	getLanguages(function(err, languages) {
		var master = [];

		// Add the unknown language
		languages.push({
			name: 'Unknown',
			slug: 'unknown'
		});

		// Write all the languages to the output directory
		mkdirp(outdir, function(err) {
			if (err) console.error(err);
			fs.writeFileSync(path.join(outDir, 'languages.json'), JSON.stringify(languages));
		});

		var jobs = [];
		_.each(times, function(time) {
			jobs.push(function(callback) {
				getTrendingRepositories(time, null, function(err, results) {
					var p = path.join(outDir, 'all', time);
					mkdirp(p, function(err) {
						if (err) return callback(err);
						fs.writeFile(path.join(p, 'data.json'), JSON.stringify(results), function(err) {
							callback(err);
						});
					});
				});
			});
		});

		master.push(function(callback) {
			async.parallel(jobs, function(err, results) {
				callback(err);
			});
		});

		_.each(languages, function(language) {
			var jobs = {};

			_.each(times, function(time) {
				jobs[time] = function(callback) {
					getTrendingRepositories(time, language.slug, function(err, results) {
						if (err) return callback(err);

						var p = path.join(outDir, language.slug, time);
						mkdirp(p, function(err) {
							if (err) return callback(err);
							fs.writeFile(path.join(p, 'data.json'), JSON.stringify(results), function(err) {
								callback(err);
							});
						});
					});
				};
			});

			master.push(function(callback) {
				async.parallel(jobs, function(err, results) {
					callback(err);
				});
			});
		});

		async.series(master, function(err) {
			callback(err);
		});
	});
};

