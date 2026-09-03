(() => {
  'use strict';

  const catalog = window.PET_CATALOG || { products: [], supplier: {} };
  const featuredIds = new Set(Array.isArray(window.FEATURED_LEATHER_IDS) ? window.FEATURED_LEATHER_IDS : []);
  const products = (Array.isArray(catalog.products) ? catalog.products : []).map((product) => {
    if (!featuredIds.has(product.uid)) return product;
    const isCollar = /collar/i.test(product.title || '');
    const isSet = /leash|harness|set/i.test(product.title || '');
    return {
      ...product,
      category: isCollar ? 'collars' : 'leashes',
      type: isCollar ? (isSet ? 'Leather Collar & Matching Set' : 'Leather Dog Collar') : 'Leather Dog Leash',
      features: ['Custom logo available', 'Custom colors and sizing', 'OEM & ODM production']
    };
  });
  const categories = [
    { key: 'bags', name: 'Pet Bags', description: 'Travel, training and walking bag solutions for pets and owners.' },
    { key: 'leashes', name: 'Dog Leashes', description: 'Walking and training leads in practical materials and constructions.' },
    { key: 'collars', name: 'Dog Collars', description: 'Everyday, leather, reflective and chain collar options.' },
    { key: 'clothes', name: 'Pet Clothes', description: 'Sweaters, jackets, vests and seasonal apparel for dogs and cats.' }
  ];
  const categoryByKey = Object.fromEntries(categories.map((category) => [category.key, category]));
  const homeCategoryImages = {
    bags: 'assets/main-pet-bags-v5.png',
    collars: 'assets/main-leather-collars-v4.png',
    clothes: 'assets/main-pet-clothes-v5.png'
  };
  const mailHref = 'mailto:sales@rongshengleather.com.cn?subject=Pet%20Product%20Inquiry';
  const state = { category: 'all', search: '', sort: 'featured', visible: 12, activeProduct: null };

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
    modalFeatures: document.querySelector('#modal-features'),
    modalSpecifications: document.querySelector('#modal-specifications'),
    modalEmail: document.querySelector('#modal-email')
  };

  function escapeHtml(value) {
    return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function safeUrl(value) {
    try {
      const url = new URL(value, window.location.href);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
  }

  function categoryName(key) { return categoryByKey[key]?.name || 'Pet Products'; }
  function productById(uid) { return products.find((product) => product.uid === uid); }
  function productsFor(key) { return products.filter((product) => product.category === key); }

  function renderHeroProducts() {
    const preferred = ['collars', 'bags', 'clothes'];
    const featured = preferred.map((key, index) => ({ key, product: productsFor(key)[index] })).filter((item) => item.product);
    elements.homeProducts.innerHTML = featured.map(({ key, product }) => `
      <button class="home-product home-product-${key}" type="button" data-home-category="${key}" aria-label="Explore ${escapeHtml(categoryName(key))}">
        <img src="${homeCategoryImages[key]}" alt="${escapeHtml(categoryName(key))}"><span><b>${escapeHtml(categoryName(key))}</b><small>Explore Category →</small></span>
      </button>`).join('');
  }

  function renderCategoryBanners() {
    elements.categoryBanners.innerHTML = categories.map((category) => {
      const group = productsFor(category.key).filter((product) => product.image);
      const samples = [group[0], group[Math.min(4, group.length - 1)]].filter(Boolean);
      return `<a class="category-banner" href="#products" data-category-banner="${category.key}">
        <div class="banner-copy"><span>${group.length} PRODUCTS</span><h3>${escapeHtml(category.name)}</h3><p>${escapeHtml(category.description)}</p><b>View Category →</b></div>
        <div class="banner-images" aria-hidden="true">${samples.map((product) => `<div><img src="${safeUrl(product.image)}" alt=""></div>`).join('')}</div>
      </a>`;
    }).join('');
  }

  function renderTabs() {
    elements.tabs.innerHTML = [{ key: 'all', name: 'All Products' }, ...categories].map((category) => `
      <button type="button" role="tab" data-category="${category.key}" class="${state.category === category.key ? 'active' : ''}" aria-selected="${state.category === category.key}">${escapeHtml(category.name)}</button>`).join('');
  }

  function filteredProducts() {
    const query = state.search.trim().toLowerCase();
    return products.filter((product) => {
      if (state.category !== 'all' && product.category !== state.category) return false;
      if (!query) return true;
      return [product.title, product.material, product.type, ...(product.features || []), ...(product.colors || [])].join(' ').toLowerCase().includes(query);
    }).sort((a, b) => {
      if (state.sort === 'name') return String(a.title).localeCompare(String(b.title));
      if (state.category === 'collars') return Number(featuredIds.has(b.uid)) - Number(featuredIds.has(a.uid));
      return 0;
    });
  }

  function productCard(product) {
    return `<article class="product-item">
      <div class="product-image" data-product-id="${escapeHtml(product.uid)}">
        <img src="${safeUrl(product.image)}" alt="${escapeHtml(product.title)}" loading="lazy">
        <button class="view-product" type="button" data-product-id="${escapeHtml(product.uid)}">View Product Details</button>
      </div>
      <div class="product-info"><p class="product-category">${escapeHtml(categoryName(product.category))}</p><h3>${escapeHtml(product.title)}</h3><p class="product-material">${escapeHtml(product.material || product.type || 'Custom materials available')}</p>
        <div class="product-meta"><b>OEM &amp; ODM AVAILABLE</b><span>Custom logo, color and packaging</span></div>
      </div></article>`;
  }

  function renderProducts() {
    const matches = filteredProducts();
    const hasMore = matches.length > state.visible;
    elements.list.innerHTML = matches.slice(0, state.visible).map(productCard).join('');
    elements.noProducts.hidden = matches.length !== 0;
    elements.loadMore.hidden = false;
    elements.loadMore.disabled = !hasMore;
    elements.loadMore.textContent = hasMore ? 'Load More Products' : 'No More Products';
    elements.loadMore.setAttribute('aria-disabled', String(!hasMore));
    elements.result.textContent = `Showing ${matches.length} product${matches.length === 1 ? '' : 's'}`;
    renderTabs();
  }

  function selectCategory(key, shouldScroll = false) {
    state.category = categoryByKey[key] ? key : 'all';
    state.visible = 12;
    renderProducts();
    if (shouldScroll) document.querySelector('#products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function openProduct(uid) {
    const product = productById(uid);
    if (!product) return;
    state.activeProduct = product;
    const gallery = [...new Set([product.image, ...(product.gallery || [])].filter(Boolean))].slice(0, 6);
    elements.modalMainImage.innerHTML = `<img src="${safeUrl(gallery[0])}" alt="${escapeHtml(product.title)}">`;
    elements.modalThumbnails.innerHTML = gallery.map((image, index) => `<button type="button" class="${index === 0 ? 'active' : ''}" data-gallery-image="${safeUrl(image)}" aria-label="View product image ${index + 1}"><img src="${safeUrl(image)}" alt=""></button>`).join('');
    elements.modalCategory.textContent = featuredIds.has(product.uid) ? 'Leather Dog Collars' : categoryName(product.category);
    elements.modalTitle.textContent = product.title;
    elements.modalFeatures.innerHTML = (product.features || []).map((feature) => `<span>${escapeHtml(feature)}</span>`).join('');
    elements.modalEmail.href = mailHref;
    const specifications = [
      ['Product Category', categoryName(product.category)], ['Product Type', product.type || categoryName(product.category)],
      ['Material', product.material || 'Custom material options'], ['Colors', (product.colors || ['Custom colors']).join(', ')],
      ['Customization', 'Color, logo, material and packaging'],
      ['Supplier', catalog.supplier?.name || 'Shenzhen Rongsheng Technology Co., Ltd.'], ['Product ID', product.id || product.uid]
    ];
    elements.modalSpecifications.innerHTML = specifications.map(([term, value]) => `<div><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('');
    elements.productModal.classList.add('open');
    elements.productModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    elements.productModal.querySelector('.modal-close')?.focus();
  }

  function closeProduct() {
    elements.productModal.classList.remove('open');
    elements.productModal.setAttribute('aria-hidden', 'true');
    state.activeProduct = null;
    document.body.style.overflow = '';
  }

  document.addEventListener('click', (event) => {
    const categoryBanner = event.target.closest('[data-category-banner]');
    if (categoryBanner) { event.preventDefault(); selectCategory(categoryBanner.dataset.categoryBanner, true); return; }
    const homeCategory = event.target.closest('[data-home-category]');
    if (homeCategory) { selectCategory(homeCategory.dataset.homeCategory, true); return; }
    const tab = event.target.closest('[data-category]');
    if (tab) { selectCategory(tab.dataset.category); return; }
    const footerCategory = event.target.closest('[data-footer-category]');
    if (footerCategory) { event.preventDefault(); selectCategory(footerCategory.dataset.footerCategory, true); return; }
    const galleryImage = event.target.closest('[data-gallery-image]');
    if (galleryImage && state.activeProduct) {
      elements.modalMainImage.innerHTML = `<img src="${galleryImage.dataset.galleryImage}" alt="${escapeHtml(state.activeProduct.title)}">`;
      elements.modalThumbnails.querySelectorAll('button').forEach((button) => button.classList.toggle('active', button === galleryImage));
      return;
    }
    const productTarget = event.target.closest('[data-product-id]');
    if (productTarget) { openProduct(productTarget.dataset.productId); return; }
    if (event.target.closest('[data-close-product]')) closeProduct();
  });

  elements.search.addEventListener('input', () => { state.search = elements.search.value; state.visible = 12; renderProducts(); });
  elements.sort.addEventListener('change', () => { state.sort = elements.sort.value; renderProducts(); });
  elements.loadMore.addEventListener('click', () => { state.visible += 12; renderProducts(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && elements.productModal.classList.contains('open')) closeProduct(); });

  renderHeroProducts(); renderCategoryBanners(); renderProducts();
})();
