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
  let {shutdown, getNodeInfo} = Cu.import(module, {});

  addMessageListener("ElemHideHelper:Shutdown", onShutdown);
  addMessageListener("ElemHideHelper:GetNodeInfo", onGetNodeInfo);

  function onShutdown()
  {
    shutdown();
    Cu.unload(module);
    removeMessageListener("ElemHideHelper:Shutdown", onShutdown);
    removeMessageListener("ElemHideHelper:GetNodeInfo", onGetNodeInfo);
  }

  function onGetNodeInfo(message)
  {
    let info = getNodeInfo(message.objects.element);
    message.objects.callback(info.nodeData, info.host);
  }
})();
