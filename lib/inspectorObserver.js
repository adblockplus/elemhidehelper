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
    onShutdown.add((function()
    {
      Services.obs.removeObserver(this, "inspector-opened");

      let e = Services.ww.getWindowEnumerator();
      while (e.hasMoreElements())
      {
        let window = e.getNext().QueryInterface(Ci.nsIDOMWindow);
        let button = window.document.getElementById("inspector-abp-elemhide-toolbutton");
        if (button)
          button.parentNode.removeChild(button);
      }
    }).bind(this));
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
    if (topic != "inspector-opened")
      return;

    let InspectorUI = subject.wrappedJSObject;
    let window = InspectorUI.chromeWin;
    let button = window.document.getElementById("inspector-abp-elemhide-toolbutton");
    if (button)
      button.parentNode.removeChild(button);

    if (!("@adblockplus.org/abp/public;1" in Cc) || !window._ehhWrapper || !require("aardvark").Aardvark.canSelect(window._ehhWrapper.browser))
      return;

    let parent = window.document.getElementById("inspector-tools");
    if (!parent)
      return;

    let [label, accesskey, tooltiptext] = this.inspectorButton;
    button = window.document.createElement("toolbarbutton");
    button.setAttribute("id", "inspector-abp-elemhide-toolbutton");
    button.setAttribute("label", label);
    button.setAttribute("class", "devtools-toolbarbutton");
    button.setAttribute("accesskey", accesskey);
    button.setAttribute("tooltiptext", tooltiptext);
    button.setAttribute("tabindex", "0");
    button.addEventListener("command", function()
    {
      InspectorUI.chromeWin.openDialog("chrome://elemhidehelper/content/composer.xul", "_blank",
                                       "chrome,centerscreen,resizable,dialog=no", InspectorUI.selection);
      InspectorUI.closeInspectorUI();
    }, false);
    parent.appendChild(button);
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsISupportsWeakReference, Ci.nsIObserver])
};

InspectorObserver.init();
