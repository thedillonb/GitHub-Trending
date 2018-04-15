import fs from 'fs';
import path from 'path';
import util from 'util';

import { IShowcase } from './interfaces';

const dbPath = path.join(__dirname, '..', '.db');

const readFile = util.promisify(fs.readFile);

export function getLanguages(): Promise<Array<{ name: string; slug: string }>> {
  return readFile(path.join(dbPath, 'trending', 'languages.json'), 'utf8').then(JSON.parse);
}

export function getTrending(language: string, since: string) {
  const db = path.join(dbPath, 'trending', `${language}.${since}.json`);
  return readFile(db, 'utf8').then(JSON.parse, err => null);
}

export function getShowcases(): Promise<[IShowcase]> {
  const db = path.join(dbPath, 'showcase', 'showcases.json');
  return readFile(db, 'utf8').then(JSON.parse, err => []);
}

export function getShowcase(showcase: string) {
  const db = path.join(dbPath, 'showcase', `${showcase}.json`);
  return readFile(db, 'utf8').then(JSON.parse);
}
