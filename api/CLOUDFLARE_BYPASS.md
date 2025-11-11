# Cloudflare Bypass Configuration

This document explains how to configure the scraper to maximize chances of bypassing Cloudflare protection on your VPS.

## Environment Variables

Add these environment variables to your VPS deployment to enable enhanced Cloudflare bypass features:

### Proxy Configuration (Highly Recommended)

```bash
# Residential proxy server address (format: host:port)
PROXY_SERVER=residential-proxy.example.com:8080

# Proxy authentication (if required)
PROXY_USERNAME=your_username
PROXY_PASSWORD=your_password
```

### 2Captcha Configuration (Recommended for VPS)

```bash
# 2Captcha API key - Get from https://2captcha.com
TWOCAPTCHA_API_KEY=your_2captcha_api_key_here
```

**How it works:**
- When Cloudflare Turnstile gets stuck (shows "Stuck here? Send feedback")
- The scraper automatically sends the challenge to 2Captcha
- Real workers solve the challenge (takes 10-30 seconds)
- The solution token is injected back into the page
- The challenge completes and scraping continues

**Cost:**
- ~$2.99 per 1000 Turnstile solves
- Average solve time: 10-30 seconds
- Success rate: 95-99%

### Chrome Path (VPS Specific)

```bash
# Path to Chrome/Chromium executable on VPS
CHROME_PATH=/usr/bin/chromium-browser
# or
CHROME_PATH=/usr/bin/google-chrome-stable
```

## Features Implemented

### 1. Residential Proxy Support
- Automatically routes traffic through a residential proxy if configured
- Supports proxy authentication
- Makes requests appear from residential IPs instead of datacenter IPs

### 2. User Agent Rotation
- Randomly selects from a pool of realistic user agents
- Rotates between Windows, macOS, and Linux signatures

### 3. Enhanced Browser Fingerprinting
- Mock WebGL vendor and renderer
- Realistic plugins list
- Battery and connection API mocking
- Media devices enumeration
- Screen properties that match real browsers
- Hardware concurrency and device memory randomization

### 4. Advanced Challenge Detection
- Detects multiple Cloudflare challenge types
- Screenshots each challenge attempt (base64 output to console)
- Automatic retry with exponential backoff

### 5. Intelligent Challenge Clicking
- Coordinate-based iframe clicking
- Human-like mouse movements with steps
- Realistic click timing and delays
- Multiple fallback strategies for different challenge types

## Recommended Proxy Services

For best results on VPS, use residential proxy services:

1. **Bright Data (formerly Luminati)**: https://brightdata.com
2. **Smartproxy**: https://smartproxy.com
3. **Oxylabs**: https://oxylabs.io
4. **IPRoyal**: https://iproyal.com

## Setup Instructions

### On Your VPS:

1. Install Chrome/Chromium:
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y chromium-browser

# Or for Google Chrome
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg -i google-chrome-stable_current_amd64.deb
sudo apt-get install -f
```

2. Set environment variables (add to `.env` or export):
```bash
export CHROME_PATH=/usr/bin/chromium-browser

# Residential proxy (highly recommended)
export PROXY_SERVER=your-proxy-host:port
export PROXY_USERNAME=your-username
export PROXY_PASSWORD=your-password

# 2Captcha (recommended for VPS)
export TWOCAPTCHA_API_KEY=your_api_key_here
```

3. Deploy your application with these environment variables

## Testing

To test if the configuration works, check the console output for:

```
🌐 Using proxy: your-proxy-host:port
🎭 Using User-Agent: Mozilla/5.0...
✅ 2Captcha integration enabled
💰 2Captcha balance: $5.23
```

If you see Cloudflare challenges, screenshots will be output as base64:

```
=== CLOUDFLARE CHALLENGE SCREENSHOT (Base64) ===
iVBORw0KGgoAAAANSUhEUgAA...
=== END SCREENSHOT ===
```

You can decode these screenshots to see what the scraper encountered.

## Debugging Screenshots

To view base64 screenshots:

1. Copy the base64 string from console
2. Create an HTML file:
```html
<!DOCTYPE html>
<html>
<body>
<img src="data:image/png;base64,PASTE_BASE64_HERE">
</body>
</html>
```
3. Open in browser to see the screenshot

## Success Indicators

You'll know it's working when you see:

**Without 2Captcha (automatic bypass):**
```
✅ Successfully passed Cloudflare challenge (if any)
Scraped title from Quizlet: "Your Set Title"
Scraped X terms
```

**With 2Captcha (when challenge gets stuck):**
```
⚠️ Challenge appears stuck - Cloudflare may have detected automation
🔄 Attempting to solve with 2Captcha service...
✅ Found Turnstile site key: 0x4AAA...
🔄 Sending Turnstile challenge to 2Captcha...
✅ 2Captcha solved the challenge!
✅ Token injected successfully, waiting for verification...
✅ Challenge appears to be passed! Main page shows content.
Scraped X terms
```

## Troubleshooting

### Still Getting Blocked?

1. **Verify proxy is working**: Check that your proxy credentials are correct
2. **Try different proxy regions**: Some proxies work better from certain locations
3. **Check proxy type**: Ensure you're using residential proxies, not datacenter
4. **Monitor rate limits**: Don't scrape too frequently from the same IP
5. **Enable logging**: Check the detailed console output for clues

### Common Issues

- **"Failed to bypass Cloudflare after maximum wait time"**: Your IP may be on a blocklist, use a different proxy
- **Screenshots show captcha**: Some challenges require human solving services (2captcha, Anti-Captcha)
- **Browser crashes**: Increase VPS memory or adjust Chrome flags
- **"One more step" with "unblock challenges.cloudflare.com"**: This means the Cloudflare challenge iframe is being blocked. The scraper now includes:
  - `--disable-web-security` flag to allow all third-party content
  - `setBypassCSP(true)` to bypass Content Security Policy
  - Extended wait times for iframe loading
  - These should resolve the iframe blocking issue
- **Loading spinner with "Stuck here? Send feedback"**: This means Cloudflare Turnstile has detected automation and is refusing to pass the challenge. This is the hardest challenge to bypass. Solutions:
  1. **Use a residential proxy** (most important) - datacenter IPs trigger stricter checks
  2. **Use a captcha solving service** like 2Captcha, Anti-Captcha, or CapSolver
  3. **Run in non-headless mode** with a real display server (Xvfb)
  4. Consider alternative approaches (API if available, different data source, etc.)

## Advanced Options

For even better results, consider:

1. Running with Xvfb (virtual display) for non-headless mode
2. Using browser profile persistence to build trust
3. Implementing request delays and randomization
4. Rotating between multiple proxy IPs
