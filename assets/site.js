(() => {
  'use strict';

  const catalog = window.PET_CATALOG || { categories: [], products: [], supplier: {} };
  const products = Array.isArray(catalog.products) ? catalog.products : [];
  const categories = [
    { key: 'bags', name: 'Pet Bags', description: 'Travel, training and walking bag solutions for pets and owners.' },
    { key: 'leashes', name: 'Dog Leashes', description: 'Walking and training leads in practical materials and constructions.' },
    { key: 'collars', name: 'Dog Collars', description: 'Everyday, leather, reflective and chain collar options.' },
    { key: 'clothes', name: 'Pet Clothes', description: 'Sweaters, jackets, vests and seasonal apparel for dogs and cats.' }
  ];
  const categoryByKey = Object.fromEntries(categories.map((category) => [category.key, category]));

  const state = {
    category: 'all',
    search: '',
    sort: 'high',
    visible: 12,
    activeProduct: null,
    quote: loadQuote()
  };

  const elements = {
    homeProducts: document.querySelector('#home-products'),
    categoryBanners: document.querySelector('#category-banners'),
    tabs: document.querySelector('#product-tabs'),
    list: document.querySelector('#product-list'),
    result: document.querySelector('#product-result'),
    noProducts: document.querySelector('#no-products'),
    loadMore: document.querySelector('#load-products'),
    search: document.querySelector('#product-search'),
    sort: document.querySelector('#product-sort'),
    productModal: document.querySelector('#product-modal'),
    modalMainImage: document.querySelector('#modal-main-image'),
    modalThumbnails: document.querySelector('#modal-thumbnails'),
    modalCategory: document.querySelector('#modal-category'),
    modalTitle: document.querySelector('#modal-title'),
    modalPrice: document.querySelector('#modal-price'),
    modalMoq: document.querySelector('#modal-moq'),
    modalFeatures: document.querySelector('#modal-features'),
    modalSpecifications: document.querySelector('#modal-specifications'),
    modalAdd: document.querySelector('#modal-add'),
    video: document.querySelector('#product-video'),
    videoType: document.querySelector('#video-type'),
    quoteDrawer: document.querySelector('#quote-drawer'),
    quoteBackground: document.querySelector('#quote-background'),
    quoteCount: document.querySelector('#quote-count'),
    quoteItems: document.querySelector('#quote-items'),
    quoteEmpty: document.querySelector('#quote-empty'),
    emailInquiry: document.querySelector('#email-inquiry'),
    message: document.querySelector('#site-message')
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function safeUrl(value) {
    try {
      const url = new URL(value, window.location.href);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  }

  function formatPrice(product) {
    return escapeHtml(product.price || 'Contact for price');
  }

  function categoryName(key) {
    return categoryByKey[key]?.name || 'Pet Products';
  }

  function productsFor(key) {
    return products.filter((product) => product.category === key);
  }

  function representativeProducts(key) {
    const group = productsFor(key).filter((product) => product.image);
    return [group[0], group[Math.min(4, group.length - 1)]].filter(Boolean);
  }

  function renderHeroProducts() {
    const preferred = ['bags', 'collars', 'clothes'];
    const featured = preferred.map((key, index) => productsFor(key)[index]).filter(Boolean);
    elements.homeProducts.innerHTML = featured.map((product) => `
      <button class="home-product" type="button" data-product-id="${escapeHtml(product.uid)}" aria-label="View ${escapeHtml(product.title)}">
        <img src="${safeUrl(product.image)}" alt="${escapeHtml(product.title)}">
        <span>${escapeHtml(categoryName(product.category))}</span>
      </button>
    `).join('');
  }

  function renderCategoryBanners() {
    elements.categoryBanners.innerHTML = categories.map((category) => {
      const bannerProducts = representativeProducts(category.key);
      return `
        <a class="category-banner" href="#products" data-category-banner="${category.key}">
          <div class="banner-copy">
            <span>20 SELECTED PRODUCTS</span>
            <h3>${escapeHtml(category.name)}</h3>
            <p>${escapeHtml(category.description)}</p>
            <b>View Category →</b>
          </div>
          <div class="banner-images" aria-hidden="true">
            ${bannerProducts.map((product) => `<div><img src="${safeUrl(product.image)}" alt=""></div>`).join('')}
          </div>
        </a>
      `;
    }).join('');
  }

  function renderTabs() {
    const tabs = [{ key: 'all', name: 'All Products' }, ...categories];
    elements.tabs.innerHTML = tabs.map((category) => `
      <button type="button" role="tab" data-category="${category.key}" class="${state.category === category.key ? 'active' : ''}" aria-selected="${state.category === category.key}">
        ${escapeHtml(category.name)}
      </button>
    `).join('');
  }

  function filteredProducts() {
    const query = state.search.trim().toLowerCase();
    const filtered = products.filter((product) => {
      if (state.category !== 'all' && product.category !== state.category) return false;
      if (!query) return true;
      const searchable = [
        product.title,
        product.material,
        product.type,
        ...(product.features || []),
        ...(product.colors || [])
      ].join(' ').toLowerCase();
      return searchable.includes(query);
    });

    return filtered.sort((a, b) => {
      if (state.sort === 'low') return Number(a.priceMin || 0) - Number(b.priceMin || 0);
      if (state.sort === 'name') return String(a.title).localeCompare(String(b.title));
      return Number(b.priceMax || b.priceMin || 0) - Number(a.priceMax || a.priceMin || 0);
    });
  }

  function productCard(product) {
    const isAdded = state.quote.includes(product.uid);
    return `
      <article class="product-item">
        <div class="product-image" data-product-id="${escapeHtml(product.uid)}">
          <img src="${safeUrl(product.image)}" alt="${escapeHtml(product.title)}" loading="lazy">
          ${product.video ? '<span class="video-badge">VIDEO AVAILABLE</span>' : ''}
          <button class="view-product" type="button" data-product-id="${escapeHtml(product.uid)}">View Product Details</button>
        </div>
        <div class="product-info">
          <p class="product-category">${escapeHtml(categoryName(product.category))}</p>
          <h3>${escapeHtml(product.title)}</h3>
          <p class="product-material">${escapeHtml(product.material || product.type || 'Custom materials available')}</p>
          <div class="product-order">
            <div><span>FOB REFERENCE · MOQ ${escapeHtml(product.moq || 'On request')}</span><strong>${formatPrice(product)}</strong></div>
            <button class="add-quote ${isAdded ? 'added' : ''}" type="button" data-add-product="${escapeHtml(product.uid)}" aria-label="${isAdded ? 'Remove from' : 'Add to'} quote list">${isAdded ? '✓' : '+'}</button>
          </div>
        </div>
      </article>
    `;
  }

  function renderProducts() {
    const matches = filteredProducts();
    const visible = matches.slice(0, state.visible);
    elements.list.innerHTML = visible.map(productCard).join('');
    elements.noProducts.hidden = matches.length !== 0;
    elements.loadMore.hidden = matches.length <= state.visible;
    elements.result.textContent = matches.length === 1 ? 'Showing 1 product' : `Showing ${matches.length} products`;
    renderTabs();
  }

  function selectCategory(key, shouldScroll = false) {
    state.category = categoryByKey[key] ? key : 'all';
    state.visible = 12;
    renderProducts();
    if (shouldScroll) document.querySelector('#products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function productById(uid) {
    return products.find((product) => product.uid === uid);
  }

  function openProduct(uid) {
    const product = productById(uid);
    if (!product) return;
    state.activeProduct = product;
    const gallery = [...new Set([product.image, ...(product.gallery || [])].filter(Boolean))].slice(0, 6);

    elements.modalMainImage.innerHTML = `<img src="${safeUrl(gallery[0])}" alt="${escapeHtml(product.title)}">`;
    elements.modalThumbnails.innerHTML = gallery.map((image, index) => `
      <button type="button" class="${index === 0 ? 'active' : ''}" data-gallery-image="${safeUrl(image)}" aria-label="View product image ${index + 1}">
        <img src="${safeUrl(image)}" alt="">
      </button>
    `).join('');
    elements.modalCategory.textContent = categoryName(product.category);
    elements.modalTitle.textContent = product.title;
    elements.modalPrice.textContent = product.price || 'Contact for price';
    elements.modalMoq.textContent = `Minimum order: ${product.moq || 'Contact us'}`;
    elements.modalFeatures.innerHTML = (product.features || []).map((feature) => `<span>${escapeHtml(feature)}</span>`).join('');
    elements.modalAdd.dataset.productId = product.uid;
    updateModalAddButton();

    const specifications = [
      ['Product Category', categoryName(product.category)],
      ['Product Type', product.type || categoryName(product.category)],
      ['Material', product.material || 'Custom material options'],
      ['Colors', (product.colors || ['Custom colors']).join(', ')],
      ['FOB Price Range', product.price || 'Contact for price'],
      ['Minimum Order', product.moq || 'Contact us'],
      ['Customization', 'Color, logo, material and packaging'],
      ['Supplier', catalog.supplier?.name || 'Shenzhen Rongsheng Technology Co., Ltd.'],
      ['Product ID', product.id || product.uid]
    ];
    elements.modalSpecifications.innerHTML = specifications.map(([term, value]) => `
      <div><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(value)}</dd></div>
    `).join('');

    if (product.video) {
      elements.video.src = safeUrl(product.video);
      elements.video.closest('.video-section').hidden = false;
      elements.videoType.textContent = product.videoType === 'product' ? 'Product-specific video' : 'Related category video';
    } else {
      elements.video.removeAttribute('src');
      elements.video.closest('.video-section').hidden = true;
    }

    elements.productModal.classList.add('open');
    elements.productModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    elements.productModal.querySelector('.modal-close')?.focus();
  }

  function closeProduct() {
    elements.productModal.classList.remove('open');
    elements.productModal.setAttribute('aria-hidden', 'true');
    elements.video.pause();
    elements.video.removeAttribute('src');
    state.activeProduct = null;
    if (!elements.quoteDrawer.classList.contains('open')) document.body.style.overflow = '';
  }

  function loadQuote() {
    try {
      const saved = JSON.parse(localStorage.getItem('bestone-v3-quote') || '[]');
      if (!Array.isArray(saved)) return [];
      return [...new Set(saved.filter((uid) => products.some((product) => product.uid === uid)))];
    } catch {
      return [];
    }
  }

  function saveQuote() {
    try {
      localStorage.setItem('bestone-v3-quote', JSON.stringify(state.quote));
    } catch {
      // The quote list still works for this session when storage is unavailable.
    }
  }

  function showMessage(text) {
    elements.message.textContent = text;
    elements.message.classList.add('show');
    window.clearTimeout(showMessage.timer);
    showMessage.timer = window.setTimeout(() => elements.message.classList.remove('show'), 2200);
  }

  function updateModalAddButton() {
    if (!state.activeProduct) return;
    const isAdded = state.quote.includes(state.activeProduct.uid);
    elements.modalAdd.textContent = isAdded ? 'Remove from Quote List' : 'Add to Quote List';
  }

  function toggleQuoteItem(uid) {
    const product = productById(uid);
    if (!product) return;
    const position = state.quote.indexOf(uid);
    if (position >= 0) {
      state.quote.splice(position, 1);
      showMessage('Removed from your quote list.');
    } else {
      state.quote.push(uid);
      showMessage('Added to your quote list.');
    }
    saveQuote();
    renderQuote();
    renderProducts();
    updateModalAddButton();
  }

  function renderQuote() {
    const selected = state.quote.map(productById).filter(Boolean);
    elements.quoteCount.textContent = selected.length;
    elements.quoteEmpty.hidden = selected.length > 0;
    elements.quoteItems.innerHTML = selected.map((product) => `
      <article class="quote-item">
        <img src="${safeUrl(product.image)}" alt="${escapeHtml(product.title)}">
        <div><h3>${escapeHtml(product.title)}</h3><p>${formatPrice(product)} · MOQ ${escapeHtml(product.moq || 'On request')}</p></div>
        <button type="button" data-remove-product="${escapeHtml(product.uid)}" aria-label="Remove ${escapeHtml(product.title)}">×</button>
      </article>
    `).join('');
  }

  function openQuote() {
    if (elements.productModal.classList.contains('open')) closeProduct();
    elements.quoteDrawer.classList.add('open');
    elements.quoteBackground.classList.add('open');
    elements.quoteDrawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    document.querySelector('#close-quote')?.focus();
  }

  function closeQuote() {
    elements.quoteDrawer.classList.remove('open');
    elements.quoteBackground.classList.remove('open');
    elements.quoteDrawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function openEmailInquiry() {
    const selected = state.quote.map(productById).filter(Boolean);
    const productLines = selected.length
      ? selected.map((product, index) => `${index + 1}. ${product.title}\n   Product ID: ${product.id}\n   FOB reference: ${product.price}\n   MOQ: ${product.moq}`).join('\n\n')
      : 'No catalog products selected yet.';
    const body = [
      'Hello Shenzhen Rongsheng Technology Co., Ltd.,',
      '',
      'I would like to request a quotation for the following pet products:',
      '',
      productLines,
      '',
      'Please contact me to confirm pricing, customization options, sample availability and lead time.'
    ].join('\n');
    const subject = selected.length
      ? `Pet Product Quote Request — ${selected.length} Selected Product${selected.length === 1 ? '' : 's'}`
      : 'Pet Product Quote Request';
    window.location.href = `mailto:sales@rongshengleather.com.cn?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  document.addEventListener('click', (event) => {
    const categoryBanner = event.target.closest('[data-category-banner]');
    if (categoryBanner) {
      event.preventDefault();
      selectCategory(categoryBanner.dataset.categoryBanner, true);
      return;
    }

    const tab = event.target.closest('[data-category]');
    if (tab) {
      selectCategory(tab.dataset.category);
      return;
    }

    const footerCategory = event.target.closest('[data-footer-category]');
    if (footerCategory) {
      event.preventDefault();
      selectCategory(footerCategory.dataset.footerCategory, true);
      return;
    }

    const add = event.target.closest('[data-add-product]');
    if (add) {
      event.stopPropagation();
      toggleQuoteItem(add.dataset.addProduct);
      return;
    }

    const productTarget = event.target.closest('[data-product-id]');
    if (productTarget) {
      openProduct(productTarget.dataset.productId);
      return;
    }

    const galleryImage = event.target.closest('[data-gallery-image]');
    if (galleryImage && state.activeProduct) {
      elements.modalMainImage.innerHTML = `<img src="${galleryImage.dataset.galleryImage}" alt="${escapeHtml(state.activeProduct.title)}">`;
      elements.modalThumbnails.querySelectorAll('button').forEach((button) => button.classList.toggle('active', button === galleryImage));
      return;
    }

    if (event.target.closest('[data-close-product]')) closeProduct();
    if (event.target.closest('[data-open-quote]') || event.target.closest('#open-quote')) openQuote();

    const remove = event.target.closest('[data-remove-product]');
    if (remove) toggleQuoteItem(remove.dataset.removeProduct);
  });

  elements.search.addEventListener('input', () => {
    state.search = elements.search.value;
    state.visible = 12;
    renderProducts();
  });
  elements.sort.addEventListener('change', () => {
    state.sort = elements.sort.value;
    renderProducts();
  });
  elements.loadMore.addEventListener('click', () => {
    state.visible += 12;
    renderProducts();
  });
  elements.modalAdd.addEventListener('click', () => toggleQuoteItem(elements.modalAdd.dataset.productId));
  document.querySelector('#close-quote').addEventListener('click', closeQuote);
  elements.quoteBackground.addEventListener('click', closeQuote);
  elements.emailInquiry.addEventListener('click', openEmailInquiry);
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (elements.productModal.classList.contains('open')) closeProduct();
    else if (elements.quoteDrawer.classList.contains('open')) closeQuote();
  });

  renderHeroProducts();
  renderCategoryBanners();
  renderProducts();
  renderQuote();
})();
