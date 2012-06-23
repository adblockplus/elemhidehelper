/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

let {Prefs} = require("prefs");

let domainData;
let nodeData;
let selectedNode = null;
let advancedMode = false;
let treeView = null;
let stylesheetData;
let previewStyle = null;
let doc;

let abpURL = Cc["@adblockplus.org/abp/public;1"].getService(Ci.nsIURI);
Cu.import(abpURL.spec);

/*******************
 * NodeData object *
 *******************/

function NodeData(node, parentNode) {
  this.tagName = {value: node.tagName, checked: false};

  if (typeof parentNode == "undefined")
    parentNode = (node.parentNode && node.parentNode.nodeType == node.ELEMENT_NODE ? new NodeData(node.parentNode) : null);
  this.parentNode = parentNode;

  var prevSibling = node.previousSibling;
  while (prevSibling && prevSibling.nodeType != node.ELEMENT_NODE)
    prevSibling = prevSibling.previousSibling;
  this.prevSibling = (prevSibling ? new NodeData(prevSibling, this.parentNode) : null);

  if (parentNode && !prevSibling)
    this.firstChild = {checked: false};

  var nextSibling = node.nextSibling;
  while (nextSibling && nextSibling.nodeType != node.ELEMENT_NODE)
    nextSibling = nextSibling.nextSibling;
  if (parentNode && !nextSibling)
    this.lastChild = {checked: false};

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

/*******************
 * TreeView object *
 *******************/

function TreeView(tree) {
  var origView = tree.view;
  this.getRowProperties = TreeView_getRowProperties;
  this.getCellProperties = TreeView_getCellProperties;

  createQIProxy(this, origView);

  for (var key in origView) {
    if (this.hasOwnProperty(key))
      continue;

    createPropertyProxy(this, origView, key);
  }

  tree.view = this;
}

function createQIProxy(obj, orig) {
  obj.QueryInterface = function(iid) {
    var impl = orig.QueryInterface(iid);
    if (impl != orig)
      throw Cr.NS_ERROR_NO_INTERFACE;

    return obj;
  };
}

function createPropertyProxy(obj, orig, key) {
  if (typeof orig[key] == "function") {
    obj[key] = function() {
      return orig[key].apply(orig, arguments);
    };
  }
  else {
    obj.__defineGetter__(key, function() {
      return orig[key];
    });
    obj.__defineSetter__(key, function(value) {
      orig[key] = value;
    });
  }
}

var atomService = Cc["@mozilla.org/atom-service;1"].getService(Ci.nsIAtomService);
var selectedAtom = atomService.getAtom("selected-false");
var anchorAtom = atomService.getAtom("anchor");

function TreeView_getRowProperties(row, properties) {
  if (!this.selection.isSelected(row))
    properties.AppendElement(selectedAtom);

  var item = this.getItemAtIndex(row);
  if (item && (item.nodeData.expression != "*" || item.nodeData == nodeData))
    properties.AppendElement(anchorAtom);
}

function TreeView_getCellProperties(row, col, properties) {
  this.getRowProperties(row, properties);
}

/*********************
 * General functions *
 *********************/

function init() {
  var element = window.arguments[0];
  doc = element.ownerDocument;
  var wnd = doc.defaultView;

  // Check whether element hiding group is disabled
  let subscription = AdblockPlus.getSubscription("~eh~");
  if (subscription && subscription.disabled)
  {
    let warning = document.getElementById("groupDisabledWarning");
    if (/\?1\?/.test(warning.textContent))
      warning.textContent = warning.textContent.replace(/\?1\?/g, subscription.title);
    warning.hidden = false;
  }

  nodeData = new NodeData(element);
  nodeData.tagName.checked = true;
  if (nodeData.attributes.length > 0)
  {
    let maxLen = 0;
    let bestAttr = null;
    for (let i = 0; i < nodeData.attributes.length; i++)
    {
      let len = nodeData.attributes[i].value.length;
      if ((nodeData.attributes[i].name == "id" || nodeData.attributes[i].name == "class") && len)
      {
        len = 0x7FFFFFFF;
        nodeData.tagName.checked = false;
      }
      if (len > maxLen)
      {
        maxLen = len;
        bestAttr = nodeData.attributes[i];
      }
    }
    if (bestAttr)
    {
      bestAttr.selected = bestAttr.value;
      bestAttr.checked = true;
    }
  }

  let domain = wnd.location.hostname;
  let selectedDomain;
  switch (Prefs.composer_defaultDomain)
  {
    case 0:
      selectedDomain = "";
      break;
    case 1:
      try
      {
        // EffectiveTLDService will throw for IP addresses, just go to the next case then
        let effectiveTLD = Cc["@mozilla.org/network/effective-tld-service;1"].getService(Ci.nsIEffectiveTLDService);
        selectedDomain = effectiveTLD.getPublicSuffixFromHost(domain);
        break;
      } catch (e) {}
    case 2:
      try
      {
        // EffectiveTLDService will throw for IP addresses, just go to the next case then
        let effectiveTLD = Cc["@mozilla.org/network/effective-tld-service;1"].getService(Ci.nsIEffectiveTLDService);
        selectedDomain = effectiveTLD.getBaseDomainFromHost(domain);
        break;
      } catch (e) {}
    case 3:
      selectedDomain = domain.replace(/^www\./, "");
      break;
    default:
      selectedDomain = domain;
      break;
  }
  domainData = {value: domain, selected: selectedDomain};

  fillDomains(domainData);
  fillNodes(nodeData);
  setAdvancedMode(document.documentElement.getAttribute("advancedMode") == "true");
  updateExpression();

  setTimeout(function() {
    document.getElementById("domainGroup").selectedItem.focus();
    if (document.getElementById("preview").checked)
      togglePreview(true);
  }, 0);
}

function updateExpression()
{
  var curNode = nodeData;

  function escapeName(name)
  {
    return name.replace(/([^\w\-])/g, "\\$1")
               .replace(/\\([\{\}])/g, escapeChar);
  }

  while (curNode)
  {
    let expression = (curNode.tagName.checked ? curNode.tagName.value : "");

    for (var i = 0; i < curNode.attributes.length; i++)
    {
      var attr = curNode.attributes[i];

      if (attr.checked) {
        var escapedName = escapeName(attr.name);
        if (attr.selected != "")
        {
          var op = "*=";
          if (attr.selected == attr.value)
            op = "=";
          else if (attr.value.substr(0, attr.selected.length) == attr.selected)
            op = "^=";
          else if (attr.value.substr(attr.value.length - attr.selected.length) == attr.selected)
            op = "$=";
  
          let useFallback = false;
          if (attr.name == "id" && op == "=")
            expression += "#" + escapeName(attr.selected).replace(/^([^a-zA-Z\\])/, escapeChar).replace(/\\(\s)$/, escapeChar);
          else if (attr.name == "class" && /\S/.test(attr.selected))
          {
            let knownClasses = {};
            for each (let cls in attr.value.split(/\s+/))
              knownClasses[cls] = true;

            let classes = attr.selected.split(/\s+/).filter(function(cls) cls != "");
            if (classes.every(function(cls) knownClasses.hasOwnProperty(cls)))
              expression += "." + classes.map(escapeName).join(".");
            else
              useFallback = true;
          }
          else
            useFallback = true;

          if (useFallback)
          {
            var escapedValue = attr.selected.replace(/(["\\])/g, '\\$1')
                                            .replace(/([\{\}])/g, escapeChar)
                                            .replace(/([^\S ])/g, escapeChar);
            expression += "[" + escapedName + op + '"' + escapedValue + '"' + "]";
          }
        }
        else
        {
          expression += "[" + escapedName + "]";
        }
      }
    }

    if (curNode.customCSS.checked && curNode.customCSS.selected != "")
    {
      expression += curNode.customCSS.selected
                                      .replace(/([\{\}])/g, escapeChar)
                                      .replace(/([^\S ])/g, escapeChar);
    }

    if ("firstChild" in curNode && curNode.firstChild.checked)
      expression += ":first-child";
    if ("lastChild" in curNode && curNode.lastChild.checked)
      expression += ":last-child";

    if (expression == "")
      expression = "*";

    curNode.expression = expression;

    if (curNode.prevSibling)
      curNode = curNode.prevSibling;
    else
      curNode = curNode.parentNode;
  }

  let expression = nodeData.expression;

  var isParent = false;
  var isRemoteParent = false;
  var siblingCount = 0;
  var firstRun = true;

  var curData = nodeData;
  while (curData) {
    if (!firstRun && curData.expression != "*") {
      var parentRelation = "";
      if (isRemoteParent)
        parentRelation = " ";
      else if (isParent)
        parentRelation = " > ";

      var siblingRelation = "";
      for (var i = 0; i < siblingCount; i++)
        siblingRelation += "* + ";
      siblingRelation = siblingRelation.replace(/^\*/, '');

      var relation;
      if (parentRelation != "" && siblingRelation != "")
        relation = siblingRelation + "*" + parentRelation;
      else if (parentRelation != "")
        relation = parentRelation;
      else
        relation = siblingRelation;

      expression = curData.expression + relation + expression;

      isParent = false;
      isRemoteParent = false;
      siblingCount = 0;
    }
    firstRun = false;

    if (curData.prevSibling) {
      siblingCount++;
      curData = curData.prevSibling;
    }
    else if (curData.parentNode) {
      siblingCount = 0;
      if (isParent)
        isRemoteParent = true;
      else
        isParent = true;
      curData = curData.parentNode;
    }
    else
      curData = null;
  }

  stylesheetData = expression + "{display: none !important;}";
  expression = domainData.selected + "##" + expression;

  document.getElementById("expression").value = expression;

  var tree = document.getElementById("nodes-tree");
  if (tree.view && tree.view.selection)
    tree.treeBoxObject.invalidateRow(tree.view.selection.currentIndex);

  if (previewStyle)
    previewStyle.textContent = stylesheetData;
}

function escapeChar(dummy, match)
{
  return "\\" + match.charCodeAt(0).toString(16) + " ";
}

function fillDomains(domainData) {
  var list = document.getElementById("domainGroup");

  var commandHandler = function() {
    changeDomain(this);
  };

  var node = document.createElement("radio");
  node.setAttribute("label", list.getAttribute("_labelnone"));
  node.setAttribute("value", "");
  node.addEventListener("command", commandHandler, false);
  if (domainData.selected == "")
    node.setAttribute("selected", "true");
  list.appendChild(node);

  var parts = domainData.value.split(".");
  if (parts[0] == "")
    parts.shift();

  for (var i = 1; i <= parts.length; i++) {
    if (parts[parts.length - i] == "")
      continue;

    var curDomain = parts.slice(parts.length - i).join(".");

    node = document.createElement("radio");
    node.setAttribute("label", curDomain)
    node.setAttribute("value", curDomain);
    node.addEventListener("command", commandHandler, false);
    if (domainData.selected == curDomain)
      node.setAttribute("selected", "true");
    list.appendChild(node);
  }
}

function fillNodes(nodeData) {
  var curContainer = document.createElement("treechildren");
  var curChildren = null;
  while (nodeData) {
    var id = "";
    var className = "";
    var i = 0;
    if (nodeData.attributes.length > i && nodeData.attributes[i].name == "id")
      id = nodeData.attributes[i++].value;
    if (nodeData.attributes.length > i && nodeData.attributes[i].name == "class")
      className = nodeData.attributes[i++].value;

    var item = document.createElement("treeitem");
    var row = document.createElement("treerow");

    var cell = document.createElement("treecell");
    cell.setAttribute("label", nodeData.tagName.value);
    row.appendChild(cell);

    cell = document.createElement("treecell");
    cell.setAttribute("label", id);
    row.appendChild(cell);

    cell = document.createElement("treecell");
    cell.setAttribute("label", className);
    row.appendChild(cell);

    item.appendChild(row);
    item.nodeData = nodeData;

    if (curChildren) {
      item.appendChild(curChildren);
      item.setAttribute("container", "true");
      item.setAttribute("open", "true");
    }
    curChildren = null;

    if (curContainer.firstChild)
      curContainer.insertBefore(item, curContainer.firstChild);
    else
      curContainer.appendChild(item);

    if (nodeData.prevSibling)
      nodeData = nodeData.prevSibling;
    else if (nodeData.parentNode) {
      curChildren = curContainer;
      curContainer = document.createElement("treechildren");
      nodeData = nodeData.parentNode;
    }
    else
      nodeData = null;
  }

  var tree = document.getElementById("nodes-tree");
  var body = document.getElementById("nodes-tree-children");
  while (curContainer.firstChild)
    body.appendChild(curContainer.firstChild);
}

function createAttribute(template, attr, text, value)
{
  template = E(template == "basic" ? "basicAttributeTemplate" : "advancedAttributeTemplate");

  let result = template.cloneNode(true);
  result.removeAttribute("id");
  result.removeAttribute("hidden");
  result.attr = attr;

  let checkbox = result.getElementsByClassName("checkbox")[0];
  checkbox.setAttribute("checked", attr.checked);
  checkbox.attr = attr;

  let label = result.getElementsByClassName("label");
  if (label.length)
  {
    label = label[0];
    label.setAttribute("value", text);

    let randID = "i" + String(Math.random()).replace(/\D/g, "");
    checkbox.setAttribute("id", randID);
    label.setAttribute("control", randID);
  }
  else
    checkbox.setAttribute("label", text);

  let textbox = result.getElementsByClassName("textbox");
  if (textbox.length)
  {
    textbox = textbox[0];
    textbox.setAttribute("value", value);
    textbox.attr = attr;
  }

  return result;
}

function fillAttributes(nodeData)
{
  selectedNode = nodeData;

  let list = document.getElementById("attributes-list");
  while(list.firstChild)
    list.removeChild(list.firstChild);

  // Add tag name entry
  let node = createAttribute("basic", nodeData.tagName, list.getAttribute("_labeltagname") + " " + nodeData.tagName.value);
  list.appendChild(node);

  // Add first/last child entries
  if (advancedMode && "firstChild" in nodeData)
  {
    node = createAttribute("basic", nodeData.firstChild, list.getAttribute("_labelfirstchild"));
    list.appendChild(node);
  }
  if (advancedMode && "lastChild" in nodeData)
  {
    node = createAttribute("basic", nodeData.lastChild, list.getAttribute("_labellastchild"));
    list.appendChild(node);
  }

  // Add attribute entries
  for (let i = 0; i < nodeData.attributes.length; i++)
  {
    let attr = nodeData.attributes[i];
    node = createAttribute(advancedMode ? "advanced" : "basic", attr, attr.name + ": " + attr.value, attr.selected);
    list.appendChild(node);
  }

  if (advancedMode)
  {
    // Add custom CSS entry
    node = createAttribute("advanced", nodeData.customCSS, list.getAttribute("_labelcustom"), nodeData.customCSS.selected);
    list.appendChild(node);
  }
}

function togglePreview(preview) {
  if (preview) {
    if (!previewStyle || !previewStyle.parentNode) {
      previewStyle = doc.createElementNS("http://www.w3.org/1999/xhtml", "style");
      previewStyle.setAttribute("type", "text/css");
      doc.documentElement.appendChild(previewStyle);
    }
    previewStyle.textContent = stylesheetData;
  }
  else {
    if (previewStyle && previewStyle.parentNode)
      previewStyle.parentNode.removeChild(previewStyle);
    previewStyle = null;
  }
}

function changeDomain(node) {
  domainData.selected = node.getAttribute("value");
  updateExpression();
}

function toggleAttr(node) {
  node.attr.checked = node.checked;
  updateExpression();
}

function setSelectedAttrValue(node) {
  node.attr.selected = node.value;
  if (node.attr.checked)
    updateExpression();
}

function setAdvancedMode(mode) {
  advancedMode = mode;

  var dialog = document.documentElement;
  dialog.setAttribute("advancedMode", advancedMode);

  var button = dialog.getButton("disclosure");
  button.setAttribute("label", dialog.getAttribute(advancedMode ? "buttonlabeldisclosure_off" : "buttonlabeldisclosure_on"));

  fillAttributes(nodeData);

  if (advancedMode) {
    setTimeout(function() {
      var tree = document.getElementById("nodes-tree");

      if (!treeView)
        treeView = new TreeView(tree);

      if (selectedNode) {
        // Expand all containers
        var items = tree.getElementsByTagName("treeitem");
        for (var i = 0; i < items.length; i++)
          if (items[i].getAttribute("container") == "true")
            items[i].setAttribute("open", "true");

        tree.treeBoxObject.ensureRowIsVisible(tree.view.rowCount - 1);
        tree.view.selection.select(tree.view.rowCount - 1);
      }
    }, 0);
  }
}

function updateNodeSelection() {
  var tree = document.getElementById("nodes-tree");
  var selection = tree.view.selection;
  if (selection.count < 1)
    return;

  var min = {};
  selection.getRangeAt(0, min, {});

  var item = tree.view
                 .QueryInterface(Ci.nsITreeContentView)
                 .getItemAtIndex(min.value);
  if (!item || !item.nodeData)
    return;

  fillAttributes(item.nodeData);
}

function addExpression()
{
  AdblockPlus.addPatterns([document.getElementById("expression").value]);

  togglePreview(false);
}
