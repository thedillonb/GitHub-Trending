import express, { Request, RequestHandler, Response } from 'express';
import _ from 'lodash';

import * as db from './db';

const router = express.Router();

const getDomain = (req: Request) => req.protocol + '://' + req.get('host');

const wrap = (fn: (req: Request, res: Response) => Promise<void>): RequestHandler => (req, res, next) =>
  fn(req, res).catch(err => next(err));

router.get('/', (req, res) => {
  const domain = getDomain(req);

  res.json({
    languages_url: `${domain}/languages`,
    showcases_url: `${domain}/showcases`,
    trending_url: `${domain}/trending`
  });
});

router.get(
  '/languages',
  wrap(async (req, res) => {
    const languages = await db.getLanguages();

    const result = _(languages)
      .reject(x => x.slug === 'all')
      .sortBy('name')
      .value();

    res.json(result);
  })
);

router.get(
  '/trending',
  wrap(async (req, res) => {
    const language = req.query.language || 'all';
    const since = req.query.since || 'daily';
    const trending = await db.getTrending(language, since);
    if (!trending) {
      return res.status(404).end();
    }

    res.json(trending);
  })
);

router.get(
  '/showcases',
  wrap(async (req, res) => {
    const showcases = await db.getShowcases();

    res.json(
      showcases.map(x => {
        return {
          description: x.description,
          image_url: x.image,
          name: x.name,
          slug: x.slug
        };
      })
    );
  })
);

router.get(
  '/showcases/:id',
  wrap(async (req, res) => {
    const showcase = await db.getShowcase(req.params.id);
    if (!showcase) {
      res.status(404).end();
    } else {
      res.json(showcase);
    }
  })
);

export default router;
