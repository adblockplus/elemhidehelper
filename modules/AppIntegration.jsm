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

var EXPORTED_SYMBOLS = ["AppIntegration"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

let baseURI = Cc["@adblockplus.org/ehh/startup;1"].getService(Ci.nsIURI);
Cu.import(baseURI.spec + "Aardvark.jsm");

var AppIntegration =
{
  addWindow: function(wnd)
  {
    new WindowWrapper(wnd);
  }
};

function WindowWrapper(wnd)
{
  this.window = wnd;

  this.registerEventListeners();
}
WindowWrapper.prototype =
{
  window: null,

  _bindMethod: function(method)
  {
    let me = this;
    return function() method.apply(me, arguments);
  },

  get browser()
  {
    let hooks = this.E("abp-hooks");
    let browser = (hooks ? hooks.getBrowser() : null);
    this.__defineGetter__("browser", function() browser);
    return this.browser;
  },

  E: function(id)
  {
    let doc = this.window.document;
    this.E = function(id) doc.getElementById(id);
    return this.E(id);
  },

  registerEventListeners: function()
  {
    for each (let [id, event, handler] in this.eventHandlers)
    {
      handler = this._bindMethod(handler);

      let element = this.E(id);
      if (element)
        element.addEventListener(event, handler, false);
    }

    this.window.addEventListener("blur", this._bindMethod(this.hideTooltips), true);
    this.browser.addEventListener("select", this._bindMethod(this.stopSelection), false);
  },

  hideTooltips: function()
  {
    this.E("ehh-helpbox").hidePopup();
    this.E("ehh-commandlabel").hidePopup();
    this.E("ehh-viewsource").hidePopup();
  },

  fillPopup: function(event)
  {
    // Submenu being opened - ignore
    if (!/^(abp-(?:toolbar|status)-)popup$/.test(event.target.getAttribute("id")))
      return;
    let prefix = RegExp.$1;
  
    let enabled = this.canSelect(this.browser);
    let running = (enabled && this.browser == Aardvark.browser);
  
    this.E(prefix + "ehh-selectelement").setAttribute("disabled", !enabled);
    this.E(prefix + "ehh-selectelement").hidden = running;
    this.E(prefix + "ehh-stopselection").hidden = !running;
  },

  canSelect: function()
  {
    let browser = this.browser;
    if (!browser || !browser.contentWindow || 
        !(browser.contentDocument instanceof Ci.nsIDOMHTMLDocument) ||
        !browser.contentDocument.body)
    {
      return false;
    }
  
    let location = browser.contentWindow.location;
    if (location.href == "about:blank")
    {
      return false;
    }
  
    if (location.hostname == "" &&
        location.protocol != "mailbox:" &&
        location.protocol != "imap:" &&
        location.protocol != "news:" &&
        location.protocol != "snews:")
    {
      return false;
    }
  
    return true;
  },

  toggleSelection: function()
  {
    if (this.browser == Aardvark.browser)
      this.stopSelection();
    else
      this.startSelection();
  },

  startSelection: function()
  {
    Aardvark.start(this);
  },

  stopSelection: function()
  {
    Aardvark.quit();
  }
};

WindowWrapper.prototype.eventHandlers = [
  ["abp-status-popup", "popupshowing", WindowWrapper.prototype.fillPopup],
  ["abp-toolbar-popup", "popupshowing", WindowWrapper.prototype.fillPopup],
  ["abp-status-ehh-selectelement", "command", WindowWrapper.prototype.toggleSelection],
  ["abp-status-ehh-stopselection", "command", WindowWrapper.prototype.toggleSelection],
  ["abp-toolbar-ehh-selectelement", "command", WindowWrapper.prototype.toggleSelection],
  ["abp-toolbar-ehh-stopselection", "command", WindowWrapper.prototype.toggleSelection],
  ["abp-command-ehh-selectelement", "command", WindowWrapper.prototype.toggleSelection],
];
