require('dotenv').config();
const { setTimeout } = require('timers/promises');
const puppeteer = require('puppeteer');
const FormData = require('form-data');
const fetch = require('node-fetch');
const TelegramBot = require('node-telegram-bot-api');

const ENABLE_DEBUGGING = true;
const CHECK_PAGE_URL = process.env.CHECK_PAGE_URL;
const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const CAPTCHA_API_KEY = process.env.CAPTCHA_API_KEY;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_REMINDER_DELAY = 10 * 1000;

if (!CHECK_PAGE_URL) {
    throw new Error('Please provide value for the "CHECK_PAGE_URL" env variable directly or via .env file');
}
if (!CAPTCHA_API_KEY) {
    throw new Error('Please provide value for the "CAPTCHA_API_KEY" env variable directly or via .env file');
}

let reminderInterval;
const browser = puppeteer.launch({ headless: !ENABLE_DEBUGGING });

const bot = (function () {
    if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
        console.warn('telegram bot: "TELEGRAM_TOKEN" or "TELEGRAM_CHAT_ID" env variables are missing, aborting setup');
        return;
    }
    console.info('telegram bot: setting up');
    const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
    console.info('telegram bot: setup complete');
    bot.on('message', msg => {
        if (ENABLE_DEBUGGING) {
            console.info('telegram bot: message received:', msg);
        }
        if (reminderInterval) {
            clearInterval(reminderInterval);
            bot.sendMessage(TELEGRAM_CHAT_ID, 'ok');
        }
    });
    return bot;
})();

const sendNotification = function (text) {
    if (!bot) {
        console.warn('telegram bot had not been configured, skipping notification', text);
        return;
    }
    bot.sendMessage(CHAT_ID, text);
    console.info('telegram bot: notification sent: ', text);
    reminderInterval = setInterval(() => {
        bot.sendMessage(CHAT_ID, 'reminder');
        console.info('telegram bot: sent reminder');
    }, TELEGRAM_REMINDER_DELAY);
};

const solveCaptcha = async function (url) {
    const formData = new FormData();
    formData.append('method', 'base64');
    formData.append('key', CAPTCHA_API_KEY);
    formData.append('body', url);
    formData.append('language', 2);
    formData.append('json', 1);
    const request = await fetch('http://2captcha.com/in.php', {
        method: 'POST',
        body: formData,
    });
    const requestData = await request.json();
    console.info('captcha request data', requestData);

    let captcha = '';
    while (true) {
        await setTimeout(10 * 1000);
        const result = await fetch(
            `http://2captcha.com/res.php?action=get&json=1&key=${CAPTCHA_API_KEY}&id=${requestData.request}`
        );
        const resultData = await result.json();
        console.info('captcha result data', resultData);
        if (result.ok && resultData.status === 1 && resultData.request) {
            captcha = resultData.request;
            break;
        }
    }
    return captcha;
};

const checkPageText = async function () {
    const page = await (await browser).newPage();
    await page.goto(CHECK_PAGE_URL, {
        waitUntil: 'networkidle2',
    });
    const captchaElement = await page.waitForSelector('#appointment_captcha_month captcha div');
    const imageWrappedIntoUrl = await captchaElement.evaluate(el => el.style.getPropertyValue('background-image'));
    const imageUrl = imageWrappedIntoUrl.slice(5, -2);

    const captcha = await solveCaptcha(imageUrl);
    await page.type('#appointment_captcha_month_captchaText', captcha);
    await page.click('#appointment_captcha_month_appointment_showMonth');

    const titleElement = await page.waitForSelector('.wrapper h2');
    const title = await titleElement.evaluate(el => el.innerText);

    await setTimeout(2 * 1000);
    await page.screenshot({ path: `screenshot-${Date.now()}.png` });

    await page.close();
    return title || '';
};

const checkAndNotify = async function () {
    try {
        const title = await checkPageText();
        if (title.includes('Unfortunately')) {
            console.info('skipped sending "Unfortunately..."');
            return;
        }
        await sendNotification(title || 'Possibly there are something new');
    } catch (error) {
        await sendNotification(`Checking failed with error "${error?.message}"`);
    }
};

(() => {
    checkAndNotify();
    setInterval(checkAndNotify, CHECK_INTERVAL_MS);
})();
