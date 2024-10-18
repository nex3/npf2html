import {AskLayout} from './ask-layout';
import {AudioBlock} from './audio-block';
import {ImageBlock} from './image-block';
import {LinkBlock} from './link-block';
import {Options} from './options';
import {PaywallBlock} from './paywall-block';
import {PollBlock} from './poll-block';
import {Renderer} from './renderer';
import {RowsDisplay, RowsLayout} from './rows-layout';
import {TextBlock, TextBlockIndented} from './text-block';
import {VideoBlock} from './video-block';

export {AskLayout} from './ask-layout';
export {
  Attribution,
  PostAttribution,
  Post,
  LinkAttribution,
  BlogAttribution,
  AppAttribution,
} from './attribution';
export {AudioBlock} from './audio-block';
export {BlogInfo} from './blog-info';
export {ImageBlock} from './image-block';
export {LinkBlock} from './link-block';
export {Media, VisualMedia} from './media';
export {Options} from './options';
export {PollAnswer, PollBlock, PollSettings} from './poll-block';
export {
  PaywallBlock,
  PaywallBlockCta,
  PaywallBlockDivider,
} from './paywall-block';
export {Renderer} from './renderer';
export {RowsDisplay, RowsLayout} from './rows-layout';
export {TextBlock, TextBlockNoIndent, TextBlockIndented} from './text-block';
export {
  InlineFormat,
  InlineFormatBasic,
  InlineFormatLink,
  InlineFormatMention,
  InlineFormatColor,
} from './inline-format';
export {VideoBlock, IFrame} from './video-block';

/**
 * A single discrete unit of content.
 *
 * @see https://www.tumblr.com/docs/npf#content-blocks
 *
 * @category Content
 */
export type ContentBlock =
  | AudioBlock
  | ImageBlock
  | LinkBlock
  | PaywallBlock
  | PollBlock
  | TextBlock
  | VideoBlock;

/**
 * A block of unknown type, not documented as part of the Tumblr API.
 *
 * @category Content
 */
export interface UnknownBlock extends Record<string, unknown> {
  /** The type of the block. */
  type: string;
}

/**
 * A layout indicating how to lay out contents blocks.
 *
 * @see https://www.tumblr.com/docs/npf#layout-blocks
 *
 * @category Layout
 */
export type Layout = AskLayout | RowsLayout;

/**
 * An interface for layouts that apply to specific adjacent groups of content
 * blocks that *aren't* just rendered as individual rows.
 */
interface LayoutGroup {
  /** The layout describing how to render this group. */
  layout: AskLayout | RowsDisplay;

  /** The inclusive block index on which the group starts. */
  start: number;

  /** The exclusive block index before which the group ends. */
  end: number;
}

/** Returns whether {@link block} is a {@link TextBlockIndented}. */
function isTextBlockIndented(block: ContentBlock): block is TextBlockIndented {
  return (
    block.type === 'text' &&
    (block.subtype === 'indented' ||
      block.subtype === 'ordered-list-item' ||
      block.subtype === 'unordered-list-item')
  );
}

/**
 * If {@link options} includes layouts, this returns a list of {@link
 * LayoutGroup}s that indicate non-default layouts, ordered by start index.
 *
 * This assumes that all {@link LayoutGroup}s are contiguous and
 * non-overlapping.
 */
function buildLayoutGroups(options?: Options): LayoutGroup[] {
  const result: Array<AskLayout | RowsDisplay> = [];
  for (const layout of options?.layout ?? []) {
    if (layout.type === 'ask') {
      result.push(layout);
    } else {
      for (const display of layout.display) {
        if (display.blocks.length === 1) continue;
        result.push(display);
      }
    }
  }

  return result
    .map(layout => ({
      layout,
      start: Math.min(...layout.blocks),
      end: Math.max(...layout.blocks) + 1,
    }))
    .sort((a, b) => a.start - b.start);
}

/**
 * Converts each NPF block in {@link blocks} to plain HTML and concatenates them
 * into a single string.
 *
 * @category Main
 */
export default function npf2html(
  blocks: ContentBlock[],
  options?: Options
): string {
  const renderer = options?.renderer ?? new Renderer(options);
  let result = '';

  const truncateAfter = options?.layout?.find(
    layout => layout.type === 'rows'
  )?.truncate_after;
  let truncateIndex: number | undefined;

  const layoutGroups = buildLayoutGroups(options);

  // HTML contents of the current `layoutGroup`, if there is one.
  let currentGroup = '';

  for (let i = 0; i < blocks.length; i++) {
    // Consumes all elements within a indented text block and renders them to a
    // string.
    const collectAndRenderIndented = (): string => {
      const first = blocks[i] as TextBlockIndented;
      const indentation = first.indent_level ?? 0;
      const blocksAndNested: [
        TextBlockIndented,
        ...Array<TextBlockIndented | string>,
      ] = [first];

      while (i < blocks.length - 1) {
        const sibling = blocks[i + 1];
        if (!isTextBlockIndented(sibling)) break;
        const siblingIndentation = sibling.indent_level ?? 0;
        if (siblingIndentation < indentation) break;
        if (siblingIndentation === indentation) {
          if (sibling.subtype !== first.subtype) break;
          i++;
          blocksAndNested.push(sibling);
        } else {
          i++;
          blocksAndNested.push(collectAndRenderIndented());
        }
      }

      return renderer.renderTextIndented(blocksAndNested);
    };

    let blockResult: string;
    const block = blocks[i];
    switch (block.type) {
      case 'audio':
        blockResult = renderer.renderAudio(block);
        break;

      case 'image':
        blockResult = renderer.renderImage(block);
        break;

      case 'link':
        blockResult = renderer.renderLink(block);
        break;

      case 'paywall':
        blockResult = renderer.renderPaywall(block);
        break;

      case 'poll':
        blockResult = renderer.renderPoll(block);
        break;

      case 'video':
        blockResult = renderer.renderVideo(block);
        break;

      case 'text':
        if (isTextBlockIndented(block)) {
          blockResult = collectAndRenderIndented();
        } else {
          blockResult = renderer.renderTextNoIndent(block);
        }
        break;

      default:
        blockResult = renderer.renderUnknown(block as UnknownBlock);
        break;
    }

    const group = layoutGroups[0];
    if (group && i >= group.start) {
      currentGroup += blockResult;

      if (i + 1 === group.end) {
        layoutGroups.shift();
        if ('type' in group.layout) {
          result += renderer.renderAskLayout(group.layout, currentGroup);
        } else {
          result += renderer.renderRowLayout(group.layout, currentGroup);
        }
        currentGroup = '';
      }
    } else {
      result += blockResult;
    }

    if (i === truncateAfter) {
      truncateIndex = result.length;
    }
  }

  if (truncateIndex !== undefined) {
    result =
      result.substring(0, truncateIndex) +
      renderer.renderTruncateLayout(result.substring(truncateIndex));
  }

  return result;
}
