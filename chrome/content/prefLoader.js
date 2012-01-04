/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Element Hiding Helper for Adblock Plus.
 *
 * The Initial Developer of the Original Code is
 * Wladimir Palant.
 * Portions created by the Initial Developer are Copyright (C) 2006-2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

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
