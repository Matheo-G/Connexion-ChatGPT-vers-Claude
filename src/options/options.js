/**
 * @file Options page controller.
 * Step 0: brand and version only. The settings form arrives in step 5.
 */

import { localizeDocument, t } from '../utils/i18n.js';
import { hydrateIcons } from '../ui-kit/dom-icons.js';

function renderVersion() {
  const { version } = chrome.runtime.getManifest();
  document.getElementById('version').textContent =
    t('versionLabel', version) || `v${version}`;
}

localizeDocument();
hydrateIcons();
renderVersion();
