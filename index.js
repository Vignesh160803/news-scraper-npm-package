'use strict'

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
  }, userConfig);


  let queryVars = config.queryVars || {};
  if (userConfig.searchTerm) {
    queryVars.q = userConfig.searchTerm;
  }

  const searchTerm = userConfig.searchTerm;
  let baseUrl = '';
  if (searchTerm === 'indian') {
    baseUrl = indianNews;
  } else if (searchTerm === 'world') {
    baseUrl = worldNews;
  } else if (searchTerm === 'business') {
    baseUrl = businessNews;
  } else if (searchTerm === 'tech' || searchTerm === 'technology') {
    baseUrl = techNews;
  } else if (searchTerm === 'entertainment') {
    baseUrl = entertainmentNews;
  } else if (searchTerm === 'sports') {
    baseUrl = sportNews;
  } else if (searchTerm === 'science') {
    baseUrl = scienceNews;
  } else if (searchTerm === 'health') {
    baseUrl = healthNews;
  } else {
    baseUrl = 'https://news.google.com/search';
  }

  const queryString = config.queryVars ? buildQueryString(queryVars) : '';
  const timeString = config.timeframe ? ` when:${config.timeframe}` : '';
  const url = `${baseUrl}${queryString}${timeString}`;

  console.log(`📰 SCRAPING NEWS FROM: ${url}`);
  const requiredArgs = [
    '--disable-extensions-except=/path/to/manifest/folder/',
    '--load-extension=/path/to/manifest/folder/',
  ];
  const puppeteerConfig = {
    headless: userConfig.puppeteerHeadlessMode,
    args: puppeteer.defaultArgs().concat(config.puppeteerArgs).filter(Boolean).concat(requiredArgs)
  }
  const browser = await puppeteer.launch(puppeteerConfig)
  const page = await browser.newPage()
  page.setViewport({ width: 1366, height: 768 })
  page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36')
  page.setRequestInterception(true)
  page.on('request', request => {
    if (!request.isNavigationRequest()) {
      request.continue()
      return
    }
    const headers = request.headers()
    headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3'
    headers['Accept-Encoding'] = 'gzip'
    headers['Accept-Language'] = 'en-US,en;q=0.9,es;q=0.8'
    headers['Upgrade-Insecure-Requests'] = "1"
    headers['Referer'] = 'https://www.google.com/'
    request.continue({ headers })
  })
  await page.setCookie({
    name: "CONSENT",
    value: `YES+cb.${new Date().toISOString().split('T')[0].replace(/-/g, '')}-04-p0.en-GB+FX+667`,
    domain: ".google.com"
  });
  await page.goto(url, { waitUntil: 'networkidle2' });

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
  let results = []
  let i = 0
  const urlChecklist = []

  $(articles).each(function () {
    const link = $(this).find('a[href^="./article"]').attr('href').replace('./', 'https://news.google.com/') || false
    link && urlChecklist.push(link);
    const srcset = $(this).find('figure').find('img').attr('srcset')?.split(' ');
    const image = srcset && srcset.length
      ? srcset[srcset.length - 2]
      : $(this).find('figure').find('img').attr('src');
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
    }
    results.push(mainArticle)
    i++
  });

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

  await page.close();
  await browser.close()

  return results.filter(result => result.title)

}

module.exports = NewsScraper;