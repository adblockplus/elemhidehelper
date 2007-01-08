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
 * Portions created by the Initial Developer are Copyright (C) 2006
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
  wnd: null,
  selectedElem: null,
  mouseX: -1,
  mouseY: -1,
  commandLabelTimeout: 0
};

ehhAardvark.start = function(wnd) {
  wnd.addEventListener("click", this.mouseClick, false);
  wnd.addEventListener("mouseover", this.mouseOver, false);
  wnd.addEventListener("keypress", this.keyPress, false);
  wnd.addEventListener("pagehide", this.pageHide, false);
  getBrowser().selectedBrowser.addEventListener("mousemove", this.mouseMove, false);

  this.wnd = wnd;

  this.makeElems();
  this.showMenu();
}

ehhAardvark.doCommand = function(command, event) {
  if (this[command](this.selectedElem)) {
    this.showCommandLabel(this.commands[command + "_key"], this.commands[command + "_label"]);
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
  }
}

ehhAardvark.showCommandLabel = function(key, label) {
  if (this.commandLabelTimeout)
    clearTimeout(this.commandLabelTimeout);

  document.getElementById("ehh-commandlabel-key").setAttribute("value", key);
  document.getElementById("ehh-commandlabel-label").setAttribute("value", label);

  var commandLabel = document.getElementById("ehh-commandlabel");
  commandLabel.showPopup(getBrowser(), this.mouseX, this.mouseY, "tooltip", "topleft", "topleft");

  this.commandLabelTimeout = setTimeout(function() {
    commandLabel.hidePopup();
    ehhAardvark.commandLabelTimeout = 0;
  }, 400);
}

ehhAardvark.onMouseClick = function(event) {
  if (event.button != 0 || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey)
    return;

  this.doCommand("select", event);
}

ehhAardvark.onMouseOver = function(event) {
  var elem = event.target;
  if (elem.ehhAardvarkLabel)
    return;

  if (elem == null)
  {
    this.clearBox ();
    return;
  }

  if (elem == this.selectedElem)
    return;
  
  this.showBoxAndLabel (elem, this.makeElementLabelString (elem));
}

ehhAardvark.onKeyPress = function(event) {
  if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey)
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
    d = this.wnd.document.createElement ("div");
    d.style.display = "none";
    d.style.overflow = "hidden";
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
    this.wnd.document.body.appendChild (d);
  }

  d = this.wnd.document.createElement ("div");
  this.setElementStyleDefault (d, "#fff0cc");
  d.ehhAardvarkLabel = true; // mark as ours
  d.style.borderTopWidth = "0";
  d.style.MozBorderRadiusBottomleft = "6px";
  d.style.MozBorderRadiusBottomright = "6px";
  d.style.zIndex = "65535";
  d.style.visibility = "hidden";
  this.wnd.document.body.appendChild (d);
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
  this.selectedElem = elem;

  var pos = this.getPos(elem)
  var dims = this.getWindowDimensions ();
  var y = pos.y;

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
  this.labelElem.style.visibility = "visible";
}

ehhAardvark.clearBox = function() {
  this.selectedElem = null;
  if ("borderElems" in this)
  {
    for (var i = 0; i < this.borderElems.length; i++)
      this.borderElems[i].style.display = "none";
    this.labelElem.style.display = "none";
    this.labelElem.style.visibility = "hidden";
  }
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

ehhAardvark.getWindowDimensions = function ()
{
  var out = {};

  var doc = this.wnd.document;
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
  //"viewSource",
  "showMenu"
];

//------------------------------------------------------------
ehhAardvark.wider = function (elem)
{
  if (elem && elem.parentNode)
  {
    var newElem = elem.parentNode;
    if (!newElem)
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
      newElem = this.widerStack[this.widerStack.length-1];
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
  if (!this.wnd)
    return false;

  this.clearBox();
  document.getElementById("ehh-helpbox").hidePopup();
  
  this.wnd.removeEventListener("click", this.mouseClick, false);
  this.wnd.removeEventListener("mouseover", this.mouseOver, false);
  this.wnd.removeEventListener("keypress", this.keyPress, false);
  this.wnd.removeEventListener("pagehide", this.pageHide, false);
  getBrowser().selectedBrowser.removeEventListener("mousemove", this.mouseMove, false);

  this.selectedElem = null;
  this.wnd = null;
  delete this.widerStack;
  delete this.borderElems;
  delete this.labelElem;
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

  var dbox = new DBox ("#fff", true);
  dbox.innerContainer.innerHTML = this.getOuterHtmlFormatted(elem);
  dbox.show ();
  return true;
}

//--------------------------------------------------------
ehhAardvark.getOuterHtmlFormatted = function (node)
{
  var str = "";
  
  if (document.all)
  {
    return "<textarea style='width:100%; height:100%'>" + node.outerHTML + "</textarea>"; 
  }

  switch (node.nodeType)
  {
    case 1: // ELEMENT_NODE
    {
      if (node.style.display == 'none')
        break;
      var isLeaf = (node.childNodes.length == 0 && leafElems[node.nodeName]);
      var isTbody = (node.nodeName == "TBODY" && node.attributes.length == 0);
      
      if (isTbody)
      {
        for (var i=0; i<node.childNodes.length; i++)
          str += this.getOuterHtmlFormatted(node.childNodes.item(i));
      }
      else
      {
        if (!isLeaf)
          str += "<div style='border: 1px solid #cccccc; border-right: 0;" +
            "margin-left: 10px; margin-right: 0; overflow: hidden'>";
        str += "&lt;<span style='color:red;font-weight:bold'>" +
              node.nodeName.toLowerCase() + "</span>";
        for (var i=0; i<node.attributes.length; i++) 
        {
          if (node.attributes.item(i).nodeValue != null &&
            node.attributes.item(i).nodeValue != '')
          {
            str += " <span style='color:green;'>"
            str += node.attributes.item(i).nodeName;
            str += "</span>='<span style='color:blue;'>";
            str += node.attributes.item(i).nodeValue;
            str += "</span>'";
          }
        }
        if (isLeaf)
          str += " /&gt;<br>";
        else 
        {
          str += "&gt;<br>";
          
          for (var i=0; i<node.childNodes.length; i++)
            str += this.getOuterHtmlFormatted(node.childNodes.item(i));
          
          str += "&lt;/<span style='color:red;font-weight:bold'>" +
            node.nodeName.toLowerCase() + "</span>&gt;</div>"
        }
      }
    }
    break;
        
    case 3: //TEXT_NODE
      if (node.nodeValue != '' && node.nodeValue != '\n' 
          && node.nodeValue != '\r\n' && node.nodeValue != ' ')
        str += node.nodeValue + "<br>";
      break;
      
    case 4: // CDATA_SECTION_NODE
      str += "&lt;![CDATA[" + node.nodeValue + "]]><br>";
      break;
          
    case 5: // ENTITY_REFERENCE_NODE
      str += "&amp;" + node.nodeName + ";<br>"
      break;
  
    case 8: // COMMENT_NODE
      str += "&lt;!--" + node.nodeValue + "--><br>"
      break;
  }
  
  return str;
}

//-------------------------------------------------
ehhAardvark.showMenu = function ()
{
  var helpBox = document.getElementById("ehh-helpbox");
  if (helpBox.getAttribute("_moz-menuactive") == "true") {
    helpBox.hidePopup();
    return true;
  }

  var helpBoxRows = document.getElementById("ehh-helpbox-rows");
  if (!helpBoxRows.firstChild) {
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

  // Show help box
  helpBox.showPopup(getBrowser().selectedBrowser, -1, -1, "tooltip", "topright", "topright");
  return true;
}
