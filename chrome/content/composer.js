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
 * The Original Code is Adblock Plus Element Hiding Helper.
 *
 * The Initial Developer of the Original Code is
 * Wladimir Palant.
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

var domainData;
var nodeData;
var selectedNode = null;

function NodeData(node, parentNode) {
  this.tagName = {value: node.tagName, checked: false};

  if (typeof parentNode == "undefined")
    parentNode = (node.parentNode && node.parentNode.nodeType == node.ELEMENT_NODE ? new NodeData(node.parentNode) : null);
  this.parentNode = parentNode;

  var prevSibling = node.prevSibling;
  while (prevSibling && prevSibling.nodeType != node.ELEMENT_NODE)
    prevSibling = prevSibling.prevSibling;
  this.prevSibling = (prevSibling ? new NodeData(prevSibling, this.parentNode) : null);

  this.attributes = [];
  for (var i = 0; i < node.attributes.length; i++) {
    var attribute = node.attributes[i];
    var data = {name: attribute.name, value: attribute.value, selected: attribute.value, checked: false};
    if (data.name == "id" || data.name == "class")
      this.attributes.unshift(data);
    else
      this.attributes.push(data);
  }

  if (this.attributes.length >= 2 && this.attributes[1].name == "id") {
    // Make sure ID attribute comes first
    var tmp = this.attributes[1];
    this.attributes[1] = this.attributes[0];
    this.attributes[0] = tmp;
  }

  this.customCSS = {selected: "", checked: false};
}

function init() {
  var element = window.arguments[0];
  var wnd = element.ownerDocument.defaultView;

  nodeData = new NodeData(element);
  nodeData.tagName.checked = true;
  if (nodeData.attributes.length > 0) {
    if (nodeData.attributes[0].name == "id" || nodeData.attributes[0].name == "class") {
      nodeData.attributes[0].selected = nodeData.attributes[0].value;
      nodeData.attributes[0].checked = true;
    }
    else {
      var maxLen = 0;
      var bestAttr = null;
      for (var i = 0; i < nodeData.attributes.length; i++) {
        if (nodeData.attributes[i].value.length > maxLen) {
          maxLen = nodeData.attributes[i].value.length;
          bestAttr = nodeData.attributes[i];
        }
      }
      if (bestAttr) {
        bestAttr.selected = bestAttr.value;
        bestAttr.checked = true;
      }
    }
  }

  var domain = wnd.location.host;
  var selectedDomain = domain.replace(/^www\./, "");
  domainData = {value: domain, selected: selectedDomain};

  updateExpression();

  setTimeout(function() {
    fillAttributes(nodeData);
    fillDomains(domainData);
    document.getElementById("domainGroup").selectedItem.focus();
  }, 0);
}

function updateExpression() {
  var curNode = nodeData;
  var simpleMode = true;
  while (curNode) {
    var expressionSimple = (curNode.tagName.checked ? curNode.tagName.value : "*");
    var expressionRaw = expressionSimple;

    for (var i = 0; i < curNode.attributes.length; i++) {
      var attr = curNode.attributes[i];

      if (attr.checked && attr.selected != "") {
        var op = "*=";
        if (attr.selected == attr.value)
          op = "=";
        else if (attr.value.substr(0, attr.selected.length) == attr.selected)
          op = "^=";
        else if (attr.value.substr(attr.value.length - attr.selected.length) == attr.selected)
          op = "$=";

        if (/[()"]/.test(attr.value))
          expressionSimple = null;

        if (expressionSimple != null)
          expressionSimple += "(" + attr.name + op + attr.value + ")";
        expressionRaw += "[" + attr.name + op + '"' + attr.value.replace(/"/g, '\\"') + '"' + "]";
      }
    }

    if (curNode.customCSS.checked && curNode.customCSS.selected != "") {
      expressionSimple = null;
      expressionRaw += curNode.customCSS.selected;
    }

    curNode.expressionSimple = expressionSimple;
    curNode.expressionRaw = expressionRaw;

    if (expressionSimple == null || (expressionRaw != "*" && curNode != nodeData))
      simpleMode = false;

    if (curNode.prevSibling)
      curNode = curNode.prevSibling;
    else
      curNode = curNode.parentNode;
  }

  var expression;
  if (simpleMode)
    expression = domainData.selected + "#" + nodeData.expressionSimple;
  else {
    expression = domainData.selected + "##" + nodeData.expressionRaw;
    // TBD
  }

  document.getElementById("expression").value = expression;
}

function fillDomains(domainData) {
  var template = document.getElementById("domain-template");
  if (domainData.selected == "")
    template.setAttribute("selected", "true");

  var parts = domainData.value.split(".");
  if (parts[0] == "")
    parts.splice(0, 1);

  for (var i = 1; i <= parts.length; i++) {
    var curDomain = parts.slice(parts.length - i).join(".");

    var node = template.cloneNode(true);
    node.removeAttribute("id");
    node.setAttribute("label", curDomain);
    node.setAttribute("value", curDomain);

    if (domainData.selected == curDomain)
      node.setAttribute("selected", "true");

    template.parentNode.appendChild(node);
  }
}

function fillAttributes(nodeData) {
  var template = document.getElementById("attribute-template");
  selectedNode = nodeData;

  // Remove everything but our template
  var child = template.parentNode.firstChild;
  while (child) {
    var nextChild = child.nextSibling;
    if (child != template)
      template.parentNode.removeChild(child);
    child = nextChild;
  }

  // Add tag name checkbox
  var node = template.cloneNode(true);
  node.hidden = false;
  node.setAttribute("label", node.getAttribute("label") + " " + nodeData.tagName.value);
  node.setAttribute("checked", nodeData.tagName.checked);
  template.parentNode.appendChild(node);

  // Add attribute checkboxes
  for (var i = 0; i < nodeData.attributes.length; i++) {
    var attr = nodeData.attributes[i];

    node = template.cloneNode(true);
    node.hidden = false;
    node.setAttribute("label", attr.name + ": " + attr.value);
    node.setAttribute("checked", attr.checked);
    node.setAttribute("value", attr.name);
    template.parentNode.appendChild(node);
  }
}

function changeDomain(node) {
  domainData.selected = node.getAttribute("value");
  updateExpression();
}

function toggleAttr(node) {
  if (selectedNode == null)
    return;

  if (node.hasAttribute("value")) {
    var attrName = node.getAttribute("value");
    for (var i = 0; i < selectedNode.attributes.length; i++)
      if (selectedNode.attributes[i].name == attrName)
        selectedNode.attributes[i].checked = node.checked;
  }
  else
    selectedNode.tagName.checked = node.checked;

  updateExpression();
}

function addExpression() {
  var abp = Components.classes["@mozilla.org/adblockplus;1"]
                      .createInstance(Components.interfaces.nsIAdblockPlus);
  abp.addPatterns([document.getElementById("expression").value], 1);
}
