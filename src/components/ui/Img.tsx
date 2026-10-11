import NextImage, { type ImageProps } from "next/image";

/**
 * next/image, but remote URLs (pasted in admin, e.g. https://…) skip the optimizer
 * so any image host works without editing next.config.ts.
 */
export default function Img(props: ImageProps) {
  const remote = typeof props.src === "string" && /^https?:\/\//.test(props.src);
  return <NextImage {...props} unoptimized={props.unoptimized ?? remote} />;
}
