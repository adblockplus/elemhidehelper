/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

/**
 * Element creation helper, allows defining attributes and child elements in one
 * go.
 * @param {Document} doc
 *   Document to create the element in
 * @param {string} tagName
 *   Tag name of the new element
 * @param {Object.<string, string>} [attrs]
 *   Attributes to set on the element
 * @param {Array.<Node>} [children]
 *   Child nodes to add to the element
 * @return {Element}
 *   Element that was created
 */
function createElement(doc, tagName, attrs, children)
{
  let el = doc.createElement(tagName);
  if (attrs)
    for (let key in attrs)
      el.setAttribute(key, attrs[key]);
  if (children)
    for (let child of children)
      el.appendChild(child)
  return el;
}
exports.createElement = createElement;

/**
 * Calculates the document size for a window.
 * @return {Array.<number>}
 *   Width and height of the document loaded into the window
 */
function getWindowSize(/**Window*/ wnd)
{
  return [wnd.innerWidth, wnd.document.documentElement.clientHeight];
}
exports.getWindowSize = getWindowSize;

/**
 * Determines the parent element for a document node, if any. Will ascend into
 * parent frames if necessary.
 */
function getParentElement(/**Node*/ elem) /**Element*/
{
  let result = elem.parentNode;
  if (result && result.nodeType == result.DOCUMENT_NODE && result.defaultView && result.defaultView.frameElement)
    result = result.defaultView.frameElement;

  if (result && result.nodeType != result.ELEMENT_NODE)
    return null;

  return result;
}
exports.getParentElement = getParentElement;

/**
 * Modifies a rectangle with coordinates relative to a window's client area
 * to make sure it doesn't exceed that client area.
 * @param {Object} rect
 *   Rectangle with properties left, top, right, bottom.
 * @param {Window} wnd
 *   Window to restrict the rectangle to.
 */
function intersectRect(rect, wnd)
{
  let [wndWidth, wndHeight] = getWindowSize(wnd);
  rect.left = Math.max(rect.left, 0);
  rect.top = Math.max(rect.top, 0);
  rect.right = Math.min(rect.right, wndWidth);
  rect.bottom = Math.min(rect.bottom, wndHeight);
}

/**
 * Calculates the element's position within the top frame. This will consider
 * the element being clipped by frame boundaries.
 * @return {Object}
 *   Object with properties left, top, width, height denoting the element's
 *   position and size within the top frame.
 */
function getElementPosition(/**Element*/ element)
{
  let rect = element.getBoundingClientRect();
  let wnd = element.ownerDocument.defaultView;

  rect = {left: rect.left, top: rect.top,
          right: rect.right, bottom: rect.bottom};
  while (true)
  {
    intersectRect(rect, wnd);

    if (!wnd.frameElement)
      break;

    // Recalculate coordinates to be relative to frame's parent window
    let frameElement = wnd.frameElement;
    wnd = frameElement.ownerDocument.defaultView;

    let frameRect = frameElement.getBoundingClientRect();
    let frameStyle = wnd.getComputedStyle(frameElement, null);
    let relLeft = frameRect.left + parseFloat(frameStyle.borderLeftWidth) + parseFloat(frameStyle.paddingLeft);
    let relTop = frameRect.top + parseFloat(frameStyle.borderTopWidth) + parseFloat(frameStyle.paddingTop);

    rect.left += relLeft;
    rect.right += relLeft;
    rect.top += relTop;
    rect.bottom += relTop;
  }

  return rect;
}
exports.getElementPosition = getElementPosition;
