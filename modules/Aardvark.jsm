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

/**********************************
 * General element selection code *
 **********************************/

var Aardvark = {
  windowWrapper: null,
  browser: null,
  selectedElem: null,
  commentElem : null,
  mouseX: -1,
  mouseY: -1,
  commandLabelTimer: null,
  viewSourceTimer: null,
  borderElems: null,
  labelElem: null
};

Aardvark.start = function(wrapper) {
  if (!wrapper.canSelect())
    return;

  if (!("viewSourceURL" in this)) {
    // Firefox/Thunderbird and SeaMonkey have different viewPartialSource URLs
    var urls = [
      "chrome://global/content/viewPartialSource.xul",
      "chrome://navigator/content/viewPartialSource.xul"
    ];
    this.viewSourceURL = null;
    for (var i = 0; i < urls.length && !this.viewSourceURL; i++) {
      var request = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIJSXMLHttpRequest);
      request.open("GET", urls[i], false);
      try {
        request.send(null);
        this.viewSourceURL = urls[i];
      } catch (e) {}
    }

    if (!this.viewSourceURL) {
      for (i = 0; i < this.commands.length; i++)
        if (this.commands[i] == "viewSourceWindow")
          this.commands.splice(i--, 1);
    }
  }

  this.windowWrapper = wrapper;
  this.browser = wrapper.browser;

  this.browser.addEventListener("click", this.mouseClick, true);
  this.browser.addEventListener("mouseover", this.mouseOver, true);
  this.browser.addEventListener("keypress", this.keyPress, true);
  this.browser.addEventListener("mousemove", this.mouseMove, true);
  this.browser.contentWindow.addEventListener("pagehide", this.pageHide, true);

  this.browser.contentWindow.focus();

  let doc = this.browser.contentDocument;
  if (!this.labelElem || this.labelElem.ownerDocument != doc)
    this.makeElems(doc);

  this.initHelpBox();

  var prefService = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService);
  var branch = prefService.getBranch("extensions.adblockplus.");
  var showMenu = true;
  try {
    showMenu = branch.getBoolPref("ehh.showhelp");
  } catch(e) {}

  if (showMenu)
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

  this.windowWrapper.E("ehh-commandlabel-key").setAttribute("value", key);
  this.windowWrapper.E("ehh-commandlabel-label").setAttribute("value", label);

  var commandLabel = this.windowWrapper.E("ehh-commandlabel");
  commandLabel.showPopup(this.windowWrapper.window.document.documentElement, this.mouseX, this.mouseY, "tooltip", "topleft", "topleft");

  this.commandLabelTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
  this.commandLabelTimer.initWithCallback(function()
  {
    commandLabel.hidePopup();
    Aardvark.commandLabelTimer = null;
  }, 400, Ci.nsITimer.TYPE_ONE_SHOT);
}

