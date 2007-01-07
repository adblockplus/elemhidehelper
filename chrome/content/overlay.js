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
  document.getElementById("abp-status-popup").addEventListener("popupshowing", ehhFillPopup, false);
  document.getElementById("abp-toolbar-popup").addEventListener("popupshowing", ehhFillPopup, false);
  window.addEventListener("blur", ehhHideTooltips, true);
  getBrowser().addEventListener("select", ehhStop, false);
}

function ehhHideTooltips() {
  document.getElementById("ehh-helpbox").hidePopup();
  document.getElementById("ehh-commandlabel").hidePopup();
}

function ehhFillPopup() {
  var enabled = (window.content && content.document instanceof HTMLDocument && content.location.href != "about:blank");
  var running = (enabled && window.content == ehhAardvark.wnd);

  document.getElementById("abp-status-ehh-selectelement").setAttribute("disabled", !enabled);
  document.getElementById("abp-toolbar-ehh-selectelement").setAttribute("disabled", !enabled);

  document.getElementById("abp-status-ehh-selectelement").hidden = running;
  document.getElementById("abp-toolbar-ehh-selectelement").hidden = running;

  document.getElementById("abp-status-ehh-stopselection").hidden = !running;
  document.getElementById("abp-toolbar-ehh-stopselection").hidden = !running;
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
