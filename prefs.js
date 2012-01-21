/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

let prefRoot = null;
let branch = null;

let Prefs = exports.Prefs =
{
  init: function(root)
  {
    if (prefRoot)
      return;
    prefRoot = root;
    branch = Services.prefs.getBranch(prefRoot);

    let defaultBranch = Services.prefs.getDefaultBranch(prefRoot);
    for each (let name in defaultBranch.getChildList("", {}))
    {
      let type = defaultBranch.getPrefType(name);
      switch (type)
      {
        case Ci.nsIPrefBranch.PREF_INT:
          defineIntegerProperty(name);
          break;
        case Ci.nsIPrefBranch.PREF_BOOL:
          defineBooleanProperty(name);
          break;
        case Ci.nsIPrefBranch.PREF_STRING:
          defineStringProperty(name);
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
    let importBranch = Services.prefs.getBranch("extensions.adblockplus.");
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
  },

  shutdown: function()
  {
    if (!prefRoot)
      return;
    prefRoot = null;

    try
    {
      branch.QueryInterface(Ci.nsIPrefBranch2)
            .removeObserver("", PrefsPrivate);
    }
    catch (e)
    {
      Cu.reportError(e);
    }
    branch = null;
  }
};

let PrefsPrivate =
{
  ignorePrefChanges: false,

  observe: function(subject, topic, data)
  {
    if (PrefsPrivate.ignorePrefChanges || topic != "nsPref:changed")
      return;

    if ("_update_" + data in PrefsPrivate)
      PrefsPrivate["_update_" + data]();
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsISupportsWeakReference, Ci.nsIObserver])
}

/**
 * Sets up getter/setter on Prefs object for preference.
 */
function defineProperty(/**String*/ name, defaultValue, /**Function*/ readFunc, /**Function*/ writeFunc)
{
  let value = defaultValue;
  PrefsPrivate["_update_" + name] = function()
  {
    try
    {
      value = readFunc();
    }
    catch(e)
    {
      Cu.reportError(e);
    }
  }
  Prefs.__defineGetter__(name, function() value);
  Prefs.__defineSetter__(name, function(newValue)
  {
    if (value == newValue)
      return value;

    try
    {
      PrefsPrivate.ignorePrefChanges = true;
      writeFunc(newValue);
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
}

/**
 * Sets up getter/setter on Prefs object for an integer preference.
 */
function defineIntegerProperty(/**String*/ name)
{
  defineProperty(name, 0, function() branch.getIntPref(name),
                          function(newValue) branch.setIntPref(name, newValue));
}

/**
 * Sets up getter/setter on Prefs object for a boolean preference.
 */
function defineBooleanProperty(/**String*/ name)
{
  defineProperty(name, false, function() branch.getBoolPref(name),
                              function(newValue) branch.setBoolPref(name, newValue));
}

/**
 * Sets up getter/setter on Prefs object for a string preference.
 */
function defineStringProperty(/**String*/ name)
{
  defineProperty(name, "", function() branch.getComplexValue(name, Ci.nsISupportsString).data,
    function(newValue)
    {
      let str = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
      str.data = newValue;
      branch.setComplexValue(name, Ci.nsISupportsString, str);
    });
}
