'use strict';

var DragDropActionCreators = require('../actions/DragDropActionCreators'),
    NativeDragItemTypes = require('../constants/NativeDragItemTypes'),
    EnterLeaveMonitor = require('../utils/EnterLeaveMonitor'),
    isFileDragDropEvent = require('./isFileDragDropEvent'),
    shallowEqual = require('react/lib/shallowEqual'),
    union = require('lodash-node/modern/arrays/union'),
    without = require('lodash-node/modern/arrays/without'),
    isWebkit = require('./isWebkit'),
    isFirefox = require('./isFirefox');

// Store global state for browser-specific fixes and workarounds
var _monitor = new EnterLeaveMonitor(),
    _currentDragTarget,
    _initialDragTargetRect,
    _imitateCurrentDragEnd,
    _dragTargetRectDidChange,
    _lastDragSourceCheckTimeout;

function getElementRect(el) {
  var rect = el.getBoundingClientRect();
  // Copy so object doesn't get reused
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

function checkIfCurrentDragTargetRectChanged() {
  if (!_dragTargetRectDidChange) {
    var currentRect = getElementRect(_currentDragTarget);
    _dragTargetRectDidChange = !shallowEqual(_initialDragTargetRect, currentRect);
  }

  return _dragTargetRectDidChange;
}

function triggerDragEndIfDragSourceWasRemovedFromDOM() {
  if (_currentDragTarget &&
      _imitateCurrentDragEnd &&
      !document.contains(_currentDragTarget)) {

    _imitateCurrentDragEnd();
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('dragenter', function (e) {
    var isFirstEnter = _monitor.enter(e.target);

    if (isFirstEnter && isFileDragDropEvent(e)) {
      DragDropActionCreators.startDragging(NativeDragItemTypes.FILE, null);
    }
  });

  window.addEventListener('dragover', function (e) {
    if (!_currentDragTarget) {
      return;
    }

    if (isWebkit() && checkIfCurrentDragTargetRectChanged()) {
      // Prevent animating to incorrect position
      e.preventDefault();
    } else if (isFirefox()) {

      // Firefox won't trigger a global `drop` if source node was removed.
      // It won't trigger `mouseup` either. It *will* however trigger `dragover`
      // continually during drag, so our strategy is to simply wait until `dragover`
      // has stopped firing.

      clearTimeout(_lastDragSourceCheckTimeout);
      _lastDragSourceCheckTimeout = setTimeout(
        triggerDragEndIfDragSourceWasRemovedFromDOM,
        140 // 70 seems enough on OS X with FF33, double it to be sure
      );
    }
  });

  window.addEventListener('dragleave', function (e) {
    var isLastLeave = _monitor.leave(e.target);

    if (isLastLeave && isFileDragDropEvent(e)) {
      DragDropActionCreators.endDragging();
    }
  });

  window.addEventListener('drop', function (e) {
    _monitor.reset();

    if (isFileDragDropEvent(e)) {
      DragDropActionCreators.endDragging();
    } else if (!isFirefox()) {
      triggerDragEndIfDragSourceWasRemovedFromDOM();
    }
  });
}

var NativeDragDropSupport = {
  handleDragStart(dragTarget, imitateDragEnd) {
    _currentDragTarget = dragTarget;
    _initialDragTargetRect = getElementRect(dragTarget);
    _dragTargetRectDidChange = false;
    _imitateCurrentDragEnd = imitateDragEnd;
  },

  handleDragEnd() {
    _currentDragTarget = null;
    _initialDragTargetRect = null;
    _dragTargetRectDidChange = false;
    _imitateCurrentDragEnd = null;
  }
};

module.exports = NativeDragDropSupport;