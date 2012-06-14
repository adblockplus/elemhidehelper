/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

let InspectorObserver =
{
  init: function()
  {
    Services.obs.addObserver(this, "inspector-opened", true);
    onShutdown.add((function() Services.obs.removeObserver(this, "inspector-opened")).bind(this));
  },

  get inspectorButton()
  {
    // Randomize URI to work around bug 719376
    let stringBundle = Services.strings.createBundle("chrome://elemhidehelper/locale/global.properties?" + Math.random());
    let result = [stringBundle.GetStringFromName("inspector.button.label"), stringBundle.GetStringFromName("inspector.button.accesskey"), stringBundle.GetStringFromName("inspector.button.tooltiptext")];

    delete this.inspectorButton;
    this.__defineGetter__("inspectorButton", function() result);
    return this.inspectorButton;
  },

  observe: function(subject, topic, data)
  {
    if (topic != "inspector-opened" || !("@adblockplus.org/abp/public;1" in Cc))
      return;

    let InspectorUI = subject.wrappedJSObject;
    let window = InspectorUI.chromeWin;
    if (!window._ehhWrapper || !require("aardvark").Aardvark.canSelect(window._ehhWrapper.browser))
      return;

    let [label, accesskey, tooltiptext] = this.inspectorButton;
    InspectorUI.registerTool({
      id: "abp-elemhide",
      label: label,
      accesskey: accesskey,
      tooltiptext: tooltiptext,
      get isOpen() false,
      show: function(selection)
      {
        InspectorUI.chromeWin.openDialog("chrome://elemhidehelper/content/composer.xul", "_blank",
                                         "chrome,centerscreen,resizable,dialog=no", selection);
        InspectorUI.closeInspectorUI();
      }
    });
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsISupportsWeakReference, Ci.nsIObserver])
};

InspectorObserver.init();
