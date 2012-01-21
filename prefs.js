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

let {addonRoot} = require("info");

let Prefs = exports.Prefs =
{
  branch: null,
  ignorePrefChanges: false,

  init: function(branchName)
  {
    if (this.branch)
      return;
    this.branch = Services.prefs.getBranch(branchName);

    /**
     * Sets up getter/setter on Prefs object for preference.
     */
    function defineProperty(/**String*/ name, defaultValue, /**Function*/ readFunc, /**Function*/ writeFunc)
    {
      let value = defaultValue;
      this["_update_" + name] = function()
      {
        try
        {
          value = readFunc.call(this);
        }
        catch(e)
        {
          Cu.reportError(e);
        }
      };
      Prefs.__defineGetter__(name, function() value);
      Prefs.__defineSetter__(name, function(newValue)
      {
        if (value == newValue)
          return value;

        try
        {
          this.ignorePrefChanges = true;
          writeFunc.call(this, newValue);
          value = newValue;
        }
        catch(e)
        {
          Cu.reportError(e);
        }
        finally
        {
          this.ignorePrefChanges = false;
        }
        return value;
      });
      this["_update_" + name]();
    }

    /**
     * Sets up getter/setter on Prefs object for an integer preference.
     */
    function defineIntegerProperty(/**String*/ name)
    {
      defineProperty.call(this, name, 0,
                          function() this.branch.getIntPref(name),
                          function(newValue) this.branch.setIntPref(name, newValue));
    }

    /**
     * Sets up getter/setter on Prefs object for a boolean preference.
     */
    function defineBooleanProperty(/**String*/ name)
    {
      defineProperty.call(this, name, false,
                          function() this.branch.getBoolPref(name),
                          function(newValue) this.branch.setBoolPref(name, newValue));
    }

    /**
     * Sets up getter/setter on Prefs object for a string preference.
     */
    function defineStringProperty(/**String*/ name)
    {
      defineProperty.call(this, name, "",
                          function() this.branch.getComplexValue(name, Ci.nsISupportsString).data,
                          function(newValue)
                          {
                            let str = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
                            str.data = newValue;
                            this.branch.setComplexValue(name, Ci.nsISupportsString, str);
                          });
    }

    /**
     * Sets up getter/setter on Prefs object for a JSON-encoded preference.
     */
    function defineJSONProperty(/**String*/ name)
    {
      defineProperty.call(this, name, "",
                          function() JSON.parse(this.branch.getComplexValue(name, Ci.nsISupportsString).data),
                          function(newValue)
                          {
                            let str = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
                            str.data = JSON.stringify(newValue);
                            this.branch.setComplexValue(name, Ci.nsISupportsString, str);
                          });
    }

    // Load default preferences and set up properties for them
    let defaultBranch = Services.prefs.getDefaultBranch(branchName);
    let scope =
    {
      pref: function(pref, value)
      {
        if (pref.substr(0, branchName.length) != branchName)
        {
          Cu.reportError(new Error("Ignoring default preference " + pref + ", wrong branch."));
          return;
        }
        pref = pref.substr(branchName.length);

        switch(typeof value)
        {
          case "boolean":
          {
            defaultBranch.setBoolPref(pref, value);
            defineBooleanProperty.call(Prefs, pref);
            break;
          }
          case "number":
          {
            defaultBranch.setIntPref(pref, value);
            defineIntegerProperty.call(Prefs, pref);
            break;
          }
          case "string":
          {
            let str = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
            str.data = value;
            defaultBranch.setComplexValue(pref, Ci.nsISupportsString, str);
            defineStringProperty.call(Prefs, pref);
            break;
          }
          case "object":
          {
            let str = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
            str.data = JSON.stringify(value);
            defaultBranch.setComplexValue(pref, Ci.nsISupportsString, str);
            defineJSONProperty.call(Prefs, pref);
            break;
          }
        }
      }
    };
    Services.scriptloader.loadSubScript(addonRoot + "defaults/preferences/prefs.js", scope);

    // Add preference change observer
    try
    {
      this.branch.QueryInterface(Ci.nsIPrefBranch2)
                 .addObserver("", this, true);
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
    if (!this.branch)
      return;

    try
    {
      this.branch.QueryInterface(Ci.nsIPrefBranch2)
                 .removeObserver("", this);
    }
    catch (e)
    {
      Cu.reportError(e);
    }
    this.branch = null;
  },

  observe: function(subject, topic, data)
  {
    if (this.ignorePrefChanges || topic != "nsPref:changed")
      return;

    if ("_update_" + data in this)
      this["_update_" + data]();
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsISupportsWeakReference, Ci.nsIObserver])
};
