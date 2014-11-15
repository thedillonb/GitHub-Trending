var cheerio = require('cheerio'),
    request = require('request'),
    async   = require('async'),
    _       = require('underscore');

function GitHubClient(token) {
    if (!token) throw new Error('You must provide a GitHub token!');
    this.token = token;
};

GitHubClient.prototype.getRepository = function(user, name, callback) {
    var req = {
        method: 'GET',
        url: 'https://api.github.com/repos/' + user + '/' + name,
        headers: {
            'User-Agent': 'CodeHub-Trending'
        },
        auth: {
            user: 'token',
            pass: this.token,
            sendImmediately: true
        }
    };

    console.log('%s %s', req.method, req.url);
    request(req, function(err, response, body) {
        if (err) return callback(err);

        var repoBody = JSON.parse(body);
        var rateLimitRemaining = parseInt(response.headers['x-ratelimit-remaining']);
        var resetSeconds = parseInt(response.headers['x-ratelimit-reset']);
        var nowSeconds = Math.round(new Date().getTime() / 1000);
        var duration = resetSeconds - nowSeconds + 60;

        // We need to drop the permission object from every repository
        // because that state belongs to the user that is authenticated
        // at the curren time; which is misrepresentitive of the client
        // attempting to query this information.
        repoBody = _.omit(repoBody, 'permissions');

        // Make sure we don't drain the rate limit
        if (rateLimitRemaining < 400) {
            console.warn('Pausing for %s to allow rateLimit to reset', duration);
            setTimeout(function() {
                callback(null, repoBody);
            }, duration * 1000);
        } else {
            callback(null, repoBody);
        }
    });
};

GitHubClient.prototype.getTrendingRepositories = function(time, language, callback) {
    var self = this;
    var queryString = { 'since': time };
    if (language) queryString.l = language;

    var req = {
        method: 'GET',
        url: 'https://github.com/trending',
        qs: queryString,
        headers: {
            'X-PJAX': 'true'
        }
    };

    console.log('%s %s - %j', req.method, req.url, req.qs);
    request(req, function(err, response, body) {
        if (err) return callback(err);
        $ = cheerio.load(body);
        var data = [];
        $('.container.explore-page .explore-content > ol > li').each(function() {
            var owner = $('h3.repo-list-name > a', this).attr('href').split('/');
            data.push({ owner: owner[1], name: owner[2] });
        });

        async.parallelLimit(_.map(data, function(x) {
            return function(callback) {
                self.getRepository(x.owner, x.name, callback);
            };
        }), 4, callback);
    });
};

GitHubClient.prototype.getLanguages = function(callback) {
    var req = {
        method: 'GET',
        url: 'https://github.com/trending',
        headers: {
            'X-PJAX': 'true'
        }
    };

    console.log('%s %s', req.method, req.url);
    request(req, function(err, response, body) {
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

GitHubClient.prototype.getShowcases = function(callback) {
    var getShowcasePage = function(page, callback) {
        var req = {
            method: 'GET',
            url: 'https://github.com/showcases',
            qs: { 'page': page },
            headers: { 'X-PJAX': 'true' }
        };

        console.log('%s %s - %j', req.method, req.url, req.qs);
        request(req, function(err, response, body) {
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
            callback();
        }); 
    }, 
    function() { return more }, 
    function(err) { callback(err, showcases) });
};

GitHubClient.prototype.getShowcaseRepositories = function(slug, callback) {
    var self = this;
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
            data.push({ owner: href[1], name: href[2] });
        });

        async.series(_.map(data, function(x) {
            return function(callback) {
                self.getRepository(x.owner, x.name, callback);
            };
        }), callback);
    });
};


module.exports = function(token) {
    return new GitHubClient(token);
};