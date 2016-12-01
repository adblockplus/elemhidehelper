/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

let console;
try
{
  // Gecko 44+
  ({console} = Cu.import("resource://gre/modules/Console.jsm", {}));
}
catch (e)
{
  ({console} = Cu.import("resource://gre/modules/devtools/Console.jsm", {}));
}

let DebuggerServer;
try
{
  // Firefox 44+
  let {require} = Cu.import("resource://devtools/shared/Loader.jsm", {});
  ({DebuggerServer} = require("devtools/server/main"));
}
catch (e)
{
  ({DebuggerServer} = Cu.import("resource://gre/modules/devtools/dbg-server.jsm", {}));
}

let {getNodeInfo} = require("./nodeInfo");

function Actor(connection, tabActor)
{
}

Actor.prototype = {
  requestTypes: {
    nodeinfo: function(request, connection)
    {
      let nodeActor = connection.getActor(request.nodeActor);
      return getNodeInfo(nodeActor ? nodeActor.rawNode : null);
    }
  }
};

let name = "elemhidehelper";
let actor = {
  constructorFun: Actor,
  constructorName: name,
  name: name
};

DebuggerServer.addTabActor(actor, name);
onShutdown.add(() =>
{
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
});
