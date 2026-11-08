import React from "react";
const paths = {
  cameras: "M2 6h7l2-3h4l2 3h5v15H2z M8 13a4 4 0 1 0 8 0 4 4 0 0 0-8 0 M18 9h1",
  profile: "M9 3h6l3 5-3 5H9L6 8z M3 22v-3l6-3h6l6 3v3z",
  containers: "M3 7 12 2l9 5v12l-9 4-9-4z M3 7l9 5 9-5 M12 12v11 M7 5l10 5",
  goals: "M4 22V3h15l-3 5 3 5H4 M8 18h12 M17 15l3 3-3 3",
  challenges:
    "M7 3h10v8l-5 5-5-5z M7 5H3v5l5 3 M17 5h4v5l-5 3 M12 16v5 M7 22h10",
  wrapped: "M3 8h18v14H3z M2 4h20v4H2z M12 4v18 M12 4 8 1H5v3 M12 4l4-3h3v3",
  more: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  home: "M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z",
  fridge: "M5 3h14v18H5z M5 10h14 M8 6v2 M8 13v4",
  meals: "M4 3v6a3 3 0 0 0 6 0V3 M7 3v18 M19 21V3c-5 3-5 10 0 10",
  list: "M9 6h12 M9 12h12 M9 18h12 M3 6l1 1 2-2 M3 12l1 1 2-2 M3 18l1 1 2-2",
  activity: "m3 12 4 0 3-8 4 16 3-8h4",
  plus: "M12 5v14 M5 12h14",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  leaf: "M20 3C7 2 2 9 6 16s16 3 14-13Z M5 21 16 9",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
  close: "m6 6 12 12 M6 18 18 6",
  check: "m5 12 4 4L19 6",
  clock: "M12 8v4l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  search: "M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  download: "M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5",
  trash: "M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7",
  heart: "M20 5c-3-3-6-1-8 1-2-2-5-4-8-1-5 5 3 11 8 16 5-5 13-11 8-16",
  bell: "M5 17h14l-2-3V9a5 5 0 0 0-10 0v5z M10 21h4",
  wifi: "M3 8c5-5 13-5 18 0 M6 12c3-3 9-3 12 0 M9 16c2-1 4-1 6 0 M12 20h.01",
};
export default function Icon({ name, size = 20, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.leaf} />
    </svg>
  );
}
