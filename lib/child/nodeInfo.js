/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

let {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

let messageManager = require("messageManager");

let processID = Services.appinfo.processID;
let maxNodeID = 0;
let nodes = new Map();

messageManager.addMessageListener("ElemHideHelper:GetNodeInfo", onGetNodeInfo);
onShutdown.add(() =>
{
  messageManager.removeMessageListener("ElemHideHelper:GetNodeInfo",
                                       onGetNodeInfo);
});

function onGetNodeInfo(message)
{
  if (Cu.isCrossProcessWrapper(message.objects.element))
    return;

  let nodeInfo = getNodeInfo(message.objects.element);
  nodeInfo.messageId = message.data;
  messageManager.sendAsyncMessage("ElemHideHelper:GetNodeInfo:Response",
                                  nodeInfo);
}

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
exports.getNodeInfo = getNodeInfo;

function getNodeById(nodeId)
{
  return nodes.get(nodeId);
}
exports.getNodeById = getNodeById;

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

function forgetNode(nodeID)
{
  nodes.delete(nodeID);
}
exports.forgetNode = forgetNode;
