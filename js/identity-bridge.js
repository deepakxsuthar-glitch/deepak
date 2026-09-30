(function () {
  'use strict';

  var sessionKey = 'deepak-visitor-session';
  var apiBase = (window.DEEPAK_API_BASE || '').replace(/\/+$/, '');
  var apiUrl = function (url) { return apiBase + url; };
  var sessionId = localStorage.getItem(sessionKey) || (window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
  localStorage.setItem(sessionKey, sessionId);

  fetch(apiUrl('/api/track'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: sessionId, page: window.location.pathname })
  }).catch(function () {});

  fetch(apiUrl('/api/content')).then(function (response) {
    if (!response.ok) throw new Error('Unable to load published content');
    return response.json();
  }).then(function (sections) {
    var sectionAliases = { hero: 'home', projects: 'work', notes: 'blog' };
    sections.forEach(function (section) {
      var targetSection = sectionAliases[section.section] || section.section;
      var element = document.querySelector('[data-section="' + targetSection + '"]');
      if (!element) return;
      var isPublished = Boolean(section.enabled && section.published);
      element.hidden = !isPublished;
      document.querySelectorAll('#navbar a[data-nav-section="' + targetSection + '"]').forEach(function (link) {
        if (link.parentElement) link.parentElement.hidden = !isPublished;
      });
      if (!isPublished) return;

      var heading = section.section === 'hero' ? element.querySelector('h1') : element.querySelector('.colorlib-heading');
      if (heading && section.title) heading.textContent = section.title;
      if (!section.body) return;
      if (section.section === 'hero') {
        var subtitle = element.querySelector('h2');
        if (subtitle) subtitle.textContent = section.body;
      } else if (section.section === 'about') {
        var paragraph = element.querySelector('.about-desc p');
        if (paragraph) paragraph.textContent = section.body;
      } else {
        var body = element.querySelector('.identity-content-body');
        if (!body) {
          body = document.createElement('p');
          body.className = 'identity-content-body';
          if (heading && heading.closest('.row')) heading.closest('.row').insertAdjacentElement('afterend', body);
          else element.insertAdjacentElement('afterbegin', body);
        }
        body.textContent = section.body;
      }
    });
  }).catch(function () {});

  var form = document.getElementById('contact-form');
  if (!form) return;
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var button = form.querySelector('[type="submit"]');
    var original = button.value;
    button.disabled = true;
    button.value = 'Sending...';
    var data = Object.fromEntries(new FormData(form).entries());
    fetch(apiUrl('/api/contact'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (response) { if (!response.ok) throw new Error('Unable to send'); return response.json(); })
      .then(function () { form.reset(); button.value = 'Message sent'; })
      .catch(function () { button.value = 'Try again'; })
      .finally(function () { setTimeout(function () { button.disabled = false; button.value = original; }, 2500); });
  });
}());
