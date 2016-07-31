'use strict';
const co      = require('co');
const cheerio = require('cheerio');
const request = require('request');
const _       = require('underscore');

function GitHubClient(token) {
    if (!token) throw new Error('You must provide a GitHub token!');
    this.token = token;
};

function makeRequest(req) {
  return new Promise((res, rej) => {
    console.log('%s %s - %j', req.method, req.url, req.qs || {});
    request(req, (err, response, body) => {
      if (err) return rej(err);
      return res({ response: response, body: body });
    });
  });
};

GitHubClient.prototype.getRepository = function(user, name, callback) {
    return makeRequest({
        method: 'GET',
        url: 'https://api.github.com/repos/' + user + '/' + name,
        headers: { 'User-Agent': 'CodeHub-Trending' },
        auth: {
            user: 'token',
            pass: this.token,
            sendImmediately: true
        }
    }).then(x => {
      const response = x.response;
      const rateLimitRemaining = parseInt(response.headers['x-ratelimit-remaining']);
      const resetSeconds = parseInt(response.headers['x-ratelimit-reset']);
      const nowSeconds = Math.round(new Date().getTime() / 1000);
      const duration = resetSeconds - nowSeconds + 60;

      // We need to drop the permission object from every repository
      // because that state belongs to the user that is authenticated
      // at the curren time; which is misrepresentitive of the client
      // attempting to query this information.
      const repoBody = _.omit(JSON.parse(x.body), 'permissions');

      // Make sure we don't drain the rate limit
      if (rateLimitRemaining < 400) {
          console.warn('Pausing for %s to allow rateLimit to reset', duration);
          return new Promise((res) => setTimeout(res, duration * 1000)).then(_ => repoBody);
      }

      return repoBody;
    });
};

GitHubClient.prototype.getTrendingRepositories = co.wrap(function*(time, language) {
    const queryString = { 'since': time };
    if (language) queryString.l = language;

    const res = yield makeRequest({
        method: 'GET',
        url: 'https://github.com/trending',
        qs: queryString,
        headers: { 'X-PJAX': 'true' }
    });

    const $ = cheerio.load(res.body);
    const data = [];
    $('.container.explore-page .explore-content > ol > li').each(function() {
        var owner = $('h3.repo-list-name > a', this).attr('href').split('/');
        data.push({ owner: owner[1], name: owner[2] });
    });

    const repos = [];
    for (let i = 0; i < data.length; i++) {
      const owner = data[i].owner;
      const name = data[i].name;
      repos.push(yield this.getRepository(owner, name));
    }
    return repos;
});

GitHubClient.prototype.getLanguages = function() {
    return makeRequest({
        method: 'GET',
        url: 'https://github.com/trending',
        headers: { 'X-PJAX': 'true' }
    }).then(x => {
      const $ = cheerio.load(x.body);
      const languages = [];
      $('.column.one-fourth .select-menu .select-menu-list a.select-menu-item').each(function() {
        const href = $(this).attr('href');
        languages.push({
            name: $(this).text().trim(),
            slug: decodeURIComponent(href.substring(href.lastIndexOf('/') + 1))
        });
      });
      return languages;
    });
};

GitHubClient.prototype.getShowcases = co.wrap(function*() {
    const showcases = [];

    for (let page = 1; page < 1000; page++) {
      const res = yield makeRequest({
          method: 'GET',
          url: 'https://github.com/showcases',
          qs: { 'page': page }
      });

      const $ = cheerio.load(res.body);
      $('.exploregrid a.exploregrid-item').each(function() {
          const href = $(this).attr('href');
          if (href.lastIndexOf('/') > 0) {
              const showcase = {
                  name: $('h3', this).text().trim(),
                  slug: href.substring(href.lastIndexOf('/') + 1),
                  description: $(this).clone().children().remove().end().text().trim()
              };

              const imageExtract = /url\(data:image\/svg\+xml;base64,(.+)\)/g;
              const arr = imageExtract.exec($('.exploregrid-item-header', this).attr('style'));
              showcase.image = new Buffer(arr[1], 'base64').toString('ascii');
              showcases.push(showcase);
          }
      });

      const next = $('div.pagination a:contains("Next")');
      if (next.length == 0) break;
    }

    return showcases;
});

GitHubClient.prototype.getShowcaseData = co.wrap(function *(slug) {
    const res = yield makeRequest({
        method: 'GET',
        url: 'https://github.com/showcases/' + slug,
        headers: { 'X-PJAX': 'true' }
    });

    const $ = cheerio.load(res.body);
    const title = $('.showcase-page-title').text().trim();
    const description = $('.showcase-page-description').text().trim();
    const data = [];
    $('.repo-list > li').each(function() {
        const href = $('h3.repo-list-name > a', this).attr('href').split('/');
        data.push({ owner: href[1], name: href[2] });
    });

    const repos = [];
    for (let i = 0; i < data.length; i++) {
      repos.push(yield this.getRepository(data[i].owner, data[i].name));
    }
    return {
      title: title,
      description: description,
      repos: repos
    };
});


module.exports = function(token) {
    return new GitHubClient(token);
};
