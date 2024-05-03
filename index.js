'use strict';

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const getTitle = require('./fetchTitle').default;
const getArticleType = require('./typeOfArticle').default;
const getPrettyUrl = require('./getProperUrl').default;
const buildQueryString = require('./queryBuild').default;
const getArticleContent = require('./articleContent').default;

const indianNews = "https://news.google.com/topics/CAAqJQgKIh9DQkFTRVFvSUwyMHZNRE55YXpBU0JXVnVMVWRDS0FBUAE?hl=en-IN&gl=IN&ceid=IN%3Aen";
const worldNews = "https://news.google.com/topics/CAAqKggKIiRDQkFTRlFvSUwyMHZNRGx1YlY4U0JXVnVMVWRDR2dKSlRpZ0FQAQ?hl=en-IN&gl=IN&ceid=IN%3Aen";
const businessNews = "https://news.google.com/topics/CAAqKggKIiRDQkFTRlFvSUwyMHZNRGx6TVdZU0JXVnVMVWRDR2dKSlRpZ0FQAQ?hl=en-IN&gl=IN&ceid=IN%3Aen";
const techNews = "https://news.google.com/topics/CAAqKggKIiRDQkFTRlFvSUwyMHZNRGRqTVhZU0JXVnVMVWRDR2dKSlRpZ0FQAQ?hl=en-IN&gl=IN&ceid=IN%3Aen";
const entertainmentNews = "https://news.google.com/topics/CAAqKggKIiRDQkFTRlFvSUwyMHZNREpxYW5RU0JXVnVMVWRDR2dKSlRpZ0FQAQ?hl=en-IN&gl=IN&ceid=IN%3Aen";
const sportNews = "https://news.google.com/topics/CAAqKggKIiRDQkFTRlFvSUwyMHZNRFp1ZEdvU0JXVnVMVWRDR2dKSlRpZ0FQAQ?hl=en-IN&gl=IN&ceid=IN%3Aen";
const scienceNews = "https://news.google.com/topics/CAAqKggKIiRDQkFTRlFvSUwyMHZNRFp0Y1RjU0JXVnVMVWRDR2dKSlRpZ0FQAQ?hl=en-IN&gl=IN&ceid=IN%3Aen";
const healthNews = "https://news.google.com/topics/CAAqKggKIiRDQkFTRlFvSUwyMHZNRFp0Y1RjU0JXVnVMVWRDR2dKSlRpZ0FQAQ?hl=en-IN&gl=IN&ceid=IN%3Aen";

const NewsScraper = async (userConfig) => {

  const config = Object.assign({
    prettyURLs: true,
    getArticleContent: false,
    puppeteerArgs: [],
    puppeteerHeadlessMode: true,
    proportion: {}, // New parameter for specifying proportion of articles for each category
  }, userConfig);

  const categories = userConfig.categories || [];
  let urls = [];

  // Define URLs for each category
  categories.forEach(category => {
    if (category === 'indian') {
      urls.push({ url: indianNews, category: 'indian' });
    } else if (category === 'world') {
      urls.push({ url: worldNews, category: 'world' });
    } else if (category === 'business') {
      urls.push({ url: businessNews, category: 'business' });
    } else if (category === 'tech' || category === 'technology') {
      urls.push({ url: techNews, category: 'tech' });
    } else if (category === 'entertainment') {
      urls.push({ url: entertainmentNews, category: 'entertainment' });
    } else if (category === 'sports') {
      urls.push({ url: sportNews, category: 'sports' });
    } else if (category === 'science') {
      urls.push({ url: scienceNews, category: 'science' });
    } else if (category === 'health') {
      urls.push({ url: healthNews, category: 'health' });
    }
  });

  const queryString = config.queryVars ? buildQueryString(config.queryVars) : '';
  const timeString = config.timeframe ? ` when:${config.timeframe}` : '';

  // Create an object to store the count of articles fetched in each category
  const articleCounts = {};

  // Create an array to store results from each URL
  let results = [];

  // Loop through each URL and scrape news
  for (const item of urls) {
    const fullUrl = `${item.url}${queryString}${timeString}`;

    const browser = await puppeteer.launch({
      headless: config.puppeteerHeadlessMode,
      args: puppeteer.defaultArgs().concat(config.puppeteerArgs),
    });

    const page = await browser.newPage();

    page.setViewport({ width: 1366, height: 768 });
    page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36');
    page.setRequestInterception(true);

    page.on('request', request => {
      if (!request.isNavigationRequest()) {
        request.continue();
        return;
      }
      const headers = request.headers();
      headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3';
      headers['Accept-Encoding'] = 'gzip';
      headers['Accept-Language'] = 'en-US,en;q=0.9,es;q=0.8';
      headers['Upgrade-Insecure-Requests'] = "1";
      headers['Referer'] = 'https://www.google.com/';
      request.continue({ headers });
    });

    await page.setCookie({
      name: "CONSENT",
      value: `YES+cb.${new Date().toISOString().split('T')[0].replace(/-/g, '')}-04-p0.en-GB+FX+667`,
      domain: ".google.com"
    });

    await page.goto(fullUrl, { waitUntil: 'networkidle2' });

    try {
      await page.$(`[aria-label="Reject all"]`);
      await Promise.all([
        page.click(`[aria-label="Reject all"]`),
        page.waitForNavigation({ waitUntil: 'networkidle2' })
      ]);
    } catch (err) {
      // console.log("ERROR REJECTING COOKIES:", err);
    }

    const content = await page.content();
    const $ = cheerio.load(content);

    const articles = $('article');
    let i = 0;

    // Calculate the number of articles to fetch based on the proportion
    const totalArticles = articles.length;
    const proportion = config.proportion[item.category] || 1; // Default to fetching all articles
    const numArticlesToFetch = Math.ceil(totalArticles * proportion);

    // Loop through articles and fetch only the specified proportion
    let fetchedArticles = 0;
    $(articles).each(function () {
      if (fetchedArticles >= numArticlesToFetch) return false; // Exit loop if fetched enough articles
      const link = $(this).find('a[href^="./article"]').attr('href').replace('./', 'https://news.google.com/') || false;
      const srcset = $(this).find('figure').find('img').attr('srcset')?.split(' ');
      const image = srcset && srcset.length ? srcset[srcset.length - 2] : $(this).find('figure').find('img').attr('src');
      const articleType = getArticleType($, this);
      const title = getTitle($, this, articleType);
      const mainArticle = {
        title,
        "link": link,
        "image": image?.startsWith("/") ? `https://news.google.com${image}` : image,
        "source": $(this).find('div[data-n-tid]').text() || false,
        "datetime": new Date($(this).find('div:last-child time').attr('datetime')) || false,
        "time": $(this).find('div:last-child time').text() || false,
        articleType
      };
      results.push(mainArticle);
      fetchedArticles++;
    });

    // Update the count of articles fetched in this category
    articleCounts[item.category] = fetchedArticles;

    await page.close();
    await browser.close();
  }

  if (config.prettyURLs) {
    results = await Promise.all(results.map(article => {
      const url = getPrettyUrl(article.link);
      article.link = url;
      return article;
    }));
  }

  if (config.getArticleContent) {
    const filterWords = config.filterWords || [];
    results = await getArticleContent(results, browser, filterWords);
  }

  return {
    articles: results.filter(result => result.title),
    articleCounts: articleCounts
  };

};

module.exports = NewsScraper;
