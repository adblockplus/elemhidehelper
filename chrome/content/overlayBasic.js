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
 * Portions created by the Initial Developer are Copyright (C) 2006-2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

window.addEventListener("load", ehhInit, false);

function ehhInit() {
  var prefService = Components.classes["@mozilla.org/preferences-service;1"]
                              .getService(Components.interfaces.nsIPrefService);
  var branch = prefService.getBranch("extensions.adblockplus.");

  // Check whether ABP is installed and has at least the required version
  var requiredVersion = "0.7.5";
  var installedVersion = "0";
  try {
    var abp = Components.classes["@mozilla.org/adblockplus;1"]
                        .createInstance().wrappedJSObject;
    installedVersion = abp.getInstalledVersion();
  } catch(e) {}

  var parts1 = requiredVersion.split(".");
  var parts2 = installedVersion.split(".");
  var mustUpdate = false;
  for (var i = 0; i < parts1.length; i++) {
    if (parts2.length <= i || parseInt(parts1[i]) > parseInt(parts2[i])) {
      mustUpdate = true;
      break;
    }
    if (parseInt(parts1[i]) < parseInt(parts2[i]))
      break;
  }

  // Show warning about required ABP update if necessary
  if (mustUpdate) {
    var noWarning = {value: false};
    try {
      noWarning.value = branch.getBoolPref("ehh.norequirementswarning");
    } catch(e) {}

    if (!noWarning.value) {
      // Make sure we don't show the warning twice
      var hiddenWnd = Components.classes["@mozilla.org/appshell/appShellService;1"]
                                .getService(Components.interfaces.nsIAppShellService)
                                .hiddenDOMWindow;
      if ("ehhNoRequirementsWarning" in hiddenWnd)
        noWarning.value = true;
      else
        hiddenWnd.ehhNoRequirementsWarning = true;
    }

    if (!noWarning.value) {
      setTimeout(function() {
        var stringService = Components.classes["@mozilla.org/intl/stringbundle;1"]
                                      .getService(Components.interfaces.nsIStringBundleService);
        var strings = stringService.createBundle("chrome://elemhidehelper/locale/global.properties");
        var promptService = Components.classes['@mozilla.org/embedcomp/prompt-service;1']
                                      .getService(Components.interfaces.nsIPromptService);
        promptService.alertCheck(window,
            strings.GetStringFromName("noabp_warning_title"),
            strings.formatStringFromName("noabp_warning_text", [requiredVersion], 1),
            strings.GetStringFromName("noabp_warning_disable"),
            noWarning);

        if (noWarning.value) {
          try {
            branch.setBoolPref("ehh.norequirementswarning", true);
          } catch(e) {}
        }
      }, 0);
    }
    return;
  }

  ehhInit2();
}