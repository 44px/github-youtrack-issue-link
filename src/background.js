"use strict";

function setupEventHandlers() {
  const events = [
    chrome.webNavigation.onCompleted,
    chrome.webNavigation.onHistoryStateUpdated
  ];
  const defaultEventFilters = {
    url: [{
      hostEquals: 'github.com',
      pathSuffix: `/pulls`
    }]
  };

  chrome.storage.sync.get({repos: []}, (data) => {
    const eventFilters = (data.repos.length > 0) ? {
      url: data.repos.map((repo) => ({
        hostEquals: 'github.com',
        pathSuffix: `${repo}/pulls`
      }))
    } : defaultEventFilters;

    events.forEach((event) => {
      event.removeListener(executePRStatusesScript);
      event.addListener(executePRStatusesScript, eventFilters);
    });
  });
}

function executePRStatusesScript(details) {
  chrome.storage.sync.get({youtrackUrl: ''}, (data) => {
    chrome.tabs.sendMessage(details.tabId, {youtrackUrl: data.youtrackUrl});
  });
}


// Init
setupEventHandlers();
chrome.storage.onChanged.addListener((changes, namespace) => {
  if ((namespace === 'sync') && !!changes.repos) {
    setupEventHandlers();
  }
});
