/**
 * @file Popup controller.
 * Step 0: renders the brand, version and a static status.
 * Connection status, workflow picker and history arrive in steps 1 and 5.
 */

import { localizeDocument, t } from '../utils/i18n.js';
import { hydrateIcons } from '../ui-kit/dom-icons.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('popup');

function renderVersion() {
  const { version } = chrome.runtime.getManifest();
  document.getElementById('version').textContent =
    t('versionLabel', version) || `v${version}`;
}

function bindActions() {
  document
    .getElementById('open-options')
    .addEventListener('click', () => chrome.runtime.openOptionsPage());
}

function init() {
  localizeDocument();
  hydrateIcons();
  renderVersion();
  bindActions();
  log.debug('Popup ready');
}

init();
