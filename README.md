# GitHub-Trending

Scrapes GitHub's trending and showcase pages to produce an API that can be consumed by downstream applications.
This application was originally designed for use in the iOS GitHub application [CodeHub](https://github.com/thedillonb/CodeHub)
but I welcome anyone else who wishes to expand upon this to do so.

## Demo

The following links are for demonstration purposes only. Please do **not** use these endpoints in your applications.
This instance is specifically designed for use by the iOS application, CodeHub, and is not ment for external use outside
of that application. The code is provided so that *YOU* may stand up your own instance.

[Showcases](http://trending.codehub-app.com/showcases)

[Languages](http://trending.codehub-app.com/languages)

[Trending](http://trending.codehub-app.com/trending)

## Installation

```bash
git clone git@github.com:thedillonb/GitHub-Trending.git

cd GitHub-Trending

npm install
```

You will need to generate a GitHub token if you want to scrape the pages

```bash
GITHUB_TOKEN=<GITHUB_TOKEN> npm run dev-start
```

## License

The MIT License (MIT)

Copyright (c) 2014 Dillon Buchanan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
