const {Readability} = require('@mozilla/readability');
const jsdom = require("jsdom");
const {JSDOM} = jsdom;

const vc = new jsdom.VirtualConsole();
vc.on("error",()=>{});

const verifyMessages = [
    "you are human",
    "are you human",
    "i'm not a robot",
    "not a robot",
    "recaptcha"
];

const articleContent = async(articles,browser,filterWords)=>{
    try{
        const processedArticles = articles.map(article=>
            getArticleContent(article,browser,filterWords)
        );

        const processedOnes = await Promise.all(processedArticles);
        return processedOnes;
    }
    catch(e){
        return articles;
    }
}

const getArticleContent = async(article,browser,filterWords)=>{
    try{
        const page = await browser.newPage();
        await page.goto(article.link,{waitUntil: 'networkidle2'});
        const content = await page.evaluate(()=>document.documentElement.innerHTML);

        const favicon = await page.evaluate(()=>{
            const link = document.querySelector('link[rel="icon"],link[re;="shortcut icon"]');
            return link ? link.getAttribute('href') : '';
        });

        const dom = new JSDOM(content,{url: article.link,virtualConsole: vc});
        let reader = new Readability(dom.window.document);
        const articleContents = reader.parse();

        if(!articleContents || !articleContents.textContent){
            return {...article,content:'',favicon};
        }
        const hasVerifyMessage = verifyMessages.find(w => articleContents.textContent.toLowerCase().includes(w));
        if (hasVerifyMessage) {
        return { ...article, content: '', favicon};
        }
        const cleanedText = cleanText(articleContents.textContent, filterWords);

        if(cleanedText.split(' ').length<100){
            return {...article,content:'',favicon};
        }
        return {...article,content:cleanedText,favicon};
    }
    catch(e){
        return {...article,content:'',favicon:''};
    }
}

const cleanText = (text, filterWords) => {
    const unwantedKeywords = [
      "subscribe now",
      "sign up",
      "newsletter",
      "subscribe now",
      "sign up for our newsletter",
      "exclusive offer",
      "limited time offer",
      "free trial",
      "download now",
      "join now",
      "register today",
      "special promotion",
      "promotional offer",
      "discount code",
      "early access",
      "sneak peek",
      "save now",
      "don't miss out",
      "act now",
      "last chance",
      "expires soon",
      "giveaway",
      "free access",
      "premium access",
      "unlock full access",
      "buy now",
      "learn more",
      "click here",
      "follow us on",
      "share this article",
      "connect with us",
      "advertisement",
      "sponsored content",
      "partner content",
      "affiliate links",
      "click here",
      "for more information", 
      "you may also like", 
      "we think you'll like", 
      "from our network", 
      ...filterWords
    ];
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.split(' ').length > 4)
      .filter(line => !unwantedKeywords.some(keyword => line.toLowerCase().includes(keyword)))
      .join('\n');
  }
  
module.exports = {
    default: articleContent
}