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

try
{
  Cu.import("resource://gre/modules/AddonManager.jsm");
}
catch (e) {}

let addonID = "elemhidehelper@adblockplus.org";

function E(id) document.getElementById(id);

function init()
{
  let ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
  if (typeof AddonManager != "undefined")
  {
    let addon = AddonManager.getAddonByID(addonID, function(addon)
    {
      loadInstallManifest(ioService.newURI(addon.getResourceURL("install.rdf"), null, null));
    });
  }
  else
  {
    let extensionManager = Cc["@mozilla.org/extensions/manager;1"].getService(Ci.nsIExtensionManager);
    let installLocation = extensionManager.getInstallLocation(addonID);
    let installManifestFile = installLocation.getItemFile(addonID, "install.rdf");
    loadInstallManifest(ioService.newFileURI(installManifestFile));
  }
}

function loadInstallManifest(installManifestURI)
{
  let rdf = Cc["@mozilla.org/rdf/rdf-service;1"].getService(Ci.nsIRDFService);
  let ds = rdf.GetDataSource(installManifestURI.spec);
  let root = rdf.GetResource("urn:mozilla:install-manifest");

  function emResource(prop)
  {
    return rdf.GetResource("http://www.mozilla.org/2004/em-rdf#" + prop);
  }

  function getTargets(prop)
  {
    let targets = ds.GetTargets(root, emResource(prop), true);
    let result = [];
    while (targets.hasMoreElements())
      result.push(targets.getNext().QueryInterface(Ci.nsIRDFLiteral).Value);
    return result;
  }

  function dataSourceLoaded()
  {
    setExtensionData(getTargets("name")[0], getTargets("version")[0],
                     getTargets("homepageURL")[0], getTargets("creator"),
                     getTargets("contributor"), getTargets("translator"));
  }

  if (ds instanceof Ci.nsIRDFRemoteDataSource && ds.loaded)
    dataSourceLoaded();
  else
  {
    let sink = ds.QueryInterface(Ci.nsIRDFXMLSink);
    sink.addXMLSinkObserver({
      onBeginLoad: function() {},
      onInterrupt: function() {},
      onResume: function() {},
      onEndLoad: function() {
        sink.removeXMLSinkObserver(this);
        dataSourceLoaded();
      },
      onError: function() {},
    });
  }
}

function cmpNoCase(a, b)
{
  let aLC = a.toLowerCase();
  let bLC = b.toLowerCase();
  if (aLC < bLC)
    return -1;
  else if (aLC > bLC)
    return 1;
  else
    return 0;
}

function setExtensionData(name, version, homepage, authors, contributors, translators)
{
  authors.sort(cmpNoCase);
  contributors.sort(cmpNoCase);
  translators.sort(cmpNoCase);

  E("title").value = name;
  E("version").value = version;
  E("homepage").value = homepage;
  E("authors").textContent = authors.join(", ");
  E("contributors").textContent = contributors.join(", ");
  E("translators").textContent = translators.join(", ");

  E("mainBox").setAttribute("loaded", "true");
}
