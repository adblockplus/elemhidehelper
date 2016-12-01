/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

let messageManager = require("messageManager");
let {forgetNode, getNodeById} = require("./nodeInfo");

messageManager.addMessageListener("ElemHideHelper:Preview", onTogglePreview);
onShutdown.add(() =>
{
  messageManager.removeMessageListener("ElemHideHelper:Preview", onTogglePreview);
});

function onTogglePreview(message)
{
  togglePreview(message.data.nodeID, message.data.stylesheetData);
  if (message.data.forgetNode)
    forgetNode(message.data.nodeID);
}

function togglePreview(nodeID, stylesheetData)
{
  let context = getNodeById(nodeID);
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
