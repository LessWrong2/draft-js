/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule removeEntitiesAtEdges
 * @format
 * @flow
 */

'use strict';

import type {BlockNodeRecord} from 'BlockNodeRecord';
import type ContentState from 'ContentState';
import type {EntityMap} from 'EntityMap';
import type SelectionState from 'SelectionState';
import type {List} from 'immutable';

var CharacterMetadata = require('CharacterMetadata');

var findRangesImmutable = require('findRangesImmutable');
var invariant = require('invariant');

function removeEntitiesAtEdges(
  contentState: ContentState,
  selectionState: SelectionState,
): ContentState {
  var blockMap = contentState.getBlockMap();
  var entityMap = contentState.getEntityMap();

  var updatedBlocks = {};

  var startKey = selectionState.getStartKey();
  var startOffset = selectionState.getStartOffset();
  var startBlock = blockMap.get(startKey);
  var updatedStart = removeForBlock(entityMap, startBlock, startOffset);

  if (updatedStart !== startBlock) {
    updatedBlocks[startKey] = updatedStart;
  }

  var endKey = selectionState.getEndKey();
  var endOffset = selectionState.getEndOffset();
  var endBlock = blockMap.get(endKey);
  if (startKey === endKey) {
    endBlock = updatedStart;
  }

  var updatedEnd = removeForBlock(entityMap, endBlock, endOffset);

  if (updatedEnd !== endBlock) {
    updatedBlocks[endKey] = updatedEnd;
  }

  if (!Object.keys(updatedBlocks).length) {
    return contentState.set('selectionAfter', selectionState);
  }

  return contentState.merge({
    blockMap: blockMap.merge(updatedBlocks),
    selectionAfter: selectionState,
  });
}

/**
 * Given a list of characters and an offset that is in the middle of an entity,
 * returns the start and end of the entity that is overlapping the offset.
 * Note: This method requires that the offset be in an entity range.
 */
function getRemovalRange(
  characters: List<CharacterMetadata>,
  entityKey: ?string,
  offset: number,
): {
  start: number,
  end: number,
} {
  var removalRange;

  // Iterates through a list looking for ranges of matching items
  // based on the 'isEqual' callback.
  // Then instead of returning the result, call the 'found' callback
  // with each range.
  // Then filters those ranges based on the 'filter' callback
  //
  // Here we use it to find ranges of characters with the same entity key.
  findRangesImmutable(
    characters, // the list to iterate through
    (a, b) => a.getEntity() === b.getEntity(), // 'isEqual' callback
    element => element.getEntity() === entityKey, // 'filter' callback
    (start: number, end: number) => {
      // 'found' callback
      if (start <= offset && end >= offset) {
        // this entity overlaps the offset index
        removalRange = {start, end};
      }
    },
  );
  invariant(
    typeof removalRange === 'object',
    'Removal range must exist within character list.',
  );
  return removalRange;
}

function removeForBlock(
  entityMap: EntityMap,
  block: BlockNodeRecord,
  offset: number,
): BlockNodeRecord {
  var chars = block.getCharacterList();
  var charBefore = offset > 0 ? chars.get(offset - 1) : undefined;
  var charAfter = offset < chars.count() ? chars.get(offset) : undefined;
  var entityBeforeCursor = charBefore ? charBefore.getEntity() : undefined;
  var entityAfterCursor = charAfter ? charAfter.getEntity() : undefined;

  if (entityAfterCursor && entityAfterCursor === entityBeforeCursor) {
    var entity = entityMap.__get(entityAfterCursor);
    if (entity.getMutability() !== 'MUTABLE') {
      var {start, end} = getRemovalRange(chars, entityAfterCursor, offset);
      var current;
      while (start < end) {
        current = chars.get(start);
        chars = chars.set(start, CharacterMetadata.applyEntity(current, null));
        start++;
      }
      return block.set('characterList', chars);
    }
  }

  return block;
}

module.exports = removeEntitiesAtEdges;
