/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

(function()
{
  const Cu = Components.utils;

  let rand = Components.stack.filename.replace(/.*\?/, "");
  let module = "chrome://elemhidehelper/content/actor.jsm?" + rand;
  let {shutdown, getNodeInfo, togglePreview, forgetNode} = Cu.import(module, {});

  addMessageListener("ElemHideHelper:Shutdown", onShutdown);
  addMessageListener("ElemHideHelper:GetNodeInfo", onGetNodeInfo);
  addMessageListener("ElemHideHelper:Preview", onTogglePreview);

  function onShutdown()
  {
    shutdown();
    Cu.unload(module);
    removeMessageListener("ElemHideHelper:Shutdown", onShutdown);
    removeMessageListener("ElemHideHelper:GetNodeInfo", onGetNodeInfo);
    removeMessageListener("ElemHideHelper:Preview", onTogglePreview);
  }

  function onGetNodeInfo(message)
  {
    let nodeInfo = getNodeInfo(message.objects.element);
    nodeInfo.messageId = message.data;
    sendAsyncMessage("ElemHideHelper:GetNodeInfo:Response", nodeInfo);
  }

  function onTogglePreview(message)
  {
    togglePreview(message.data.nodeID, message.data.stylesheetData);
    if (message.data.forgetNode)
      forgetNode(message.data.nodeID);
  }
})();
