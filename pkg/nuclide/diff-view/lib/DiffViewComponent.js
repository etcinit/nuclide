'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

var {CompositeDisposable} = require('atom');
var React = require('react-for-atom');
var {PropTypes} = React;

var DiffViewComponent = React.createClass({
  propTypes: {
    model: PropTypes.object.isRequired,
  },

  componentDidMount() {
    this._subscriptions = new CompositeDisposable();

    var DiffViewEditor = require('./DiffViewEditor');

    this._oldDiffEditor = new DiffViewEditor(this._getOldTextEditorElement());
    this._newDiffEditor = new DiffViewEditor(this._getNewTextEditorElement());

    // The first version of the diff view will have both editors readonly.
    // But later on, the right editor will be editable and savable.
    this._oldDiffEditor.setReadOnly();
    this._newDiffEditor.setReadOnly();

    var diffViewState = this.props.model.getDiffState();
    var {oldText, newText, filePath, uiComponents} = diffViewState;
    this._oldDiffEditor.setFileContents(filePath, oldText);
    this._newDiffEditor.setFileContents(filePath, newText);


    var SyncScroll = require('./SyncScroll');
    this._subscriptions.add(new SyncScroll(
        this._getOldTextEditorElement().getModel(),
        this._getNewTextEditorElement().getModel()
      )
    );

    this._inlineComponents = this._oldDiffEditor.renderComponentsInline(uiComponents);
  },

  _computeDiffLinesAndOffsets() {
    var {addedLines, removedLines, oldLineOffsets, newLineOffsets} =
        this.props.model.computeDiff(this._oldDiffEditor.getText(), this._newDiffEditor.getText());

    this._inlineComponents.forEach(element => {
      var domNode = React.findDOMNode(element.component);
      // get the height of the component after it has been rendered in the DOM
      var componentHeight = window.getComputedStyle(domNode).height;
      // "123px" -> 123
      componentHeight = Number(componentHeight.substring(0, componentHeight.length - 2));
      var lineHeight = this._oldDiffEditor.getLineHeightInPixels();
      // calculate the number of lines we need to insert in the buffer to make room
      // for the component to be displayed
      var offset = Math.ceil(componentHeight / lineHeight);
      var offsetRow = element.bufferRow;

      newLineOffsets[offsetRow] = (newLineOffsets[offsetRow] || 0) + offset;
      oldLineOffsets[offsetRow] = (oldLineOffsets[offsetRow] || 0) + offset;

      // TODO(gendron):
      // horrible hack! Set the width of the overlay so that it won't resize when we
      // type comment replies into the text editor.
      // Need to figure out how Atom computes and sets the overlay dimensions.
      var componentWidth = window.getComputedStyle(domNode).width;
      domNode.style.width = componentWidth;
    });

    return {
      addedLines,
      removedLines,
      newLineOffsets,
      oldLineOffsets,
    };
  },

  updateDiffMarkers() {
    var {addedLines, removedLines, newLineOffsets, oldLineOffsets} = this._computeDiffLinesAndOffsets();
    // Set the empty space offsets in the diff editors marking for no-matching diff section.
    this._newDiffEditor.setOffsets(newLineOffsets);
    this._oldDiffEditor.setOffsets(oldLineOffsets);

    // Set highlighted lines in the diff editors marking the added and deleted lines.
    // This trigges a redraw for the editor, hence being done after the offsets have been set.
    this._newDiffEditor.setHighlightedLines(addedLines, undefined);
    this._oldDiffEditor.setHighlightedLines(undefined, removedLines);
  },

  componentWillUnmount(): void {
    if (this._subscriptions) {
      this._subscriptions.dispose();
      this._subscriptions = null;
    }
  },

  render(): ReactElement {
    return (
      <div className='diff-view-component'>
        <div className='split-pane'>
          <div className='title'>
            <p>Original</p>
          </div>
          <atom-text-editor ref='old' style={{height: '100%'}} />
        </div>
        <div className='split-pane'>
          <div className='title'>
            <p>Changed</p>
          </div>
          <atom-text-editor ref='new' style={{height: '100%'}} />
        </div>
      </div>
    );
  },

  _getOldTextEditorElement(): TextEditorElement {
    return this.refs['old'].getDOMNode();
  },

  _getNewTextEditorElement(): TextEditorElement {
    return this.refs['new'].getDOMNode();
  },

});

module.exports = DiffViewComponent;
