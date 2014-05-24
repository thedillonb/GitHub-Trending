var gh = require('./github')
  , async = require('async')
  , db = require('./db')
  , _  = require('underscore');

exports.loadLanguages = function(callback) {

	var createLoadLanguageJob = function(language) {
		return function(callback) {
			async.waterfall([
				function(callback) {
					var langSlug = language.slug === 'all' ? null : language.slug;
					async.series({
						daily: function(callback) { gh.getTrending('daily', langSlug, callback) },
						weekly: function(callback) { gh.getTrending('weekly', langSlug, callback) },
						monthly: function(callback) { gh.getTrending('monthly', langSlug, callback) }
					}, callback);
				},
				function(repos, callback) {
					db.Trending.update({ 'language.slug': language.slug }, {
						language: language,
						repositories: repos
					}, { 
						upsert: true 
					}, callback);
				}
			], function(err) {
				if (err) return console.error(err);
				callback(err);
			});
		};
	};

	async.waterfall([
		function(callback) {
			gh.getLanguages(function(err, languages) {
				if (err) return callback(err);
				languages.unshift({ name: 'All Languages', slug: 'all' });
				languages.push({ name: 'Unknown', slug: 'unknown' });
				callback(err, languages);
			});
		},
		function(languages, callback) {
			async.series(_.map(languages, createLoadLanguageJob), callback);
		}
	], callback);
};

exports.loadShowcases = function(callback) {
	var createLoadShowcaseJob = function(showcase) {
		return function(callback) {
			async.waterfall([
				function(callback) {
					gh.getShowcase(showcase.slug, callback);
				},
				function(repos, callback) {
					db.Explore.update({ 'slug': showcase.slug }, {
						name: showcase.name,
						slug: showcase.slug,
						description: showcase.description,
						repositories: repos
					}, { 
						upsert: true 
					}, callback);
				}
			], function(err) {
				if (err) return console.error(err);
				callback(err);
			});
		};
	}

	async.waterfall([
		function(callback) {
			gh.getShowcases(callback);
		},
		function(showcases, callback) {
			async.series(_.map(showcases, createLoadShowcaseJob), callback);
		}
	], callback);
}