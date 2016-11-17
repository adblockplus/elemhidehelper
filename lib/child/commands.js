/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

let messageManager = require("messageManager");
let {getNodeInfo} = require("./nodeInfo");
let {
  state, selectElement, setAnchorElement, stopSelection
} = require("./selection");
let {getParentElement} = require("./utils");

messageManager.addMessageListener("ElemHideHelper:Command", onCommand);

onShutdown.add(() =>
{
  messageManager.removeMessageListener("ElemHideHelper:Command", onCommand);
});

function onCommand(message)
{
  let command = message.data;
  if (typeof exports[command] == "function")
    exports[command]();
}

function quit()
{
  stopSelection();
}
exports.quit = quit;

function select()
{
  if (!state.selectedElement)
    return;

  messageManager.sendAsyncMessage(
    "ElemHideHelper:SelectionSucceeded",
    getNodeInfo(state.selectedElement)
  );
  stopSelection();
}
exports.select = select;

function wider()
{
  if (!state.selectedElement)
    return;

  let newElement = getParentElement(state.selectedElement);
  if (!newElement)
    return;

  state.isUserSelected = true;
  selectElement(newElement);
}
exports.wider = wider;

function narrower()
{
  if (!state.selectedElement)
    return;

  // Search selected element in the parent chain, starting with the ancho
  // element. We need to select the element just before the selected one.
  let e = state.anchorElement;
  let newElement = null;
  while (e && e != state.selectedElement)
  {
    newElement = e;
    e = getParentElement(e);
  }

  if (!e || !newElement)
    return;

  state.isUserSelected = true;
  selectElement(newElement);
}
exports.narrower = narrower;

function lock()
{
  if (!state.selectedElement)
    return;

  if (state.lockedAnchor)
  {
    setAnchorElement(state.lockedAnchor);
    state.lockedAnchor = null;
  }
  else
    state.lockedAnchor = state.anchorElement;
}
exports.lock = lock;

let blinkState = null;

function stopBlinking()
{
  blinkState.timer.cancel();
  if (!Cu.isDeadWrapper(blinkState.element))
    blinkState.element.style.visibility = blinkState.origVisibility;
  blinkState = null;
}

function doBlink()
{
  if (Cu.isDeadWrapper(blinkState.element))
  {
    stopBlinking();
    return;
  }

  blinkState.counter++;
  blinkState.element.style.setProperty(
    "visibility",
    (blinkState.counter % 2 == 0 ? "visible" : "hidden"),
    "important"
  );
  if (blinkState.counter == 6)
    stopBlinking();
}

function blinkElement()
{
  if (!state.selectedElement)
    return;

  if (blinkState)
    stopBlinking();

  blinkState = {
    counter: 0,
    element: state.selectedElement,
    origVisibility: state.selectedElement.style.visibility,
    timer: Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer)
  };

  blinkState.timer.initWithCallback(doBlink, 250,
      Ci.nsITimer.TYPE_REPEATING_SLACK);
}
exports.blinkElement = blinkElement;
