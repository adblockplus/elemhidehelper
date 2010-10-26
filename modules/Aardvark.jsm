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
 * The Original Code is Aardvark Firefox extension.
 *
 * The Initial Developer of the Original Code is
 * Rob Brown.
 * Portions created by the Initial Developer are Copyright (C) 2006-2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 * Wladimir Palant
 *
 * ***** END LICENSE BLOCK ***** */

var EXPORTED_SYMBOLS = ["Aardvark"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

let baseURI = Cc["@adblockplus.org/ehh/startup;1"].getService(Ci.nsIURI);
Cu.import(baseURI.spec + "Prefs.jsm");

// To be replaced when selection starts
function E(id) {return null;}

/**********************************
 * General element selection code *
 **********************************/

var Aardvark = {
  window: null,
  browser: null,
  anchorElem: null,
  selectedElem: null,
  isUserSelected: false,
  lockedAnchor: null,
  commentElem: null,
  mouseX: -1,
  mouseY: -1,
  commandLabelTimer: null,
  viewSourceTimer: null,
  boxElem: null,
};

Aardvark.start = function(wrapper) {
  if (!this.canSelect(wrapper.browser))
    return;

  if (this.browser)
    this.quit();

  this.window = wrapper.window;
  this.browser = wrapper.browser;
  E = function(id) wrapper.E(id);

  this.browser.addEventListener("click", this.mouseClick, true);
  this.browser.addEventListener("DOMMouseScroll", this.mouseScroll, true);
  this.browser.addEventListener("keypress", this.keyPress, true);
  this.browser.addEventListener("mousemove", this.mouseMove, true);
  this.browser.contentWindow.addEventListener("pagehide", this.pageHide, true);

  this.browser.contentWindow.focus();

  let doc = this.browser.contentDocument;
  if (!this.boxElem)
    this.boxElem = E("ehh-elementmarker").firstChild;

  this.initHelpBox();

  if (Prefs.showhelp)
    this.showMenu();

  // Make sure to select some element immeditely (whichever is in the center of the browser window)
  let wndWidth = doc.documentElement.clientWidth;
  let wndHeight = doc.documentElement.clientHeight;
  if (doc.compatMode == "BackCompat") // clientHeight will be bogus in quirks mode
    wndHeight = doc.documentElement.offsetHeight - doc.defaultView.scrollMaxY;
  this.isUserSelected = false;
  this.onMouseMove({clientX: wndWidth / 2, clientY: wndHeight / 2, screenX: -1, screenY: -1, target: null});
}

Aardvark.canSelect = function(browser)
{
  if (!Prefs.initialized)
    return false;

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

Aardvark.doCommand = function(command, event) {
  if (this[command](this.selectedElem)) {
    this.showCommandLabel(this.commands[command + "_key"], this.commands[command + "_label"]);
    if (event)
      event.stopPropagation();
  }
  if (event)
    event.preventDefault();
}

Aardvark.showCommandLabel = function(key, label) {
  if (this.commandLabelTimer)
    this.commandLabelTimer.cancel();

  E("ehh-commandlabel-key").setAttribute("value", key);
  E("ehh-commandlabel-label").setAttribute("value", label);

  var commandLabel = E("ehh-commandlabel");
  commandLabel.showPopup(this.window.document.documentElement, this.mouseX, this.mouseY, "tooltip", "topleft", "topleft");

  this.commandLabelTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
  this.commandLabelTimer.initWithCallback(function()
  {
    commandLabel.hidePopup();
    Aardvark.commandLabelTimer = null;
  }, 400, Ci.nsITimer.TYPE_ONE_SHOT);
}

Aardvark.initHelpBox = function() {
  var helpBoxRows = E("ehh-helpbox-rows");
  if (helpBoxRows.firstChild)
    return;

  // Help box hasn't been filled yet, need to do it now
  var stringService = Cc["@mozilla.org/intl/stringbundle;1"].getService(Ci.nsIStringBundleService);
  var strings = stringService.createBundle("chrome://elemhidehelper/locale/global.properties");

  for (var i = 0; i < this.commands.length; i++) {
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
    element.setAttribute("value", key);
    element.className = "key";
    row.appendChild(element);

    var element = this.window.document.createElement("description");
    element.setAttribute("value", alternativeKey);
    element.className = "key";
    row.appendChild(element);

    element = this.window.document.createElement("description");
    element.setAttribute("value", label);
    element.className = "label";
    row.appendChild(element);
  }
}

Aardvark.onMouseClick = function(event) {
  if (event.button != 0 || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey)
    return;

  this.doCommand("select", event);
}

Aardvark.onMouseScroll = function(event)
{
  if (!event.shiftKey || event.altKey || event.ctrlKey || event.metaKey)
    return;

  if ("axis" in event && event.axis != event.VERTICAL_AXIS)
    return;

  for (let i = 0; i < Math.abs(event.detail); i++)
    this.doCommand(event.detail > 0 ? "wider" : "narrower", event);
}

Aardvark.onKeyPress = function(event) {
  if (event.altKey || event.ctrlKey || event.metaKey)
    return;

  var command = null;
  if (event.keyCode == event.DOM_VK_ESCAPE)
    command = "quit";
  else if (event.keyCode == event.DOM_VK_RETURN)
    command = "select";
  else if (event.charCode) {
    var key = String.fromCharCode(event.charCode).toLowerCase();
    var commands = this.commands;
    for (var i = 0; i < commands.length; i++)
      if (commands[commands[i] + "_key"] == key || commands[commands[i] + "_altkey"] == key)
        command = commands[i];
  }

  if (command)
    this.doCommand(command, event);
}

Aardvark.onPageHide = function(event) {
  this.doCommand("quit", null);
}

Aardvark.onMouseMove = function(event) {
  this.mouseX = event.screenX;
  this.mouseY = event.screenY;

  this.clearBox();

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
      this.showBoxAndLabel(this.selectedElem);
    }
  }
}

