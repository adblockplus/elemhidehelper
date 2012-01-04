/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");

function loadDefaultPrefs(installPath)
{
  try
  {
    let baseURI = Services.io.newFileURI(installPath);
    let uri;
    if (installPath.isDirectory())
      uri = Services.io.newURI("defaults/preferences/prefs.js", null, baseURI).spec;
    else
      uri = "jar:" + baseURI.spec + "!/defaults/preferences/prefs.js";

    let branch = Services.prefs.getDefaultBranch("");
    let scope =
    {
      pref: function(pref, value)
      {
        switch (typeof value)
        {
          case "boolean":
            branch.setBoolPref(pref, value);
            break;
          case "number":
            branch.setIntPref(pref, value);
            break;
          case "string":
            let str = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
            str.data = value;
            branch.setComplexValue(pref, Ci.nsISupportsString, str);
            break;
        }
      }
    };
    Services.scriptloader.loadSubScript(uri, scope);
  }
  catch(e)
  {
    Cu.reportError(e);
  }
}