Aardvark.initHelpBox = function() {
  var helpBoxRows = this.windowWrapper.E("ehh-helpbox-rows");
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

    var row = this.windowWrapper.window.document.createElement("row");
    helpBoxRows.appendChild(row);

    var element = this.windowWrapper.window.document.createElement("description");
    element.setAttribute("value", key);
    element.className = "key";
    row.appendChild(element);

    element = this.windowWrapper.window.document.createElement("description");
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

Aardvark.onMouseOver = function(event) {
  var elem = event.originalTarget;
  var aardvarkLabel = elem;
  while (aardvarkLabel && !("AardvarkLabel" in aardvarkLabel))
    aardvarkLabel = aardvarkLabel.parentNode;

  if (elem == null || aardvarkLabel)
  {
    this.clearBox ();
    return;
  }

  if (elem == this.selectedElem)
    return;
  
  this.showBoxAndLabel (elem, this.makeElementLabelString (elem));
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
Aardvark.generateEventHandlers(["mouseClick", "mouseOver", "keyPress", "pageHide", "mouseMove"]);

Aardvark.appendDescription = function(node, value, className) {
  var descr = this.windowWrapper.window.document.createElement("description");
  descr.setAttribute("value", value);
  if (className)
    descr.setAttribute("class", className);
  node.appendChild(descr);
}

/***************************
 * Highlight frame display *
 ***************************/

//-------------------------------------------------
// create the box and tag etc (done once and saved)
Aardvark.makeElems = function (doc)
{
  this.borderElems = [];
  var d, i;

  for (i=0; i<4; i++)
  {
    d = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
    d.style.display = "none";
    d.style.position = "absolute";
    d.style.height = "0px";
    d.style.width = "0px";
    d.style.zIndex = "65534";
    if (i < 2)
      d.style.borderTop = "2px solid #f00";
    else
      d.style.borderLeft = "2px solid #f00";
    d.AardvarkLabel = true; // mark as ours
    this.borderElems[i] = d;
  }

  d = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
  this.setElementStyleDefault (d, "#fff0cc");
  d.style.borderTopWidth = "0";
  d.style.MozBorderRadiusBottomleft = "6px";
  d.style.MozBorderRadiusBottomright = "6px";
  d.style.borderBottomLeftRadius = "6px";
  d.style.borderBottomRightRadius = "6px";
  d.style.zIndex = "65535";
  d.AardvarkLabel = true; // mark as ours
  this.labelElem = d;
}

Aardvark.makeElementLabelString = function(elem) {
  var s = "<b style='color:#000'>" + elem.tagName.toLowerCase() + "</b>";
  if (elem.id != '')
    s += ", id: " + elem.id;
  if (elem.className != '')
    s += ", class: " + elem.className;
  /*for (var i in elem.style)
    if (elem.style[i] != '')
      s += "<br> " + i + ": " + elem.style[i]; */
  if (elem.style.cssText != '')
    s += ", style: " + elem.style.cssText;
    
  return s;
}

Aardvark.showBoxAndLabel = function(elem, string) {
  var doc = elem.ownerDocument;
  if (!doc || !doc.body)
    return;

  this.selectedElem = elem;

  for (var i = 0; i < 4; i++)
    doc.body.appendChild(this.borderElems[i]);

  var pos = this.getPos(elem)
  var dims = this.getWindowDimensions (doc);

  this.borderElems[0].style.left
    = this.borderElems[1].style.left
    = this.borderElems[2].style.left
    = (pos.x - 1) + "px";
  this.borderElems[3].style.left = (pos.x + elem.offsetWidth - 1) + "px";

  this.borderElems[0].style.width
    = this.borderElems[1].style.width
    = (elem.offsetWidth + 2) + "px";

  this.borderElems[2].style.height
    = this.borderElems[3].style.height
    = (elem.offsetHeight + 2) + "px";

  this.borderElems[0].style.top
    = this.borderElems[2].style.top
    = this.borderElems[3].style.top
    = (pos.y - 1) + "px";
  this.borderElems[1].style.top = (pos.y + elem.offsetHeight - 1) + "px";
  
  this.borderElems[0].style.display
    = this.borderElems[1].style.display
    = this.borderElems[2].style.display
    = this.borderElems[3].style.display
    = "";
  
  var y = pos.y + elem.offsetHeight + 1;
  
  doc.body.appendChild(this.labelElem);

  this.labelElem.innerHTML = string;
  this.labelElem.style.display = "";

  // adjust the label as necessary to make sure it is within screen and
  // the border is pretty
  if ((y + this.labelElem.offsetHeight) >= dims.scrollY + dims.height)
  {
    this.labelElem.style.borderTopWidth = "1px";
    this.labelElem.style.MozBorderRadiusTopleft = "6px";
    this.labelElem.style.MozBorderRadiusTopright = "6px";
    this.labelDrawnHigh = true;
    y = (dims.scrollY + dims.height) - this.labelElem.offsetHeight;
  }
  else if (this.labelElem.offsetWidth > elem.offsetWidth)
  {
    this.labelElem.style.borderTopWidth = "1px";
    this.labelElem.style.MozBorderRadiusTopright = "6px";
    this.labelDrawnHigh = true;
  }
  else if (this.labelDrawnHigh)
  {
    this.labelElem.style.borderTopWidth = "0";
    this.labelElem.style.MozBorderRadiusTopleft = "";
    this.labelElem.style.MozBorderRadiusTopright = "";
    delete (this.labelDrawnHigh); 
  }
  this.labelElem.style.left = (pos.x + 2) + "px";
  this.labelElem.style.top = y + "px";
}

Aardvark.clearBox = function() {
  this.selectedElem = null;

  for (var i = 0; i < this.borderElems.length; i++)
    if (this.borderElems[i].parentNode)
      this.borderElems[i].parentNode.removeChild(this.borderElems[i]);

  if (this.labelElem.parentNode)
    this.labelElem.parentNode.removeChild(this.labelElem);
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

Aardvark.setElementStyleDefault = function (elem, bgColor)
{
  var s = elem.style;
  s.display = "none";
  s.backgroundColor = bgColor;
  s.borderColor = "black";
  s.borderWidth = "1px 2px 2px 1px";
  s.borderStyle = "solid";
  s.fontFamily = "arial";
  s.textAlign = "left";
  s.color = "#000";
  s.fontSize = "12px";
  s.position = "absolute";
  s.paddingTop = "2px";
  s.paddingBottom = "2px";
  s.paddingLeft = "5px";
  s.paddingRight = "5px";
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
    if (newElem && newElem.nodeType == newElem.DOCUMENT_NODE && newElem.defaultView && !(newElem.defaultView.frameElement instanceof HTMLFrameElement))
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
  this.windowWrapper.hideTooltips();
  
  this.browser.removeEventListener("click", this.mouseClick, true);
  this.browser.removeEventListener("mouseover", this.mouseOver, true);
  this.browser.removeEventListener("keypress", this.keyPress, true);
  this.browser.removeEventListener("mousemove", this.mouseMove, true);
  this.browser.contentWindow.removeEventListener("pagehide", this.pageHide, true);

  this.selectedElem = null;
  this.browser = null;
  this.commentElem = null;
  delete this.widerStack;
  return true;
}

//------------------------------------------------------------
Aardvark.select = function (elem)
{
  if (!elem || !this.quit())
    return false;

  this.windowWrapper.window.openDialog("chrome://elemhidehelper/content/composer.xul", "_blank",
                                       "chrome,centerscreen,resizable,dialog=no", elem);
  return true;
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

  var sourceBox = this.windowWrapper.E("ehh-viewsource");
  if ((sourceBox.getAttribute("_moz-menuactive") == "true" || sourceBox.state == "open") && this.commentElem == elem) {
    sourceBox.hidePopup();
    return true;
  }
  sourceBox.hidePopup();

  while (sourceBox.firstChild)
    sourceBox.removeChild(sourceBox.firstChild);
  this.getOuterHtmlFormatted(elem, sourceBox);
  this.commentElem = elem;

  let anchor = this.windowWrapper.window.document.documentElement;
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
  if (!elem || !this.viewSourceURL)
    return false;

  var range = elem.ownerDocument.createRange();
  range.selectNodeContents(elem);
  var selection = {rangeCount: 1, getRangeAt: function() {return range}};

  this.windowWrapper.window.openDialog(this.viewSourceURL, "_blank", "scrollbars,resizable,chrome,dialog=no",
                                       null, null, selection, "selection");
  return true;
}

//--------------------------------------------------------
Aardvark.getOuterHtmlFormatted = function (node, container)
{
  var type = null;
  switch (node.nodeType) {
    case node.ELEMENT_NODE:
      var box = this.windowWrapper.window.document.createElement("vbox");
      box.className = "elementBox";

      var startTag = this.windowWrapper.window.document.createElement("hbox");
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

        var endTag = this.windowWrapper.window.document.createElement("hbox");
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
  var helpBox = this.windowWrapper.E("ehh-helpbox");
  if (helpBox.getAttribute("_moz-menuactive") == "true" || helpBox.state == "open") {
    helpBox.hidePopup();
    return true;
  }

  // Show help box
  helpBox.showPopup(this.browser, -1, -1, "tooltip", "topleft", "topleft");
  return true;
}
