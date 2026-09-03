const fs = require('fs');
const path = require('path');

const DEBUG_PORT = 9224;
const SITE_URL = 'http://127.0.0.1:4175/';
const projectRoot = path.resolve(__dirname, '..');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  const pages = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
  const page = pages.find((entry) => entry.type === 'page');
  if (!page) throw new Error('No debuggable browser page found.');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  const pending = new Map(); let id = 0;
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', (event) => { const message = JSON.parse(event.data); if (!message.id || !pending.has(message.id)) return; const item = pending.get(message.id); pending.delete(message.id); message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result); });
  const send = (method, params = {}) => { const requestId = ++id; socket.send(JSON.stringify({ id: requestId, method, params })); return new Promise((resolve, reject) => pending.set(requestId, { resolve, reject })); };
  const evaluate = async (expression) => { const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error('Browser evaluation failed'); return result.result.value; };

  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true, screenWidth: 390, screenHeight: 844 });
  await send('Page.navigate', { url: SITE_URL }); await delay(6000);
  const mobile = await evaluate(`(() => ({
    categories: document.querySelectorAll('.category-banner').length,
    products: document.querySelectorAll('.product-item').length,
    homeCategories: document.querySelectorAll('.home-product[data-home-category]').length,
    homeImagesLoaded: [...document.querySelectorAll('.home-product img')].every((image) => image.complete && image.naturalWidth > 0),
    mailLinks: document.querySelectorAll('a[href^="mailto:sales@rongshengleather.com.cn"]').length,
    hasPrice: /(?:US)?\\$\\s?\\d/.test(document.body.innerText),
    hasVideo: document.querySelectorAll('video, .video-section, .video-badge').length > 0,
    hasQuoteDrawer: Boolean(document.querySelector('#quote-drawer')),
    hasMoq: /(?:MOQ|minimum order)/i.test(document.body.innerText),
    noOverflow: document.documentElement.scrollWidth <= window.innerWidth,
    hasChinese: /[\\u3400-\\u9fff]/.test(document.body.innerText)
  }))()`);
  const capture = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(projectRoot, 'assets', 'v3-mobile-preview.png'), Buffer.from(capture.data, 'base64'));

  await evaluate(`document.querySelector('.home-product').click()`); await delay(500);
  const homeCategory = await evaluate(`({ activeTab: document.querySelector('.product-tabs .active')?.textContent.trim(), modalOpen: document.querySelector('#product-modal').classList.contains('open') })`);
  await evaluate(`document.querySelector('[data-category="collars"]').click(); document.querySelector('.view-product').click()`); await delay(500);
  const modal = await evaluate(`(() => ({
    open: document.querySelector('#product-modal').classList.contains('open'),
    specs: document.querySelectorAll('#modal-specifications div').length,
    hasPrice: /(?:US)?\\$\\s?\\d/.test(document.querySelector('#product-modal').innerText),
    hasMoq: /(?:MOQ|minimum order)/i.test(document.querySelector('#product-modal').innerText),
    mailto: document.querySelector('#modal-email').getAttribute('href')
  }))()`);

  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false, screenWidth: 1440, screenHeight: 1000 });
  await send('Page.navigate', { url: SITE_URL }); await delay(5000); await evaluate(`document.querySelector('#home').scrollIntoView()`); await delay(500);
  const desktop = await evaluate(`({ noOverflow: document.documentElement.scrollWidth <= window.innerWidth, homeCategories: document.querySelectorAll('.home-product[data-home-category]').length, leatherSection: Boolean(document.querySelector('#leather-collection')) })`);
  const desktopCapture = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(projectRoot, 'assets', 'v3-category-preview.png'), Buffer.from(desktopCapture.data, 'base64'));
  const pagination = await evaluate(`(() => {
    const button = document.querySelector('#load-products');
    let clicks = 0;
    while (!button.disabled && clicks < 20) { button.click(); clicks += 1; }
    return { text: button.textContent.trim(), disabled: button.disabled, clicks, rendered: document.querySelectorAll('.product-item').length };
  })()`);
  const firstCollarIsLeather = await evaluate(`(() => { document.querySelector('[data-category="collars"]').click(); const first = document.querySelector('.product-item h3')?.textContent || ''; const material = document.querySelector('.product-material')?.textContent || ''; return /leather/i.test(first + ' ' + material); })()`);
  const report = { mobile, homeCategory, modal, desktop, pagination, firstCollarIsLeather }; console.log(JSON.stringify(report, null, 2));
  const passed = mobile.categories === 4 && mobile.products === 12 && mobile.homeCategories === 3 && mobile.homeImagesLoaded && mobile.mailLinks >= 5 && !mobile.hasPrice && !mobile.hasVideo && !mobile.hasQuoteDrawer && !mobile.hasMoq && mobile.noOverflow && !mobile.hasChinese && homeCategory.activeTab === 'Dog Collars' && !homeCategory.modalOpen && modal.open && modal.specs === 7 && !modal.hasPrice && !modal.hasMoq && modal.mailto.startsWith('mailto:') && desktop.noOverflow && desktop.homeCategories === 3 && !desktop.leatherSection && pagination.text === 'No More Products' && pagination.disabled && pagination.rendered > 12 && firstCollarIsLeather;
  socket.close(); if (!passed) process.exitCode = 1;
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
