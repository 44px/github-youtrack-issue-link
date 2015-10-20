"use strict";

function createOrUpdateIssueLinks(storageData) {
  const youtrackUrl = storageData.youtrackUrl;
  const notificationPanel = getNotificationPanel();
  const unknownStatus = {
    id: null,
    value: 'Unknown',
    color: {bg: '#444', fg: '#FFF'}
  };

  if (youtrackUrl === '') {
    notificationPanel.show('Please set YouTrack url in options');
    return;
  }

  const pullRequests = QSA('.issue-title-link').map((link) => {
    const issueId = getIssueId(link.text);
    const issueLink = (issueId !== null) ? `${youtrackUrl}/issue/${issueId}` : '';

    return {
      link,
      issueId,
      issueLink,
      issueStatus: unknownStatus
    }
  });

  getIssueStatuses(youtrackUrl, pullRequests).then((issues) => {
    issues.forEach((issue) => {
      const pr = pullRequests.find((pr) => pr.issueId === issue.id);
      pr.issueStatus = issue.status;
      createOrUpdateLabel(pr);
    });
  }).catch((error) => {
    if (error.response && (error.response.status === 401)) {
      notificationPanel.show('Please login to YouTrack');
    }
  });
}

chrome.runtime.onMessage.addListener(createOrUpdateIssueLinks);


// Utility
function QSA(selector) {
  return [].slice.call(document.querySelectorAll(selector));
}

function getNotificationPanel() {
  let panel = document.querySelector('.ytlink-notice');
  if (panel === null) {
    panel = document.createElement('div');
    panel.classList.add('ytlink-notice');
    document.body.appendChild(panel);
  }

  return {
    show: function(message) {
      panel.textContent = `Github YouTrack issue link: ${message}`;
      panel.classList.add('ytlink-notice_show');

      clearTimeout(window.ytLinkNoticeTimeout);
      window.ytLinkNoticeTimeout = setTimeout(() => {
        panel.classList.remove('ytlink-notice_show');
        panel.textContent = '';
      }, 5000);
    }
  };
}

function createOrUpdateLabel(pr) {
  const LABEL_CLASS = 'ytlink-label';
  let label = pr.link.parentNode.querySelector(`.${LABEL_CLASS}`);
  if (label === null) {
    label = document.createElement('a');
    label.classList.add('label', LABEL_CLASS);
    label.target = '_blank';
    pr.link.parentNode.insertBefore(label, pr.link);
  }

  label.style.backgroundColor = pr.issueStatus.color.bg;
  label.style.color = pr.issueStatus.color.fg;
  label.href = pr.issueLink;
  label.textContent = pr.issueStatus.value;
}

function getIssueId(prTitle) {
  const match = prTitle.trim().match(/([a-z]+-\d+)/i);
  return match ? match[0] : null;
}

function getIssueStatuses(youtrackUrl, pullRequests) {
  const issueIds = pullRequests.map((pr) => pr.issueId).filter(Boolean);
  if (issueIds.length === 0) {
    return Promise.reject(new Error('No issues found'));
  }

  const filter = issueIds.map((issueId) => `issue+ID:+${issueId}`).join('+or+');
  const url = `${youtrackUrl}/rest/issue?filter=${filter}&max=${issueIds.length}&with=State`
  return fetch(url, {
    credentials: 'include',
    headers: {
      accept: 'application/json'
    }
  })
  .then(checkStatus)
  .then(prepareData);
}

function checkStatus(response) {
  if ((response.status >= 200) && (response.status < 300)) {
    return response;
  } else {
    var error = new Error(response.statusText);
    error.response = response;
    throw error;
  }
}

function prepareData(response) {
  return response.json().then((data) => {
    return data.issue.map((issue) => {
      const stateField = issue.field.find((field) => field.name === 'State');
      return {
        id: issue.id,
        status: {
          id: stateField.valueId[0],
          value: stateField.value[0],
          color: {
            bg: stateField.color.bg,
            fg: stateField.color.fg,
          }
        }
      };
    });
  });
}
