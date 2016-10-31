/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

let {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

let {Prefs} = require("prefs");

// Make sure to stop selection when we are uninstalled
onShutdown.add(() => Aardvark.quit());

// To be replaced when selection starts
function E(id) {return null;}

let messageCounter = 0;

/*********************************
 * Minimal element creation code *
 *********************************/

function createElement(doc, tagName, attrs, children)
{
  let el = doc.createElement(tagName);
  if (attrs)
    for (let key in attrs)
      el.setAttribute(key, attrs[key]);
  if (children)
    for (let child of children)
      el.appendChild(child)
  return el;
};

/**********************************
 * General element selection code *
 **********************************/

let Aardvark = exports.Aardvark =
{
  window: null,
  browser: null,
  anchorElem: null,
  selectedElem: null,
  isUserSelected: false,
  lockedAnchor: null,
  commentElem: null,
  mouseX: -1,
  mouseY: -1,
  prevSelectionUpdate: -1,
  commandLabelTimer: null,
  viewSourceTimer: null,
  boxElem: null,
  paintNode: null,
  prevPos: null,

  start: function(wrapper)
  {
    if (!this.canSelect(wrapper.browser))
      return;

    if (this.browser)
      this.quit();

    this.window = wrapper.window;
    this.browser = wrapper.browser;
    E = id => wrapper.E(id);

    this.browser.addEventListener("click", this.onMouseClick, true);
    this.browser.addEventListener("DOMMouseScroll", this.onMouseScroll, true);
    this.browser.addEventListener("keypress", this.onKeyPress, true);
    this.browser.addEventListener("mousemove", this.onMouseMove, true);
    this.browser.addEventListener("select", this.quit, false);
    this.browser.contentWindow.addEventListener("pagehide", this.onPageHide, true);

    this.browser.contentWindow.focus();

    let doc = this.browser.contentDocument;
    let {elementMarkerClass} = require("main");
    this.boxElem = createElement(doc, "div", {"class": elementMarkerClass}, [
      createElement(doc, "div", {"class": "ehh-border"}),
      createElement(doc, "div", {"class": "ehh-label"}, [
        createElement(doc, "span", {"class": "ehh-labelTag"}),
        createElement(doc, "span", {"class": "ehh-labelAddition"})
      ])
    ]);

    this.initHelpBox();

    if (Prefs.showhelp)
      this.showMenu();

    // Make sure to select some element immeditely (whichever is in the center of the browser window)
    let [wndWidth, wndHeight] = this.getWindowSize(doc.defaultView);
    this.isUserSelected = false;
    this.onMouseMove({clientX: wndWidth / 2, clientY: wndHeight / 2, screenX: -1, screenY: -1, target: null});
  },

  canSelect: function(browser)
  {
    if (!browser || !browser.contentWindow ||
        !(browser.contentDocument instanceof Ci.nsIDOMHTMLDocument))
    {
      return false;
    }

    let location = browser.contentWindow.location;
    if (location.href == "about:blank")
      return false;

    if (!Prefs.acceptlocalfiles &&
        location.hostname == "" &&
        location.protocol != "mailbox:" &&
        location.protocol != "imap:" &&
        location.protocol != "news:" &&
        location.protocol != "snews:")
    {
      return false;
    }

    return true;
  },

  doCommand: function(command, event)
  {
    if (this[command](this.selectedElem))
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

  onMouseClick: function(event)
  {
    if (event.button != 0 || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey)
      return;

    this.doCommand("select", event);
  },

  onMouseScroll: function(event)
  {
    if (!event.shiftKey || event.altKey || event.ctrlKey || event.metaKey)
      return;

    if ("axis" in event && event.axis != event.VERTICAL_AXIS)
      return;

    this.doCommand(event.detail > 0 ? "wider" : "narrower", event);
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

  onPageHide: function(event)
  {
    this.doCommand("quit", null);
  },

  onMouseMove: function(event)
  {
    this.mouseX = event.screenX;
    this.mouseY = event.screenY;

    this.hideSelection();
    if (!this.browser)
    {
      // hideSelection() called quit()
      return;
    }

    let x = event.clientX;
    let y = event.clientY;

    // We might have coordinates relative to a frame, recalculate relative to top window
    let node = event.target;
    while (node && node.ownerDocument && node.ownerDocument.defaultView && node.ownerDocument.defaultView.frameElement)
    {
      node = node.ownerDocument.defaultView.frameElement;
      let rect = node.getBoundingClientRect();
      x += rect.left;
      y += rect.top;
    }

    let elem = this.browser.contentDocument.elementFromPoint(x, y);
    while (elem && "contentDocument" in elem && this.canSelect(elem))
    {
      let rect = elem.getBoundingClientRect();
      x -= rect.left;
      y -= rect.top;
      elem = elem.contentDocument.elementFromPoint(x, y);
    }

    if (elem)
    {
      if (!this.lockedAnchor)
        this.setAnchorElement(elem);
      else
      {
        this.lockedAnchor = elem;
        this.selectElement(this.selectedElem);
      }
    }
  },

  onAfterPaint: function()
  {
    // Don't update position too often
    if (this.selectedElem && Date.now() - this.prevSelectionUpdate > 20)
    {
      let pos = this.getElementPosition(this.selectedElem);
      if (!this.prevPos || this.prevPos.left != pos.left || this.prevPos.right != pos.right
                        || this.prevPos.top != pos.top || this.prevPos.bottom != pos.bottom)
      {
        this.selectElement(this.selectedElem);
      }
    }
  },

  setAnchorElement: function(anchor)
  {
    this.anchorElem = anchor;

    let newSelection = anchor;
    if (this.isUserSelected)
    {
      // User chose an element via wider/narrower commands, keep the selection if
      // out new anchor is still a child of that element
      let e = newSelection;
      while (e && e != this.selectedElem)
        e = this.getParentElement(e);

      if (e)
        newSelection = this.selectedElem;
      else
        this.isUserSelected = false;
    }

    this.selectElement(newSelection);
  },

  appendDescription: function(node, value, className)
  {
    var descr = this.window.document.createElement("description");
    descr.setAttribute("value", value);
    if (className)
      descr.setAttribute("class", className);
    node.appendChild(descr);
  },

  /**************************
   * Element marker display *
   **************************/

  getElementLabel: function(elem)
  {
    let tagName = elem.tagName.toLowerCase();
    let addition = "";
    if (elem.id != "")
      addition += ", id: " + elem.id;
    if (elem.className != "")
      addition += ", class: " + elem.className;
    if (elem.style.cssText != "")
      addition += ", style: " + elem.style.cssText;

    return [tagName, addition];
  },

  selectElement: function(elem)
  {
    this.selectedElem = elem;
    this.prevSelectionUpdate = Date.now();

    let border = this.boxElem.getElementsByClassName("ehh-border")[0];
    let label = this.boxElem.getElementsByClassName("ehh-label")[0];
    let labelTag = this.boxElem.getElementsByClassName("ehh-labelTag")[0];
    let labelAddition = this.boxElem.getElementsByClassName("ehh-labelAddition")[0];

    if (this.boxElem.parentNode)
      this.boxElem.parentNode.removeChild(this.boxElem);

    let doc = this.browser.contentDocument;
    let [wndWidth, wndHeight] = this.getWindowSize(doc.defaultView);

    let pos = this.getElementPosition(elem);
    this.boxElem.style.left = Math.min(pos.left - 1, wndWidth - 2) + "px";
    this.boxElem.style.top = Math.min(pos.top - 1, wndHeight - 2) + "px";
    border.style.width = Math.max(pos.right - pos.left - 2, 0) + "px";
    border.style.height = Math.max(pos.bottom - pos.top - 2, 0) + "px";

    [labelTag.textContent, labelAddition.textContent] = this.getElementLabel(elem);

    // If there is not enough space to show the label move it up a little
    if (pos.bottom < wndHeight - 25)
      label.className = "ehh-label";
    else
      label.className = "ehh-label onTop";

    doc.documentElement.appendChild(this.boxElem);

    this.paintNode = doc.defaultView;
    if (this.paintNode)
    {
      this.prevPos = pos;
      this.paintNode.addEventListener("MozAfterPaint", this.onAfterPaint, false);
    }
  },

  hideSelection: function()
  {
    try
    {
      if (this.boxElem.parentNode)
        this.boxElem.parentNode.removeChild(this.boxElem);
    }
    catch (e)
    {
      // Are we using CPOW whose process is gone? Quit!
      // Clear some variables to prevent recursion (quit will call us again).
      this.boxElem = {};
      this.paintNode = null;
      this.quit();
      return;
    }

    if (this.paintNode)
      this.paintNode.removeEventListener("MozAfterPaint", this.onAfterPaint, false);

    this.paintNode = null;
    this.prevPos = null;
  },

  getWindowSize: function(wnd)
  {
    return [wnd.innerWidth, wnd.document.documentElement.clientHeight];
  },

  getElementPosition: function(element)
  {
    // Restrict rectangle coordinates by the boundaries of a window's client area
    function intersectRect(rect, wnd)
    {
      let [wndWidth, wndHeight] = this.getWindowSize(wnd);
      rect.left = Math.max(rect.left, 0);
      rect.top = Math.max(rect.top, 0);
      rect.right = Math.min(rect.right, wndWidth);
      rect.bottom = Math.min(rect.bottom, wndHeight);
    }

    let rect = element.getBoundingClientRect();
    let wnd = element.ownerDocument.defaultView;

    rect = {left: rect.left, top: rect.top,
            right: rect.right, bottom: rect.bottom};
    while (true)
    {
      intersectRect.call(this, rect, wnd);

      if (!wnd.frameElement)
        break;

      // Recalculate coordinates to be relative to frame's parent window
      let frameElement = wnd.frameElement;
      wnd = frameElement.ownerDocument.defaultView;

      let frameRect = frameElement.getBoundingClientRect();
      let frameStyle = wnd.getComputedStyle(frameElement, null);
      let relLeft = frameRect.left + parseFloat(frameStyle.borderLeftWidth) + parseFloat(frameStyle.paddingLeft);
      let relTop = frameRect.top + parseFloat(frameStyle.borderTopWidth) + parseFloat(frameStyle.paddingTop);

      rect.left += relLeft;
      rect.right += relLeft;
      rect.top += relTop;
      rect.bottom += relTop;
    }

    return rect;
  },

  getParentElement: function(elem)
  {
    let result = elem.parentNode;
    if (result && result.nodeType == Ci.nsIDOMElement.DOCUMENT_NODE && result.defaultView && result.defaultView.frameElement)
      result = result.defaultView.frameElement;

    if (result && result.nodeType != Ci.nsIDOMElement.ELEMENT_NODE)
      return null;

    return result;
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

  wider: function(elem)
  {
    if (!elem)
      return false;

    let newElem = this.getParentElement(elem);
    if (!newElem)
      return false;

    this.isUserSelected = true;
    this.selectElement(newElem);
    return true;
  },

  narrower: function(elem)
  {
    if (elem)
    {
      // Search selected element in the parent chain, starting with the anchor element.
      // We need to select the element just before the selected one.
      let e = this.anchorElem;
      let newElem = null;
      while (e && e != elem)
      {
        newElem = e;
        e = this.getParentElement(e);
      }

      if (!e || !newElem)
        return false;

      this.isUserSelected = true;
      this.selectElement(newElem);
      return true;
    }
    return false;
  },

  lock: function(elem)
  {
    if (!elem)
      return false;

    if (this.lockedAnchor)
    {
      this.setAnchorElement(this.lockedAnchor);
      this.lockedAnchor = null;
    }
    else
      this.lockedAnchor = this.anchorElem;

    return true;
  },

  quit: function()
  {
    if (!this.browser)
      return false;

    if ("blinkTimer" in this)
      this.stopBlinking();

    if (this.commandLabelTimer)
      this.commandLabelTimer.cancel();
    if (this.viewSourceTimer)
      this.viewSourceTimer.cancel();
    this.commandLabelTimer = null;
    this.viewSourceTimer = null;

    this.hideSelection();
    this.hideTooltips();

    this.browser.removeEventListener("click", this.onMouseClick, true);
    this.browser.removeEventListener("DOMMouseScroll", this.onMouseScroll, true);
    this.browser.removeEventListener("keypress", this.onKeyPress, true);
    this.browser.removeEventListener("mousemove", this.onMouseMove, true);
    this.browser.removeEventListener("select", this.quit, false);
    this.browser.contentWindow.removeEventListener("pagehide", this.onPageHide, true);

    this.anchorElem = null;
    this.selectedElem = null;
    this.window = null;
    this.browser = null;
    this.commentElem = null;
    this.lockedAnchor = null;
    this.boxElem = null;
    E = id => null;
    return false;
  },

  select: function(elem)
  {
    if (!elem || !this.window)
      return false;

    let messageManager = Cc["@mozilla.org/parentprocessmessagemanager;1"]
                           .getService(Ci.nsIMessageBroadcaster);
    let messageId = ++messageCounter;
    let callback = (message) =>
    {
      let response = message.data;
      if (response.messageId != messageId)
        return;

      messageManager.removeMessageListener(
        "ElemHideHelper:GetNodeInfo:Response",
        callback
      );

      if (!response.nodeData)
        return;

      this.window.openDialog("chrome://elemhidehelper/content/composer.xul",
          "_blank", "chrome,centerscreen,resizable,dialog=no", response);
      this.quit();
    };

    messageManager.addMessageListener(
      "ElemHideHelper:GetNodeInfo:Response",
      callback
    );
    messageManager.broadcastAsyncMessage(
      "ElemHideHelper:GetNodeInfo",
      messageId,
      {
        element: elem
      }
    );
    return false;
  },

  blinkElement: function(elem)
  {
    if (!elem)
      return false;

    if ("blinkTimer" in this)
      this.stopBlinking();

    let counter = 0;
    this.blinkElem = elem;
    this.blinkOrigValue = elem.style.visibility;
    this.blinkTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    this.blinkTimer.initWithCallback(function()
    {
      counter++;
      elem.style.visibility = (counter % 2 == 0 ? "visible" : "hidden");
      if (counter == 6)
        Aardvark.stopBlinking();
    }, 250, Ci.nsITimer.TYPE_REPEATING_SLACK);

    return true;
  },

  stopBlinking: function()
  {
    this.blinkTimer.cancel();
    this.blinkElem.style.visibility = this.blinkOrigValue;

    delete this.blinkElem;
    delete this.blinkOrigValue;
    delete this.blinkTimer;
  },

  viewSource: function(elem)
  {
    if (!elem)
      return false;

    var sourceBox = E("ehh-viewsource");
    if (sourceBox.state == "open" && this.commentElem == elem)
    {
      sourceBox.hidePopup();
      return true;
    }
    sourceBox.hidePopup();

    while (sourceBox.firstElementChild)
      sourceBox.removeChild(sourceBox.firstElementChild);
    this.getOuterHtmlFormatted(elem, sourceBox);
    this.commentElem = elem;

    let anchor = this.window.document.documentElement;
    let x = this.mouseX;
    let y = this.mouseY;
    this.viewSourceTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    this.viewSourceTimer.initWithCallback(function()
    {
      sourceBox.showPopup(anchor, x, y, "tooltip", "topleft", "topleft");
      Aardvark.viewSourceTimer = null;
    }, 500, Ci.nsITimer.TYPE_ONE_SHOT);
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
    var type = null;
    switch (node.nodeType)
    {
      case node.ELEMENT_NODE:
        var box = this.window.document.createElement("vbox");
        box.className = "elementBox";

        var startTag = this.window.document.createElement("hbox");
        startTag.className = "elementStartTag";
        if (!node.firstChild)
          startTag.className += " elementEndTag";

        this.appendDescription(startTag, "<", null);
        this.appendDescription(startTag, node.tagName, "tagName");

        for (var i = 0; i < node.attributes.length; i++)
        {
          var attr = node.attributes[i];
          this.appendDescription(startTag, attr.name, "attrName");
          if (attr.value != "")
          {
            this.appendDescription(startTag, "=", null);
            this.appendDescription(startTag, '"' + attr.value.replace(/"/, "&quot;") + '"', "attrValue");
          }
        }

        this.appendDescription(startTag, node.firstChild ? ">" : " />", null);
        box.appendChild(startTag);

        if (node.firstChild)
        {
          for (var child = node.firstChild; child; child = child.nextSibling)
            this.getOuterHtmlFormatted(child, box);

          var endTag = this.window.document.createElement("hbox");
          endTag.className = "elementEndTag";
          this.appendDescription(endTag, "<", null);
          this.appendDescription(endTag, "/" + node.tagName, "tagName");
          this.appendDescription(endTag, ">", null);
          box.appendChild(endTag);
        }
        container.appendChild(box);
        return;

      case node.TEXT_NODE:
        type = "text";
        break;
      case node.CDATA_SECTION_NODE:
        type = "cdata";
        break;
      case node.COMMENT_NODE:
        type = "comment";
        break;
      default:
        return;
    }

    var text = node.nodeValue.replace(/\r/g, '').replace(/^\s+/, '').replace(/\s+$/, '');
    if (text == "")
      return;

    if (type != "cdata")
    {
      text = text.replace(/&/g, "&amp;")
                 .replace(/</g, "&lt;")
                 .replace(/>/g, "&gt;");
    }
    text = text.replace(/\t/g, "  ");
    if (type == "cdata")
      text = "<![CDATA[" + text + "]]>";
    else if (type == "comment")
      text = "<!--" + text + "-->";

    var lines = text.split("\n");
    for (var i = 0; i < lines.length; i++)
      this.appendDescription(container, lines[i].replace(/^\s+/, '').replace(/\s+$/, ''), type);
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
for (let method of ["onMouseClick", "onMouseScroll", "onKeyPress", "onPageHide", "onMouseMove", "onAfterPaint", "quit"])
  Aardvark[method] = Aardvark[method].bind(Aardvark);
