/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

let {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

let messageManager = require("messageManager");
let {
  createElement, getWindowSize, getParentElement, getElementPosition
} = require("./utils");

/**
 * @typedef State
 * @type {Object}
 * @property {Window} window
 *   The top-level window that we are selecting in.
 * @property {Element} boxElement
 *   The element marking the current selection.
 * @property {Element} anchorElement
 *   The element that received the last mouse event.
 * @property {Element} selectedElement
 *   The element currently selected (usually anchorElement or a parent element
 *   of it).
 * @property {boolean} isUserSelected
 *   Will be true if the user narrowed down the selection to a specific element
 *   using wider/narrower commands.
 * @property {Element} lockedAnchor
 *   When selection is locked, this property will be updated by mouse events
 *   instead of anchorElement.
 * @property {number} prevSelectionUpdate
 *   Time of previous selection update, used for rate limiting.
 * @property {Object} prevPos
 *   Position and size of selected element during previous selection update.
 */

/**
 * Current selection state. This object will be empty if no selection is
 * currently in progress.
 *
 * @type {State}
 */
let state = exports.state = {};

messageManager.addMessageListener("ElemHideHelper:StartSelection", startSelection);

onShutdown.add(() =>
{
  messageManager.removeMessageListener("ElemHideHelper:StartSelection", startSelection);

  stopSelection();
});

function startSelection(message)
{
  stopSelection();

  let outerWindowID = message.data;
  let wnd = Services.wm.getOuterWindowWithId(outerWindowID);
  if (!wnd || !canSelect(wnd))
    return;

  state.window = wnd;

  wnd.addEventListener("click", onMouseClick, true);
  wnd.addEventListener("wheel", onMouseScroll, true);
  wnd.addEventListener("mousemove", onMouseMove, true);
  wnd.addEventListener("pagehide", onPageHide, true);

  wnd.focus();

  let doc = wnd.document;
  let {elementMarkerClass} = require("info");
  state.boxElement = createElement(doc, "div", {"class": elementMarkerClass}, [
    createElement(doc, "div", {"class": "ehh-border"}),
    createElement(doc, "div", {"class": "ehh-label"}, [
      createElement(doc, "span", {"class": "ehh-labelTag"}),
      createElement(doc, "span", {"class": "ehh-labelAddition"})
    ])
  ]);

  // Make sure to select some element immeditely (whichever is in the center of the browser window)
  let [wndWidth, wndHeight] = getWindowSize(wnd);
  state.isUserSelected = false;
  onMouseMove({clientX: wndWidth / 2, clientY: wndHeight / 2, screenX: -1, screenY: -1, target: null});

  messageManager.sendAsyncMessage("ElemHideHelper:SelectionStarted");
}

function stopSelection()
{
  if (!state.boxElement)
    return;

  hideSelection();

  let wnd = state.window;
  wnd.removeEventListener("click", onMouseClick, true);
  wnd.removeEventListener("wheel", onMouseScroll, true);
  wnd.removeEventListener("mousemove", onMouseMove, true);
  wnd.removeEventListener("pagehide", onPageHide, true);

  for (let key of Object.keys(state))
    delete state[key];

  messageManager.sendAsyncMessage("ElemHideHelper:SelectionStopped");
}
exports.stopSelection = stopSelection;

function canSelect(wnd)
{
  let acceptLocalFiles;
  try
  {
    let pref = "extensions.elemhidehelper.acceptlocalfiles";
    acceptLocalFiles = Services.prefs.getBoolPref(pref);
  }
  catch (e)
  {
    acceptLocalFiles = false;
  }

  if (!acceptLocalFiles)
  {
    let localSchemes;
    try
    {
      localSchemes = new Set(
        Services.prefs.getCharPref("extensions.adblockplus.whitelistschemes")
                      .split(/\s+/)
      );
    }
    catch (e)
    {
      localSchemes = new Set();
    }

    if (localSchemes.has(wnd.location.protocol.replace(/:$/, "")))
      return false;
  }

  return true;
}

function getElementLabel(elem)
{
  let tagName = elem.localName;
  let addition = "";
  if (elem.id != "")
    addition += ", id: " + elem.id;
  if (elem.className != "")
    addition += ", class: " + elem.className;
  if (elem.style.cssText != "")
    addition += ", style: " + elem.style.cssText;

  return [tagName, addition];
}

function setAnchorElement(anchor)
{
  state.anchorElement = anchor;

  let newSelection = anchor;
  if (state.isUserSelected)
  {
    // User chose an element via wider/narrower commands, keep the selection if
    // our new anchor is still a child of that element
    let e = newSelection;
    while (e && e != state.selectedElement)
      e = getParentElement(e);

    if (e)
      newSelection = state.selectedElement;
    else
      state.isUserSelected = false;
  }

  selectElement(newSelection);
}
exports.setAnchorElement = setAnchorElement;

function selectElement(elem)
{
  state.selectedElement = elem;
  state.prevSelectionUpdate = Date.now();

  let border = state.boxElement.querySelector(".ehh-border");
  let label = state.boxElement.querySelector(".ehh-label");
  let labelTag = state.boxElement.querySelector(".ehh-labelTag");
  let labelAddition = state.boxElement.querySelector(".ehh-labelAddition");

  let doc = state.window.document;
  let [wndWidth, wndHeight] = getWindowSize(state.window);

  let pos = getElementPosition(elem);
  state.boxElement.style.left = Math.min(pos.left - 1, wndWidth - 2) + "px";
  state.boxElement.style.top = Math.min(pos.top - 1, wndHeight - 2) + "px";
  border.style.width = Math.max(pos.right - pos.left - 2, 0) + "px";
  border.style.height = Math.max(pos.bottom - pos.top - 2, 0) + "px";

  [labelTag.textContent, labelAddition.textContent] = getElementLabel(elem);

  // If there is not enough space to show the label move it up a little
  if (pos.bottom < wndHeight - 25)
    label.className = "ehh-label";
  else
    label.className = "ehh-label onTop";

  doc.documentElement.appendChild(state.boxElement);

  state.prevPos = pos;
  state.window.addEventListener("MozAfterPaint", onAfterPaint, false);
}
exports.selectElement = selectElement;

function hideSelection()
{
  if (!Cu.isDeadWrapper(state.boxElement) && state.boxElement.parentNode)
    state.boxElement.parentNode.removeChild(state.boxElement);

  if (!Cu.isDeadWrapper(state.window))
    state.window.removeEventListener("MozAfterPaint", onAfterPaint, false);
}

/******************
 * Event handlers *
 ******************/

function onMouseClick(event)
{
  if (event.button != 0 || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey)
    return;

  require("./commands").select();
  event.preventDefault();
}

function onMouseScroll(event)
{
  if (!event.shiftKey || event.altKey || event.ctrlKey || event.metaKey)
    return;

  let delta = event.deltaY || event.deltaX;
  if (!delta)
    return;

  let commands = require("./commands");
  if (delta > 0)
    commands.wider();
  else
    commands.narrower();
  event.preventDefault();
}

function onMouseMove(event)
{
  hideSelection();

  let x = event.clientX;
  let y = event.clientY;

  // We might have coordinates relative to a frame, recalculate relative to top window
  let node = event.target;
  while (node && node.ownerDocument && node.ownerDocument.defaultView && node.ownerDocument.defaultView.frameElement)
  {
    node = node.ownerDocument.defaultView.frameElement;
    let rect = node.getBoundingClientRect();
    x += rect.left;
    y += rect.top;
  }

  // Get the element matching the coordinates, probably within a frame
  let elem = state.window.document.elementFromPoint(x, y);
  while (elem && "contentWindow" in elem && canSelect(elem.contentWindow))
  {
    let rect = elem.getBoundingClientRect();
    x -= rect.left;
    y -= rect.top;
    elem = elem.contentWindow.document.elementFromPoint(x, y);
  }

  if (elem)
  {
    if (!state.lockedAnchor)
      setAnchorElement(elem);
    else
    {
      state.lockedAnchor = elem;
      selectElement(state.selectedElement);
    }
  }
}

function onPageHide(event)
{
  stopSelection();
}

function onAfterPaint(event)
{
  // Don't update position too often
  if (state.selectedElement && Date.now() - state.prevSelectionUpdate > 20)
  {
    let pos = getElementPosition(state.selectedElement);
    if (!state.prevPos || state.prevPos.left != pos.left ||
        state.prevPos.right != pos.right || state.prevPos.top != pos.top ||
        state.prevPos.bottom != pos.bottom)
    {
      selectElement(state.selectedElement);
    }
  }
}
