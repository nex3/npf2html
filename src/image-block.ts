import type {VisualMedia} from './media';
import type {Attribution} from './attribution';

/**
 * An NPF image type content block.
 *
 * @see https://www.tumblr.com/docs/npf#content-block-type-image
 */
export interface ImageBlock {
  type: 'image';

  /**
   * An array of {@link VisualMedia} objects which represent different available
   * sizes of this image asset.
   */
  media: VisualMedia[];

  /** Colors used in the image. */
  colors?: Record<string, string>;

  /** A feedback token to use when this image block is a GIF Search result. */
  feedback_token?: string;

  /**
   * For GIFs, this is a single-frame "poster".
   *
   * @see https://www.tumblr.com/docs/npf#gif-posters
   */
  poster?: VisualMedia;

  /** @see https://www.tumblr.com/docs/npf#attributions */
  attribution?: Attribution;

  /** Text used to describe the image, for screen readers. */
  alt_text?: string;

  /** A caption typically shown under the image. */
  caption?: string;
}
