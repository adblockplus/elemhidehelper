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

/**********************************
 * General element selection code *
 **********************************/

var ehhAardvark = {
  browser: null,
  selectedElem: null,
  commentElem : null,
  mouseX: -1,
  mouseY: -1,
  commandLabelTimeout: 0,
  borderElems: null,
  labelElem: null
};

ehhAardvark.start = function(browser) {
  if (!ehhCanSelect(browser))
    return;

  if (!("viewSourceURL" in this)) {
    // Firefox/Thunderbird and SeaMonkey have different viewPartialSource URLs
    var urls = [
      "chrome://global/content/viewPartialSource.xul",
      "chrome://navigator/content/viewPartialSource.xul"
    ];
    this.viewSourceURL = null;
    for (var i = 0; i < urls.length && !this.viewSourceURL; i++) {
      var request = new XMLHttpRequest();
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

  browser.addEventListener("click", this.mouseClick, true);
  browser.addEventListener("mouseover", this.mouseOver, true);
  browser.addEventListener("keypress", this.keyPress, true);
  browser.addEventListener("mousemove", this.mouseMove, true);
  browser.contentWindow.addEventListener("pagehide", this.pageHide, true);

  browser.contentWindow.focus();

  this.browser = browser;

  if (!this.labelElem)
    this.makeElems();

  this.initHelpBox();

  var prefService = Components.classes["@mozilla.org/preferences-service;1"]
                              .getService(Components.interfaces.nsIPrefService);
  var branch = prefService.getBranch("extensions.adblockplus.");
  var showMenu = true;
  try {
    showMenu = branch.getBoolPref("ehh.showhelp");
  } catch(e) {}

  if (showMenu)
    this.showMenu();
}

ehhAardvark.doCommand = function(command, event) {
  if (this[command](this.selectedElem)) {
    this.showCommandLabel(this.commands[command + "_key"], this.commands[command + "_label"]);
    if (event)
      event.stopPropagation();
  }
  if (event)
    event.preventDefault();
}

ehhAardvark.showCommandLabel = function(key, label) {
  if (this.commandLabelTimeout)
    clearTimeout(this.commandLabelTimeout);

  document.getElementById("ehh-commandlabel-key").setAttribute("value", key);
  document.getElementById("ehh-commandlabel-label").setAttribute("value", label);

  var commandLabel = document.getElementById("ehh-commandlabel");
  commandLabel.showPopup(document.documentElement, this.mouseX, this.mouseY, "tooltip", "topleft", "topleft");

  this.commandLabelTimeout = setTimeout(function() {
    commandLabel.hidePopup();
    ehhAardvark.commandLabelTimeout = 0;
  }, 400);
}

ehhAardvark.initHelpBox = function() {
  var helpBoxRows = document.getElementById("ehh-helpbox-rows");
  if (helpBoxRows.firstChild)
    return;

  // Help box hasn't been filled yet, need to do it now
  var stringService = Components.classes["@mozilla.org/intl/stringbundle;1"]
                                .getService(Components.interfaces.nsIStringBundleService);
  var strings = stringService.createBundle("chrome://elemhidehelper/locale/global.properties");

  for (var i = 0; i < this.commands.length; i++) {
    var command = this.commands[i];
    var key = strings.GetStringFromName("command." + command + ".key");
    var label = strings.GetStringFromName("command." + command + ".label");
    this.commands[command + "_key"] = key.toLowerCase();
    this.commands[command + "_label"] = label;

    var row = document.createElement("row");
    helpBoxRows.appendChild(row);

    var element = document.createElement("description");
    element.setAttribute("value", key);
    element.className = "key";
    row.appendChild(element);

    element = document.createElement("description");
    element.setAttribute("value", label);
    element.className = "label";
    row.appendChild(element);
  }
}

ehhAardvark.onMouseClick = function(event) {
  if (event.button != 0 || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey)
    return;

  this.doCommand("select", event);
}

ehhAardvark.onMouseOver = function(event) {
  var elem = event.originalTarget;
  var aardvarkLabel = elem;
  while (aardvarkLabel && !("ehhAardvarkLabel" in aardvarkLabel))
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

ehhAardvark.onKeyPress = function(event) {
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

ehhAardvark.onPageHide = function(event) {
  this.doCommand("quit", null);
}

ehhAardvark.onMouseMove = function(event) {
  this.mouseX = event.screenX;
  this.mouseY = event.screenY;
}

// Makes sure event handlers like ehhAardvark.keyPress redirect
// to the real handlers (ehhAardvark.onKeyPress in this case) with
// correct this pointer.
ehhAardvark.generateEventHandlers = function(handlers) {
  var generator = function(handler) {
    return function(event) {ehhAardvark[handler](event)};
  };

  for (var i = 0; i < handlers.length; i++) {
    var handler = "on" + handlers[i][0].toUpperCase() + handlers[i].substr(1);
    this[handlers[i]] = generator(handler);
  }
}
ehhAardvark.generateEventHandlers(["mouseClick", "mouseOver", "keyPress", "pageHide", "mouseMove"]);

ehhAardvark.appendDescription = function(node, value, className) {
  var descr = document.createElement("description");
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
ehhAardvark.makeElems = function ()
{
  this.borderElems = [];
  var d, i;

  for (i=0; i<4; i++)
  {
    d = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
    d.style.display = "none";
    d.style.position = "absolute";
    d.style.height = "0px";
    d.style.width = "0px";
    d.style.zIndex = "65534";
    if (i < 2)
      d.style.borderTop = "2px solid #f00";
    else
      d.style.borderLeft = "2px solid #f00";
    d.ehhAardvarkLabel = true; // mark as ours
    this.borderElems[i] = d;
  }

  d = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
  this.setElementStyleDefault (d, "#fff0cc");
  d.style.borderTopWidth = "0";
  d.style.MozBorderRadiusBottomleft = "6px";
  d.style.MozBorderRadiusBottomright = "6px";
  d.style.zIndex = "65535";
  d.ehhAardvarkLabel = true; // mark as ours
  this.labelElem = d;
}

ehhAardvark.makeElementLabelString = function(elem) {
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

ehhAardvark.showBoxAndLabel = function(elem, string) {
  var doc = elem.ownerDocument;
  if (!doc || !doc.body)
    return;

  this.selectedElem = elem;

  for (var i = 0; i < 4; i++) {
    try {
      doc.adoptNode(this.borderElems[i]);
    }
    catch (e) {
      // Temporary work-around for bug 604736, adoptNode fails
      this.borderElems[i] = doc.importNode(this.borderElems[i], true);
    }
    doc.body.appendChild(this.borderElems[i]);
  }

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
  
  try {
    doc.adoptNode(this.labelElem);
  }
  catch(e) {
    // Temporary work-around for bug 604736, adoptNode fails
    this.labelElem = doc.importNode(this.labelElem, true);
  }
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

ehhAardvark.clearBox = function() {
  this.selectedElem = null;

  for (var i = 0; i < this.borderElems.length; i++)
    if (this.borderElems[i].parentNode)
      this.borderElems[i].parentNode.removeChild(this.borderElems[i]);

  if (this.labelElem.parentNode)
    this.labelElem.parentNode.removeChild(this.labelElem);
}

ehhAardvark.getPos = function (elem)
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

ehhAardvark.getWindowDimensions = function (doc)
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

ehhAardvark.setElementStyleDefault = function (elem, bgColor)
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
ehhAardvark.commands = [
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
ehhAardvark.wider = function (elem)
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
ehhAardvark.narrower = function (elem)
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
ehhAardvark.quit = function ()
{
  if (!this.browser)
    return false;

  this.clearBox();
  ehhHideTooltips();
  
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
ehhAardvark.select = function (elem)
{
  if (!elem || !this.quit())
    return false;

  window.openDialog("chrome://elemhidehelper/content/composer.xul", "_blank",
                    "chrome,centerscreen,resizable,dialog=no", elem);
  return true;
}

//------------------------------------------------------------
ehhAardvark.blinkElement = function (elem)
{
  if (!elem)
    return false;

  if ("blinkInterval" in this)
    this.stopBlinking();

  var counter = 0;
  this.blinkElem = elem;
  this.blinkOrigValue = elem.style.visibility;
  this.blinkInterval = setInterval(function() {
    counter++;
    elem.style.visibility = (counter % 2 == 0 ? "visible" : "hidden");
    if (counter == 6)
      ehhAardvark.stopBlinking();
  }, 250);

  return true;
}
ehhAardvark.stopBlinking = function() {
  clearInterval(this.blinkInterval);
  this.blinkElem.style.visibility = this.blinkOrigValue;

  delete this.blinkElem;
  delete this.blinkOrigValue;
  delete this.blinkInterval;
}

//------------------------------------------------------------
ehhAardvark.viewSource = function (elem)
{
  if (!elem)
    return false;

  var sourceBox = document.getElementById("ehh-viewsource");
  if ((sourceBox.getAttribute("_moz-menuactive") == "true" || sourceBox.state == "open") && this.commentElem == elem) {
    sourceBox.hidePopup();
    return true;
  }
  sourceBox.hidePopup();

  while (sourceBox.firstChild)
    sourceBox.removeChild(sourceBox.firstChild);
  this.getOuterHtmlFormatted(elem, sourceBox);
  this.commentElem = elem;

  var x = this.mouseX;
  var y = this.mouseY;
  setTimeout(function() {
    sourceBox.showPopup(document.documentElement, x, y, "tooltip", "topleft", "topleft");
  }, 500);
  return true;
}

//--------------------------------------------------------
ehhAardvark.viewSourceWindow = function(elem) {
  if (!elem || !this.viewSourceURL)
    return false;

  var range = elem.ownerDocument.createRange();
  range.selectNodeContents(elem);
  var selection = {rangeCount: 1, getRangeAt: function() {return range}};

  // SeaMonkey uses a different 
  window.openDialog(this.viewSourceURL, "_blank", "scrollbars,resizable,chrome,dialog=no",
                    null, null, selection, "selection");
  return true;
}

//--------------------------------------------------------
ehhAardvark.getOuterHtmlFormatted = function (node, container)
{
  var type = null;
  switch (node.nodeType) {
    case node.ELEMENT_NODE:
      var box = document.createElement("vbox");
      box.className = "elementBox";

      var startTag = document.createElement("hbox");
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

        var endTag = document.createElement("hbox");
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
ehhAardvark.showMenu = function ()
{
  var helpBox = document.getElementById("ehh-helpbox");
  if (helpBox.getAttribute("_moz-menuactive") == "true" || helpBox.state == "open") {
    helpBox.hidePopup();
    return true;
  }

  // Show help box
  helpBox.showPopup(this.browser, -1, -1, "tooltip", "topleft", "topleft");
  return true;
}
