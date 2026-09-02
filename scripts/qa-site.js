const fs = require('fs');
const path = require('path');

const DEBUG_PORT = 9224;
const SITE_URL = 'http://127.0.0.1:4175/';
const projectRoot = path.resolve(__dirname, '..');

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function getPageWebSocket() {
  const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
  const pages = await response.json();
  const page = pages.find((entry) => entry.type === 'page');
  if (!page) throw new Error('No debuggable browser page found.');
  return page.webSocketDebuggerUrl;
}

async function run() {
  const socket = new WebSocket(await getPageWebSocket());
  const pending = new Map();
  let id = 0;

  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });

  function send(method, params = {}) {
    const requestId = ++id;
    socket.send(JSON.stringify({ id: requestId, method, params }));
    return new Promise((resolve, reject) => pending.set(requestId, { resolve, reject }));
  }

  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Browser evaluation failed.');
    return result.result.value;
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
    screenWidth: 390,
    screenHeight: 844
  });
  await send('Page.navigate', { url: SITE_URL });
  await delay(7000);
  await evaluate(`localStorage.removeItem('bestone-v3-quote'); location.reload()`);
  await delay(5000);

  const initial = await evaluate(`(() => ({
    title: document.title,
    categories: document.querySelectorAll('.category-banner').length,
    productCards: document.querySelectorAll('.product-item').length,
    catalogProducts: window.PET_CATALOG?.products?.length || 0,
    hasChinese: /[\\u3400-\\u9fff]/.test(document.body.innerText),
    viewportWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
    visibleCategorySection: !document.querySelector('#categories').hidden
  }))()`);

  const mobileCapture = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(projectRoot, 'assets', 'v3-mobile-preview.png'), Buffer.from(mobileCapture.data, 'base64'));

  await evaluate(`document.querySelector('[data-category-banner="collars"]').click()`);
  await delay(1200);
  const category = await evaluate(`(() => ({
    activeTab: document.querySelector('.product-tabs .active')?.textContent.trim(),
    result: document.querySelector('#product-result')?.textContent.trim(),
    productCards: document.querySelectorAll('.product-item').length,
    allCardsAreCollars: [...document.querySelectorAll('.product-category')].every((node) => node.textContent.trim() === 'Dog Collars')
  }))()`);

  await evaluate(`document.querySelector('.view-product').click()`);
  await delay(700);
  const modal = await evaluate(`(() => ({
    open: document.querySelector('#product-modal').classList.contains('open'),
    galleryImages: document.querySelectorAll('#modal-thumbnails button').length,
    specifications: document.querySelectorAll('#modal-specifications div').length,
    videoAvailable: Boolean(document.querySelector('#product-video').getAttribute('src')),
    externalProductLinks: document.querySelectorAll('#product-modal a[href^="http"]').length
  }))()`);

  await evaluate(`document.querySelector('#modal-add').click()`);
  await delay(300);
  const quoteCount = await evaluate(`document.querySelector('#quote-count').textContent.trim()`);
  await evaluate(`document.querySelector('[data-close-product]').click(); document.querySelector('#open-quote').click()`);
  await delay(500);
  const quote = await evaluate(`(() => ({
    open: document.querySelector('#quote-drawer').classList.contains('open'),
    items: document.querySelectorAll('.quote-item').length,
    emailAction: document.querySelector('#email-inquiry')?.textContent.trim(),
    hasFormFields: document.querySelectorAll('#quote-drawer input, #quote-drawer textarea').length > 0
  }))()`);
  await evaluate(`document.querySelector('#close-quote').click(); window.scrollTo(0, 0)`);
  await delay(500);

  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: 1440,
    screenHeight: 1000
  });
  await send('Page.navigate', { url: `${SITE_URL}#categories` });
  await delay(6000);
  const desktop = await evaluate(`(() => ({
    viewportWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
    categoryBanners: document.querySelectorAll('.category-banner').length
  }))()`);
  const desktopCapture = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(projectRoot, 'assets', 'v3-category-preview.png'), Buffer.from(desktopCapture.data, 'base64'));

  const report = { initial, category, modal, quoteCount, quote, desktop };
  console.log(JSON.stringify(report, null, 2));

  const passed = initial.categories === 4
    && initial.productCards === 12
    && initial.catalogProducts === 80
    && initial.hasChinese === false
    && initial.noHorizontalOverflow
    && category.activeTab === 'Dog Collars'
    && category.result === 'Showing 20 products'
    && category.allCardsAreCollars
    && modal.open
    && modal.galleryImages >= 1
    && modal.specifications >= 8
    && modal.videoAvailable
    && modal.externalProductLinks === 0
    && Number(quoteCount) >= 1
    && quote.open
    && quote.items >= 1
    && quote.emailAction === 'Email Selected Products'
    && quote.hasFormFields === false
    && desktop.noHorizontalOverflow
    && desktop.categoryBanners === 4;

  socket.close();
  if (!passed) process.exitCode = 1;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
