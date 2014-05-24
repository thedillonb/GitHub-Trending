var cheerio = require('cheerio'),
    request = require('request'),
    async 	= require('async'),
    _ 		= require('underscore');

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
		callback(null, data);
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
					showcases.push({
						name: $('h3', this).text(),
						slug: href.substring(href.lastIndexOf('/') + 1),
						description: $('p.collection-card-body', this).text()
					});
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
			callback(err);
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
		callback(err, data);
	});
};