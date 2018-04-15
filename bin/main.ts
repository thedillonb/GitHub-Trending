import fs from 'fs';
import http from 'http';
import path from 'path';
import util from 'util';
import winston from 'winston';
import writeFileAtomic from 'write-file-atomic';

import app from '../src/app';
import GitHub from '../src/github';

winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, { timestamp: true });

const gh = new GitHub(process.env.GITHUB_TOKEN as string);

app.set('port', process.env.PORT || 3000);

const delay = (time: number) => new Promise(res => setTimeout(res, time));
const mkdir = util.promisify(fs.mkdir);
const dirExists = util.promisify(fs.exists);
const writeFile = util.promisify(fs.writeFile);
const unlink = util.promisify(fs.unlink);

const atomic = (file: string, data: any) => {
  return new Promise((res, rej) => {
    writeFileAtomic(file, JSON.stringify(data), err => (err ? rej(err) : res()));
  });
};

async function updateShowcases() {
  const dbPath = path.join(__dirname, '..', '.db');
  const showcasePath = path.join(dbPath, 'showcase');

  if (!await dirExists(dbPath)) {
    await mkdir(dbPath);
  }

  if (!await dirExists(showcasePath)) {
    await mkdir(showcasePath);
  }

  winston.info('Updating showcases...');
  const showcases = await gh.getShowcases();

  for (const showcase of showcases) {
    const repositories = await gh.getShowcaseRepositories(showcase.slug).catch(err => {
      winston.warn(`Error retrieving showcases for ${showcase.slug}`, err);
      return [] as any[];
    });

    await atomic(path.join(showcasePath, `${showcase.slug}.json`), {
      description: showcase.description,
      image: showcase.image,
      name: showcase.name,
      repositories,
      slug: showcase.slug
    });
  }

  await atomic(
    path.join(showcasePath, 'showcases.json'),
    showcases.map(showcase => {
      return {
        description: showcase.description,
        image: showcase.image,
        name: showcase.name,
        slug: showcase.slug
      };
    })
  );
}

async function updateTrending() {
  const dbPath = path.join(__dirname, '..', '.db');
  const trendingPath = path.join(dbPath, 'trending');

  if (!await dirExists(dbPath)) {
    await mkdir(dbPath);
  }

  if (!await dirExists(trendingPath)) {
    await mkdir(trendingPath);
  }

  winston.info('Updating trending...');
  const languages = await gh.getLanguages();
  languages.unshift({ name: 'All Languages', slug: 'all' });
  languages.push({ name: 'Unknown', slug: 'unknown' });

  await atomic(path.join(trendingPath, 'languages.json'), languages);

  for (const language of languages) {
    const langSlug = language.slug === 'all' ? null : language.slug;

    for (const time of ['daily', 'weekly', 'monthly']) {
      winston.info(`Retrieving ${time} ${language.name} repositories.`);
      const repos = await gh.getTrendingRepositories(time, langSlug).catch(err => {
        winston.warn(`Error trying to retrieve repositories for ${time} ${language.name}`, err);
        return [];
      });

      await atomic(path.join(trendingPath, `${language.slug}.${time}.json`), repos);
      await delay(2000);
    }
  }
}

function startServer() {
  return new Promise<http.Server>((res, rej) => {
    const server = app.listen(app.get('port'), () => res(server));
    setTimeout(() => rej(new Error('Server failed to start!')), 1000 * 10);
  });
}

async function update() {
  for (const fn of [updateShowcases, updateTrending]) {
    try {
      await fn();
    } catch (err) {
      winston.error(err);
    }
  }
}

async function main() {
  const server = await startServer();
  winston.info(`Server listening on ${server.address().address}:${server.address().port}.`);

  await update();

  setInterval(update, 1000 * 60 * 60 * 12);
}

main().catch(err => {
  winston.error(err);
  process.exit(-1);
});
