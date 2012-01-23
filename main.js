/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

Cu.import("resource://gre/modules/Services.jsm");

let {Prefs} = require("prefs");
let {WindowObserver} = require("windowObserver");
let {WindowWrapper} = require("windowWrapper");

// Check whether some preferences can still be found under their old locations
Prefs.migrate("extensions.adblockplus.ehh-selectelement_key", "selectelement_key");
Prefs.migrate("extensions.adblockplus.ehh.showhelp", "showhelp");

// Use random marker class
let elementMarkerClass = null;
{
  let rnd = [];
  let offset = "a".charCodeAt(0);
  for (let i = 0; i < 20; i++)
    rnd.push(offset + Math.random() * 26);

  elementMarkerClass = String.fromCharCode.apply(String, rnd);
}

// Load CSS asynchronously
let request = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIJSXMLHttpRequest);
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
  onShutdown.add(function() styleService.unregisterSheet(styleURI, Ci.nsIStyleSheetService.USER_SHEET));
}, false);
request.send(null);

// Load overlay asynchonously and start attaching to windows once done
request = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIJSXMLHttpRequest);
request.open("GET", "chrome://elemhidehelper/content/overlay.xul");
request.addEventListener("load", function(event)
{
  if (onShutdown.done)
    return;

  let overlay = {__proto__: null, "_processing": []};
  for (let child = event.target.responseXML.documentElement.firstElementChild; child; child = child.nextElementSibling)
    if (child.hasAttribute("id"))
      overlay[child.getAttribute("id")] = child;
  for (let child = event.target.responseXML.firstChild; child; child = child.nextSibling)
    if (child.nodeType == child.PROCESSING_INSTRUCTION_NODE)
      overlay._processing.push(child);

  // Initialization done, we can start up now
  require("inspectorObserver");
  new WindowObserver({
    applyToWindow: function(window)
    {
      window.setTimeout(function()
      {
        if (onShutdown.done || !window.document.getElementById("abp-hooks"))
          return;

        for (let id in overlay)
          if (id != "_processing")
            window.document.documentElement.appendChild(window.document.importNode(overlay[id], true));
        for (let i = 0; i < overlay._processing.length; i++)
        {
          let node = window.document.importNode(overlay._processing[i], true);
          node.data += ' class="elemhidehelper-node"';
          window.document.insertBefore(node, window.document.firstChild);
        }

        window._ehhWrapper = new WindowWrapper(window, elementMarkerClass);
      }, 0);
    },

    removeFromWindow: function(window)
    {
      if (!window._ehhWrapper)
        return;

      window._ehhWrapper.shutdown();
      delete window._ehhWrapper;

      let remove = [];
      for (let id in overlay)
      {
        if (id != "_processing")
        {
          let element = window.document.getElementById(id);
          if (element)
            remove.push(element);
        }
      }

      for (let child = window.document.firstChild; child; child = child.nextSibling)
        if (child.nodeType == child.PROCESSING_INSTRUCTION_NODE && child.data.indexOf("elemhidehelper-node") >= 0)
          remove.push(child);

      for (let i = 0; i < remove.length; i++)
        remove[i].parentNode.removeChild(remove[i]);
    }
  });
}, false);
request.send(null);
