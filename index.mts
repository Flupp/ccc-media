// -*- js-chain-indent: t; js-indent-level: 2; -*-
// kate: indent-width 2; replace-tabs true;
"use strict";

const EVENT_URL_PREFIX: string = "https://media.ccc.de/public/events/";
// const EVENT_URL_PREFIX: string = "prefetched-events/";


class FetchError extends Error { constructor(message: string) { super(message); } }

async function fetchJSON(resource: RequestInfo | URL): Promise<any> {
  const response = await fetch(resource);
  if (!response.ok) {
    throw new FetchError(`Response not OK: ${response.status} ${response.statusText}. URL: ${response.url}`);
  }
  return response.json();
}

// create element with attributes
function cewa
  <K extends keyof HTMLElementTagNameMap>
  ( tagName: K
  , attributes: {readonly [attr: string]: string} = {}
  , ...children: Node[]
  ) : HTMLElementTagNameMap[K]
{
  const element = document.createElement(tagName);
  for (const attr in attributes)
    element.setAttribute(attr, attributes[attr]);
  for (const child of children)
    element.appendChild(child);
  return element;
}

function ce
  <K extends keyof HTMLElementTagNameMap>
  ( tagName: K
  , ...children: Node[]
  ) : HTMLElementTagNameMap[K]
{
  return cewa(tagName, {}, ...children)
}

function tn(data: string): Text {
  return document.createTextNode(data);
}

// new no-break space text node
function nbsp(): Text {
  return document.createTextNode("\u00A0"/* no-break space */);
}

// new em space text node
function emsp(): Text {
  return document.createTextNode("\u2003"/* em space */);
}

function* intersperseBr<T>(iterable: Iterable<T>): Iterable<T | HTMLBRElement> {
  let notFirst = false;
  for (const i of iterable) {
    if (notFirst)
      yield(ce("br"));
    yield i;
    notFirst = true;
  }
}

function stars(n: number, max: number = 5): HTMLElement {
  return cewa("span", {"aria-label": `${n} out of ${max} stars.`, class: "stars"}, tn("★".repeat(n) + "☆".repeat(max - n)));
}

function divMod(dividend: number, divisor: number): [number, number] {
  return [Math.floor(dividend / divisor), dividend % divisor]
}

function pad0(n: number, length: number): string {
  const str = n.toString();
  return "0".repeat(Math.max(0, length - str.length)) + str;
}

function prettyDuration(durationSeconds: number): string {
  const [r, s] = divMod(durationSeconds, 60);
  const [h, m] = divMod(r, 60);
  return `${pad0(h, 2)}:${pad0(m, 2)}:${pad0(s, 2)}`
}


type CCCEvent
  = { guid: string
    , title: string
    , subtitle: string
    , description: string | null
    , persons: Array<string>
    , duration: number
    , thumb_url: string
    , timeline_url: string
    , frontend_link: string
    , conference_title: string
    }

