import React from "react";

export function CaseStudyLazyImage({
  src,
  alt,
  priority = false,
  className = "",
  style,
}) {
  return (
    <img
      className={`cs-mockup-img${className ? ` ${className}` : ""}`}
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding={priority ? "sync" : "async"}
      style={style}
    />
  );
}
