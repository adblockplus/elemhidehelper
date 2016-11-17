/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

let {Aardvark} = require("aardvark");
let {Prefs} = require("prefs");
let {KeySelector} = require("keySelector");

let key = undefined;

function getMenuItem()
{
  // Randomize URI to work around bug 719376
  let stringBundle = Services.strings.createBundle("chrome://elemhidehelper/locale/global.properties?" + Math.random());
  let result = [stringBundle.GetStringFromName("selectelement.label"), stringBundle.GetStringFromName("stopselection.label")];

  getMenuItem = () => result;
  return getMenuItem();
}

exports.WindowWrapper = WindowWrapper;
function WindowWrapper(wnd)
{
  this.window = wnd;

  this.popupShowingHandler = this.popupShowingHandler.bind(this);
  this.popupHiddenHandler = this.popupHiddenHandler.bind(this);
  this.keyPressHandler = this.keyPressHandler.bind(this);
  this.toggleSelection = this.toggleSelection.bind(this);
  this.hideTooltips = this.hideTooltips.bind(this);

  this.init();
}
WindowWrapper.prototype =
{
  window: null,

  get browser()
  {
    if ("gBrowser" in this.window)
      return this.window.gBrowser;            // Firefox / SeaMonkey browser
    else if (typeof this.window.getBrowser == "function")
      return this.window.getBrowser();        // Thunderbird
    else if (typeof this.window.getMessageBrowser == "function")
      return this.window.getMessageBrowser(); // SeaMonkey mail

    throw new Error("Failed to find browser element in this application");
  },

  init: function()
  {
    this.window.addEventListener("popupshowing", this.popupShowingHandler, false);
    this.window.addEventListener("popuphidden", this.popupHiddenHandler, false);
    this.window.addEventListener("keypress", this.keyPressHandler, false);
    this.window.addEventListener("blur", this.hideTooltips, true);
  },

  shutdown: function()
  {
    this.window.removeEventListener("popupshowing", this.popupShowingHandler, false);
    this.window.removeEventListener("popuphidden", this.popupHiddenHandler, false);
    this.window.removeEventListener("keypress", this.keyPressHandler, false);
    this.window.removeEventListener("blur", this.hideTooltips, true);
  },

  E: function(id)
  {
    let doc = this.window.document;
    this.E = id => doc.getElementById(id);
    return this.E(id);
  },

  popupShowingHandler: function(event)
  {
    let popup = event.originalTarget;
    if (!/^(abp-(?:toolbar|status|menuitem)-)popup$/.test(popup.id))
      return;

    this.popupHiddenHandler(event);

    let running = this.browser == Aardvark.browser;

    let [labelStart, labelStop] = getMenuItem();
    let item = popup.ownerDocument.createElement("menuitem");
    item.setAttribute("label", running ? labelStop : labelStart);
    item.setAttribute("class", "elemhidehelper-item");

    if (typeof key == "undefined")
      this.configureKey(event.currentTarget);
    item.setAttribute("acceltext", KeySelector.getTextForKey(key));

    item.addEventListener("command", this.toggleSelection, false);

    let insertBefore = null;
    for (let child = popup.firstChild; child; child = child.nextSibling)
      if (/-options$/.test(child.id))
        insertBefore = child;
    popup.insertBefore(item, insertBefore);
  },

  popupHiddenHandler: function(event)
  {
    let popup = event.originalTarget;
    if (!/^(abp-(?:toolbar|status|menuitem)-)popup$/.test(popup.id))
      return;

    let items = popup.getElementsByClassName("elemhidehelper-item");
    while (items.length)
      items[0].parentNode.removeChild(items[0]);
  },

  keyPressHandler: function(event)
  {
    if (typeof key == "undefined")
      this.configureKey(event.currentTarget);

    if (KeySelector.matchesKey(event, key))
    {
      event.preventDefault();
      this.toggleSelection();
    }
  },

  configureKey: function(window)
  {
    key = new KeySelector(window).selectKey(Prefs.selectelement_key);
  },

  hideTooltips: function()
  {
    if (Aardvark.window == this.window)
      Aardvark.hideTooltips();
  },

  toggleSelection: function()
  {
    if ("@adblockplus.org/abp/public;1" in Cc && this.browser != Aardvark.browser)
      Aardvark.start(this);
    else
      Aardvark.doCommand("quit", null);
  }
};
