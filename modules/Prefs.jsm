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
 * The Original Code is Adblock Plus Element Hiding Helper.
 *
 * The Initial Developer of the Original Code is
 * Wladimir Palant.
 * Portions created by the Initial Developer are Copyright (C) 2006-2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

var EXPORTED_SYMBOLS = ["Prefs"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

const prefRoot = "extensions.elemhidehelper.";

let prefService = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService);
let branch = prefService.getBranch(prefRoot);

var Prefs =
{
  initialized: false,

  startup: function()
  {
    this.initialized = true;

    let defaultBranch = prefService.getDefaultBranch(prefRoot);
    for each (let name in defaultBranch.getChildList("", {}))
    {
      let type = defaultBranch.getPrefType(name);
      switch (type)
      {
        case Ci.nsIPrefBranch.PREF_INT:
          PrefsPrivate.defineIntegerProperty(name);
          break;
        case Ci.nsIPrefBranch.PREF_BOOL:
          PrefsPrivate.defineBooleanProperty(name);
          break;
        case Ci.nsIPrefBranch.PREF_STRING:
          PrefsPrivate.defineStringProperty(name);
          break;
      }
      if ("_update_" + name in PrefsPrivate)
        PrefsPrivate["_update_" + name]();
    }

    try
    {
      branch.QueryInterface(Ci.nsIPrefBranch2)
            .addObserver("", PrefsPrivate, true);
    }
    catch (e)
    {
      Cu.reportError(e);
    }

    // Preferences used to be stored in Adblock Plus branch, import
    let importBranch = prefService.getBranch("extensions.adblockplus.");
    if (importBranch.prefHasUserValue("ehh-selectelement_key") && importBranch.getPrefType("ehh-selectelement_key") == Ci.nsIPrefBranch.PREF_STRING)
    {
      Prefs.selectelement_key = importBranch.getCharPref("ehh-selectelement_key");
      importBranch.clearUserPref("ehh-selectelement_key");
    }
    if (importBranch.prefHasUserValue("ehh.showhelp") && importBranch.getPrefType("ehh.showhelp") == Ci.nsIPrefBranch.PREF_BOOL)
    {
      Prefs.showhelp = importBranch.getBoolPref("ehh.showhelp");
      importBranch.clearUserPref("ehh.showhelp");
    }
  }
};

var PrefsPrivate =
{
  ignorePrefChanges: false,

  defineIntegerProperty: function(name)
  {
    let value = 0;
    PrefsPrivate["_update_" + name] = function()
    {
      try
      {
        value = branch.getIntPref(name);
      }
      catch(e)
      {
        Cu.reportError(e);
      }
    }
    Prefs.__defineGetter__(name, function() value);
    Prefs.__defineSetter__(name, function(newValue)
    {
      try
      {
        PrefsPrivate.ignorePrefChanges = true;
        branch.setIntPref(name, newValue);
        value = newValue;
      }
      catch(e)
      {
        Cu.reportError(e);
      }
      finally
      {
        PrefsPrivate.ignorePrefChanges = false;
      }
      return value;
    });
  },

  defineBooleanProperty: function(name)
  {
    let value = false;
    PrefsPrivate["_update_" + name] = function()
    {
      try
      {
        value = branch.getBoolPref(name);
      }
      catch(e)
      {
        Cu.reportError(e);
      }
    }
    Prefs.__defineGetter__(name, function() value);
    Prefs.__defineSetter__(name, function(newValue)
    {
      try
      {
        PrefsPrivate.ignorePrefChanges = true;
        branch.setBoolPref(name, newValue);
        value = newValue;
      }
      catch(e)
      {
        Cu.reportError(e);
      }
      finally
      {
        PrefsPrivate.ignorePrefChanges = false;
      }
      return value;
    });
  },

  defineStringProperty: function(name)
  {
    let value = "";
    PrefsPrivate["_update_" + name] = function()
    {
      try
      {
        value = branch.getComplexValue(name, Ci.nsISupportsString).data;
      }
      catch(e)
      {
        Cu.reportError(e);
      }
    }
    Prefs.__defineGetter__(name, function() value);
    Prefs.__defineSetter__(name, function(newValue)
    {
      try
      {
        PrefsPrivate.ignorePrefChanges = true;
        let str = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
        str.data = newValue;
        branch.setComplexValue(name, Ci.nsISupportsString, str);
        value = newValue;
      }
      catch(e)
      {
        Cu.reportError(e);
      }
      finally
      {
        PrefsPrivate.ignorePrefChanges = false;
      }
      return value;
    });
  },

  observe: function(subject, topic, data)
  {
    if (PrefsPrivate.ignorePrefChanges || topic != "nsPref:changed")
      return;

    if ("_update_" + data in PrefsPrivate)
      PrefsPrivate["_update_" + data]();
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsISupportsWeakReference, Ci.nsIObserver])
}
