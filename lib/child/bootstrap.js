/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

(function(messageManager)
{
  const Cc = Components.classes;
  const Ci = Components.interfaces;
  const Cr = Components.results;
  const Cu = Components.utils;

  let {Loader, main, unload} = Cu.import(
    "resource://gre/modules/commonjs/toolkit/loader.js", {}
  );
  let {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

  Cu.importGlobalProperties(["atob", "btoa", "File", "URL", "URLSearchParams",
      "TextDecoder", "TextEncoder"]);

  let shutdownHandlers = [];
  let onShutdown =
  {
    done: false,
    add: function(handler)
    {
      if (shutdownHandlers.indexOf(handler) < 0)
        shutdownHandlers.push(handler);
    },
    remove: function(handler)
    {
      let index = shutdownHandlers.indexOf(handler);
      if (index >= 0)
        shutdownHandlers.splice(index, 1);
    }
  };

  function init()
  {
    let url = new URL(Components.stack.filename);
    let params = new URLSearchParams(url.search.substr(1));
    let info = JSON.parse(params.get("info"));

    let loader = Loader({
      paths: {
        "": info.addonRoot + "lib/"
      },
      globals: {
        Components, Cc, Ci, Cu, Cr, atob, btoa, File, URL, URLSearchParams,
        TextDecoder, TextEncoder, onShutdown
      },
      modules: {
        info, messageManager
      },
      id: info.addonID
    });
    onShutdown.add(() => unload(loader, "disable"))

    main(loader, "child/main");
  }

  function shutdown(message)
  {
    if (onShutdown.done)
      return;

    onShutdown.done = true;
    for (let i = shutdownHandlers.length - 1; i >= 0; i --)
    {
      try
      {
        shutdownHandlers[i]();
      }
      catch (e)
      {
        Cu.reportError(e);
      }
    }
    shutdownHandlers = null;
  }

  messageManager.addMessageListener("ElemHideHelper:Shutdown", shutdown);
  onShutdown.add(() =>
  {
    messageManager.removeMessageListener("ElemHideHelper:Shutdown", shutdown);
  });

  init();
})(this);
