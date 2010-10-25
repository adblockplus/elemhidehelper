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
  selectedElem: null,
  commentElem : null,
  mouseX: -1,
  mouseY: -1,
  commandLabelTimer: null,
  viewSourceTimer: null,
  boxElem: null,
};

Aardvark.start = function(wrapper) {
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
}

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
    var label = strings.GetStringFromName("command." + command + ".label");
    this.commands[command + "_key"] = key.toLowerCase();
    this.commands[command + "_label"] = label;

    var row = this.window.document.createElement("row");
    helpBoxRows.appendChild(row);

    var element = this.window.document.createElement("description");
    element.setAttribute("value", key);
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
      if (commands[commands[i] + "_key"] == key)
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
  while (elem && "contentDocument" in elem)
  {
    let rect = elem.getBoundingClientRect();
    x -= rect.left;
    y -= rect.top;
    elem = elem.contentDocument.elementFromPoint(x, y);
  }

  if (elem)
    this.showBoxAndLabel(elem, this.makeElementLabelString(elem));
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

Aardvark.makeElementLabelString = function(elem) {
  var s = "<b style='color:#000'>" + elem.tagName.toLowerCase() + "</b>";
  if (elem.id != '')
    s += ", id: " + elem.id;
  if (elem.className != '')
    s += ", class: " + elem.className;
  if (elem.style.cssText != '')
    s += ", style: " + elem.style.cssText;
    
  return s;
}

Aardvark.showBoxAndLabel = function(elem, string) {
  var doc = elem.ownerDocument;
  if (!doc || !doc.body)
    return;

  this.selectedElem = elem;

  if (this.boxElem.ownerDocument != doc)
    this.boxElem = doc.importNode(this.boxElem, true);

  var pos = this.getPos(elem)
  var dims = this.getWindowDimensions (doc);

  let border = this.boxElem.getElementsByClassName("border")[0];
  let label = this.boxElem.getElementsByClassName("label")[0];

  this.boxElem.style.left = (pos.x - 1) + "px";
  this.boxElem.style.top = (pos.y - 1) + "px";
  border.style.width = (elem.offsetWidth - 2) + "px";
  border.style.height = (elem.offsetHeight - 2) + "px";

  label.innerHTML = string;

  doc.body.appendChild(this.boxElem);
}

Aardvark.clearBox = function() {
  this.selectedElem = null;
  if (this.boxElem.parentNode)
    this.boxElem.parentNode.removeChild(this.boxElem);
}

Aardvark.hideTooltips = function()
{
  E("ehh-helpbox").hidePopup();
  E("ehh-commandlabel").hidePopup();
  E("ehh-viewsource").hidePopup();
}

Aardvark.getPos = function (elem)
{
  var pos = {x: 0, y: 0};

  while (elem)
  {
    pos.x += elem.offsetLeft;
    pos.y += elem.offsetTop;
    elem = elem.offsetParent;
  }
  return pos;
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

/*********************************
 * Code from aardvarkCommands.js *
 *********************************/

//------------------------------------------------------------
// 0: name, 1: needs element
Aardvark.commands = [
  "select",
  "wider",
  "narrower",
  "quit",
  "blinkElement",
  "viewSource",
  "viewSourceWindow",
  "showMenu"
];

//------------------------------------------------------------
Aardvark.wider = function (elem)
{
  if (elem)
  {
    var newElem = elem.parentNode;
    if (newElem && newElem.nodeType == newElem.DOCUMENT_NODE && newElem.defaultView && newElem.defaultView.frameElement)
      newElem = newElem.defaultView.frameElement;

    if (!newElem || newElem.nodeType != newElem.ELEMENT_NODE)
      return false;
    
    if (this.widerStack && this.widerStack.length>0 && 
      this.widerStack[this.widerStack.length-1] == elem)
    {
      this.widerStack.push (newElem);
    }
    else
    {
      this.widerStack = [elem, newElem];
    }
    this.showBoxAndLabel (newElem, 
        this.makeElementLabelString (newElem));
    return true;
  }
  return false;
} 

//------------------------------------------------------------
Aardvark.narrower = function (elem)
{
  if (elem)
  {
    if (this.widerStack && this.widerStack.length>1 && 
      this.widerStack[this.widerStack.length-1] == elem)
    {
      this.widerStack.pop();
      var newElem = this.widerStack[this.widerStack.length-1];
      this.showBoxAndLabel (newElem, 
          this.makeElementLabelString (newElem));
      return true;
    }
  }
  return false;
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

  this.selectedElem = null;
  this.window = null;
  this.browser = null;
  this.commentElem = null;
  E = function(id) null;
  delete this.widerStack;
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
