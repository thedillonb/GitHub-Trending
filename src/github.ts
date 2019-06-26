import cheerio from 'cheerio';
import _ from 'lodash';
import request from 'request-promise-native';
import winston from 'winston';

import { IShowcase } from './interfaces';

const wait = (duration: number) => new Promise(res => setTimeout(res, duration * 1000));

async function scrape(options: request.OptionsWithUrl): Promise<request.FullResponse> {
  while (true) {
    const result = await request({
      ...options,
      resolveWithFullResponse: true,
      simple: false
    });

    const { statusCode } = result;

    if (statusCode === 429) {
      winston.warn(`429 received (${options.url})!. Waiting 2mins.`);
      await wait(60 * 2);
      continue;
    } else if (statusCode === 200) {
      return result;
    } else {
      throw new Error(`Invalid status code: ${statusCode}`);
    }
  }
}

export default class GitHubClient {
  constructor(readonly token: string) {
    if (!token) {
      throw new Error('Invalid GitHub token!');
    }
  }

  public async getRepository(user: string, name: string) {
    const response: request.FullResponse = await request({
      auth: {
        pass: this.token,
        sendImmediately: true,
        user: 'token'
      },
      headers: { 'User-Agent': 'CodeHub-Trending' },
      method: 'GET',
      resolveWithFullResponse: true,
      url: `https://api.github.com/repos/${user}/${name}`
    });

    const rateLimitRemaining = parseInt(response.headers['x-ratelimit-remaining'] as string, 10);
    const resetSeconds = parseInt(response.headers['x-ratelimit-reset'] as string, 10);
    const nowSeconds = Math.round(new Date().getTime() / 1000);
    const duration = resetSeconds - nowSeconds + 60;

    // We need to drop the permission object from every repository
    // because that state belongs to the user that is authenticated
    // at the curren time; which is misrepresentitive of the client
    // attempting to query this information.
    const repoBody = _.omit(JSON.parse(response.body.toString()), 'permissions');

    // Make sure we don't drain the rate limit
    if (rateLimitRemaining < 400) {
      winston.warn('Pausing for %s to allow rateLimit to reset', duration);
      await wait(duration);
    }

    return repoBody;
  }

  public async getTrendingRepositories(time: string, language?: string | null) {
    const queryString: { [id: string]: string } = { since: time };
    if (language) {
      queryString.l = language;
    }

    const result = await scrape({
      headers: { 'X-PJAX': 'true' },
      method: 'GET',
      qs: queryString,
      url: 'https://github.com/trending'
    });

    const $ = cheerio.load(result.body);
    const owners: Array<{ owner: string; name: string }> = [];

    $('article.Box-row').each((idx, el) => {
      const owner = $('h1 > a', el)
        .attr('href')
        .split('/');

      owners.push({ owner: owner[1], name: owner[2] });
    });

    const repos = [];

    for (const { owner, name } of owners) {
      try {
        repos.push(await this.getRepository(owner, name));
      } catch (err) {
        winston.error(`Error retrieving trending repository ${owner}/${name}.`);
      }
    }

    return repos;
  }

  public async getLanguages() {
    const result = await scrape({
      headers: { 'X-PJAX': 'true' },
      method: 'GET',
      url: 'https://github.com/trending'
    });

    const $ = cheerio.load(result.body);
    const languages: Array<{ name: string; slug: string }> = [];

    $('.mb-3 .select-menu .select-menu-list a.select-menu-item').each((idx, el) => {
      const href = $(el)
        .attr('href')
        .split('?')[0];
      const slug = decodeURIComponent(href.substring(href.lastIndexOf('/') + 1));
      const name = $(el)
        .text()
        .trim();

      languages.push({ name, slug });
    });

    return languages;
  }

  public async getShowcases() {
    const showcases: IShowcase[] = [];

    const addShowcases = (response: request.FullResponse) => {
      const $ = cheerio.load(response.body);

      $('article').each((idx, el) => {
        const anchor = $('a', el);
        const href = anchor.attr('href');
        const name = anchor.text();
        const slug = href.split('/').slice(-1)[0];
        const image = $('img', el).attr('src');
        const description = $('div.col-10.col-md-11', el)
          .clone()
          .children()
          .remove()
          .end()
          .text()
          .trim();

        showcases.push({
          description,
          image,
          name,
          slug
        });
      });

      return $('.ajax-pagination-form > input:nth-child(2)').attr('value');
    };

    const res1 = await scrape({
      method: 'GET',
      url: 'https://github.com/collections'
    });

    const after = addShowcases(res1);

    if (after) {
      const res2 = await scrape({
        method: 'GET',
        qs: { after },
        url: 'https://github.com/collections'
      });

      addShowcases(res2);
    }

    return showcases;
  }

  public async getShowcaseRepositories(slug: string) {
    const res = await scrape({
      method: 'GET',
      url: `https://github.com/collections/${slug}`
    });

    const $ = cheerio.load(res.body);

    const data: Array<{ owner: string; name: string }> = [];

    $('article').each((idx, el) => {
      const [, owner, name] = $('h1 > a', el)
        .attr('href')
        .split('/');

      if (!owner || !name) {
        return;
      }

      data.push({ owner, name });
    });

    const repos: any[] = [];
    for (const { owner, name } of data) {
      try {
        repos.push(await this.getRepository(owner, name));
      } catch (err) {
        winston.error(`Error retrieving trending repository ${owner}/${name}.`);
      }
    }

    return repos;
  }
}
