import bodyParser from 'body-parser';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import httpErrors from 'http-errors';
import logger from 'morgan';
import winston from 'winston';

import routes from './routes';

const app = express();

app.use(
  logger('dev', {
    stream: {
      write(str: string) {
        winston.info(str.trim());
      }
    }
  })
);

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use('/', routes);
app.use('/v2', routes);

app.use((req, res, next) => {
  next(new httpErrors.NotFound());
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  res
    .status((err as any).status || 500)
    .json({ message: err.message })
    .end();
});

export default app;
