/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

let {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

let {Prefs} = require("prefs");

let messageManager = Cc["@mozilla.org/parentprocessmessagemanager;1"]
                       .getService(Ci.nsIMessageListenerManager)
                       .QueryInterface(Ci.nsIMessageBroadcaster);

// To be replaced when selection starts
function E(id) {return null;}

messageManager.addMessageListener("ElemHideHelper:Response",
                                  messageResponse);
messageManager.addMessageListener("ElemHideHelper:SelectionStarted",
                                  selectionStarted);
messageManager.addMessageListener("ElemHideHelper:SelectionSucceeded",
                                  selectionSucceeded);
messageManager.addMessageListener("ElemHideHelper:SelectionStopped",
                                  selectionStopped);
onShutdown.add(() =>
{
  messageManager.removeMessageListener("ElemHideHelper:Response",
                                       messageResponse);
  messageManager.removeMessageListener("ElemHideHelper:SelectionStarted",
                                       selectionStarted);
  messageManager.removeMessageListener("ElemHideHelper:SelectionSucceeded",
                                       selectionSucceeded);
  messageManager.removeMessageListener("ElemHideHelper:SelectionStopped",
                                       selectionStopped);

  selectionStopped();
});

let maxMessageId = 0;
let messageCallbacks = new Map();

function sendMessageWithResponse(messageName, data, callback)
{
  if (!data)
    data = {};
  data.messageId = ++maxMessageId;
  messageCallbacks.set(data.messageId, callback);
  messageManager.broadcastAsyncMessage(messageName, data);
}

function messageResponse(message)
{
  let callback = messageCallbacks.get(message.data.messageId);
  if (callback)
  {
    messageCallbacks.delete(message.data.messageId);
    callback(message.data);
  }
}

function selectionStarted(message)
{
  Aardvark.selectionStarted();
}

function selectionSucceeded(message)
{
  Aardvark.selectionSucceeded(message.data);
}

function selectionStopped(message)
{
  Aardvark.selectionStopped();
}

/**********************************
 * General element selection code *
 **********************************/

let Aardvark = exports.Aardvark =
{
  window: null,
  browser: null,
  rememberedWrapper: null,
  mouseX: -1,
  mouseY: -1,
  commandLabelTimer: null,
  viewSourceTimer: null,

  start: function(wrapper)
  {
    this.rememberedWrapper = wrapper;
    let browser = wrapper.browser;
    if ("selectedBrowser" in browser)
      browser = browser.selectedBrowser;
    messageManager.broadcastAsyncMessage(
      "ElemHideHelper:StartSelection",
      browser.outerWindowID
    );
  },

  selectionStarted: function()
  {
    let wrapper = this.rememberedWrapper;
    this.rememberedWrapper = null;

    this.window = wrapper.window;
    this.browser = wrapper.browser;
    E = id => wrapper.E(id);

    this.browser.addEventListener("keypress", this.onKeyPress, true);
    this.browser.addEventListener("mousemove", this.onMouseMove, false);
    this.browser.addEventListener("select", this.onTabSelect, false);

    this.initHelpBox();

    if (Prefs.showhelp)
      this.showMenu();
  },

  selectionSucceeded: function(nodeInfo)
  {
    this.window.openDialog("chrome://elemhidehelper/content/composer.xul",
        "_blank", "chrome,centerscreen,resizable,dialog=no", nodeInfo);
  },

  selectionStopped: function()
  {
    if (!this.browser)
      return;

    if (this.commandLabelTimer)
      this.commandLabelTimer.cancel();
    if (this.viewSourceTimer)
      this.viewSourceTimer.cancel();
    this.commandLabelTimer = null;
    this.viewSourceTimer = null;

    this.hideTooltips();

    this.browser.removeEventListener("keypress", this.onKeyPress, true);
    this.browser.removeEventListener("mousemove", this.onMouseMove, false);
    this.browser.removeEventListener("select", this.onTabSelect, false);

    this.window = null;
    this.browser = null;
    E = id => null;
  },

  doCommand: function(command, event)
  {
    let showFeedback;
    if (this.hasOwnProperty(command))
      showFeedback = this[command]();
    else
    {
      showFeedback = (command != "select" && command != "quit");
      messageManager.broadcastAsyncMessage("ElemHideHelper:Command", command);
    }

    if (showFeedback)
    {
      this.showCommandLabel(this.commands[command + "_key"], this.commands[command + "_altkey"], this.commands[command + "_label"]);
      if (event)
        event.stopPropagation();
    }
    if (event)
      event.preventDefault();
  },

  showCommandLabel: function(key, alternativeKey, label)
  {
    if (this.commandLabelTimer)
      this.commandLabelTimer.cancel();

    E("ehh-commandlabel-key").textContent = key.toUpperCase();
    E("ehh-commandlabel-alternativeKey").textContent = alternativeKey.toUpperCase();
    E("ehh-commandlabel-label").setAttribute("value", label);

    var commandLabel = E("ehh-commandlabel");
    commandLabel.showPopup(this.window.document.documentElement, this.mouseX, this.mouseY, "tooltip", "topleft", "topleft");

    this.commandLabelTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    this.commandLabelTimer.initWithCallback(function()
    {
      commandLabel.hidePopup();
      Aardvark.commandLabelTimer = null;
    }, 400, Ci.nsITimer.TYPE_ONE_SHOT);
  },

  initHelpBox: function()
  {
    var helpBoxRows = E("ehh-helpbox-rows");
    if (helpBoxRows.firstElementChild)
      return;

    // Help box hasn't been filled yet, need to do it now
    var stringService = Cc["@mozilla.org/intl/stringbundle;1"].getService(Ci.nsIStringBundleService);
    var strings = stringService.createBundle("chrome://elemhidehelper/locale/global.properties");

    for (var i = 0; i < this.commands.length; i++)
    {
      var command = this.commands[i];
      var key = strings.GetStringFromName("command." + command + ".key");
      var alternativeKey = strings.GetStringFromName("command." + command + ".alternativeKey");
      var label = strings.GetStringFromName("command." + command + ".label");
      this.commands[command + "_key"] = key.toLowerCase();
      this.commands[command + "_altkey"] = alternativeKey.toLowerCase();
      this.commands[command + "_label"] = label;

      var row = this.window.document.createElement("row");
      helpBoxRows.appendChild(row);

      var element = this.window.document.createElement("description");
      element.textContent = key.toUpperCase();
      element.className = "key";
      row.appendChild(element);

      var element = this.window.document.createElement("description");
      element.textContent = alternativeKey.toUpperCase();
      element.className = "key";
      row.appendChild(element);

      element = this.window.document.createElement("description");
      element.setAttribute("value", label);
      element.className = "label";
      row.appendChild(element);
    }
  },

  hideTooltips: function()
  {
    let tooltips = ["ehh-helpbox", "ehh-commandlabel", "ehh-viewsource"];
    for (let i = 0; i < tooltips.length; i++)
    {
      let tooltip = E(tooltips[i]);
      if (tooltip)
        tooltip.hidePopup();
    }
  },

  onKeyPress: function(event)
  {
    if (event.altKey || event.ctrlKey || event.metaKey)
      return;

    var command = null;
    if (event.keyCode == event.DOM_VK_ESCAPE)
      command = "quit";
    else if (event.keyCode == event.DOM_VK_RETURN)
      command = "select";
    else if (event.charCode)
    {
      var key = String.fromCharCode(event.charCode).toLowerCase();
      var commands = this.commands;
      for (var i = 0; i < commands.length; i++)
        if (commands[commands[i] + "_key"] == key || commands[commands[i] + "_altkey"] == key)
          command = commands[i];
    }

    if (command)
      this.doCommand(command, event);
  },

  onMouseMove: function(event)
  {
    this.mouseX = event.screenX;
    this.mouseY = event.screenY;
  },

  onTabSelect: function(event)
  {
    this.doCommand("quit", null);
  },

  appendDescription: function(node, value, className)
  {
    var descr = this.window.document.createElement("description");
    descr.setAttribute("value", value);
    if (className)
      descr.setAttribute("class", className);
    node.appendChild(descr);
  },

  /***************************
   * Commands implementation *
   ***************************/

  commands: [
    "select",
    "wider",
    "narrower",
    "lock",
    "quit",
    "blinkElement",
    "viewSource",
    "viewSourceWindow",
    "showMenu"
  ],

  viewSource: function()
  {
    let sourceBox = E("ehh-viewsource");
    if (sourceBox.state == "open")
    {
      sourceBox.hidePopup();
      return true;
    }

    sendMessageWithResponse("ElemHideHelper:SerializeSelected", null, data =>
    {
      sourceBox.hidePopup();

      while (sourceBox.firstElementChild)
        sourceBox.removeChild(sourceBox.firstElementChild);
      this.getOuterHtmlFormatted(data.serialized, sourceBox);

      let anchor = this.window.document.documentElement;
      let x = this.mouseX;
      let y = this.mouseY;
      this.viewSourceTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
      this.viewSourceTimer.initWithCallback(function()
      {
        sourceBox.showPopup(anchor, x, y, "tooltip", "topleft", "topleft");
        Aardvark.viewSourceTimer = null;
      }, 500, Ci.nsITimer.TYPE_ONE_SHOT);
    });
    return true;
  },

  viewSourceWindow: function(elem)
  {
    if (!elem)
      return false;

    if (Services.vc.compare(Services.appinfo.platformVersion, "43.0") >= 0)
    {
      // After https://bugzilla.mozilla.org/show_bug.cgi?id=1134585 landed, pass
      // a single object as parameter.
      this.window.openDialog(
        "chrome://global/content/viewPartialSource.xul",
        "_blank", "scrollbars,resizable,chrome,dialog=no",
        {
          URI: "view-source:data:text/html;charset=utf-8," + encodeURIComponent(elem.outerHTML),
          drawSelection: false,
          baseURI: elem.ownerDocument.baseURI
        }
      );
    }
    else
    {
      // Before Gecko 43, use positional parameters and a fake selection object.
      var range = elem.ownerDocument.createRange();
      range.selectNodeContents(elem);
      var selection = {rangeCount: 1, getRangeAt: function() {return range}};
      this.window.openDialog(
        "chrome://global/content/viewPartialSource.xul",
        "_blank", "scrollbars,resizable,chrome,dialog=no",
        null, null, selection, "selection"
      );
    }
    return true;
  },

  getOuterHtmlFormatted: function(node, container)
  {
    let type = node.type;
    if (type == "element")
    {
      let box = this.window.document.createElement("vbox");
      box.className = "elementBox";

      let startTag = this.window.document.createElement("hbox");
      startTag.className = "elementStartTag";
      if (!node.children.length)
        startTag.className += " elementEndTag";

      this.appendDescription(startTag, "<", null);
      this.appendDescription(startTag, node.tagName, "tagName");

      for (let {name, value} of node.attributes)
      {
        this.appendDescription(startTag, name, "attrName");
        if (value != "")
        {
          this.appendDescription(startTag, "=", null);
          this.appendDescription(startTag, `"${value.replace(/"/, "&quot;")}"`,
                                 "attrValue");
        }
      }

      this.appendDescription(startTag, node.children.length ? ">" : " />", null);
      box.appendChild(startTag);

      if (node.children.length)
      {
        for (let child of node.children)
          this.getOuterHtmlFormatted(child, box);

        let endTag = this.window.document.createElement("hbox");
        endTag.className = "elementEndTag";
        this.appendDescription(endTag, "<", null);
        this.appendDescription(endTag, "/" + node.tagName, "tagName");
        this.appendDescription(endTag, ">", null);
        box.appendChild(endTag);
      }
      container.appendChild(box);
      return;
    }

    let text = node.text.replace(/\r/g, "").trim();
    if (text == "")
      return;

    text = text.replace(/&/g, "&amp;")
               .replace(/</g, "&lt;")
               .replace(/>/g, "&gt;")
               .replace(/\t/g, "  ");
    if (type == "comment")
      text = "<!--" + text + "-->";

    for (let line of text.split("\n"))
      this.appendDescription(container, line.trim(), type);
  },

  showMenu: function()
  {
    var helpBox = E("ehh-helpbox");
    if (helpBox.state == "open")
    {
      helpBox.hidePopup();
      return true;
    }

    // Show help box
    helpBox.showPopup(this.browser, -1, -1, "tooltip", "topleft", "topleft");
    return true;
  }
}

// Makes sure event handlers like Aardvark.onKeyPress always have the correct
// this pointer set.
for (let method of ["onKeyPress", "onMouseMove", "onTabSelect"])
  Aardvark[method] = Aardvark[method].bind(Aardvark);
