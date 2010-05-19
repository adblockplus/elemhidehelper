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

var EXPORTED_SYMBOLS = ["EHH"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

/**
 * Add-on ID of the Adblock Plus add-on.
 * @type String
 */
const abpID = "{d10d0bf8-f5b5-c8b4-a8b2-2b9879e08c5d}";

/**
 * ID of Adblock Plus on addons.mozilla.org.
 * @type Integer
 */
const abpAmoID = 1865;

/**
 * Minimal required Adblock Plus version.
 * @type String
 */
const minABPVersion = "1.3a";

/**
 * Add-on ID of this add-on.
 * @type String
 */
const myID = "elemhidehelper@adblockplus.org";

/**
 * Location of this file to be reported to Adblock Plus (lazily initialized).
 * @type nsIURI
 */
let moduleURI = null;

/**
 * Timer used to delay checking for compatible Adblock Plus version.
 * @type nsITimer
 */
let timer = null;

/**
 * Exported symbol of the module, will be triggered by Adblock Plus.
 * @class
 */
var EHH =
{
  initialized: false,

  startup: function()
  {
    EHH.initialized = true;
  },

  shutdown: function(/**Boolean*/ cleanup)
  {
    if (cleanup)
    {
      EHH.initialized = false;

      // Close all our windows
      let enumerator = Cc["@mozilla.org/appshell/window-mediator;1"]
                         .getService(Ci.nsIWindowMediator)
                         .getEnumerator("ehh:composer");
      while (enumerator.hasMoreElements())
      {
        let wnd = enumerator.getNext();
        if (wnd instanceof Ci.nsIDOMWindowInternal && !wnd.closed)
          wnd.close();
      }
    }
  }
};

let extensionManager = null;

/**
 * Executed when the module loads, registers its location in the ABP category
 * and starts waiting for Adblock Plus to initialize it.
 */
function init()
{
  let ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
  let uri = ioService.newFileURI(__LOCATION__);

  let categoryManager = Cc["@mozilla.org/categorymanager;1"].getService(Ci.nsICategoryManager);
  categoryManager.addCategoryEntry("adblock-plus-module-location", uri.spec, uri.spec, false, true);

  // Wait a minute before checking, just in case...
  timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
  timer.initWithCallback(startABPCheck, 60000, Ci.nsITimer.TYPE_ONE_SHOT);
}

/**
 * Starts checking whether a compatible Adblock Plus version is installed.
 */
function startABPCheck()
{
  timer = null;
  if (!EHH.initialized)
  {
    // Adblock Plus didn't initialize us - what's wrong?
    checkDependencies();
  }
}

/**
 * Called if no compatible Adblock Plus version is found, tries to find the cause.
 */
function checkDependencies()
{
  // Get extension manager - either new or old API
  try
  {
    Cu.import("resource://gre/modules/AddonManager.jsm");
  }
  catch (e)
  {
    extensionManager = Cc["@mozilla.org/extensions/manager;1"].getService(Ci.nsIExtensionManager);
  }

  getAddonInfo(abpID, checkABPInfo);
}

/**
 * Checks the information on the installed Adblock Plus add-on.
 */
function checkABPInfo(info)
{
  if (info == null)
  {
    // Adblock Plus isn't installed - suggest installing it
    showMessage("abpInstallationRequired");
    return;
  }

  if (info.hasPendingOperations)
  {
    // Some operation is pending already, don't bother the user
    return;
  }

  let versionComparator = Cc["@mozilla.org/xpcom/version-comparator;1"]
                            .getService(Ci.nsIVersionComparator);
  if (versionComparator.compare(info.version, minABPVersion) < 0)
  {
    // Adblock Plus is too old - suggest updating it
    checkForUpdates(info, "abpUpdateRequired");
    return;
  }

  if (info.userDisabled)
  {
    // Adblock Plus is disabled - suggest enabling
    if (info.canEnable)
      showMessage("abpEnableRequired", info);
    return;
  }

  if (info.appDisabled)
  {
    // Adblock Plus disabled by application - outdated version? Check for updates.
    checkForUpdates(info, "abpUpdateRequired");
    return;
  }

  // Everything looks fine - maybe it is us who needs an update?
  getAddonInfo(myID, function(info)
  {
    if (info)
      checkForUpdates(info, "selfUpdateRequired");
  });
}

/**
 * Retrieves the information on an installed add-on by its ID.
 */
function getAddonInfo(addonID, callback)
{
  if (typeof AddonManager != "undefined")
  {
    AddonManager.getAddonByID(addonID, function(addon)
    {
      if (!addon)
      {
        callback(null);
        return;
      }

      callback({
        version: addon.version,
        hasPendingOperations: addon.pendingOperations ? true : false,
        appDisabled: addon.appDisabled,
        userDisabled: addon.userDisabled,
        canUpdate: (addon.permissions & AddonManager.PERM_CAN_UPGRADE) ? true : false,
        canEnable: (addon.permissions & AddonManager.PERM_CAN_ENABLE) ? true : false,
        _source: addon
      });
    });
  }
  else
  {
    let addon = extensionManager.getItemForID(addonID);
    if (!addon)
    {
      callback(null);
      return;
    }

    let rdf = Cc["@mozilla.org/rdf/rdf-service;1"].getService(Ci.nsIRDFService);
    let addonResource = rdf.GetResource("urn:mozilla:item:" + addonID);

    function getAddonProperty(property)
    {
      let link = rdf.GetResource("http://www.mozilla.org/2004/em-rdf#" + property);
      let target = extensionManager.datasource.GetTarget(addonResource, link, true);
      return (target instanceof Ci.nsIRDFLiteral ? target.Value : null);
    }

    callback({
      version: addon.version,
      hasPendingOperations: !!getAddonProperty("opType"),
      appDisabled: !!getAddonProperty("appDisabled"),
      userDisabled: !!getAddonProperty("userDisabled"),
      canUpdate: extensionManager.getInstallLocation(addonID).canAccess,
      canEnable: true,
      _source: addon
    });
  }
}

/**
 * Looks for available updates of an add-on.
 */
function checkForUpdates(info, message)
{
  if (!info.canUpdate)
    return;  // Sorry all you restricted users out there...

  if (typeof AddonManager != "undefined")
  {
    info._source.findUpdates({
      onUpdateAvailable: function(addon, install)
      {
        if (install.version != info.version)
        {
          info._install = install;
          showMessage(message, info);
        }
      },
      onNoUpdateAvailable: function(addon) {},
      onCompatibilityUpdateAvailable: function(addon) {},
      onNoCompatibilityUpdateAvailable: function(addon) {},
      onUpdateFinished: function(addon) {}
    }, AddonManager.UPDATE_WHEN_USER_REQUESTED);
  }
  else
  {
    extensionManager.update([info._source], 1, 0, {
      QueryInterface: XPCOMUtils.generateQI([Ci.nsIAddonUpdateCheckListener]),
      onAddonUpdateStarted: function(addon) {},
      onAddonUpdateEnded: function(addon, status)
      {
        if (addon.version != info.version)
        {
          info._install = addon;
          showMessage(message, info);
        }
      },
      onUpdateStarted: function() {},
      onUpdateEnded: function() {},
    });
  }
}

let knownWindowTypes = {
  "navigator:browser": true,
  "mail:3pane": true,
  "mail:messageWindow": true,
  "Songbird:Main": true,
  "emusic:window": true
};

/**
 * Finds a compatible application window to display messages in.
 */
function getAppWindow() /**nsIDOMWindow*/
{
  let mediator = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
  let enumerator = mediator.getZOrderDOMWindowEnumerator(null, true);
  while (enumerator.hasMoreElements())
  {
    let wnd = enumerator.getNext().QueryInterface(Ci.nsIDOMWindow);
    let wndType = wnd.document.documentElement.getAttribute("windowtype");
    if (wndType in knownWindowTypes)
      return wnd;
  }

  return null;
}

/**
 * Displays a message to the user.
 */
function showMessage(action, info)
{
  let wnd = getAppWindow();
  if (!wnd)
    return null;  // Nothing to show the message in

  let stringBundle = Cc["@mozilla.org/intl/stringbundle;1"]
              .getService(Ci.nsIStringBundleService)
              .createBundle("chrome://elemhidehelper/locale/global.properties");

  let doc = wnd.document;
  let popupset = doc.createElement("popupset");
  let panel = doc.createElement("panel");
  let description = doc.createElement("description");
  let buttonBox = doc.createElement("hbox");
  let acceptButton = doc.createElement("button");
  let denyButton = doc.createElement("button");

  description.textContent = stringBundle.GetStringFromName(action);
  acceptButton.setAttribute("label", stringBundle.GetStringFromName("actionAccept"));
  denyButton.setAttribute("label", stringBundle.GetStringFromName("actionDeny"));
  buttonBox.setAttribute("pack", "center");
  panel.style.maxWidth = "300px";
  panel.style.marginLeft = "50px";
  panel.style.marginTop = "50px";
  panel.style.padding = "10px";

  acceptButton.addEventListener("command", function()
  {
    panel.hidePopup();
    executeAction(action, info);
  }, false);
  denyButton.addEventListener("command", function()
  {
    panel.hidePopup();
  }, false);

  buttonBox.appendChild(acceptButton);
  buttonBox.appendChild(denyButton);
  panel.appendChild(description);
  panel.appendChild(buttonBox);
  popupset.appendChild(panel);
  doc.documentElement.appendChild(popupset);

  panel.openPopup(doc.documentElement, "overlap", -1, -1, false);
}

/**
 * Creates an install object for an add-on that isn't installed yet by its AMO ID.
 */
function getInstallForAddon(addonID, callback)
{
  // Get download URL and hash from API, download won't work without a hash
  let xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIJSXMLHttpRequest);
  xhr.open("GET", "https://services.addons.mozilla.org/api/1.1/addon/" + addonID);
  xhr.onload = function()
  {
    xhr.onload = null;

    let doc = xhr.responseXML;
    if (doc && doc.documentElement && doc.documentElement.localName == "addon")
    {
      let name = null;
      let version = null;
      let iconURL = null;
      let downloadURL = null;
      let downloadHash = null;
      for (let i = 0, len = doc.documentElement.childNodes.length; i < len; i++)
      {
        let node = doc.documentElement.childNodes[i];
        switch (node.localName)
        {
          case "name":
            name = node.textContent;
            break;
          case "version":
            version = node.textContent;
            break;
          case "icon":
            iconURL = node.textContent;
            break;
          case "install":
            downloadURL = node.textContent;
            downloadHash = node.getAttribute("hash");
            break;
        }
      }

      if (downloadURL)
      {
        if (typeof AddonManager != "undefined")
        {
          AddonManager.getInstallForURL(downloadURL, callback, "application/x-xpinstall",
                                        downloadHash, name, iconURL, version, null);
        }
        else
        {
          // HACK: Use plain HTTP as download URL - extension manager's certificate
          // check will want the final URL to be HTTPS as well otherwise. With the
          // hash we are on the safe side anyway.
          downloadURL = downloadURL.replace(/^https:/, "http:");

          let install = Cc["@mozilla.org/updates/item;1"].createInstance(Ci.nsIUpdateItem);
          install.init(abpID, version, "app-profile", null, null, name, downloadURL,
                       downloadHash, iconURL, null, null, Ci.nsIUpdateItem.TYPE_EXTENSION, null);
          callback(install);
        }
      }
    }
  };
  xhr.send();
}

/**
 * Executes an action if the user accepted the message.
 */
function executeAction(action, info)
{
  function doInstall(install)
  {
    if (typeof install.install == "function")
      install.install();
    else
      extensionManager.addDownloads([install], 1, null);
  }

  switch (action)
  {
    case "abpInstallationRequired":
      getInstallForAddon(abpAmoID, doInstall);
      break;
    case "abpEnableRequired":
      if ("userDisabled" in info._source)
        info._source.userDisabled = false;
      else
        extensionManager.enableItem(abpID);
      return;
    case "abpUpdateRequired":
    case "selfUpdateRequired":
      doInstall(info._install);
      break;
    default:
      return;
  }
}

init();
