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

  if (document.getElementById("abp-status-popup"))
    document.getElementById("abp-status-popup").addEventListener("popupshowing", ehhFillPopup, false);
  if (document.getElementById("abp-toolbar-popup"))
    document.getElementById("abp-toolbar-popup").addEventListener("popupshowing", ehhFillPopup, false);
  window.addEventListener("blur", ehhHideTooltips, true);
  ehhGetBrowser().addEventListener("select", ehhStop, false);

  // Make sure we configure the shortcut key even if the default pref isn't there
  if (window.abpConfigureKey) {
    var defaultBranch = prefService.getDefaultBranch("extensions.adblockplus.");
    try {
      // Seems to be the only way to test whether the pref really exists in the default branch
      defaultBranch.getCharPref("ehh-selectelement_key");
    }
    catch(e) {
      var key = "Accel Shift H";
      try {
        key = branch.getCharPref("ehh-selectelement_key");
      } catch(e2) {}
      abpConfigureKey("ehh-selectelement", key);
    }
  }

  // Make sure chrome protection works in SeaMonkey
  if (branch.getPrefType("protectchrome.ehh") != branch.PREF_STRING) {
    try {
      branch.setCharPref("protectchrome.ehh", "elemhidehelper");
    } catch(e) {}
  }
}

function ehhGetBrowser() {
  if ("getBrowser" in window)
    return getBrowser();
  else if ("messageContent" in window)
    return window.messageContent;
  else if (document.getElementById("frame_main_pane"))
    return document.getElementById("frame_main_pane");
  else
    return null;
}

function ehhHideTooltips() {
  document.getElementById("ehh-helpbox").hidePopup();
  document.getElementById("ehh-commandlabel").hidePopup();
  document.getElementById("ehh-viewsource").hidePopup();
}

function ehhDisableElement(id, disable) {
  var element = document.getElementById();
  if (element)
    element.setAttribute("disabled", disable);
}

function ehhHideElement(id, hide) {
  var element = document.getElementById();
  if (element)
    element.hidden = hide;
}

function ehhFillPopup(event) {
  var popup = event.target.getAttribute("id");
  if (popup.match(/-/g).length != 2)
    return;

  popup = popup.replace(/popup$/, '');

  var browser = ehhGetBrowser();
  var enabled = ehhCanSelect(browser);
  var running = (enabled && browser == ehhAardvark.browser);

  document.getElementById(popup + "ehh-selectelement").setAttribute("disabled", !enabled);
  document.getElementById(popup + "ehh-selectelement").hidden = running;
  document.getElementById(popup + "ehh-stopselection").hidden = !running;
}

function ehhCanSelect(browser) {
  if (!browser || !browser.contentWindow || 
      !(browser.contentDocument instanceof HTMLDocument) ||
      !browser.contentDocument.body)
    return false;

  var location = browser.contentWindow.location;
  if (location.href == "about:blank")
    return false;

  if (location.hostname == "" &&
      location.protocol != "mailbox:" &&
      location.protocol != "imap:" &&
      location.protocol != "news:" &&
      location.protocol != "snews:")
    return false;

  return true;
}

function ehhSelectElement() {
  var browser = ehhGetBrowser();
  if (!browser.contentWindow || !browser.contentDocument)
    return;

  if (browser == ehhAardvark.browser) {
    ehhStop();
    return;
  }

  ehhAardvark.start(browser);
}

function ehhStop() {
  ehhAardvark.quit();
}
