# Lincx Template Patterns

Canonical, copy-paste-ready patterns extracted from the existing Lincx ad template library. Each pattern is stable across templates and SHOULD be reused verbatim when the matching use case appears.

> **Field names in the snippets below are illustrative.** They reflect what commonly appears across the library, but **every template has its own CAG** — the actual field names for the template you're working on come from `get_creative_asset_group(id=…)`, not from these snippets. The **structure, class names, Mustache forms (`{{ }}` vs `{{{ }}}` vs `{{# }}`), data attributes, and JS helpers** are what you should copy verbatim. The **field names** — `href`, `cta_text`, `offer_headline`, etc. — swap for whatever the CAG defines. See `CHECKLIST.md` §6.

> **Scripts search their own zone, never the whole page.** lincx-core strips a template's inline `<script>`s from the markup and appends them to the zone's mount, the element that holds the zone tag. So each script reads `document.currentScript.parentElement` once, synchronously, inside its IIFE: in `DOMContentLoaded`, timer and observer callbacks `document.currentScript` is `null`, so the read throws there, and a top-level `const zone` throws when a page serves the template twice. Pass that `zone` to every helper and query only inside it; a page-wide query lets the first zone on the page take every other zone's offers. Each zone snippet needs its own parent element, holding no other zone, or one zone's queries reach another zone's offers. Write inline scripts as a bare `<script>`: lincx-core leaves an inline `<script>` that carries an attribute in the markup, where it never runs (a `data-lincx-hook="beforeLoad"` script aside).

Organized by user intent:
- "Build a listicle" → §1, §2, §3, §11, §12, §14
- "Build a sticky offer bar" → §4, §8
- "Build a product card / comparison" → §5, §6, §8, §9
- "Add multi-CTA to any template" → §3
- "Add video media" → §11, §12
- "Add ratings" → §8
- "Add a disclaimer footer" → §14

---

## 1. Root wrapper + ads loop

The backbone of every template.

```html
<div class="lincx-wrapper">
  <div class="lincx-container">
    {{#ads}}
    <div class="listicle" data-group="{{ groupOffer }}" id="{{ adId }}">
      <!-- per-ad content -->
    </div>
    {{/ads}}
  </div>
</div>
```

```css
.lincx-wrapper {
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  -webkit-font-smoothing: antialiased;
}
@media (min-width: 992px) {
  .lincx-wrapper { max-width: 1240px; }
}
```

---

## 2. Numbered subheading (listicle item)

```html
<h3 class="subheading" data-content="{{ offer_headline }}">
  <a href="{{href}}" target="_blank"
     data-lincx-cta
     data-lincx-cta-name="headline"
     data-lincx-cta-position="headline"
     style="text-decoration: none; color: #000;">
    {{{ offer_headline }}}
  </a>
</h3>
```

Paired with JS that prepends the reverse index so the last item is #1:

```js
function addNumberToHeadlines(zone) {
  const headlines = zone.querySelectorAll('.subheading[data-content]:not([data-content=""])')
  const count = headlines.length
  headlines.forEach((headline, index) => {
    headline.innerHTML = `<span class="number">${count - index}.</span> ${headline.innerHTML}`
  })
}
```

Alternative: use CSS counters if the order is stable (not reordered by group logic):

```css
.listicle { counter-reset: index; }
.subheading::before { content: counter(index) '.'; counter-increment: index; }
```

---

## 3. Multi-CTA list with `Label|URL` splitting

Allows ops to define multiple CTAs as a single pipe-delimited array.

```html
<div class="listicle__list__cta" data-content="{{#cta_list}}{{.}}{{/cta_list}}">
  {{#cta_list}}
  <a href="{{.}}"
     class="cta__link"
     target="_blank"
     data-lincx-cta
     data-disclaimer="{{ offer_disclaimer }}"
     data-lincx-cta-name="cta position {{ _index }}"
     data-lincx-cta-position="cta_list"
     data-element="{{.}}">
    {{.}}
  </a>
  {{/cta_list}}
</div>
```

```js
function handleCtaListSplits(zone) {
  zone.querySelectorAll('.listicle__list__cta a').forEach((cta, index) => {
    const parts = (cta.dataset.element || '').split('|')
    cta.textContent = parts[0]
    cta.href = parts[1]
    cta.dataset.lincxCtaName = `cta position ${index + 1}`
    if (parts[2]) cta.style.color = parts[2].trim()
  })
}
```

---

## 4. Sticky offer bar (fixed bottom)

```html
<div class="lincx-sticky-offer-bar">
  {{#ads}}
  <div id="{{ adId }}" class="lincx-sticky-offer-wrapper">
    <button class="lincx-sticky-offer-bar-close" aria-label="Close offer bar">×</button>
    <div class="lincx-container">
      <!-- image / promo / cta columns -->
    </div>
  </div>
  {{/ads}}
</div>
```

```css
.lincx-sticky-offer-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  z-index: 999;
  background: #fff;
  box-shadow: 0 -1px 1px #f0f0f0;
  padding: 0.5rem 0;
}
@media (min-width: 768px) {
  .lincx-sticky-offer-bar-close { display: none; }  /* hide close on desktop */
}
```

