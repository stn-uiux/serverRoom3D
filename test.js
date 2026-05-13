import { Builder, By, Key, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';

(async function testServerRoom() {
  let options = new chrome.Options();
  // We must run headless or standard based on the container constraints
  options.addArguments('--headless=new');
  options.addArguments('--window-size=1920,1080');

  let driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
  try {
    console.log("Navigating to app...");
    await driver.get('http://localhost:5173');
    
    // Wait for the app to initialize
    await driver.sleep(2000);
    
    console.log("Entering Gwacheon node...");
    // Just find "과천" in tree and click it
    let gwacheonNode = await driver.wait(until.elementLocated(By.xpath('//span[contains(text(), "과천")]')), 5000);
    await gwacheonNode.click();
    await driver.sleep(1000);
    
    console.log("Entering Edit Mode...");
    let editButton = await driver.wait(until.elementLocated(By.xpath('//button[.//span[text()="Edit Mode"]]')), 5000);
    await editButton.click();
    await driver.sleep(1000);
    
    // Now we need to artificially simulate a rack drop
    // We can execute script to access the `useStore` directly and trigger `moveRack` manually
    // to see exactly what is returned and what triggers the toast!
    console.log("Injecting debug script...");
    const result = await driver.executeAsyncScript(`
      const callback = arguments[arguments.length - 1];
      
      // We will access zustand window.__store via a hack if it's exposed, or just rely on DOM for Toast
      // Let's monkey-patch showToast to capture the error message!
      
      const debugLogs = [];
      
      try {
        // Find a way to get the React root or fiber
        const rootNode = document.querySelector('#root');
        
        // Wait, instead of patching zustand directly, we can just simulate drag drop in DOM?
        // It's 3D canvas (r3f) so DOM simulation of drag is super hard (pointer events).
        
        callback({ status: 'ok', logs: [] });
      } catch(e) {
        callback({ status: 'error', message: e.message });
      }
    `);
    
    console.log("Test done.");
  } finally {
    await driver.quit();
  }
})();
