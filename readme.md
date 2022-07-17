# Booking check bot

A small script that resolves catcha and checks for presence of a specific text afterwards. If not found, the notification is sent to the specified telegram user.

> Note: this script was not generalised, you may want to change DOM selectors found in `checkPageText` function for your specific purpose.

### Environment variables

- `CHECK_PAGE_URL` (required) - the url of the start page that need needs to be checked
- `CAPTCHA_API_KEY` (required) - the API key of the captcha-solving API
- `TELEGRAM_*` (optional) - information related to the telegram notification. If not provided, message sending will be skipped, instead logged to the `stdout`
    - `TELEGRAM_TOKEN` (required) - token of the telegram bot
    - `TELEGRAM_CHAT_ID` (required) - chat ID to which the notification will be send. Please note that this user have to first initiate a conversation with the bot in order to receive messages later on

### Usage

1. Install dependencies via `npm ci`
2. Set environment variables into `.env` file or provide them during runtime
3. Run script via `node index.js`
4. Check console output and/or your telegram notifications