---

## 5. Product card with rank + stats + CTAs

```html
<div class="product-card" id="{{ adId }}">
  <div class="card-header">
    <div class="rank-image">
      <div class="rank-number">1</div>
      <div class="product-image"><img src="{{ image }}" alt="{{ offer_headline }}" /></div>
    </div>
    <div class="stats-section">
      <div class="stats-score">{{ rating_score }}</div>
      <div class="stats-label">EXCELLENT</div>
      <div class="stats-rating"><!-- stars injected by JS --></div>
    </div>
  </div>
  <div class="content-wrapper">
    <div class="card-content">
      <a href="{{href}}" class="headline-link" data-lincx-cta
         data-lincx-cta-name="headline" data-lincx-cta-position="headline">
        <h3 class="offer-headline">{{{ offer_headline }}}</h3>
      </a>
    </div>
  </div>
  <div class="card-ctas">
    <a href="{{href}}" class="btn-visit-site" target="_blank"
       data-lincx-cta data-lincx-cta-name="visit-site" data-lincx-cta-position="visit-site">
      {{{ cta_text }}}
    </a>
  </div>
</div>
```

---

## 6. Featured + All Benefits (per-index display)

Used when the first ad should render differently from the rest.

```html
{{#ads}}
<div class="listicle-item-{{ _index }}">
  <div class="ads-listicle-item ads-listicle-item-{{ _index }}">
    <h1 data-content="{{ listicle_headline }}">{{{ listicle_headline }}}</h1>
  </div>
  <div class="ads-featured-benefits ads-featured-benefits-{{ _index }}">
    <!-- featured variant -->
  </div>
  <div class="ads-all-benefits ads-all-benefits-{{ _index }}">
    <!-- compact variant -->
  </div>
</div>
{{/ads}}
```

```css
.ads-listicle-item { display: none; }
.listicle-item-0 .ads-listicle-item { display: block; }

.ads-featured-benefits { display: none; }
.listicle-item-1 .ads-featured-benefits,
.listicle-item-2 .ads-featured-benefits,
.listicle-item-3 .ads-featured-benefits { display: block; }

.listicle-item-0 .ads-all-benefits,
.listicle-item-1 .ads-all-benefits,
.listicle-item-2 .ads-all-benefits,
.listicle-item-3 .ads-all-benefits { display: none; }
```

---

## 7. Ad badge with info popup (no-JS checkbox pattern)

```html
<span class="lincx-ad-badge">
  Ad
  <label class="lincx-info-icon-wrapper" for="ad-info-{{adId}}">
    <input type="checkbox" id="ad-info-{{adId}}" class="lincx-info-checkbox" />
    <svg class="lincx-info-icon"><!-- info icon --></svg>
    <div class="lincx-info-popup">
      <label class="lincx-info-popup-close" for="ad-info-{{adId}}" aria-label="Close">×</label>
      <div class="lincx-info-popup-content">
        <p>We earn a commission from partner links displayed on this page.</p>
      </div>
    </div>
  </label>
</span>
```

```css
.lincx-info-checkbox { position: absolute; opacity: 0; width: 0; height: 0; }
.lincx-info-popup { opacity: 0; visibility: hidden; transition: opacity 0.2s; }
.lincx-info-checkbox:checked ~ .lincx-info-popup {
  opacity: 1;
  visibility: visible;
}
```

---

## 8. Rating renderer (score + stars)

```html
<div class="lincx-rating-box">
  <div class="lincx-rating-number" data-rating-score="{{rating_score}}">{{rating_score}}</div>
  <div class="lincx-rating-text">
    <span class="lincx-rating-label" data-rating-score="{{rating_score}}">EXCELLENT</span>
    <div class="lincx-rating-stars" data-rating-stars="{{rating_stars}}"></div>
  </div>
</div>
```

```js
function renderRating(container) {
  const label = container.querySelector('.lincx-rating-label')
  const score = parseFloat(label.dataset.ratingScore) || 0
  label.textContent = score >= 9.0 ? 'EXCELLENT' : score >= 7.0 ? 'GOOD' : 'AVERAGE'

  const starsEl = container.querySelector('.lincx-rating-stars')
  const rating = Math.min(Math.max(parseFloat(starsEl.dataset.ratingStars) || 0, 0), 5)
  const full = Math.floor(rating)
  const half = rating % 1 >= 0.5 ? 1 : 0
  const empty = 5 - full - half

  let html = ''
  for (let i = 0; i < full; i++) html += '<span class="star full">★</span>'
  if (half) html += '<span class="star half">★</span>'
  for (let i = 0; i < empty; i++) html += '<span class="star empty">★</span>'
  starsEl.innerHTML = html
}
```

---

## 9. Default-value fallback for CTA buttons

Shows a hardcoded default when `cta_text` is empty.

```html
<a href="{{href}}" class="cta-btn" data-lincx-cta
   data-lincx-cta-name="cta" data-lincx-cta-position="cta"
   data-default-value="Get Started">
  <span class="cta-btn-text">{{{ cta_text }}}</span>
</a>
```

