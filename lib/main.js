/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

let {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

let {Prefs} = require("prefs");
let {WindowObserver} = require("windowObserver");
let {WindowWrapper} = require("windowWrapper");

// Check whether some preferences can still be found under their old locations
Prefs.migrate("extensions.adblockplus.ehh-selectelement_key", "selectelement_key");
Prefs.migrate("extensions.adblockplus.ehh.showhelp", "showhelp");

// Window types to attach to
let knownWindowTypes = new Set(["navigator:browser", "mail:3pane", "mail:messageWindow"]);

// Use random marker class
let elementMarkerClass = null;
{
  let rnd = [];
  let offset = "a".charCodeAt(0);
  for (let i = 0; i < 20; i++)
    rnd.push(offset + Math.random() * 26);

  elementMarkerClass = String.fromCharCode.apply(String, rnd);
}
exports.elementMarkerClass = elementMarkerClass;

// Load CSS asynchronously
let request = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);
request.open("GET", "chrome://elemhidehelper/content/elementmarker.css");
request.overrideMimeType("text/plain");
request.addEventListener("load", function(event)
{
  if (onShutdown.done)
    return;

  let data = event.target.responseText.replace(/%%CLASS%%/g, elementMarkerClass);
  let styleService = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
  let styleURI = Services.io.newURI("data:text/css," + encodeURIComponent(data), null, null);
  styleService.loadAndRegisterSheet(styleURI, Ci.nsIStyleSheetService.USER_SHEET);
  onShutdown.add(() => styleService.unregisterSheet(styleURI, Ci.nsIStyleSheetService.USER_SHEET));
}, false);
request.send(null);

// Load our developer tools actor
let processScript = "chrome://elemhidehelper/content/processScript.js?" + elementMarkerClass;
let messageManager = Cc["@mozilla.org/parentprocessmessagemanager;1"]
                       .getService(Ci.nsIProcessScriptLoader);
messageManager.loadProcessScript(processScript, true);
onShutdown.add(() => {
  messageManager.removeDelayedProcessScript(processScript);
  messageManager.QueryInterface(Ci.nsIMessageBroadcaster).broadcastAsyncMessage("ElemHideHelper:Shutdown");
});

// Load overlay asynchonously and start attaching to windows once done
request = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIJSXMLHttpRequest);
request.open("GET", "chrome://elemhidehelper/content/overlay.xul");
request.channel.owner = Cc["@mozilla.org/systemprincipal;1"].getService(Ci.nsIPrincipal);
request.addEventListener("load", function(event)
{
  if (onShutdown.done)
    return;

  let overlay = event.target.responseXML.documentElement;

  // Initialization done, we can start up now
  require("inspectorObserver");
  new WindowObserver({
    applyToWindow: function(window)
    {
      let type = window.document.documentElement.getAttribute("windowtype");
      if (!knownWindowTypes.has(type) || window._ehhWrapper)
        return;

      window.document.documentElement.appendChild(overlay.cloneNode(true));

      let style = window.document.createProcessingInstruction("xml-stylesheet", 'class="elemhidehelper-node" href="chrome://elemhidehelper/skin/overlay.css" type="text/css"');
      window.document.insertBefore(style, window.document.firstChild);

      window._ehhWrapper = new WindowWrapper(window);
    },

    removeFromWindow: function(window)
    {
      if (!window._ehhWrapper)
        return;

      window._ehhWrapper.shutdown();
      delete window._ehhWrapper;

      let element = window.document.getElementById(overlay.getAttribute("id"));
      if (element)
        element.parentNode.removeChild(element);

      for (let child = window.document.firstChild; child; child = child.nextSibling)
        if (child.nodeType == child.PROCESSING_INSTRUCTION_NODE && child.data.indexOf("elemhidehelper-node") >= 0)
          child.parentNode.removeChild(child);
    }
  });
}, false);
request.send(null);
