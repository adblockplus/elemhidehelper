/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

let EXPORTED_SYMBOLS = ["shutdown", "getNodeInfo", "togglePreview",
                        "forgetNode"];

const Ci = Components.interfaces;
const Cu = Components.utils;

let {console} = Cu.import("resource://gre/modules/devtools/Console.jsm", {});
let {DebuggerServer} = Cu.import("resource://gre/modules/devtools/dbg-server.jsm", {});
let {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

let processID = Services.appinfo.processID;
let maxNodeID = 0;
let nodes = new Map();

let name = "elemhidehelper";
let actor = {
  constructorFun: Actor,
  constructorName: name,
  name: name
};

DebuggerServer.addTabActor(actor, name);

let shutdown = (function()
{
  let executed = false;
  return function()
  {
    if (!executed)
    {
      executed = true;
      try
      {
        DebuggerServer.removeTabActor(actor);
      }
      catch (e)
      {
        // The call above will throw in the content process despite succeeding,
        // see https://bugzilla.mozilla.org/show_bug.cgi?id=1189780.
        Cu.reportError(e);
      }
    }
  }
})();

function Actor(connection, tabActor)
{
}

Actor.prototype = {
  requestTypes: {
    nodeinfo: function(request, connection)
    {
      let nodeActor = connection.getActor(request.nodeActor);
      return getNodeInfo(nodeActor ? nodeActor.rawNode: null);
    }
  }
};

function getNodeInfo(node)
{
  let nodeData = getNodeData(node);
  if (nodeData)
  {
    let nodeID = processID + "-" + (++maxNodeID);
    nodes.set(nodeID, {document: node.ownerDocument, style: null});
    return {
      host: node.ownerDocument.defaultView.location.hostname,
      nodeData: nodeData,
      nodeID: nodeID
    };
  }

  return {};
}

function getNodeData(node, parentNode)
{
  if (!node || node.nodeType != Ci.nsIDOMNode.ELEMENT_NODE)
    return null;

  let result = {};
  result.tagName = {value: node.tagName, checked: false};

  if (typeof parentNode != "undefined")
    result.parentNode = parentNode;
  else
    result.parentNode = getNodeData(node.parentElement);

  let prevSibling = node.previousElementSibling;
  result.prevSibling = getNodeData(prevSibling, result.parentNode);

  if (result.parentNode && !prevSibling)
    result.firstChild = {checked: false};

  let nextSibling = node.nextElementSibling;
  if (result.parentNode && !nextSibling)
    result.lastChild = {checked: false};

  result.attributes = [];
  for (let attribute of node.attributes)
  {
    let data = {
      name: attribute.name,
      value: attribute.value,
      selected: attribute.value,
      checked: false
    };
    if (data.name == "id" || data.name == "class")
      result.attributes.unshift(data);
    else
      result.attributes.push(data);
  }

  if (result.attributes.length >= 2 && result.attributes[1].name == "id")
  {
    // Make sure ID attribute comes first
    let tmp = result.attributes[1];
    result.attributes[1] = result.attributes[0];
    result.attributes[0] = tmp;
  }

  result.customCSS = {selected: "", checked: false};
  return result;
}

function togglePreview(nodeID, stylesheetData)
{
  let context = nodes.get(nodeID);
  if (!context)
    return;

  if (stylesheetData)
  {
    if (!context.style || !context.style.parentNode)
    {
      context.style = context.document.createElementNS(
          "http://www.w3.org/1999/xhtml", "style");
      context.style.setAttribute("type", "text/css");
      context.document.documentElement.appendChild(context.style);
    }
    context.style.textContent = stylesheetData;
  }
  else
  {
    try
    {
      if (context.style && context.style.parentNode)
        context.style.parentNode.removeChild(context.style);
      context.style = null;
    }
    catch (e)
    {
      // If the window was closed (reloaded) we end up with a dead object
      // reference (https://bugzilla.mozilla.org/show_bug.cgi?id=695480). Just
      // forget this node then.
      forgetNode(nodeID);
    }
  }
}

function forgetNode(nodeID)
{
  nodes.delete(nodeID);
}
