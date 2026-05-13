import puppeteer from 'puppeteer';

(async () => {
  try {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text());
    });
    
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
    console.log('Loaded');
    
    // Find the equipment button
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && text.includes('장비')) {
        console.log('Found button, clicking...');
        await btn.click();
        await new Promise(r => setTimeout(r, 2000));
        break;
      }
    }
    
    await browser.close();
  } catch(e) {
    console.error('SCRIPT ERROR:', e);
  }
})();
