/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Element Hiding Helper for Adblock Plus.
 *
 * The Initial Developer of the Original Code is
 * Wladimir Palant.
 * Portions created by the Initial Developer are Copyright (C) 2006-2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

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
