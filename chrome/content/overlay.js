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
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

window.addEventListener("load", ehhInit, false);

function ehhInit() {
  if (document.getElementById("abp-status-popup"))
    document.getElementById("abp-status-popup").addEventListener("popupshowing", ehhFillPopup, false);
  if (document.getElementById("abp-toolbar-popup"))
    document.getElementById("abp-toolbar-popup").addEventListener("popupshowing", ehhFillPopup, false);
  window.addEventListener("blur", ehhHideTooltips, true);
  getBrowser().addEventListener("select", ehhStop, false);

  // Make sure we configure the shortcut key even if the default pref isn't there
  var prefService = Components.classes["@mozilla.org/preferences-service;1"]
                              .getService(Components.interfaces.nsIPrefService);
  var branch = prefService.getBranch("extensions.adblockplus.");
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
      key = branch.setCharPref("protectchrome.ehh", "elemhidehelper");
    } catch(e) {}
  }
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

  var enabled = (window.content && 
                 content.document instanceof HTMLDocument &&
                 content.document.body &&
                 content.location.href != "about:blank" &&
                 content.location.hostname != "");
  var running = (enabled && window.content == ehhAardvark.wnd);

  document.getElementById(popup + "ehh-selectelement").setAttribute("disabled", !enabled);
  document.getElementById(popup + "ehh-selectelement").hidden = running;
  document.getElementById(popup + "ehh-stopselection").hidden = !running;
}

function ehhSelectElement() {
  var wnd = window.content;
  if (!content || !content.document)
    return;

  if (wnd == ehhAardvark.wnd) {
    ehhStop();
    return;
  }

  ehhAardvark.start(wnd);
}

function ehhStop() {
  ehhAardvark.quit();
}
