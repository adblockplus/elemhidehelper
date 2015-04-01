/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

let InspectorObserver =
{
  init: function()
  {
    let gDevTools;
    try
    {
      ({gDevTools}) = Cu.import("resource:///modules/devtools/gDevTools.jsm", null);
    }
    catch(e)
    {
      // No developer tools or unsupported version - ignore.
      return;
    }

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

    Object.defineProperty(this, "inspectorButtonTooltip", {value: result, enumerable: true});
    return this.inspectorButtonTooltip;
  },

  inspectorReady: function(eventName, toolbox, panel)
  {
    let panelWindow = panel.panelWin;
    let inspectBtn = panelWindow.document.getElementById("inspector-breadcrumbs");
    if (!inspectBtn)
      return;

    let tooltiptext = InspectorObserver.inspectorButtonTooltip;
    button = panelWindow.document.createElement("toolbarbutton");
    button.setAttribute("id", "ehh-inspector-toolbarbutton");
    button.setAttribute("class", "devtools-toolbarbutton");
    button.setAttribute("tooltiptext", tooltiptext);
    button.setAttribute("tabindex", "0");
    button.addEventListener("command", function()
    {
      panelWindow.openDialog("chrome://elemhidehelper/content/composer.xul", "_blank",
                             "chrome,centerscreen,resizable,dialog=no", panel.selection.node);
    }, false);
    
    //Override button style for light DevTools theme
    let style = panelWindow.document.createProcessingInstruction("xml-stylesheet", 'href="chrome://elemhidehelper/skin/devToolsOverlay.css" type="text/css"');
    panelWindow.document.insertBefore(style, panelWindow.document.firstChild);
    
    inspectBtn.parentNode.insertBefore(button, inspectBtn);
  }
};

InspectorObserver.init();
