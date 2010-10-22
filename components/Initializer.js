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
 * The Original Code is Adblock Plus Element Hiding Helper.
 *
 * The Initial Developer of the Original Code is
 * Wladimir Palant.
 * Portions created by the Initial Developer are Copyright (C) 2006-2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

/**
 * Helper component to load ABPIntegration.jsm module.
 * @constructor
 */
function Initializer() {}
Initializer.prototype =
{
  classDescription: "EHH helper component",
  contractID: "@adblockplus.org/ehh/startup;1",
  classID: Components.ID("{2d53b96c-1dd2-11b2-94ad-dedbdb99852f}"),
  _xpcom_categories: [{ category: "app-startup", service: true }],

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsISupportsWeakReference]),

  observe: function(subject, topic, data)
  {
    let observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
    switch (topic)
    {
      case "app-startup":
      case "profile-after-change":
        observerService.addObserver(this, "final-ui-startup", true);
        break;
      case "final-ui-startup":
        observerService.removeObserver(this, "final-ui-startup");

        // Load the module
        let chromeRegistry = Cc["@mozilla.org/chrome/chrome-registry;1"].getService(Ci.nsIChromeRegistry);
        let ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
        let moduleURL = chromeRegistry.convertChromeURL(ioService.newURI("chrome://elemhidehelper-modules/content/ABPIntegration.jsm", null, null));
        Cu.import(moduleURL.spec);
        break;
    }
  }
};

if (XPCOMUtils.generateNSGetFactory)
  var NSGetFactory = XPCOMUtils.generateNSGetFactory([Initializer]);
else
  var NSGetModule = XPCOMUtils.generateNSGetModule([Initializer]);