async function loadDetails
  ( guid: string
  , nodeTitle: HTMLElement
  , nodeThumb: HTMLElement
  , nodeMeta: HTMLElement
  , nodeDescription: HTMLElement
  , nodeThumbFoot: HTMLElement
  ) : Promise<void>
{
  let e;
  try {
    e = await fetchJSON(EVENT_URL_PREFIX + guid) as CCCEvent;
  } catch (err) {
    if (err instanceof FetchError)
      console.warn(err.message);
    else
      console.error(err);
    return;
  }

  const title = cewa("a", {href: e.frontend_link}, cewa("span", {class: "title"}, tn(e.title)));
  if (e.subtitle) {
    // if (e.title.match(/\p{Punctuation}$/u))
    //   title.appendChild(cewa("span", {class: "separator"}, tn(" ")));
    // else if (!e.title.match(/\p{space}$/u))
    //   title.appendChild(cewa("span", {class: "separator"}, tn(" – ")));
    title.appendChild(cewa("span", {class: "separator"}, tn(" – ")));
    title.appendChild(cewa("span", {class: "subtitle"}, tn(e.subtitle)));
  }
  nodeTitle.replaceWith(title);

  nodeMeta.appendChild(ce
    ( "dl"
    ,         ce("dt", tn("by"))
    , nbsp(), ce("dd", tn(e.persons.join(", ")))
    , emsp(), ce("dt", tn("at"))
    , nbsp(), ce("dd", tn(e.conference_title))
    , emsp(), ce("dt", tn("duration"))
    , nbsp(), ce("dd", tn(prettyDuration(e.duration)))
    ));

  if (e.thumb_url)
    nodeThumb.replaceWith(cewa("img", {class: "thumb", src: e.thumb_url}));

  if (e.description)
    for (const par of e.description.split(/\r?\n\r?\n/))
      nodeDescription.appendChild(ce("p", ...intersperseBr(par.split(/\r?\n/).map(tn))));

  if (e.timeline_url) {
    const img = cewa("img", {src: e.timeline_url});
    const a = cewa("a", {href: e.frontend_link}, img);
    nodeThumbFoot.appendChild(a);
    // extract from e to keep closure small
    const frontend_link = e.frontend_link;
    const duration = e.duration;
    const updateTooltip = (mouseEvent: MouseEvent) => {
      // https://stackoverflow.com/a/42111623
      const r = img.getBoundingClientRect();
      const seconds = Math.floor(duration * (mouseEvent.clientX - r.left) / r.width);
      a.href = frontend_link + '#t=' + seconds;
    };
    img.addEventListener("mouseenter", updateTooltip);
    img.addEventListener("mousemove", updateTooltip);
    // const tooltiptext = cewa("span", { class: "tooltiptext"});
    // const tooltiptick = cewa("span", { class: "tooltiptick"});
    // nodeThumbFoot.appendChild(cewa("div", {class: "tooltip"}, img, tooltiptext, tooltiptick));
    // const updateTooltip = (mouseEvent: MouseEvent) => {
    //   // https://stackoverflow.com/a/42111623
    //   const tgt = mouseEvent.currentTarget;
    //   if (!(tgt instanceof Element)) return;
    //   const r = tgt.getBoundingClientRect();
    //   const seconds = Math.floor(duration * (mouseEvent.clientX - r.left) / r.width);
    //   tooltiptext.textContent = prettyDuration(seconds);
    //   tooltiptext.style.left = (100 * (mouseEvent.clientX - r.left) / r.width) + "%";
    //   // tooltiptext.style.left = (mouseEvent.clientX - r.left) + "px";
    // };
    // img.addEventListener("mouseenter", updateTooltip);
    // img.addEventListener("mousemove", updateTooltip);
  }
}


type DataEntry
  = { guid: string
    , rating: number
    , view_time: string
    , comment: string
    }

async function loadDynamicContent(dataFile: string): Promise<void> {
  const list = document.querySelector("main");
  if (!list)
    throw Error("Element id 'list' not found. DOM incomplete?");
  const promises = [];
  for (const i of await fetchJSON(dataFile) as DataEntry[]) {
    const nodeTitle = cewa("a", {href: "https://media.ccc.de/v/" + i.guid}, tn(i.guid));
    const nodeThumb = cewa("span", {class: "thumb"});
    const nodeMeta = ce("span");
    const nodeDescription = cewa("div", {class: "description"});
    const nodeThumbFoot = cewa("div", {class: "timeline"});
    list.append
      ( ce("h2", nodeTitle)
      , ce("p", stars(i.rating), tn(" "), tn(i.comment))
      , nodeThumb
      , nodeMeta
      , nodeDescription
      , cewa( "dl", {class: "misc"}
            ,         ce("dt", tn("watched"))
            , nbsp(), ce("dd", tn(i.view_time))
            , emsp(), ce("dt", tn("GUID"))
            , nbsp(), ce("dd", ce("samp", tn(i.guid)))
            )
      , nodeThumbFoot
      );
    promises.push(loadDetails(i.guid, nodeTitle, nodeThumb, nodeMeta, nodeDescription, nodeThumbFoot));
  }
  for (const p of promises) {
    try {
      await p;
    } catch (err) {
      console.log(err);
    }
  }
}


loadDynamicContent("data.json");