```css
.cta-btn::before {
  content: attr(data-default-value);
  position: absolute;
}
.cta-btn-text { position: relative; z-index: 1; }
.cta-btn-text:empty { display: none; }
.cta-btn:has(.cta-btn-text:not(:empty))::before { display: none; }
```

---

## 10. Group ordering for listicles

```js
function initGroupOffer(zone) {
  const groupKeys = ['high']
  const listicles = zone.querySelectorAll('.listicle')
  const container = zone.querySelector('.lincx-container')
  const tail = Array.from(listicles).slice(1)

  const grouped = tail.reduce((acc, l) => {
    const g = l.dataset.group || 'default'
    ;(acc[g] = acc[g] || []).push(l)
    return acc
  }, {})

  const order = groupKeys.concat(Object.keys(grouped).filter(k => !groupKeys.includes(k)))
  tail.forEach(l => l.remove())
  order.forEach(g => (grouped[g] || []).forEach(l => container.appendChild(l)))

  zone.querySelectorAll('.listicle').forEach((l, rank) => l.setAttribute('data-rank', rank))
}
```

---

## 11. Lazy-loaded image/video (IntersectionObserver)

```html
<div class="listicle__thumbnail lazy-load" data-content="{{ src }}">
  <a href="{{href}}" target="_blank" class="image_link"
     data-lincx-cta data-lincx-cta-name="image" data-lincx-cta-position="image">
    <img data-src="{{ src }}" alt="listicle image"
         onerror="this.onerror=null; this.remove();" />
  </a>
</div>
```

```js
function setupLazyLoad(zone) {
  zone.querySelectorAll('.lazy-load').forEach(el => {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return
        const video = entry.target.querySelector('video')
        if (video) {
          const ext = (video.dataset.src || '').split('.').pop().toLowerCase()
          if (ext === 'gif' || ext === 'webp') {
            const img = document.createElement('img')
            img.src = video.dataset.src
            img.alt = 'listicle image'
            video.replaceWith(img)
          } else if (!video.src) {
            video.src = video.dataset.src
            video.play().catch(() => {})
          }
        } else {
          entry.target.querySelectorAll('img').forEach(img => {
            if (!img.src) img.src = img.dataset.src || ''
          })
        }
        obs.unobserve(entry.target)
      })
    }, { threshold: 0.3 })
    observer.observe(el)
  })
}
```

---

## 12. Video autoplay resilience

```js
function initVideoPlayback(zone) {
  zone.querySelectorAll('.video-thumbnail').forEach(video => {
    const ensurePlaying = () => video.paused && video.play().catch(() => {})
    ensurePlaying()
    video.addEventListener('pause', ensurePlaying)
    video.addEventListener('ended', () => { video.currentTime = 0; ensurePlaying() })
  })
}
```

---

## 13. Date formatting

```js
function renderCurrentDate(zone, selector, daysBack = 0) {
  const date = new Date()
  if (daysBack) date.setDate(date.getDate() - daysBack)
  const formatted = date.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: '2-digit'
  })
  zone.querySelectorAll(selector).forEach(el => el.textContent = formatted)
}
```

---

## 14. Disclaimer footer

Keep outside `{{#ads}}`. Reuse verbatim and edit the brand/domain line at the bottom.

```html
<footer class="footer">
  <p>
    ADVERTISING DISCLOSURE: This website and the products and services referred
    to on it are advertising marketplaces. This website is an advertisement and
    not a news publication. Any photographs of persons used on this site are models.
    <br /><br />
    Trademarks utilized on our website belong to their respective owners...
    <br /><br />
    © <span class="footer-year"></span> <span class="footer-location"></span>
  </p>
  <script>
    ;(() => {
      const scope = document.currentScript.parentElement
      const footer = scope.matches('.footer') ? scope : scope.querySelector('.footer')
      if (!footer) return
      const yearEl = footer.querySelector('.footer-year')
      if (yearEl) yearEl.textContent = new Date().getFullYear()
      const locEl = footer.querySelector('.footer-location')
      if (locEl) locEl.textContent = window.location.hostname
    })()
  </script>
</footer>
```

The script finds its footer from its parent: the footer itself in place, else the `.footer` inside the zone's mount, where lincx-core appends it. Use classes, not ids: two zones on one page would repeat an id.

```css
.footer {
  text-align: center;
  color: #b3b3b3;
  font-size: 10px;
  margin-bottom: 30px;
}
```

---

## 15. Universal CSS block (put at top of every stylesheet)

```css
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');

*, *::after, *::before {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

[data-content=''] { display: none; }
[data-show]:not([data-show='']) { display: none; }
```

---

## 16. Canonical breakpoints

Use only these. Mobile-first, `min-width` only:

```css
@media (min-width: 576px) { /* small tablet */ }
@media (min-width: 768px) { /* tablet */ }
@media (min-width: 850px) { /* listicle-specific break */ }
@media (min-width: 992px) { /* desktop */ }
@media (min-width: 1024px) { /* large desktop */ }
@media (min-width: 1200px) { /* XL */ }
```