Aardvark.setAnchorElement = function(anchor)
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

  this.showBoxAndLabel(newSelection);
}

// Makes sure event handlers like Aardvark.keyPress redirect
// to the real handlers (Aardvark.onKeyPress in this case) with
// correct this pointer.
Aardvark.generateEventHandlers = function(handlers) {
  var generator = function(handler) {
    return function(event) {Aardvark[handler](event)};
  };

  for (var i = 0; i < handlers.length; i++) {
    var handler = "on" + handlers[i][0].toUpperCase() + handlers[i].substr(1);
    this[handlers[i]] = generator(handler);
  }
}
Aardvark.generateEventHandlers(["mouseClick", "mouseScroll", "keyPress", "pageHide", "mouseMove"]);

Aardvark.appendDescription = function(node, value, className) {
  var descr = this.window.document.createElement("description");
  descr.setAttribute("value", value);
  if (className)
    descr.setAttribute("class", className);
  node.appendChild(descr);
}

/***************************
 * Highlight frame display *
 ***************************/

Aardvark.makeElementLabelString = function(elem)
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
}

Aardvark.showBoxAndLabel = function(elem, string)
{
  this.selectedElem = elem;

  let border = this.boxElem.getElementsByClassName("border")[0];
  let label = this.boxElem.getElementsByClassName("label")[0];
  let labelTag = this.boxElem.getElementsByClassName("labelTag")[0];
  let labelAddition = this.boxElem.getElementsByClassName("labelAddition")[0];

  let pos = this.getElementPosition(elem);
  this.boxElem.style.left = (pos.left - 1) + "px";
  this.boxElem.style.top = (pos.top - 1) + "px";
  border.style.width = (pos.right - pos.left - 2) + "px";
  border.style.height = (pos.bottom - pos.top - 2) + "px";

  let doc = this.browser.contentDocument;

  [labelTag.textContent, labelAddition.textContent] = this.makeElementLabelString(elem);

  // If there is not enough space to show the label move it up a little
  let wndHeight = doc.documentElement.clientHeight;
  if (doc.compatMode == "BackCompat") // clientHeight will be bogus in quirks mode
    wndHeight = doc.documentElement.offsetHeight - doc.defaultView.scrollMaxY;
  if (pos.bottom < wndHeight - 25)
    label.className = "label";
  else
    label.className = "label onTop";
  
  if (this.boxElem.ownerDocument != doc)
    this.boxElem = doc.importNode(this.boxElem, true);
  doc.documentElement.appendChild(this.boxElem);
}

Aardvark.clearBox = function() {
  if (this.boxElem.parentNode)
    this.boxElem.parentNode.removeChild(this.boxElem);
}

Aardvark.hideTooltips = function()
{
  E("ehh-helpbox").hidePopup();
  E("ehh-commandlabel").hidePopup();
  E("ehh-viewsource").hidePopup();
}

