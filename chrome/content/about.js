/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

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
      loadInstallManifest(addon.getResourceURI("install.rdf"), addon.name, addon.homepageURL);
    });
  }
  else
  {
    let extensionManager = Cc["@mozilla.org/extensions/manager;1"].getService(Ci.nsIExtensionManager);
    let rdf = Cc["@mozilla.org/rdf/rdf-service;1"].getService(Ci.nsIRDFService);
    let root = rdf.GetResource("urn:mozilla:item:" + addonID);

    function emResource(prop)
    {
      return rdf.GetResource("http://www.mozilla.org/2004/em-rdf#" + prop);
    }
  
    function getTarget(prop)
    {
      let target = extensionManager.datasource.GetTarget(root, emResource(prop), true);
      if (target)
        return target.QueryInterface(Ci.nsIRDFLiteral).Value;
      else
        return null;
    }
    
    let installLocation = extensionManager.getInstallLocation(addonID);
    let installManifestFile = installLocation.getItemFile(addonID, "install.rdf");
    loadInstallManifest(ioService.newFileURI(installManifestFile), getTarget("name"), getTarget("homepageURL"));
  }
}

function loadInstallManifest(installManifestURI, name, homepage)
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
    setExtensionData(name, getTargets("version")[0],
                     homepage, getTargets("creator"),
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

function loadInBrowser(url)
{
  let windowMediator = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
  let enumerator = windowMediator.getZOrderDOMWindowEnumerator(null, true);
  if (!enumerator.hasMoreElements())
  {
    // On Linux the list returned will be empty, see bug 156333. Fall back to random order.
    enumerator = windowMediator.getEnumerator(null);
  }
  let abpHooks = null;
  while (enumerator.hasMoreElements())
  {
    let window = enumerator.getNext().QueryInterface(Ci.nsIDOMWindow);
    abpHooks = window.document.getElementById("abp-hooks");
    if (abpHooks && abpHooks.addTab)
    {
      window.focus();
      break;
    }
  }

  if (abpHooks && abpHooks.addTab)
    abpHooks.addTab(url);
  else
  {
    let protocolService = Cc["@mozilla.org/uriloader/external-protocol-service;1"].getService(Ci.nsIExternalProtocolService);
    let ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
    protocolService.loadURI(ioService.newURI(url, null, null), null);
  }
}
