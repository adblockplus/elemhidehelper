/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

let {gDevTools} = Cu.import("resource:///modules/devtools/gDevTools.jsm", null);

let InspectorObserver =
{
  init: function()
  {
    gDevTools.on("inspector-ready", this.inspectorReady);
    onShutdown.add(function()
    {
      gDevTools.off("inspector-ready", this.inspectorReady);
    }.bind(this));
  },

  get inspectorButtonTooltip()
  {
    // Randomize URI to work around bug 719376
    let stringBundle = Services.strings.createBundle("chrome://elemhidehelper/locale/global.properties?" + Math.random());
    let result = stringBundle.GetStringFromName("inspector.button.tooltiptext");

    delete this.inspectorButtonTooltip;
    this.__defineGetter__("inspectorButtonTooltip", function() result);
    return this.inspectorButtonTooltip;
  },
  
  inspectorReady: function(eventName, toolbox, panel)
  {
    let panelWindow = panel.panelWin;
    let inspectBtn = panelWindow.document.getElementById("inspector-inspect-toolbutton");
    if (!inspectBtn)
      return;
    
    let tooltiptext = InspectorObserver.inspectorButtonTooltip;
    button = panelWindow.document.createElement("toolbarbutton");
    button.setAttribute("id", "inspector-abp-elemhide-toolbutton");
    button.style.listStyleImage = "url('chrome://adblockplus/skin/abp-status-16.png')";
    button.style.MozImageRegion = "rect(0px, 16px, 16px, 0px)";
    button.style.paddingTop = "4px";
    button.setAttribute("class", "devtools-toolbarbutton");
    button.setAttribute("tooltiptext", tooltiptext);
    button.setAttribute("tabindex", "0");
    button.addEventListener("command", function()
    {
      panelWindow.openDialog("chrome://elemhidehelper/content/composer.xul", "_blank", 
                             "chrome,centerscreen,resizable,dialog=no", panel.selection.node);
    }, false);
    inspectBtn.parentNode.insertBefore(button, inspectBtn.nextSibling);
  }
};

InspectorObserver.init();
