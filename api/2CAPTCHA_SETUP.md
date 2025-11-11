# 2Captcha Setup Guide

## Quick Start

### 1. Sign Up for 2Captcha

1. Go to https://2captcha.com
2. Click "Register" and create an account
3. Verify your email address

### 2. Add Funds

1. Log in to your 2Captcha account
2. Go to "Top Up Balance" in the menu
3. Add funds (minimum $1, recommended $5-10 to start)
4. Payment methods: PayPal, Bitcoin, WebMoney, etc.

### 3. Get Your API Key

1. Go to https://2captcha.com/setting
2. Find your "API Key" (looks like: `abcd1234efgh5678ijkl9012mnop3456`)
3. Copy it

### 4. Configure Your VPS

Add the API key to your environment variables:

```bash
export TWOCAPTCHA_API_KEY=your_actual_api_key_here
```

Or add it to your `.env` file:

```
TWOCAPTCHA_API_KEY=your_actual_api_key_here
```

### 5. Test It

Run your scraper and check the console output:

```
✅ 2Captcha integration enabled
💰 2Captcha balance: $5.00
```

## Pricing

- **Turnstile challenges**: $2.99 per 1000 solves
- **Average cost per scrape**: $0.003 (less than a penny)
- **Minimum balance**: $1.00

## Example Cost Calculation

If you scrape:
- 100 pages/day = $0.30/day = $9/month
- 500 pages/day = $1.50/day = $45/month
- 1000 pages/day = $3.00/day = $90/month

## How It Works

1. **Automatic Detection**: When the scraper detects a stuck Turnstile challenge
2. **Send to 2Captcha**: Challenge details are sent to 2Captcha API
3. **Human Solver**: Real workers solve the challenge (10-30 seconds)
4. **Token Injection**: Solution token is automatically injected into the page
5. **Continue Scraping**: Challenge passes and scraping continues

## Monitoring Your Balance

You can check your balance at any time:
- Dashboard: https://2captcha.com/enterpage
- API: The scraper automatically shows your balance on startup

## Tips for Optimization

1. **Combine with Residential Proxy**: Best results when using both
2. **Monitor Success Rate**: Check 2Captcha reports to see solve success rate
3. **Set Up Alerts**: Configure low balance alerts in 2Captcha settings
4. **Use Auto-Refill**: Enable auto-refill to avoid running out of balance

## Troubleshooting

### "2Captcha is not enabled" Error
- Check that `TWOCAPTCHA_API_KEY` environment variable is set
- Verify the API key is correct (no extra spaces)
- Restart your application after setting the variable

### "Insufficient balance" Error
- Add more funds to your 2Captcha account
- Minimum balance required: $0.003 per solve

### "Invalid site key" Error
- The scraper couldn't find the Turnstile site key
- This is rare - contact support if it persists

### Slow Solve Times
- Normal solve time: 10-30 seconds
- Peak times may be slower (30-60 seconds)
- Check 2Captcha status: https://2captcha.com/status

## Alternative Services

If 2Captcha is unavailable, these services also support Turnstile:

1. **Anti-Captcha**: https://anti-captcha.com
2. **CapSolver**: https://www.capsolver.com
3. **CapMonster Cloud**: https://capmonster.cloud

(Note: You would need to modify the code to use these services)

## Support

- 2Captcha Support: https://2captcha.com/support
- Documentation: https://2captcha.com/2captcha-api
- API Status: https://2captcha.com/status
