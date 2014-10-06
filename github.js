var cheerio = require('cheerio'),
    request = require('request'),
    async 	= require('async'),
    _ 		= require('underscore'),
    gm 		= require('gm').subClass({ imageMagick: true }),
    fs 		= require('fs');

var oauth = process.env['GITHUB_TOKEN'];

function getRepository(user, name, callback) {
	request({
		method: 'GET',
		url: 'https://api.github.com/repos/' + user + '/' + name,
		headers: {
			'User-Agent': 'CodeHub-Trending'
		},
		auth: {
			user: 'token',
			pass: oauth,
			sendImmediately: true
		}
	},
	function(err, response, body) {
		if (err) return callback(err);

		var jsonBody = JSON.parse(body);
		var rateLimitRemaining = parseInt(response.headers['x-ratelimit-remaining']);
		var resetSeconds = parseInt(response.headers['x-ratelimit-reset']);
		var nowSeconds = Math.round(new Date().getTime() / 1000);
		var duration = resetSeconds - nowSeconds + 60;

		// Make sure we don't drain the rate limit
		if (rateLimitRemaining < 400) {
			console.warn('Pausing for %s to allow rateLimit to reset', duration);
			setTimeout(function() {
				callback(null, jsonBody);
			}, duration * 1000);
		} else {
			callback(null, jsonBody);
		}
	});
};

exports.getTrending = function(time, language, callback) {
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
            var owner = $('h3.repo-list-name > a', this).attr('href').split('/');

			data.push({
				owner: owner[1],
				name: owner[2],
			})
		});

		async.parallelLimit(_.map(data, function(x) {
			return function(callback) {
				getRepository(x.owner, x.name, function(err, data) {
					if (err) return callback(err);
					x.url = data.html_url;
					x.avatarUrl = data.owner.avatar_url;
					x.description = data.description;
                    x.stars = data.stargazers_count;
                    x.forks = data.forks_count;
					callback(err);
				});
			};
		}), 4, function(err) { callback(err, data); });
	});
};

exports.getLanguages = function(callback) {
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
					slug: decodeURIComponent(href.substring(href.indexOf('=') + 1))
				});
			}
		});
		callback(null, languages);
	});
};

exports.getShowcases = function(callback) {
	var getShowcasePage = function(page, callback) {
		request({
			method: 'GET',
			url: 'https://github.com/showcases',
			qs: { 'page': page },
			headers: { 'X-PJAX': 'true' }
		},
		function(err, response, body) {
			if (err) return callback(err);
			$ = cheerio.load(body);
			var showcases = [];
			$('li.collection-card').each(function() {
				var href = $('a.collection-card-image', this).attr('href');
				if (href.lastIndexOf('/') > 0) {
					var showcase = {
						name: $('h3', this).text(),
						slug: href.substring(href.lastIndexOf('/') + 1),
						description: $('p.collection-card-body', this).text()
					};

					var imageExtract = /url\(data:image\/svg\+xml;base64,(.+)\)/g;
					var arr = imageExtract.exec($('.collection-card-image', this).attr('style'));
					showcase.image = new Buffer(arr[1], 'base64').toString('ascii');
					showcases.push(showcase);
				}
			});

			callback(err, {
				showcases: showcases,
				more: $('div.pagination a:contains("Next")').length > 0
			});
		});
	};

	var more = false;
	var page = 1;
	var showcases = [];

	async.doWhilst(function(callback) {
		getShowcasePage(page, function(err, results) {
			if (err) return callback(err);

			_.each(results.showcases, function(s) { showcases.push(s) });
			more = results.more;
			page++;

			async.series(_.map(results.showcases, function(x) {
				return function(callback) {
					var svgImage = 'public/' + x.slug + '.svg';
					var pngImage = 'public/' + x.slug + '.png';
					fs.writeFile(svgImage, x.image, function(err) {
						if (err) return callback(err);
						gm(svgImage).resize(96).write(pngImage, function(err) {
							fs.unlink(svgImage);
							if (err) return callback(err);
							x.image = x.slug + '.png';
							callback(null);
						});
					});
				};
			}), callback);
		}); 
	}, 
	function() { return more }, 
	function(err) { callback(err, showcases) });
};

exports.getShowcase = function(slug, callback) {
	request({
		method: 'GET',
		url: 'https://github.com/showcases/' + slug,
		headers: { 'X-PJAX': 'true' }
	},
	function(err, response, body) {
		if (err) return callback(err);
		$ = cheerio.load(body);
		var data = [];
		$('.repo-list > li').each(function() {
            var href = $('h3.repo-list-name > a', this).attr('href').split('/');
			data.push({
				owner: href[1],
				name: href[2]
			});
		});

		async.series(_.map(data, function(x) {
			return function(callback) {
				getRepository(x.owner, x.name, function(err, data) {
					if (err) return callback(err);
					x.url = data.html_url;
					x.avatarUrl = data.owner.avatar_url;
					x.description = data.description;
					x.stars = data.stargazers_count;
					x.forks = data.forks_count;
					callback(err);
				});
			};
		}), function(err) { callback(err, data); });
	});
};
