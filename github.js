var cheerio = require('cheerio'),
    request = require('request'),
    async 	= require('async'),
    _ 		= require('underscore'),
    gm 		= require('gm').subClass({ imageMagick: true }),
    fs 		= require('fs');

var oauth = process.env['GITHUB_TOKEN'];

function getUser(username, callback) {
	request({
		method: 'GET',
		url: 'https://api.github.com/users/' + username,
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
		callback(err, JSON.parse(body));
	});
}

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
		callback(err, JSON.parse(body));
	});
}

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
			var stars = $('.repo-leaderboard-meta-item .octicon-star', this).parent().text();
			var forks = $('.repo-leaderboard-meta-item .octicon-git-branch', this).parent().text();
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

		async.parallel(_.map(data, function(x) {
			return function(callback) {
				getUser(x.owner, function(err, data) {
					if (err) return callback(err);
					x.avatarUrl = data.avatar_url;
					callback(err);
				});
			};
		}), function(err) { callback(null, data); });
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
					slug: href.substring(href.indexOf('=') + 1)
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
						gm(svgImage).write(pngImage, function(err) {
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
		$('.collection-repos > li').each(function() {
			data.push({
				url: $('h3.collection-repo-title > a', this).attr('href'),
				owner: $('h3.collection-repo-title .repo-author', this).text(),
				name: $('h3.collection-repo-title .repo-name', this).text(),
				description: ($('.collection-repo-description', this).text() || "").trim(),
				stars: 0,
				forks: 0,
			})
		});

		async.parallel(_.map(data, function(x) {
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
		}), function(err) { callback(null, data); });
	});
};