Aardvark.getElementPosition = function(element)
{
  // Restrict rectangle coordinates by the boundaries of a window's client area
  function intersectRect(rect, wnd)
  {
    let doc = wnd.document;
    let wndWidth = doc.documentElement.clientWidth;
    let wndHeight = doc.documentElement.clientHeight;
    if (doc.compatMode == "BackCompat") // clientHeight will be bogus in quirks mode
      wndHeight = doc.documentElement.offsetHeight - wnd.scrollMaxY;

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
    intersectRect(rect, wnd);

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
}

Aardvark.getWindowDimensions = function (doc)
{
  var out = {};

  out.scrollX = doc.body.scrollLeft + doc.documentElement.scrollLeft; 
  out.scrollY = doc.body.scrollTop + doc.documentElement.scrollTop;

  if (doc.compatMode == "BackCompat")
  {
    out.width = doc.body.clientWidth;
    out.height = doc.body.clientHeight;
  }
  else
  {
    out.width = doc.documentElement.clientWidth;
    out.height = doc.documentElement.clientHeight;
  }
  return out;
}

Aardvark.getParentElement = function(elem)
{
  let result = elem.parentNode;
  if (result && result.nodeType == Ci.nsIDOMElement.DOCUMENT_NODE && result.defaultView && result.defaultView.frameElement)
    result = result.defaultView.frameElement;

  if (result && result.nodeType != Ci.nsIDOMElement.ELEMENT_NODE)
    return null;

  return result;
}

/*********************************
 * Code from aardvarkCommands.js *
 *********************************/

//------------------------------------------------------------
// 0: name, 1: needs element
Aardvark.commands = [
  "select",
  "wider",
  "narrower",
  "lock",
  "quit",
  "blinkElement",
  "viewSource",
  "viewSourceWindow",
  "showMenu"
];

//------------------------------------------------------------
Aardvark.wider = function (elem)
{
  if (!elem)
    return false;

  let newElem = this.getParentElement(elem);
  if (!newElem)
    return false;
  
  this.isUserSelected = true;
  this.showBoxAndLabel(newElem);
  return true;
} 

//------------------------------------------------------------
Aardvark.narrower = function (elem)
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
    this.showBoxAndLabel(newElem);
  }
  return false;
}

//------------------------------------------------------------

Aardvark.lock = function (elem)
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
}
  
//------------------------------------------------------------
Aardvark.quit = function ()
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

  this.clearBox();
  this.hideTooltips();
  
  this.browser.removeEventListener("click", this.mouseClick, true);
  this.browser.removeEventListener("keypress", this.keyPress, true);
  this.browser.removeEventListener("mousemove", this.mouseMove, true);
  this.browser.contentWindow.removeEventListener("pagehide", this.pageHide, true);

  this.anchorElem = null;
  this.selectedElem = null;
  this.window = null;
  this.browser = null;
  this.commentElem = null;
  this.lockedAnchor = null;
  E = function(id) null;
  return false;
}

//------------------------------------------------------------
Aardvark.select = function (elem)
{
  if (!elem)
    return false;

  this.window.openDialog("chrome://elemhidehelper/content/composer.xul", "_blank",
                         "chrome,centerscreen,resizable,dialog=no", elem);
  this.quit();
  return false;
}

//------------------------------------------------------------
Aardvark.blinkElement = function (elem)
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
}
Aardvark.stopBlinking = function()
{
  this.blinkTimer.cancel();
  this.blinkElem.style.visibility = this.blinkOrigValue;

  delete this.blinkElem;
  delete this.blinkOrigValue;
  delete this.blinkTimer;
}

//------------------------------------------------------------
Aardvark.viewSource = function (elem)
{
  if (!elem)
    return false;

  var sourceBox = E("ehh-viewsource");
  if ((sourceBox.getAttribute("_moz-menuactive") == "true" || sourceBox.state == "open") && this.commentElem == elem) {
    sourceBox.hidePopup();
    return true;
  }
  sourceBox.hidePopup();

  while (sourceBox.firstChild)
    sourceBox.removeChild(sourceBox.firstChild);
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
}

//--------------------------------------------------------
Aardvark.viewSourceWindow = function(elem) {
  if (!elem)
    return false;

  var range = elem.ownerDocument.createRange();
  range.selectNodeContents(elem);
  var selection = {rangeCount: 1, getRangeAt: function() {return range}};

  this.window.openDialog("chrome://global/content/viewPartialSource.xul", "_blank", "scrollbars,resizable,chrome,dialog=no",
                         null, null, selection, "selection");
  return true;
}

//--------------------------------------------------------
Aardvark.getOuterHtmlFormatted = function (node, container)
{
  var type = null;
  switch (node.nodeType) {
    case node.ELEMENT_NODE:
      var box = this.window.document.createElement("vbox");
      box.className = "elementBox";

      var startTag = this.window.document.createElement("hbox");
      startTag.className = "elementStartTag";
      if (!node.firstChild)
        startTag.className += "elementEndTag";

      this.appendDescription(startTag, "<", null);
      this.appendDescription(startTag, node.tagName, "tagName");

      for (var i = 0; i < node.attributes.length; i++) {
        var attr = node.attributes[i];
        this.appendDescription(startTag, attr.name, "attrName");
        if (attr.value != "") {
          this.appendDescription(startTag, "=", null);
          this.appendDescription(startTag, '"' + attr.value.replace(/"/, "&quot;") + '"', "attrValue");
        }
      }

      this.appendDescription(startTag, node.firstChild ? ">" : " />", null);
      box.appendChild(startTag);

      if (node.firstChild) {
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

  if (type != "cdata") {
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
}

//-------------------------------------------------
Aardvark.showMenu = function ()
{
  var helpBox = E("ehh-helpbox");
  if (helpBox.getAttribute("_moz-menuactive") == "true" || helpBox.state == "open") {
    helpBox.hidePopup();
    return true;
  }

  // Show help box
  helpBox.showPopup(this.browser, -1, -1, "tooltip", "topleft", "topleft");
  return true;
}
