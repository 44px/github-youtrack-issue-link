"use strict";

function saveSettings() {
  const youtrackUrl = formField('youtrackUrl').value.trim().replace(/\/$/, '');
  const repos = formField('repos').value.split('\n').map((str) => {
    return str.trim();
  }).filter(Boolean);

  chrome.storage.sync.set({youtrackUrl, repos}, () => {
    showStatus('status', 'success', 'New settings saved');
  });
}

function restoreSettings() {
  chrome.storage.sync.get({youtrackUrl: '', repos: []}, (data) => {
    formField('repos').value = data.repos.join('\n');
    formField('youtrackUrl').value = data.youtrackUrl;
  });
}


// Utility
function formField(name) {
  return document.getElementById(name);
}

function showStatus(id, type, text) {
  let status = document.getElementById(id);
  status.textContent = text;
  status.classList.add(`form__status--${type}`);
  setTimeout(() => {
    status.textContent = '';
    status.classList.remove(`form__status--${type}`);
  }, 1000);
}


document.addEventListener('DOMContentLoaded', restoreSettings);
document.getElementById('save').addEventListener('click', saveSettings);
