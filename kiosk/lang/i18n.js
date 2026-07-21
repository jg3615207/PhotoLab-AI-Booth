// PhotoLab i18n — lightweight internationalization framework
// Supports English (en) and Traditional Chinese (zh-Hant)

(function() {
  'use strict';

  const STORAGE_KEY = 'photolab-lang';
  const DEFAULT_LANG = 'en';

  // Get current language: localStorage → browser → default
  function getLang() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (stored === 'en' || stored === 'zh-Hant')) return stored;
    const browser = navigator.language || '';
    if (browser.startsWith('zh')) return 'zh-Hant';
    return DEFAULT_LANG;
  }

  let currentLang = getLang();
  const translations = {}; // { en: {...}, 'zh-Hant': {...} }

  // Register a language's translation map
  window.__registerLang = function(langCode, map) {
    translations[langCode] = map;
  };

  // Translate a key with optional arguments
  // Usage: t('key.path', arg1, arg2, ...)
  // String template: "Hello {0}, you have {1} items"
  window.__ = function(key) {
    const map = translations[currentLang] || {};
    const fallback = translations[DEFAULT_LANG] || {};
    let text = map[key] || fallback[key] || key;
    // Replace {0}, {1}, etc. with arguments
    for (let i = 1; i < arguments.length; i++) {
      text = text.replace('{' + (i - 1) + '}', arguments[i]);
    }
    return text;
  };

  // Change language
  window.__setLang = function(lang) {
    if (lang !== 'en' && lang !== 'zh-Hant') return;
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    applyTranslations();
    // Fire custom event for dynamic re-rendering
    window.dispatchEvent(new CustomEvent('langchange', { detail: { lang: lang } }));
  };

  // Toggle between en and zh-Hant
  window.__toggleLang = function() {
    window.__setLang(currentLang === 'en' ? 'zh-Hant' : 'en');
  };

  window.__getLang = function() {
    return currentLang;
  };

  // Apply translations to all [data-i18n] elements
  function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      const text = window.__(key);
      if (text) el.textContent = text;
    });
    // Apply placeholder translations to [data-i18n-placeholder] elements
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (!key) return;
      const text = window.__(key);
      if (text) el.placeholder = text;
    });
    // Update <html lang="">
    document.documentElement.lang = currentLang;
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyTranslations);
  } else {
    applyTranslations();
  }

  // Also run after langchange event for dynamic content
  window.addEventListener('langchange', applyTranslations);

  console.log('[i18n] Active language:', currentLang);
})();
