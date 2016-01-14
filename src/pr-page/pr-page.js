"use strict";

(function init() {
  const renderIssueLinks = getIssueLinksRenderer(getNotifier());
  
  chrome.runtime.onMessage.addListener((storageData) => {
    renderIssueLinks(storageData);
    // For single PR pages: when PR merged or comment updated, header DOM node is replaced.
    // So we need to watch for it and re-render labels.
    const observe = getDOMObserver(() => renderIssueLinks(storageData));
    observe(document.querySelector('.js-pull-request-tab-container'));
  });
})();


function getNotifier() {
  const SHOW_CLASS = 'ytlink-notice--show';
  const panel = document.createElement('div');
  panel.classList.add('ytlink-notice');
  document.body.appendChild(panel);
  let timer = null;
  
  return (message) => {
    panel.textContent = `Github YouTrack issue link: ${message}`;
    panel.classList.add(SHOW_CLASS);

    clearTimeout(timer);
    timer = setTimeout(() => {
      panel.classList.remove(SHOW_CLASS);
      panel.textContent = '';
    }, 5000);
  };
}

function getDOMObserver(callback) {
  const observer = new MutationObserver(callback);
  
  return (target) => {
    observer.disconnect();
    if (target) {
      observer.observe(target, {childList: true});
    }
  }
}

function getIssueLinksRenderer(notify) {
  return (storageData) => {
    const loadIssues = getIssueLoader(storageData.youtrackUrl);
    loadIssues(getPullRequestsGroupedByIssues())
      .then((issues) => {
        issues.forEach((issue) => issue.pullRequests.forEach((pr) => updateLabel(issue, getLabel(pr))));
      }) 
      .catch((error) => {
        const ERROR_MESSAGES = {
          'NO_YT_URL': 'Please set YouTrack url in options',
          'HTTP_401': 'Please login to YouTrack'
        }
        
        if (ERROR_MESSAGES[error.message]) {
          notify(ERROR_MESSAGES[error.message]);
        }
      });
  }
}

function getPullRequestsGroupedByIssues() {
  const QSA = (selector) => [].slice.call(document.querySelectorAll(selector));
  const prTitles = QSA('.issue-title-link').concat(QSA('.js-issue-title'));
  return prTitles.reduce((pullRequests, title) => {
    const issueId = getIssueId(title.textContent);
    if (issueId !== null) {
      const currentValue = pullRequests.get(issueId) || {pullRequests: []};
      pullRequests.set(issueId, {
        pullRequests: [...currentValue.pullRequests, title]
      });
    }
    return pullRequests;
  }, new Map());
}

function getIssueId(prTitle) {
  const match = prTitle.trim().match(/([a-z]+-\d+)/i);
  return match ? match[0] : null;
}

function getIssueLoader(youtrackUrl) {
  return (pullRequests) => {
    if (youtrackUrl === '') {
      return Promise.reject(new Error('NO_YT_URL'));
    } else if (pullRequests.size === 0) {
      return Promise.reject(new Error('NO_ISSUES'));
    }
    
    const issueIds = [...pullRequests.keys()];
    const filter = issueIds.map((issueId) => `issue+ID:+${issueId}`).join('+or+');
    const url = `${youtrackUrl}/rest/issue?filter=${filter}&max=${issueIds.length}&with=State`;
    
    return fetch(url, {
      credentials: 'include',
      headers: {
        accept: 'application/json'
      }
    })
    .then(checkStatus)
    .then((response) => response.json())
    .then((data) => mergeIssuesWithPR(youtrackUrl, pullRequests, data));
  }
}

function checkStatus(response) {
  if ((response.status >= 200) && (response.status < 300)) {
    return response;
  }
  throw new Error(`HTTP_${response.status}`);
}

function mergeIssuesWithPR(youtrackUrl, pullRequests, data) {
  data.issue.forEach((issue) => {
    const state = issue.field.find((field) => field.name === 'State'); 
    pullRequests.set(issue.id, Object.assign({}, pullRequests.get(issue.id), {
      status: {
        id: state.valueId[0],
        value: state.value[0],
        color: state.color
      }
    }));
  });
  return pullRequests;
}

function getLabel(prTitle) {
  const LABEL_CLASS = 'ytlink-label';
  let label = prTitle.parentNode.querySelector(`.${LABEL_CLASS}`);
  if (label === null) {
    label = document.createElement('a');
    label.classList.add(LABEL_CLASS);
    prTitle.parentNode.insertBefore(label, prTitle);
  }
  return label;
}

function updateLabel(issue, label) {
  label.style.backgroundColor = issue.status.color.bg;
  label.style.color = issue.status.color.fg;
  label.textContent = issue.status.value;
  label.href = issue.link;
}
