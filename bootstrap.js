/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");

function install(params, reason) {}
function uninstall(params, reason) {}

function startup(params, reason)
{
  if (Services.vc.compare(Services.appinfo.platformVersion, "10.0") < 0)
    Components.manager.addBootstrappedManifestLocation(params.installPath);

  let scope = {};
  Services.scriptloader.loadSubScript("chrome://elemhidehelper/content/prefLoader.js", scope);
  scope.loadDefaultPrefs(params.installPath);

  Cu.import("chrome://elemhidehelper-modules/content/AppIntegration.jsm");
  AppIntegration.startup();
}

function shutdown(params, reason)
{
  if (Services.vc.compare(Services.appinfo.platformVersion, "10.0") < 0)
    Components.manager.removeBootstrappedManifestLocation(params.installPath);

  AppIntegration.shutdown();
  Cu.unload("chrome://elemhidehelper-modules/content/AppIntegration.jsm");

  let aboutWnd = Services.wm.getMostRecentWindow("ehh:about");
  if (aboutWnd)
    aboutWnd.close();

  while (true)
  {
    let helperWnd = Services.wm.getMostRecentWindow("ehh:composer");
    if (!helperWnd)
      break;
    helperWnd.close();
  }
}
