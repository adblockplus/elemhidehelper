/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

let EXPORTED_SYMBOLS = ["shutdown", "getNodeInfo"];

const Ci = Components.interfaces;
const Cu = Components.utils;

let {console} = Cu.import("resource://gre/modules/devtools/Console.jsm", {});
let {DebuggerServer} = Cu.import("resource://gre/modules/devtools/dbg-server.jsm", {});
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
      DebuggerServer.removeTabActor(actor);
    executed = true;
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
      if (!nodeActor || !nodeActor.rawNode ||
          nodeActor.rawNode.nodeType != Ci.nsIDOMNode.ELEMENT_NODE)
      {
        return {};
      }

      return getNodeInfo(nodeActor.rawNode);
    }
  }
};

function getNodeInfo(node)
{
  return {
    host: node.ownerDocument.defaultView.location.hostname,
    nodeData: getNodeData(node)
  };
}

function getNodeData(node, parentNode)
{
  if (!node)
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
